import 'server-only';

import { estimateFlowStateFor, loadProjectEstimateFlowMaps } from '@/lib/estimates/flow';
import { buildVersionLabelMap, mapEstimateMeta } from '@/lib/estimates/server';
import type { EstimateMeta } from '@/lib/estimates/types';
import { uuidFromAppId } from '@/lib/supabase/mappers';
import { getSupabaseServerAuth } from '@/lib/supabase/serverClient';

type EstimateMetaRow = {
  id: string;
  project_id: string;
  commercial_scope_id: string | null;
  internal_name: string | null;
  created_at: string | null;
  status: string | null;
  created_by: string | null;
  summary_json: unknown;
  summary: unknown;
  outputs: unknown;
  warnings: unknown;
  costing_manifest: string | null;
  costing_rules: string | null;
  total_true_cost_ex_gst: number | null;
  total_true_cost_inc_gst: number | null;
};

export async function loadProjectEstimateMetas(projectId: string): Promise<EstimateMeta[]> {
  const projectUuid = uuidFromAppId(projectId, 'proj');
  const supabase = await getSupabaseServerAuth();
  const res = await supabase
    .from('estimates')
    .select(
      'id, project_id, commercial_scope_id, internal_name, created_at, status, created_by, summary_json, summary, outputs, warnings, costing_manifest, costing_rules, total_true_cost_ex_gst, total_true_cost_inc_gst',
    )
    .eq('project_id', projectUuid)
    .order('created_at', { ascending: false });

  if (res.error) throw res.error;

  const rows = (Array.isArray(res.data) ? res.data : []) as EstimateMetaRow[];
  const versionLabels = buildVersionLabelMap(rows);
  const flowMaps = await loadProjectEstimateFlowMaps(projectUuid, rows, supabase);

  return rows.map((row) => {
    const estimateUuid = String(row?.id ?? '');
    const versionLabel = versionLabels.get(estimateUuid) ?? 'V-';
    return mapEstimateMeta(
      {
        ...row,
        ...estimateFlowStateFor(flowMaps.flowByEstimateId, estimateUuid),
      },
      versionLabel,
    );
  });
}
