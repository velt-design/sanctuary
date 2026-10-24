import type { DashboardParts } from '@/lib/dashboard/dashboardParts';
import { DashboardIncompleteReadError, type DashboardPartLoader } from '@/lib/dashboard/dashboardPartTransport';
import type { QueueMode } from '@/lib/dashboard/types';

/** Active read observation belongs to the existing Query object, which controls cancellation and GC.
 * The complete DashboardData remains owned by the existing query cache, never a fabricated aggregate.
 */
function createObservation(){
  let parts: Partial<DashboardParts>={};
  let generation=0;
  const listeners=new Set<()=>void>();
  const publish=(next:Partial<DashboardParts>)=>{parts=next;for(const listener of listeners)listener();};
  return {
    subscribe(listener:()=>void){listeners.add(listener);return()=>listeners.delete(listener);},
    snapshot:()=>parts,
    async read(loader:DashboardPartLoader,queue:QueueMode,signal:AbortSignal, retainPartial:boolean){
      const current=++generation;
      const previous=retainPartial?parts:{};
      publish(previous);
      const clear=()=>{if(current===generation)publish({});};
      signal.addEventListener('abort',clear,{once:true});
      try{return await loader(queue,signal,next=>{if(current===generation&&!signal.aborted)publish({...previous,...next});});}
      catch(error){if(!(error instanceof DashboardIncompleteReadError))clear();throw error;}
      finally{signal.removeEventListener('abort',clear);}
    },
  };
}
const observations=new WeakMap<object,ReturnType<typeof createObservation>>();
export function dashboardReadObservation(owner:object){
  let observation=observations.get(owner);
  if(!observation){observation=createObservation();observations.set(owner,observation);}
  return observation;
}
