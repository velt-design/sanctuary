import 'server-only';
import { readPartsResponse } from '@/lib/api/readParts';
import { dashboardPartNames, DASHBOARD_READ_MAX_BYTES } from './dashboardParts';
import type { DashboardPartReads } from './getDashboardData';
import type { QueueMode } from './types';
export function dashboardPartsResponse(request:Request,queue:QueueMode,start:()=>DashboardPartReads):Response {
  return readPartsResponse(request,async(emit,signal)=>{
    const reads=start();
    // The existing seven independent reads start once after authority. Disconnects stop delivery;
    // already-issued operations settle without starting another read or connection.
    const results=await Promise.allSettled(dashboardPartNames.map(async name=>{
      try {
        const value=await reads[name];
        if(!signal.aborted)emit({part:name,queue,value});
      }catch(error){
        const status=error&&typeof error==='object'&&'status' in error&&typeof error.status==='number'?error.status:500;
        if(!signal.aborted)emit({part:name,queue,error:'This Dashboard section could not load.',status});
      }
    }));
    const failed=results.find(result=>result.status==='rejected');
    if(failed?.status==='rejected')throw failed.reason;
    if(!signal.aborted)emit({done:true,queue});
  },DASHBOARD_READ_MAX_BYTES);
}
