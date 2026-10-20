'use client';
import { useRef,useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { CalendarVisit,VisitSnapshot } from '@/lib/siteVisits/contract';
import { calendarVisitKey } from './useCalendarVisits';
import { visitRequest } from './visitRequest';

type Recovery={outcome:'unknown'|'saved'|'conflict';ready:boolean;latest:CalendarVisit|null};
export function useVisitSave({visit,id,projectId,onDone}:{visit?:CalendarVisit;id:string;projectId?:string;onDone:()=>void}){
  const client=useQueryClient(),lock=useRef(false);
  const [revision,setRevision]=useState(visit?.revision??0);
  const [latest,setLatest]=useState<CalendarVisit>();
  const [pending,setPending]=useState(false),[error,setError]=useState('');
  const [recovery,setRecovery]=useState<Recovery|null>(null);
  const current=latest&&(!visit||latest.revision>=visit.revision)?latest:visit;
  const changed=Boolean(current&&current.revision!==revision);
  const blocked=changed||Boolean(recovery);
  async function readLatest(){
    // The global read finds a visit moved to another project; the project read
    // also retains old source-window history. Both waits run under the same 20s.
    const paths=['/api/staff/v1/outlook-site-visits'];
    if(projectId)paths.push(`${paths[0]}?project=${encodeURIComponent(projectId)}`);
    const results=await Promise.allSettled(paths.map(path=>visitRequest<VisitSnapshot>(path,{cache:'no-store'})));
    const found=results.flatMap(result=>result.status==='fulfilled'?result.value.events.filter(item=>item.id===id):[])
      .sort((a,b)=>b.revision-a.revision)[0];
    if(found)return found;
    // A failed read cannot establish that an uncertain create is absent.
    if(results.some(result=>result.status==='rejected'))throw new Error('The latest visit could not be checked.');
    return null;
  }
  async function reload(){
    if(lock.current)return;
    lock.current=true;setPending(true);setError('');
    setRecovery(value=>value?{...value,ready:false}:value);
    try{
      // A historical create may have committed without a response. Look up its
      // held UUID; an absent result permits only the same idempotent create ID.
      const found=await readLatest();
      if(!found&&(visit||revision>0))throw new Error('This visit is unavailable. Your draft is kept; try reloading again.');
      if(found&&found.revision<Math.max(revision,current?.revision??0))throw new Error('The latest revision is not yet available.');
      if(found)setLatest(found);
      setRecovery(value=>({outcome:value?.outcome??'conflict',ready:true,latest:found}));
    }catch{
      setError('The latest visit could not be checked. Your draft is kept. Reload again before saving.');
    }finally{lock.current=false;setPending(false);}
  }
  function acknowledge(){
    if(pending)return;
    if(recovery){
      if(!recovery.ready)return;
      setRevision(recovery.latest?.revision??0);
      setRecovery(null);
    }else if(current)setRevision(current.revision);
    setError('');
  }
  async function save(path:string,input:unknown){
    if(lock.current||blocked)return;
    lock.current=true;setPending(true);setError('');
    let saved:CalendarVisit|undefined;
    try{
      const response=await visitRequest<{visit:CalendarVisit}>(path,{method:'POST',body:JSON.stringify(input)});
      saved=response.visit;
      setLatest(saved);setRevision(saved.revision);
      // Refresh is a separate bounded read. A failed refresh cannot turn a
      // confirmed command into an unknown or failed save.
      const found=await readLatest();
      if(!found||found.revision<saved.revision)throw new Error('Saved visit is not yet available in the read.');
      for(const [key,data] of client.getQueriesData<VisitSnapshot>({queryKey:calendarVisitKey})){
        if(!data)continue;
        const scope=typeof key[2]==='string'?key[2].replace(/^proj_/,''):null;
        const events=data.events.filter(item=>item.id!==id);
        if(!scope||scope===found.projectId)events.push(found);
        client.setQueryData(key,{...data,events});
      }
      void client.invalidateQueries({queryKey:calendarVisitKey,refetchType:'none'});
      onDone();
    }catch(e){
      const conflict=Boolean(e&&typeof e==='object'&&'status' in e&&e.status===409);
      setRecovery({outcome:saved?'saved':conflict?'conflict':'unknown',ready:false,latest:saved??null});
      if(!saved)setError(e instanceof Error?e.message:'The request did not complete.');
    }finally{lock.current=false;setPending(false);}
  }
  return {current,revision,pending,error,setError,recovery,changed,blocked,save,reload,acknowledge};
}
