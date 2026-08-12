import 'server-only';

import { supabaseServiceRole } from '@/lib/supabaseClient';
import { appIdFromUuid } from '@/lib/supabase/mappers';
import { buildVersionLabelMap } from '@/lib/estimates/server';
import type { Estimate } from '@/lib/types/estimate';
import { missingTableError, nowIso, schemaMissingError } from './serverHelpers';

type QuoteSourceEstimate = Estimate & {
  pricingSource: unknown;
  pricingSourceMetadata: unknown;
  commercialScopeId: string | null;
};

export function mapQuoteSourceEstimateRow(row: any): QuoteSourceEstimate {
  const outputs = row.outputs && typeof row.outputs === 'object' ? row.outputs : {};
  return {
    id: appIdFromUuid('est', String(row.id ?? '')),
    projectId: appIdFromUuid('proj', String(row.project_id ?? '')),
    createdAt: typeof row.created_at === 'string' ? row.created_at : nowIso(),
    updatedAt: typeof row.updated_at === 'string' ? row.updated_at : undefined,
    status: String(row.status ?? 'draft') as any,
    inputs: row.inputs ?? {},
    derived: outputs.derived ?? {},
    outputs: {
      materials: outputs.materials ?? { lines: [], totals: { materials_ex_gst: 0 } },
      install: outputs.install ?? { actions: [], totals: { crew_minutes: 0, crew_hours: 0, install_ex_gst: 0 } },
      overhead: outputs.overhead ?? { total_ex_gst: 0 },
      totals: outputs.totals ?? { cost_ex_gst: 0, cost_inc_gst: 0, warnings: [], notes_and_warnings: [] },
      warnings: Array.isArray(row.warnings) ? row.warnings : [],
      cost_snapshot_version: outputs.cost_snapshot_version === 'v2' ? 'v2' : 'v1',
      pergolas: Array.isArray(outputs.pergolas) ? outputs.pergolas : undefined,
      siteShared:
        outputs.siteShared && typeof outputs.siteShared === 'object'
          ? outputs.siteShared
          : outputs.shared && typeof outputs.shared === 'object'
            ? outputs.shared
            : undefined,
      shared:
        outputs.shared && typeof outputs.shared === 'object'
          ? outputs.shared
          : outputs.siteShared && typeof outputs.siteShared === 'object'
            ? outputs.siteShared
            : undefined,
      pricing_policy: outputs.pricing_policy,
      customer_add_ons: outputs.customer_add_ons,
      standalone_infills: outputs.standalone_infills,
      additional_aluminium: outputs.additional_aluminium,
    },
    configVersions: outputs.configVersions ?? {
      pricebook: '',
      installActions: '',
      overheads: '',
      rules: '',
      manifest: '',
    },
    pricingSource: row.pricing_source,
    pricingSourceMetadata: row.pricing_source_metadata,
    commercialScopeId: typeof row.commercial_scope_id === 'string' ? row.commercial_scope_id : null,
  } as QuoteSourceEstimate;
}

export function loadQuoteFamilyByCommercialScope(projectUuid: string, commercialScopeId: string | null) {
  const query = supabaseServiceRole
    .from('quotes')
    .select('id, quote_ref, internal_name, commercial_scope_id')
    .eq('project_id', projectUuid);
  return commercialScopeId
    ? query.eq('commercial_scope_id', commercialScopeId).maybeSingle()
    : query.is('commercial_scope_id', null).maybeSingle();
}

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
    .select('id, project_id, commercial_scope_id, created_at, updated_at, status, inputs, outputs, warnings, pricing_source, pricing_source_metadata')
    .eq('id', estimateUuid)
    .maybeSingle();
  if (res.error) {
    if (missingTableError(res.error)) throw schemaMissingError();
    return null;
  }
  if (!res.data) return null;

  return mapQuoteSourceEstimateRow(res.data as any);
}
