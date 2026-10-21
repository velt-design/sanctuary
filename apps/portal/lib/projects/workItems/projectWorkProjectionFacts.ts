import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { getProjectWorkReadContext, type ProjectWorkReadContext } from './projectWorkReadContext';

export type ProjectWorkRow = Record<string, unknown>;
export type ProjectWorkProjectionFacts = Readonly<{
  readContext: ProjectWorkReadContext;
  stateRows: ProjectWorkRow[];
  itemRows: ProjectWorkRow[];
  confirmationRows: ProjectWorkRow[];
}>;

function rows(value: unknown): ProjectWorkRow[] {
  return Array.isArray(value) ? value.filter((entry): entry is ProjectWorkRow => Boolean(entry && typeof entry === 'object')) : [];
}

async function queryRows(
  query: PromiseLike<{
    data: unknown;
    error: { message?: string; code?: string } | null;
  }>,
  fallback: string,
): Promise<ProjectWorkRow[]> {
  const result = await query;
  if (result.error) throw Object.assign(new Error(result.error.message ?? fallback), result.error);
  return rows(result.data);
}

/** Load only after this request has established the visible project and V2 model. */
export async function loadProjectWorkProjectionFacts(params: {
  supabase: SupabaseClient;
  projectUuid: string;
  readContext: ProjectWorkReadContext;
}): Promise<ProjectWorkProjectionFacts> {
  const readContext = await getProjectWorkReadContext(params);
  if (!readContext || readContext.modelVersion !== 2) throw new Error('Project work facts require a visible V2 project');
  const { supabase, projectUuid } = params;
  const [stateRows, itemRows, confirmationRows] = await Promise.all([
    queryRows(
      supabase
        .from('project_operational_states')
        .select('state,waiting_until,waiting_reason,closed_outcome,row_version')
        .eq('project_id', projectUuid)
        .limit(1),
      'Failed to load project operational state',
    ),
    queryRows(
      supabase
        .from('project_work_items')
        .select(
          'id,project_id,title,responsibility_area,status,due_at,sla_breach_at,deadline_policy,calendar_revision,assignee_user_id,priority,priority_reason,blocked_reason,origin,source_type,source_key,series_key,subject_kind,subject_id,row_version,created_at,updated_at,completed_at,cancelled_at,outcome,cancellation_reason',
        )
        .eq('project_id', projectUuid)
        .in('status', ['OPEN', 'BLOCKED'])
        .order('due_at', { ascending: true }),
      'Failed to load project work items',
    ),
    queryRows(
      supabase
        .from('project_confirmation_events')
        .select('id,event_kind,confirmation_type,subject_kind,subject_id,occurred_at,recorded_at,retracts_event_id')
        .eq('project_id', projectUuid)
        .order('recorded_at', { ascending: false })
        .limit(100),
      'Failed to load project confirmation facts',
    ),
  ]);
  return { readContext, stateRows, itemRows, confirmationRows };
}
