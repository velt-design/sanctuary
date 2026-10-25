import { dashboardPartsResponse } from '@/lib/dashboard/dashboardPartResponse.server';
import { dashboardPartNames, type DashboardParts } from '@/lib/dashboard/dashboardParts';
import type { DashboardPartReads } from '@/lib/dashboard/getDashboardData';
import { parseDashboardQueueMode } from '@/lib/dashboard/queueMode';
import { dashboardFixture } from '../data';
export async function GET(request:Request){
  if(process.env.ENABLE_PORTAL_QA_FIXTURES?.trim()!=='1'||(process.env.NODE_ENV==='production'&&process.env.VERCEL_ENV!=='preview'))return new Response(null,{status:404});
  const params=new URL(request.url).searchParams, queue=parseDashboardQueueMode(params.get('queue'));
  return dashboardPartsResponse(request,queue,()=>{
    const data=dashboardFixture();
    const values:DashboardParts={snapshot:{updatedAtIso:data.updatedAtIso,kpis:data.kpis,schedule:data.schedule,siteVisits:data.siteVisits},pipelineCounts:{pipelineCounts:data.pipelineCounts,pipelineCountsScope:data.pipelineCountsScope,pipelineCountsAvailable:data.pipelineCountsAvailable},projectStateCounts:{projectStateCounts:data.projectStateCounts,projectStateCountsAvailable:data.projectStateCountsAvailable},projectWorkQueue:{projectWorkQueue:data.projectWorkQueue,projectWorkQueueAvailable:data.projectWorkQueueAvailable},recentEstimates:{recentEstimates:data.recentEstimates},recentActivity:{recentActivity:data.recentActivity},personalTasks:{personalTasks:data.personalTasks}};
    const delays={pipelineCounts:350,projectStateCounts:600,personalTasks:900,projectWorkQueue:1200,recentEstimates:1400,recentActivity:1800,snapshot:2200};
    return Object.fromEntries(dashboardPartNames.map(name=>[name,new Promise((resolve,reject)=>setTimeout(()=>{if(params.get('failure')==='1'&&name==='snapshot')reject(new Error('Synthetic snapshot failure'));else resolve(values[name]);},delays[name]))])) as DashboardPartReads;
  });
}
