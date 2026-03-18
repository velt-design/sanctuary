import 'server-only';

import { getCostingConfigWithOverrides } from '@/lib/costing/overrides';
import { supabaseServer } from '@/lib/supabaseClient';
import { normalizePowdercoatProfile, normalizePowdercoatStoredRow } from './powdercoating';
import type { JobPackPowdercoatOption, JobPackPowdercoatOverrideState, JobPackPowdercoatStoredRow } from './types';

const POWDERCOATING_SHEET_KEY = 'powdercoating-order';

function emptyState(): JobPackPowdercoatOverrideState {
  return { version: null, rows: [] };
}

export function isMissingSchemaError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const code = typeof (error as any).code === 'string' ? (error as any).code.trim() : '';
  const message = typeof (error as any).message === 'string' ? (error as any).message.toLowerCase() : '';
  return code === 'PGRST204' || code === '42703' || message.includes('does not exist') || message.includes('missing');
}

export async function estimateExists(estimateUuid: string): Promise<boolean> {
  const res = await supabaseServer.from('estimates').select('id').eq('id', estimateUuid).maybeSingle();
  if (res.error) throw res.error;
  return Boolean(res.data?.id);
}

export async function loadPowdercoatOverrideState(estimateUuid: string): Promise<JobPackPowdercoatOverrideState> {
  const res = await supabaseServer
    .from('job_pack_sheet_overrides')
    .select('payload_json, updated_at')
    .eq('estimate_id', estimateUuid)
    .eq('sheet_key', POWDERCOATING_SHEET_KEY)
    .maybeSingle();

  if (res.error) throw res.error;
  if (!res.data) return emptyState();

  const rowsRaw =
    res.data.payload_json && typeof res.data.payload_json === 'object' && Array.isArray((res.data.payload_json as any).rows)
      ? (res.data.payload_json as any).rows
      : [];

  const rows = rowsRaw
    .map(normalizePowdercoatStoredRow)
    .filter((row: JobPackPowdercoatStoredRow | null): row is JobPackPowdercoatStoredRow => Boolean(row));
  return {
    version: typeof res.data.updated_at === 'string' ? res.data.updated_at : null,
    rows,
  };
}

export async function listPowdercoatProfileOptions(): Promise<JobPackPowdercoatOption[]> {
  const { config } = await getCostingConfigWithOverrides();
  const grouped = new Map<string, { profile: string; stockLengthsM: Set<number> }>();

  for (const item of config.materials.items) {
    if (item.category !== 'aluminium_extrusion' || item.unit !== 'bar') continue;
    const attrs = item.attributes as Record<string, unknown> | null | undefined;
    const rawProfile = typeof attrs?.profile === 'string' ? attrs.profile : '';
    const rawLength = typeof attrs?.length_m === 'number' && Number.isFinite(attrs.length_m) ? attrs.length_m : null;
    const profile = normalizePowdercoatProfile(rawProfile);
    if (!profile || rawLength === null) continue;

    const existing = grouped.get(profile) ?? { profile, stockLengthsM: new Set<number>() };
    existing.stockLengthsM.add(Math.round(rawLength * 1000) / 1000);
    grouped.set(profile, existing);
  }

  return Array.from(grouped.values())
    .map((item) => ({
      profile: item.profile,
      stockLengthsM: Array.from(item.stockLengthsM.values()).sort((left, right) => left - right),
    }))
    .sort((left, right) => left.profile.localeCompare(right.profile));
}

export async function savePowdercoatOverrideState(input: {
  estimateUuid: string;
  expectedVersion: string | null;
  rows: JobPackPowdercoatStoredRow[];
  updatedBy: string | null;
}): Promise<{ ok: true; overrides: JobPackPowdercoatOverrideState } | { ok: false; current: JobPackPowdercoatOverrideState }> {
  const current = await loadPowdercoatOverrideState(input.estimateUuid);
  if ((current.version ?? null) !== (input.expectedVersion ?? null)) {
    return { ok: false, current };
  }

  if (!input.rows.length) {
    const deleteRes = await supabaseServer
      .from('job_pack_sheet_overrides')
      .delete()
      .eq('estimate_id', input.estimateUuid)
      .eq('sheet_key', POWDERCOATING_SHEET_KEY);
    if (deleteRes.error) throw deleteRes.error;
    return { ok: true, overrides: emptyState() };
  }

  const upsertRes = await supabaseServer
    .from('job_pack_sheet_overrides')
    .upsert(
      {
        estimate_id: input.estimateUuid,
        sheet_key: POWDERCOATING_SHEET_KEY,
        payload_json: { rows: input.rows },
        updated_by: input.updatedBy,
      } as any,
      { onConflict: 'estimate_id,sheet_key' },
    )
    .select('payload_json, updated_at')
    .single();

  if (upsertRes.error) throw upsertRes.error;

  const rowsRaw =
    upsertRes.data.payload_json && typeof upsertRes.data.payload_json === 'object' && Array.isArray((upsertRes.data.payload_json as any).rows)
      ? (upsertRes.data.payload_json as any).rows
      : [];

  return {
    ok: true,
    overrides: {
      version: typeof upsertRes.data.updated_at === 'string' ? upsertRes.data.updated_at : null,
      rows: rowsRaw
        .map(normalizePowdercoatStoredRow)
        .filter((row: JobPackPowdercoatStoredRow | null): row is JobPackPowdercoatStoredRow => Boolean(row)),
    },
  };
}
