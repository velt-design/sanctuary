import { consumeReadParts, READ_PARTS_MEDIA_TYPE } from '@/lib/api/readParts';
import { ApiError } from '@/lib/repo/apiClient';
import { assembleDashboard, dashboardPartNames, DASHBOARD_READ_MAX_BYTES, type DashboardParts } from './dashboardParts';
import type { QueueMode } from './types';

const record = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const strings = (value: unknown, keys: readonly string[]) => record(value) && keys.every(key=>typeof value[key]==='string');
const number = (value: unknown) => typeof value==='number'&&Number.isFinite(value);
const nullableString = (value: unknown) => value===null||value===undefined||typeof value==='string';
function validDashboardPart(name: keyof DashboardParts, value: unknown): boolean {
  if (!record(value)) return false;
  switch(name){
    case 'snapshot': return typeof value.updatedAtIso==='string' && record(value.kpis) && ['newLeads','quotesToSend','installsThisWeek'].every(key=>number((value.kpis as Record<string,unknown>)[key])) && record(value.schedule) && Array.isArray(value.schedule.startingSoon) && value.schedule.startingSoon.every(item=>strings(item,['startDate','crewName','projectId','projectName'])) && Array.isArray(value.schedule.crewAvailability) && value.schedule.crewAvailability.every(item=>strings(item,['crewName'])) && strings(value.schedule,['hrefBoard','hrefGantt']) && record(value.siteVisits) && number(value.siteVisits.unscheduledCount) && ['today','next7'].every(key=>{const items=(value.siteVisits as Record<string,unknown>)[key];return Array.isArray(items)&&items.every(item=>strings(item,['id','startsAt']));}) && strings(value.siteVisits,['hrefSiteVisits']);
    case 'recentEstimates': return Array.isArray(value.recentEstimates)&&value.recentEstimates.every(item=>strings(item,['estimateId','projectId','projectName','versionLabel','updatedAt','href'])&&item.status==='draft'&&(item.customerPriceIncGst===null||number(item.customerPriceIncGst)));
    case 'recentActivity': return Array.isArray(value.recentActivity)&&value.recentActivity.every(item=>strings(item,['id','at','body','projectId','projectName','href'])&&item.type==='project_note'&&nullableString(item.authorDisplayName)&&nullableString(item.authorEmail));
    case 'personalTasks': return Array.isArray(value.personalTasks)&&value.personalTasks.every(item=>strings(item,['id','title','createdAt','updatedAt'])&&nullableString(item.completedAt));
    case 'projectWorkQueue': return typeof value.projectWorkQueueAvailable==='boolean' && Array.isArray(value.projectWorkQueue)&&value.projectWorkQueue.every(item=>strings(item,['projectId','projectName','stage','group','actionKind','title','reason','href'])&&nullableString(item.dueAt)&&record(item.effectiveAssignee));
    case 'projectStateCounts': return typeof value.projectStateCountsAvailable==='boolean' && (!value.projectStateCountsAvailable || (record(value.projectStateCounts) && ['ACTIVE','WAITING','CLOSED','ARCHIVED','totalCount'].every(key=>typeof (value.projectStateCounts as Record<string,unknown>)[key]==='number')));
    case 'pipelineCounts': return typeof value.pipelineCountsAvailable==='boolean' && record(value.pipelineCounts) && value.pipelineCountsScope==='open_enquiry_proposal_v1' && Object.values(value.pipelineCounts).every(count=>typeof count==='number' && Number.isInteger(count) && count>=0);
  }
}
export class DashboardIncompleteReadError extends Error {
  constructor(readonly failedParts: readonly (keyof DashboardParts)[]){super('Some Dashboard sections could not load.');this.name='DashboardIncompleteReadError';}
}
export type DashboardPartLoader = (queue: QueueMode, signal: AbortSignal, publish: (parts: Partial<DashboardParts>)=>void) => Promise<ReturnType<typeof assembleDashboard>>;
export const readDashboardParts: DashboardPartLoader = (queue,signal,publish)=>readDashboardPartsFrom(`/api/dashboard?queue=${encodeURIComponent(queue)}`,queue,signal,publish);
export async function readDashboardPartsFrom(path:string,queue:QueueMode,signal:AbortSignal,publish:Parameters<DashboardPartLoader>[2]) {
  await Promise.resolve();
  if(signal.aborted)throw new DOMException('Read cancelled','AbortError');
  const response=await fetch(path,{signal,credentials:'same-origin',cache:'no-store',headers:{Accept:READ_PARTS_MEDIA_TYPE}});
  if(!response.ok){
    throw new ApiError('Dashboard read is unavailable.',{status:response.status,body:null});
  }
  if(response.headers.get('content-type')?.split(';')[0]!==READ_PARTS_MEDIA_TYPE) throw new Error('Invalid Dashboard response type.');
  const parts: Partial<DashboardParts>={};
  let done=false;
  const failed=new Set<keyof DashboardParts>();
  await consumeReadParts(response,signal,DASHBOARD_READ_MAX_BYTES,frame=>{
    if(!record(frame) || done)throw new Error('Invalid Dashboard read frame.');
    if('error' in frame && !('part' in frame)) throw new ApiError(typeof frame.error==='string'?frame.error:'Dashboard read failed.',{status:typeof frame.status==='number'?frame.status:500,body:null});
    if(frame.done===true){
      if(frame.queue!==queue || dashboardPartNames.some(name=>!(name in parts)&&!failed.has(name)))throw new Error('Incomplete Dashboard read.');
      done=true;return;
    }
    const name=frame.part as keyof DashboardParts;
    if(frame.queue!==queue || !dashboardPartNames.includes(name) || name in parts || failed.has(name))throw new Error('Invalid Dashboard part.');
    if('error' in frame){
      if(typeof frame.error!=='string'||typeof frame.status!=='number')throw new Error('Invalid Dashboard failure.');
      if(frame.status===401||frame.status===403)throw new ApiError(frame.error,{status:frame.status,body:null});
      failed.add(name);return;
    }
    if(!validDashboardPart(name,frame.value))throw new Error('Invalid Dashboard part.');
    Object.assign(parts,{[name]:frame.value});
    publish({...parts});
  });
  if(!done)throw new Error('Incomplete Dashboard read.');
  if(failed.size)throw new DashboardIncompleteReadError([...failed]);
  return assembleDashboard(parts as DashboardParts);
};
