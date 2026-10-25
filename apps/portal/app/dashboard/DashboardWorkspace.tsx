'use client';
import {createContext,useCallback,useContext,useMemo,useRef,useState,type ComponentProps,type ReactNode} from 'react';
import {useOwnedPortalPublication} from '@/components/page-state/PortalPageSource';
import DashboardFrame from './DashboardFrame';
import DashboardTasksSurface,{type DashboardTasksSurfaceProps} from './_components/DashboardTasksSurface';
import TodayVisitsSurface,{type TodayVisitsSurfaceProps} from '@/components/site-visits/TodayVisitsSurface';

type DashboardEvidence=Omit<ComponentProps<typeof DashboardFrame>,'visits'|'tasksCard'>;
type Controller={title:string;setTitle:(title:string)=>void;
  isCurrent:()=>boolean;
  publishData:(value:DashboardEvidence|null)=>void;publishTasks:(value:DashboardTasksSurfaceProps|null)=>void;
  publishVisits:(value:TodayVisitsSurfaceProps|null)=>void};
const Context=createContext<Controller|null>(null);
const noAction=()=>undefined;
const noCommand=async()=>undefined;
const noTasks=new Set<string>();
export function DashboardWorkspace({owner,visible,entryIdentity,unavailable=false,onRetry,children}:{
  owner:object|null;visible:boolean;entryIdentity:object|string;unavailable?:boolean;onRetry?:()=>void;children:ReactNode;
}){
  const [entry,setEntry]=useState(entryIdentity);
  const [title,setTitle]=useState('');
  const composer=useRef({});
  if(entry!==entryIdentity){setEntry(entryIdentity);setTitle('');composer.current={};}
  const composerIdentity=composer.current;
  const currentOwner=useRef(owner);currentOwner.current=owner;
  const isCurrent=useCallback(()=>Boolean(owner&&currentOwner.current===owner&&composer.current===composerIdentity),[owner,composerIdentity]);
  const setSourceTitle=useCallback((value:string)=>{if(owner&&currentOwner.current===owner&&composer.current===composerIdentity)setTitle(value);},[owner,composerIdentity]);
  const data=useOwnedPortalPublication<DashboardEvidence>(owner);
  const tasks=useOwnedPortalPublication<DashboardTasksSurfaceProps>(owner);
  const visits=useOwnedPortalPublication<TodayVisitsSurfaceProps>(owner);
  const controller=useMemo(()=>({title,setTitle:setSourceTitle,isCurrent,publishData:data.publish,publishTasks:tasks.publish,publishVisits:visits.publish}),
    [title,setSourceTitle,isCurrent,data.publish,tasks.publish,visits.publish]);
  const pending=!unavailable;
  return <Context.Provider value={visible?controller:null}>
    {visible?<DashboardFrame {...(data.value??{data:null,state:unavailable?'unavailable':'pending'})}
      onRetry={data.value?.onRetry??onRetry}
      visits={<TodayVisitsSurface {...(visits.value??{pending,readFailed:unavailable,onRetry:onRetry??noAction})}/>}
      tasksCard={<DashboardTasksSurface {...(tasks.value??{title,setTitle,initialTasks:null,tasks:[],pending,readOnly:true,
        error:null,setError:noAction,submitting:false,pendingTaskIds:noTasks,createTask:noCommand,toggleTask:noCommand})}/>}/>:null}
    {children}
  </Context.Provider>;
}
export function useDashboardWorkspace(){return useContext(Context);}
