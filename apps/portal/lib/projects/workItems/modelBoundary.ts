import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchRowsByIdChunks } from '../../list/listLimits';

type ProjectWorkModelVersionRow = {
  project_id: string;
  model_version: number;
};

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

  const rows = await fetchRowsByIdChunks<ProjectWorkModelVersionRow>(
    ids,
    (chunkIds) => client
      .from('project_work_model_versions')
      .select('project_id,model_version')
      .in('project_id', chunkIds)
      .eq('model_version', 2),
  );
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
