import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { estimateFlowStateFor, loadProjectEstimateFlowMaps } from '@/lib/estimates/flow';
import { buildVersionLabelMap, loadEstimateEditability, mapEstimateDetail } from '@/lib/estimates/server';
import type { EstimateDetail } from '@/lib/estimates/types';
import { uuidFromAppId } from '@/lib/supabase/mappers';
import { getSupabaseServerAuth } from '@/lib/supabase/serverClient';

export async function resolveEstimateVersionLabels(
  supabase: SupabaseClient,
  projectUuid: string,
  signal?: AbortSignal,
): Promise<Map<string, string>> {
  signal?.throwIfAborted();
  const query = supabase
    .from('estimates')
    // Keep the original outputs.version numeric JSON value, without transferring
    // every calculator snapshot or falling back to the physical version column.
    .select('id, created_at, version:outputs->version')
    .eq('project_id', projectUuid)
    .order('created_at', { ascending: false });
  const res = await (signal ? query.abortSignal(signal) : query);
  signal?.throwIfAborted();

  if (res.error) throw res.error;

  const rows = Array.isArray(res.data) ? res.data : [];
  return buildVersionLabelMap(rows);
}

export async function resolveEstimateVersionLabel(
  supabase: SupabaseClient,
  projectUuid: string,
  estimateUuid: string,
  signal?: AbortSignal,
): Promise<string> {
  return (await resolveEstimateVersionLabels(supabase, projectUuid, signal)).get(estimateUuid) ?? 'V-';
}

export async function loadProjectEstimateDetail(projectId: string, estimateId: string): Promise<EstimateDetail | null> {
  let projectUuid: string;
  let estimateUuid: string;

  try {
    projectUuid = uuidFromAppId(projectId, 'proj');
    estimateUuid = uuidFromAppId(estimateId, 'est');
  } catch {
    return null;
  }

  const supabase = await getSupabaseServerAuth();
  const res = await supabase.from('estimates').select('*').eq('id', estimateUuid).eq('project_id', projectUuid).maybeSingle();

  if (res.error) throw res.error;
  if (!res.data) return null;

  const [versionLabel, flowMaps] = await Promise.all([
    resolveEstimateVersionLabel(supabase, projectUuid, estimateUuid),
    loadProjectEstimateFlowMaps(projectUuid, undefined, supabase),
  ]);

  const editability = flowMaps.editabilityByEstimateId.get(estimateUuid) ?? (await loadEstimateEditability(estimateUuid));

  return mapEstimateDetail(res.data, versionLabel, editability, estimateFlowStateFor(flowMaps.flowByEstimateId, estimateUuid));
}
