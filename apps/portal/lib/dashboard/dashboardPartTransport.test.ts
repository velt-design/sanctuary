import {describe,expect,it,vi,afterEach} from 'vitest';
import {readDashboardParts} from './dashboardPartTransport';
import {assembleDashboard, dashboardPartNames,type DashboardParts} from './dashboardParts';
import {dashboardFixture} from '@/app/qa/portal-progressive-fixture/data';
import {consumeReadParts,readPartsResponse} from '@/lib/api/readParts';

export function fixtureParts():DashboardParts{
  const data=dashboardFixture();
  return {snapshot:{updatedAtIso:data.updatedAtIso,kpis:data.kpis,schedule:data.schedule,siteVisits:data.siteVisits},recentEstimates:{recentEstimates:data.recentEstimates},recentActivity:{recentActivity:data.recentActivity},personalTasks:{personalTasks:data.personalTasks},projectWorkQueue:{projectWorkQueue:data.projectWorkQueue,projectWorkQueueAvailable:data.projectWorkQueueAvailable},projectStateCounts:{projectStateCounts:data.projectStateCounts,projectStateCountsAvailable:data.projectStateCountsAvailable},pipelineCounts:{pipelineCounts:data.pipelineCounts,pipelineCountsScope:data.pipelineCountsScope,pipelineCountsAvailable:data.pipelineCountsAvailable}};
}
const jsonResponse=(frames:unknown[])=>new Response(frames.map(frame=>JSON.stringify(frame)+'\n').join(''),{headers:{'content-type':'application/x-ndjson'}});
afterEach(()=>vi.unstubAllGlobals());
describe('Dashboard part transport',()=>{
  it('publishes independent complete values once and reconstructs the exact JSON result without repeated final payload',async()=>{
    const parts=fixtureParts(),published:Partial<DashboardParts>[]=[];
    const frames=[...dashboardPartNames.map(part=>({part,queue:'today',value:parts[part]})),{done:true,queue:'today'}];
    vi.stubGlobal('fetch',vi.fn(async()=>jsonResponse(frames)));
    expect(await readDashboardParts('today',new AbortController().signal,value=>published.push(value))).toEqual(assembleDashboard(parts));
    expect(published).toHaveLength(7);expect(published[0]).toEqual({snapshot:parts.snapshot});
    expect(Object.keys(published[6])).toHaveLength(7);
    const overhead=new TextEncoder().encode(frames.map(frame=>JSON.stringify(frame)+'\n').join('')).length-new TextEncoder().encode(JSON.stringify(assembleDashboard(parts))).length;
    expect(overhead).toBeGreaterThan(0);expect(overhead).toBeLessThan(1024);
  });
  it.each(['truncated','duplicate','wrong selection','malformed','early done','after done','denied'] as const)('rejects %s rather than completing partial figures',async kind=>{
    const first={part:'pipelineCounts',queue:'today',value:fixtureParts().pipelineCounts};
    const frames:unknown[]=[first];
    if(kind==='duplicate')frames.push(first);
    if(kind==='wrong selection')frames[0]={...first,queue:'next7'};
    if(kind==='malformed')frames[0]={...first,value:[]};
    if(kind==='early done')frames.push({done:true,queue:'today'});
    if(kind==='after done')frames.splice(0,frames.length,...dashboardPartNames.map(part=>({part,queue:'today',value:fixtureParts()[part]})),{done:true,queue:'today'},first);
    if(kind==='denied')frames.push({error:'Access ended',status:403});
    vi.stubGlobal('fetch',vi.fn(async()=>jsonResponse(frames)));
    await expect(readDashboardParts('today',new AbortController().signal,()=>{})).rejects.toThrow();
  });
  it('cancels delivery while every already-started source settles and enforces one overall byte budget',async()=>{
    let settle!:()=>void;const pending=new Promise<void>(resolve=>{settle=resolve;});let aborted=false;
    const request=new Request('http://localhost/api/dashboard');
    const response=readPartsResponse(request,async(emit,signal)=>{signal.addEventListener('abort',()=>{aborted=true;});emit({part:'first'});await pending;emit({done:true});},100);
    const reader=response.body!.getReader();await reader.read();await reader.cancel();expect(aborted).toBe(true);settle();
    const oversized=readPartsResponse(request,async emit=>{emit({value:'12345'});emit({value:'12345'});},25);
    await expect(consumeReadParts(oversized,new AbortController().signal,25,()=>{})).rejects.toThrow();
  });
});
