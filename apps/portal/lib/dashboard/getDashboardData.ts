import type { SupabaseClient } from '@supabase/supabase-js';
import type { DashboardData, QueueMode } from './types';
import { assembleDashboard, dashboardSnapshotPart, dashboardPartNames, type DashboardParts, type SnapshotData } from './dashboardParts';
import { getDashboardSnapshotCached } from './getDashboardSnapshotCached';
import { supabaseServiceRole } from '@/lib/supabaseClient';
import { listRecentProjectNoteActivity } from './activity';
import { listVisibleDashboardTasks } from './tasks';
import { listDashboardRecentEstimates } from './operationalLists';
import { getProjectWorkQueue } from '@/lib/projects/workItems/repository';
import { getProjectOperationalStateCounts } from '@/lib/projects/workItems/stateCounts';
import { DASHBOARD_PIPELINE_COUNTS_SCOPE, getDashboardPipelineCounts } from './pipelineCounts';

type DashboardReadOptions = { queueMode: QueueMode; userId?: string | null; supabase?: SupabaseClient | null };
export type DashboardPartReads = { [K in keyof DashboardParts]: Promise<DashboardParts[K]> };
/** One request owns exactly the existing seven reads. JSON and progressive readers share these promises. */
export function startDashboardRead(opts: DashboardReadOptions): DashboardPartReads {
  const reads = {
    snapshot: (getDashboardSnapshotCached(opts.queueMode) as Promise<SnapshotData>).then(dashboardSnapshotPart),
    recentEstimates: listDashboardRecentEstimates(supabaseServiceRole).then(recentEstimates => ({recentEstimates})),
    recentActivity: listRecentProjectNoteActivity(supabaseServiceRole, 8).then(recentActivity => ({recentActivity})),
    personalTasks: (opts.userId ? listVisibleDashboardTasks(supabaseServiceRole, opts.userId) : Promise.resolve([])).then(personalTasks => ({personalTasks})),
    projectWorkQueue: (opts.supabase ? getProjectWorkQueue(opts.supabase, {limit:5}).catch(()=>null) : Promise.resolve(null)).then(value => ({projectWorkQueue:value?.entries??[], projectWorkQueueAvailable:value!==null})),
    projectStateCounts: (opts.supabase ? getProjectOperationalStateCounts(opts.supabase).catch(()=>null) : Promise.resolve(null)).then(value => ({projectStateCounts:value??undefined, projectStateCountsAvailable:value!==null})),
    pipelineCounts: (opts.supabase ? getDashboardPipelineCounts(opts.supabase).catch(()=>null) : Promise.resolve(null)).then(value => ({pipelineCounts:value??{},pipelineCountsAvailable:value!==null,pipelineCountsScope:DASHBOARD_PIPELINE_COUNTS_SCOPE})),
  } satisfies DashboardPartReads;
  // A caller may consume the parts separately; every started rejection is still observed.
  for (const read of Object.values(reads)) void read.catch(()=>{});
  return reads;
}
export async function finishDashboardRead(reads: DashboardPartReads): Promise<DashboardData> {
  const values=await Promise.all(dashboardPartNames.map(name=>reads[name]));
  return assembleDashboard(Object.fromEntries(dashboardPartNames.map((name,index)=>[name,values[index]])) as DashboardParts);
}
export async function getDashboardData(opts: DashboardReadOptions): Promise<DashboardData> {
  return finishDashboardRead(startDashboardRead(opts));
}
