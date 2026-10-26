'use client';
import {createContext,useContext,useMemo,useState,type Dispatch,type ReactNode,type SetStateAction} from 'react';
import {useOwnedPortalPublication} from '@/components/page-state/PortalPageSource';
import { DataStatePanel } from '@/components/ui/foundation/FoundationDataState';
import WorkQueueSurface,{type WorkQueueSurfaceProps} from '@/components/projects/workQueue/WorkQueueSurface';
import {DEFAULT_WORK_QUEUE_FILTERS,type WorkQueueFilters} from '@/components/projects/workQueue/workQueueFilterSelection';
import WorkQueueFrame,{type WorkQueuePageEvidence} from './WorkQueueFrame';
type Controller={page:number;setPage:Dispatch<SetStateAction<number>>;filters:WorkQueueFilters;setFilters:Dispatch<SetStateAction<WorkQueueFilters>>;
  publishPage:(value:WorkQueuePageEvidence|null)=>void;publishList:(value:WorkQueueSurfaceProps|null)=>void};
const Context=createContext<Controller|null>(null);
const ownerOptions=[{value:'all',label:'All owners'}];
const stageOptions=[{value:'all',label:'All stages'}];
export function WorkQueueWorkspace({owner,visible,entryIdentity,unavailable=false,onRetry,children}:{
  owner:object|null;visible:boolean;entryIdentity:object|string;unavailable?:boolean;onRetry?:()=>void;children:ReactNode;
}){
  const [entry,setEntry]=useState(entryIdentity);const [page,setPage]=useState(1);
  const [filters,setFilters]=useState<WorkQueueFilters>(DEFAULT_WORK_QUEUE_FILTERS);
  if(entry!==entryIdentity){setEntry(entryIdentity);setPage(1);setFilters(DEFAULT_WORK_QUEUE_FILTERS);}
  const read=useOwnedPortalPublication<WorkQueuePageEvidence>(owner),list=useOwnedPortalPublication<WorkQueueSurfaceProps>(owner);
  const controller=useMemo(()=>({page,setPage,filters,setFilters,publishPage:read.publish,publishList:list.publish}),[page,filters,read.publish,list.publish]);
  const state=read.value?.state??(unavailable?'unavailable':'pending');
  const setFilter=<K extends keyof WorkQueueFilters>(key:K,value:WorkQueueFilters[K])=>{setFilters(current=>({...current,[key]:value}));setPage(1);};
  const clearFilters=()=>{setFilters(DEFAULT_WORK_QUEUE_FILTERS);setPage(1);};
  return <Context.Provider value={visible?controller:null}>
    {visible?<WorkQueueFrame state={state} count={read.value?.count} admin={read.value?.admin} notices={read.value?.notices} noticeTitle={read.value?.noticeTitle} retry={read.value?.retry}>
      <WorkQueueSurface {...(list.value??{filters,setFilter,clearFilters,ownerOptions,stageOptions,
        content:unavailable?<DataStatePanel state="unavailable" onRetry={onRetry}/>:<p role="status">Reading the complete work queue…</p>})}/>
    </WorkQueueFrame>:null}{children}
  </Context.Provider>;
}
export function useWorkQueueWorkspace(){return useContext(Context);}
