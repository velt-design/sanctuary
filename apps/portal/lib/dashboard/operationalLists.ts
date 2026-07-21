import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { calculateStaffCustomerPriceFromCostEx } from '@/lib/quotes/pricing';
import { appIdFromUuid } from '@/lib/supabase/mappers';
import type { DashboardNewLead, DashboardRecentEstimate } from './types';

const NEW_LEAD_COLUMNS = 'id,name,site_address,created_at,contact:contacts(name)';
const RECENT_ESTIMATE_COLUMNS =
  'id,project_id,status,version,total_true_cost_ex_gst,created_at,updated_at,projects!inner(id,name,archived_at)';

type NamedRelation = { name?: string | null } | Array<{ name?: string | null }> | null;

type NewLeadRow = {
  id?: string | null;
  name?: string | null;
  site_address?: string | null;
  created_at?: string | null;
  contact?: NamedRelation;
};

type RecentEstimateRow = {
  id?: string | null;
  project_id?: string | null;
  status?: string | null;
  version?: number | string | null;
  total_true_cost_ex_gst?: number | string | null;
  created_at?: string | null;
  updated_at?: string | null;
  projects?: (NamedRelation & { archived_at?: string | null }) | null;
};

function trimmedString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function relationName(value: NamedRelation | undefined): string | null {
  const relation = Array.isArray(value) ? value[0] : value;
  return trimmedString(relation?.name);
}

function finiteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string' || !value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function projectEstimateHref(projectId: string, estimateId: string): string {
  return `/staff/projects/${encodeURIComponent(projectId)}?tab=estimates&estimateId=${encodeURIComponent(estimateId)}`;
}

export async function listDashboardNewLeads(
  client: SupabaseClient,
  limit = 5,
): Promise<DashboardNewLead[]> {
  const safeLimit = Math.max(1, Math.min(12, Math.floor(limit)));
  const { data, error } = await client
    .from('projects')
    .select(NEW_LEAD_COLUMNS)
    .eq('pipeline_stage', 'NEW')
    .is('archived_at', null)
    .order('created_at', { ascending: true })
    .limit(safeLimit);

  if (error) throw new Error(error.message ?? 'Failed to load new leads.');

  return (Array.isArray(data) ? data : []).flatMap((raw) => {
    const row = raw as NewLeadRow;
    const projectUuid = trimmedString(row.id);
    const createdAt = trimmedString(row.created_at);
    if (!projectUuid || !createdAt) return [];
    const projectId = appIdFromUuid('proj', projectUuid);
    return [{
      projectId,
      projectName: trimmedString(row.name) ?? 'Untitled project',
      contactName: relationName(row.contact),
      siteAddress: trimmedString(row.site_address),
      createdAt,
      href: `/staff/projects/${encodeURIComponent(projectId)}`,
    }];
  });
}

export async function listDashboardRecentEstimates(
  client: SupabaseClient,
  limit = 5,
): Promise<DashboardRecentEstimate[]> {
  const safeLimit = Math.max(1, Math.min(12, Math.floor(limit)));
  const { data, error } = await client
    .from('estimates')
    .select(RECENT_ESTIMATE_COLUMNS)
    .eq('status', 'draft')
    .is('projects.archived_at', null)
    .order('updated_at', { ascending: false })
    .limit(safeLimit);

  if (error) throw new Error(error.message ?? 'Failed to load recent estimates.');

  return (Array.isArray(data) ? data : []).flatMap((raw) => {
    const row = raw as RecentEstimateRow;
    const estimateUuid = trimmedString(row.id);
    const projectUuid = trimmedString(row.project_id);
    const updatedAt = trimmedString(row.updated_at) ?? trimmedString(row.created_at);
    if (!estimateUuid || !projectUuid || !updatedAt) return [];

    const projectId = appIdFromUuid('proj', projectUuid);
    const estimateId = appIdFromUuid('est', estimateUuid);
    const version = finiteNumber(row.version);
    const customerPrice = calculateStaffCustomerPriceFromCostEx(finiteNumber(row.total_true_cost_ex_gst));

    return [{
      estimateId,
      projectId,
      projectName: relationName(row.projects) ?? 'Untitled project',
      versionLabel: version === null ? 'V-' : `V${Math.max(1, Math.floor(version))}`,
      status: 'draft' as const,
      customerPriceIncGst: customerPrice?.incGst ?? null,
      updatedAt,
      href: projectEstimateHref(projectId, estimateId),
    }];
  });
}
