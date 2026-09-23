import type { SupabaseClient } from '@supabase/supabase-js';
import { PIPELINE_STAGES } from '@/lib/projects/pipelineDefinition';
import type { PipelineCounts } from './types';

export const DASHBOARD_PIPELINE_COUNTS_SCOPE = 'open_enquiry_proposal_v1' as const;

export async function getDashboardPipelineCounts(supabase: SupabaseClient): Promise<PipelineCounts> {
  const { data, error } = await supabase.rpc('staff_dashboard_pipeline_counts_v1');
  if (error) throw new Error('Project journey counts are unavailable');
  if (!data || data.scope !== DASHBOARD_PIPELINE_COUNTS_SCOPE || !data.counts) {
    throw new Error('Project journey counts returned an unsupported scope');
  }
  const counts: PipelineCounts = {};
  for (const definition of PIPELINE_STAGES) {
    const stage = definition.key.toUpperCase();
    const value = data.counts[stage];
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
      throw new Error('Project journey counts returned an invalid count');
    }
    counts[stage] = value;
  }
  return counts;
}
