import 'server-only';

import { supabaseServiceRole } from '@/lib/supabaseClient';
import { appIdFromUuid } from '@/lib/supabase/mappers';
import { buildVersionLabelMap } from '@/lib/estimates/server';
import type { Estimate } from '@/lib/types/estimate';
import { missingTableError, nowIso, schemaMissingError } from './serverHelpers';

type QuoteSourceEstimate = Estimate & {
  pricingSource: unknown;
  pricingSourceMetadata: unknown;
};

export async function loadEstimateLabels(projectUuid: string): Promise<Map<string, string>> {
  const res = await supabaseServiceRole
    .from('estimates')
    .select('id, created_at, outputs')
    .eq('project_id', projectUuid)
    .order('created_at', { ascending: false });

  if (res.error) {
    if (missingTableError(res.error)) return new Map();
    return new Map();
  }
  return buildVersionLabelMap(Array.isArray(res.data) ? res.data : []);
}

export async function loadProjectCustomerName(projectUuid: string): Promise<string | null> {
  const res = await supabaseServiceRole
    .from('projects')
    .select('contacts ( name )')
    .eq('id', projectUuid)
    .maybeSingle();

  if (res.error || !res.data) return null;

  const row = res.data as any;
  const contactRow = Array.isArray(row?.contacts) ? row.contacts[0] : row?.contacts ?? null;
  const customerName = typeof contactRow?.name === 'string' ? contactRow.name.trim() : '';
  return customerName || null;
}

export async function loadEstimate(estimateUuid: string): Promise<QuoteSourceEstimate | null> {
  const res = await supabaseServiceRole
    .from('estimates')
    .select('id, project_id, created_at, updated_at, status, inputs, outputs, warnings, pricing_source, pricing_source_metadata')
    .eq('id', estimateUuid)
    .maybeSingle();
  if (res.error) {
    if (missingTableError(res.error)) throw schemaMissingError();
    return null;
  }
  if (!res.data) return null;

  const row = res.data as any;
  return {
    id: appIdFromUuid('est', String(row.id ?? '')),
    projectId: appIdFromUuid('proj', String(row.project_id ?? '')),
    createdAt: typeof row.created_at === 'string' ? row.created_at : nowIso(),
    updatedAt: typeof row.updated_at === 'string' ? row.updated_at : undefined,
    status: String(row.status ?? 'draft') as any,
    inputs: row.inputs ?? {},
    derived: (row.outputs as any)?.derived ?? {},
    outputs: {
      materials: (row.outputs as any)?.materials ?? { lines: [], totals: { materials_ex_gst: 0 } },
      install: (row.outputs as any)?.install ?? { actions: [], totals: { crew_minutes: 0, crew_hours: 0, install_ex_gst: 0 } },
      overhead: (row.outputs as any)?.overhead ?? { total_ex_gst: 0 },
      totals: (row.outputs as any)?.totals ?? { cost_ex_gst: 0, cost_inc_gst: 0, warnings: [], notes_and_warnings: [] },
      warnings: Array.isArray(row.warnings) ? row.warnings : [],
      cost_snapshot_version: (row.outputs as any)?.cost_snapshot_version === 'v2' ? 'v2' : 'v1',
      pergolas: Array.isArray((row.outputs as any)?.pergolas) ? (row.outputs as any).pergolas : undefined,
      siteShared:
        (row.outputs as any)?.siteShared && typeof (row.outputs as any).siteShared === 'object'
          ? (row.outputs as any).siteShared
          : (row.outputs as any)?.shared && typeof (row.outputs as any).shared === 'object'
            ? (row.outputs as any).shared
            : undefined,
      shared:
        (row.outputs as any)?.shared && typeof (row.outputs as any).shared === 'object'
          ? (row.outputs as any).shared
          : (row.outputs as any)?.siteShared && typeof (row.outputs as any).siteShared === 'object'
            ? (row.outputs as any).siteShared
            : undefined,
    },
    configVersions: (row.outputs as any)?.configVersions ?? {
      pricebook: '',
      installActions: '',
      overheads: '',
      rules: '',
      manifest: '',
    },
    pricingSource: row.pricing_source,
    pricingSourceMetadata: row.pricing_source_metadata,
  } as QuoteSourceEstimate;
}
