import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { SavedVisitsResult } from './savedVisitsContract';
import { reviewedVisit } from './reviewedVisit';

/** Both callers must verify current staff access before using their cookie-bound client. */
export async function readSavedVisits(supabase: SupabaseClient, params: URLSearchParams): Promise<SavedVisitsResult> {
  const invalid = (message: string): SavedVisitsResult => ({ ok: false, status: 400, message });
  if ([...params.keys()].some(key => !['project', 'visit'].includes(key) || params.getAll(key).length > 1)) {
    return invalid('Invalid calendar query');
  }
  const project = params.get('project')?.replace(/^proj_/, '') ?? null;
  if (project !== null && !z.uuid().safeParse(project).success) return invalid('Invalid project');
  const visit = params.get('visit');
  if (visit !== null && !z.uuid().safeParse(visit).success) return invalid('Invalid visit');
  try {
    const result = visit
      ? await supabase.rpc('outlook_site_visit_detail_read', { p_visit: visit, p_project: project })
      : await supabase.rpc('outlook_site_visits_read', { p_project: project });
    if (result.error) return { ok: false, status: result.error.code === '42501' ? 403 : 503, message: 'Site visits could not be loaded.' };
    return { ok: true, data: {
      ...result.data,
      events: (result.data?.events ?? []).map(reviewedVisit),
      enabled: Boolean(result.data?.enabled) && process.env.SANCTUARY_OUTLOOK_ENABLED === 'true',
    } };
  } catch {
    return { ok: false, status: 503, message: 'Site visits could not be loaded.' };
  }
}
