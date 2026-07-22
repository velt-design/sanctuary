import 'server-only';

import type { SupabaseClient, User } from '@supabase/supabase-js';
import { uuidFromAppId } from '@/lib/supabase/mappers';
import type {
  EstimateActualCostInput,
  EstimateActualCostRecord,
  EstimateActualCostValues,
  EstimateCostCalibrationComparison,
} from './types';

type AnyRecord = Record<string, unknown>;

function record(value: unknown): AnyRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as AnyRecord : null;
}

function numberAt(source: unknown, path: string[]): number | null {
  let cursor: unknown = source;
  for (const key of path) cursor = record(cursor)?.[key];
  const parsed = typeof cursor === 'number' ? cursor : Number.parseFloat(String(cursor ?? ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function optionalNonNegative(value: unknown): number | null | 'invalid' {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value));
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) / 100 : 'invalid';
}

export function parseEstimateActualCostInput(value: unknown): EstimateActualCostInput | null {
  const source = record(value);
  if (!source) return null;
  const keys = ['materialsExGst', 'installExGst', 'overheadExGst', 'travelExGst', 'extrasExGst', 'crewHours'] as const;
  const parsed = Object.fromEntries(keys.map((key) => [key, optionalNonNegative(source[key])])) as Record<typeof keys[number], number | null | 'invalid'>;
  if (keys.some((key) => parsed[key] === 'invalid')) return null;
  const notes = typeof source.notes === 'string' ? source.notes.trim().slice(0, 2000) : '';
  return {
    materialsExGst: parsed.materialsExGst as number | null,
    installExGst: parsed.installExGst as number | null,
    overheadExGst: parsed.overheadExGst as number | null,
    travelExGst: parsed.travelExGst as number | null,
    extrasExGst: parsed.extrasExGst as number | null,
    crewHours: parsed.crewHours as number | null,
    notes,
    isComplete: source.isComplete === true,
  };
}

function mapActual(row: AnyRecord | null, estimateId: string): EstimateActualCostRecord | null {
  if (!row) return null;
  return {
    estimateId,
    materialsExGst: numberAt(row, ['materials_ex_gst']),
    installExGst: numberAt(row, ['install_ex_gst']),
    overheadExGst: numberAt(row, ['overhead_ex_gst']),
    travelExGst: numberAt(row, ['travel_ex_gst']),
    extrasExGst: numberAt(row, ['extras_ex_gst']),
    crewHours: numberAt(row, ['crew_hours']),
    notes: typeof row.notes === 'string' ? row.notes : '',
    isComplete: row.is_complete === true,
    updatedAt: typeof row.updated_at === 'string' ? row.updated_at : '',
    updatedByEmail: typeof row.updated_by_email === 'string' ? row.updated_by_email : '',
  };
}

function difference(actual: number | null, estimated: number | null): number | null {
  return actual === null || estimated === null ? null : Math.round((actual - estimated) * 100) / 100;
}

function actualTotalExGst(actual: EstimateActualCostRecord | null): number | null {
  if (!actual) return null;
  const required = [actual.materialsExGst, actual.installExGst, actual.overheadExGst];
  if (required.some((value) => value === null)) return null;
  return Math.round((
    (actual.materialsExGst ?? 0)
    + (actual.installExGst ?? 0)
    + (actual.overheadExGst ?? 0)
    + (actual.travelExGst ?? 0)
    + (actual.extrasExGst ?? 0)
  ) * 100) / 100;
}

export function buildEstimateCostCalibrationComparison(
  estimateId: string,
  estimateRow: AnyRecord,
  actualRow: AnyRecord | null,
): EstimateCostCalibrationComparison {
  const outputs = record(estimateRow.outputs) ?? {};
  const inputs = record(estimateRow.inputs) ?? {};
  const estimated: EstimateActualCostValues & { totalExGst: number | null } = {
    materialsExGst: numberAt(outputs, ['materials', 'totals', 'materials_ex_gst']),
    installExGst: numberAt(outputs, ['install', 'totals', 'install_ex_gst']),
    overheadExGst: numberAt(outputs, ['overhead', 'total_ex_gst']),
    travelExGst:
      numberAt(outputs, ['shared', 'add_ons', 'travel_ex_gst'])
      ?? numberAt(inputs, ['travelExGst']),
    extrasExGst:
      numberAt(outputs, ['shared', 'add_ons', 'extras_allowance_ex_gst'])
      ?? numberAt(inputs, ['extrasAllowanceExGst']),
    crewHours: numberAt(outputs, ['install', 'totals', 'crew_hours']),
    totalExGst: numberAt(outputs, ['totals', 'cost_ex_gst']),
  };
  const actual = mapActual(actualRow, estimateId);
  const actualTotal = actualTotalExGst(actual);
  return {
    estimated,
    actual,
    variance: {
      materialsExGst: difference(actual?.materialsExGst ?? null, estimated.materialsExGst),
      installExGst: difference(actual?.installExGst ?? null, estimated.installExGst),
      overheadExGst: difference(actual?.overheadExGst ?? null, estimated.overheadExGst),
      travelExGst: difference(actual?.travelExGst ?? null, estimated.travelExGst),
      extrasExGst: difference(actual?.extrasExGst ?? null, estimated.extrasExGst),
      crewHours: difference(actual?.crewHours ?? null, estimated.crewHours),
      totalExGst: difference(actualTotal, estimated.totalExGst),
    },
  };
}

async function loadEstimateRow(supabase: SupabaseClient, estimateUuid: string) {
  return supabase.from('estimates').select('id, inputs, outputs').eq('id', estimateUuid).maybeSingle();
}

export async function loadEstimateCostCalibration(supabase: SupabaseClient, estimateId: string) {
  const estimateUuid = uuidFromAppId(estimateId, 'est');
  const estimateRes = await loadEstimateRow(supabase, estimateUuid);
  if (estimateRes.error) return { error: 'load_failed' as const };
  if (!estimateRes.data) return { error: 'not_found' as const };
  const actualRes = await supabase.from('estimate_cost_actuals').select('*').eq('estimate_id', estimateUuid).maybeSingle();
  if (actualRes.error) return { error: 'load_failed' as const };
  return { comparison: buildEstimateCostCalibrationComparison(estimateId, estimateRes.data as AnyRecord, actualRes.data as AnyRecord | null) };
}

export async function saveEstimateCostActuals(
  supabase: SupabaseClient,
  estimateId: string,
  user: User,
  input: EstimateActualCostInput,
) {
  const estimateUuid = uuidFromAppId(estimateId, 'est');
  const estimateRes = await loadEstimateRow(supabase, estimateUuid);
  if (estimateRes.error) return { error: 'save_failed' as const };
  if (!estimateRes.data) return { error: 'not_found' as const };
  const now = new Date().toISOString();
  const payload = {
    estimate_id: estimateUuid,
    materials_ex_gst: input.materialsExGst,
    install_ex_gst: input.installExGst,
    overhead_ex_gst: input.overheadExGst,
    travel_ex_gst: input.travelExGst,
    extras_ex_gst: input.extrasExGst,
    crew_hours: input.crewHours,
    notes: input.notes || null,
    is_complete: input.isComplete,
    updated_by: user.id,
    updated_by_email: user.email ?? '',
    updated_at: now,
  };
  const saveRes = await supabase.from('estimate_cost_actuals').upsert(payload, { onConflict: 'estimate_id' }).select('*').single();
  if (saveRes.error || !saveRes.data) return { error: 'save_failed' as const };
  return { comparison: buildEstimateCostCalibrationComparison(estimateId, estimateRes.data as AnyRecord, saveRes.data as AnyRecord) };
}
