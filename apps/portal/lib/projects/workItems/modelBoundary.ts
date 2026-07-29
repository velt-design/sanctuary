import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchRowsByIdChunks } from '../../list/listLimits';

type ProjectWorkModelVersionRow = {
  project_id: string;
  model_version: number;
};

let reportedPreRolloutCompatibility = false;

function isMissingMarkerSchema(error: unknown): boolean {
  const candidate =
    error && typeof error === 'object'
      ? error as { code?: unknown; message?: unknown }
      : null;
  const code = typeof candidate?.code === 'string' ? candidate.code : '';
  const message = typeof candidate?.message === 'string'
    ? candidate.message.toLowerCase()
    : '';

  return (
    (code === '42P01' || code === 'PGRST205')
    && message.includes('project_work_model_versions')
    && (
      message.includes('does not exist')
      || message.includes('schema cache')
      || message.includes('could not find the table')
    )
  );
}

function reportPreRolloutCompatibility(error: unknown) {
  if (reportedPreRolloutCompatibility) return;
  reportedPreRolloutCompatibility = true;
  const code =
    error && typeof error === 'object' && typeof (error as { code?: unknown }).code === 'string'
      ? (error as { code: string }).code
      : 'UNKNOWN';
  console.warn(
    '[project_work] V2 marker schema is unavailable; using pre-rollout legacy compatibility.',
    { code },
  );
}

export async function getProjectWorkModelV2Ids(
  client: SupabaseClient,
  projectIds: readonly string[],
): Promise<Set<string>> {
  const ids = Array.from(new Set(
    projectIds
      .map((projectId) => projectId.trim())
      .filter(Boolean),
  ));
  if (!ids.length) return new Set();

  let rows: ProjectWorkModelVersionRow[];
  try {
    rows = await fetchRowsByIdChunks<ProjectWorkModelVersionRow>(
      ids,
      (chunkIds) => client
        .from('project_work_model_versions')
        .select('project_id,model_version')
        .in('project_id', chunkIds)
        .eq('model_version', 2),
    );
  } catch (error) {
    // This is the explicit expand-before-migrate bridge. Production remains
    // wholly legacy until the marker table is deployed, so mixed-model
    // readers must continue to work against that schema. Only the exact
    // missing-marker condition is tolerated; auth, network and other schema
    // failures still propagate. V2-only RPCs remain unavailable/fail closed.
    if (!isMissingMarkerSchema(error)) throw error;
    reportPreRolloutCompatibility(error);
    return new Set();
  }
  return new Set(
    rows
      .filter((row) => row.model_version === 2 && typeof row.project_id === 'string')
      .map((row) => row.project_id),
  );
}

export async function isProjectWorkModelV2(
  client: SupabaseClient,
  projectId: string,
): Promise<boolean> {
  return (await getProjectWorkModelV2Ids(client, [projectId])).has(projectId);
}
