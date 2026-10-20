import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { appIdFromUuid, uuidFromAppId } from '@/lib/supabase/mappers';
import type { ProjectStatusFacts } from '@/lib/projects/projectCurrentStatus';
import { PROJECT_CLOSED_OUTCOMES, type ProjectClosedOutcome } from '@/lib/projects/workItems/types';
import { PORTAL_SEARCH_GROUP_LIMIT } from './portalSearchContract';

type Relation = Record<string, unknown> | Record<string, unknown>[] | null;
function one(value: Relation): Record<string, unknown> | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

/** One RLS-bound read for the ranked results, never a per-project aggregate or portfolio scan. */
export async function projectSearchStatuses(client: SupabaseClient, projectIds: string[]) {
  const ids = [...new Set(projectIds)].slice(0, PORTAL_SEARCH_GROUP_LIMIT).map((id) => uuidFromAppId(id, 'proj'));
  const statuses = new Map<string, ProjectStatusFacts>();
  if (!ids.length) return statuses;
  const { data, error } = await client.from('projects')
    .select('id,archived_at,project_work_model_versions(model_version),project_operational_states(state,closed_outcome)')
    .in('id', ids);
  if (error) throw error;
  for (const row of data ?? []) {
    const model = one(row.project_work_model_versions as Relation);
    const state = one(row.project_operational_states as Relation);
    const effectiveState = row.archived_at ? 'ARCHIVED'
      : ['ACTIVE', 'WAITING', 'CLOSED'].includes(String(state?.state)) ? state!.state as ProjectStatusFacts['effectiveState'] : null;
    const outcome = state?.closed_outcome;
    statuses.set(appIdFromUuid('proj', row.id), {
      workModel: model?.model_version === 2 ? 'v2' : model?.model_version === 1 ? 'legacy' : 'unknown',
      effectiveState,
      closedOutcome: PROJECT_CLOSED_OUTCOMES.includes(outcome as ProjectClosedOutcome) ? outcome as ProjectClosedOutcome : null,
    });
  }
  return statuses;
}
