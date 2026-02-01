import type { SiteVisitStatus } from '@/lib/types/siteVisits';
import { getSupabaseBrowser, supabaseHostFromUrl, supabaseRuntimeUrl } from '@/lib/supabase/browserClient';
import { appIdFromUuid, uuidFromAppId } from '@/lib/supabase/mappers';

function hostSuffix(): string {
  const host = supabaseHostFromUrl(supabaseRuntimeUrl());
  return host ? ` (host: ${host})` : '';
}

export type SiteVisitEventForProject = {
  id: string; // app id (sv_)
  projectId: string; // app id (proj_)
  status: SiteVisitStatus;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  salespersonId: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export async function getSiteVisitEventForProject(projectId: string): Promise<SiteVisitEventForProject | null> {
  const supabase = getSupabaseBrowser();
  const projectUuid = uuidFromAppId(projectId, 'proj');
  const { data, error } = await supabase.from('site_visit_events').select('*').eq('project_id', projectUuid).maybeSingle();
  if (error) throw new Error(`Failed to load site visit${hostSuffix()}`);
  if (!data) return null;

  const row: any = data;
  return {
    id: appIdFromUuid('sv', String(row.id ?? '')),
    projectId,
    status: String(row.status ?? 'UNSCHEDULED') as SiteVisitStatus,
    scheduledStart: typeof row.scheduled_start === 'string' ? row.scheduled_start : null,
    scheduledEnd: typeof row.scheduled_end === 'string' ? row.scheduled_end : null,
    salespersonId: typeof row.assigned_sales_owner_id === 'string' ? row.assigned_sales_owner_id : null,
    notes: typeof row.notes === 'string' ? row.notes : null,
    createdAt: typeof row.created_at === 'string' ? row.created_at : '',
    updatedAt: typeof row.updated_at === 'string' ? row.updated_at : '',
  };
}

