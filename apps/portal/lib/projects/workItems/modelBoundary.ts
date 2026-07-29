import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

export async function isProjectWorkModelV2(
  client: SupabaseClient,
  projectId: string,
): Promise<boolean> {
  const result = await client
    .from('project_work_model_versions')
    .select('model_version')
    .eq('project_id', projectId)
    .maybeSingle();
  if (result.error) throw result.error;
  return (result.data as { model_version?: unknown } | null)?.model_version === 2;
}
