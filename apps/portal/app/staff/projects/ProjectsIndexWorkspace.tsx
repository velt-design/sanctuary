'use client';
import {createContext,useContext,useEffect,useMemo,useRef,useState,type ComponentProps,type ReactNode} from 'react';
import {useOwnedPortalPublication} from '@/components/page-state/PortalPageSource';
import {parseProjectIndexView,projectIndexViewHref,projectsIndexParamsFromView,type ProjectIndexView} from './projectIndexView';
import ProjectsIndexFrame from './ProjectsIndexFrame';
type Evidence=Pick<ComponentProps<typeof ProjectsIndexFrame>,'read'|'rows'|'overlays'|'countNotice'|'pagination'|'canCreate'>&{selection:string};
export type PublicProjectIndexView={view:ProjectIndexView;update:(patch:Partial<ProjectIndexView>,resetPage?:boolean)=>void;reset:()=>void;changed:boolean};
type Controller=PublicProjectIndexView&{selection:string;publish:(value:Evidence|null)=>void};
const Context=createContext<Controller|null>(null);
function writeView(view:ProjectIndexView,navigationPath?:string){
  let href=projectIndexViewHref(view,new URLSearchParams(window.location.search));
  if(navigationPath){const url=new URL(href,window.location.href);url.pathname=navigationPath;href=url.pathname+url.search+url.hash;}
  window.history.replaceState(window.history.state,'',href);
  return new URL(href,window.location.href).search.slice(1);
}
export function ProjectsIndexWorkspace({owner,visible,entryIdentity,search,navigationPath,unavailable=false,onRetry,children}:{
  owner:object|null;visible:boolean;entryIdentity:object|string;search:string;navigationPath?:string;unavailable?:boolean;onRetry?:()=>void;children:ReactNode;
}){
  const [entry,setEntry]=useState(entryIdentity);
  const [view,setView]=useState(()=>parseProjectIndexView(new URLSearchParams(search)));
  const current=useRef(view);current.current=view;
  const changed=useRef(false);
  const observed=useRef(search);
  const entryView=useRef(JSON.stringify(view));
  const adopted=useRef(false);
  if(entry!==entryIdentity){setEntry(entryIdentity);const next=parseProjectIndexView(new URLSearchParams(search));setView(next);current.current=next;changed.current=false;observed.current=search;entryView.current=JSON.stringify(next);adopted.current=false;}
  useEffect(()=>{
    const next=parseProjectIndexView(new URLSearchParams(search));
    if(owner&&!adopted.current){
      adopted.current=true;
      // A held Flight owns the original entry URL, not edits made on the same
      // accepted public frame. Adopt its private reader against the current view.
      if(changed.current&&JSON.stringify(next)===entryView.current){
        observed.current=writeView(current.current,navigationPath);return;
      }
    }
    if(observed.current===search)return;
    observed.current=search;
    if(JSON.stringify(current.current)!==JSON.stringify(next))setView(next);
  },[search,owner,navigationPath]);
  const data=useOwnedPortalPublication<Evidence>(owner);
  const controller=useMemo(()=>{
    const update=(patch:Partial<ProjectIndexView>,resetPage=true)=>{
      const next={...current.current,...(resetPage?{page:1}:{}),...patch};changed.current=true;current.current=next;setView(next);
      observed.current=writeView(next,navigationPath);
    };
    return {view,update,reset:()=>update(parseProjectIndexView(new URLSearchParams())),changed:changed.current,
      selection:JSON.stringify(projectsIndexParamsFromView(view)),publish:data.publish};
  },[view,data.publish,navigationPath]);
  const evidence=data.value?.selection===controller.selection?data.value:null;
  return <Context.Provider value={visible?controller:null}>
    {visible?<ProjectsIndexFrame view={view} updateView={controller.update} resetView={controller.reset}
      read={evidence?.read??{state:unavailable?'unavailable':'pending',backgroundReady:false,retry:()=>onRetry?.()}}
      rows={evidence?.rows} overlays={evidence?.overlays} countNotice={evidence?.countNotice} pagination={evidence?.pagination} canCreate={Boolean(evidence?.canCreate)}/>:null}
    {children}
  </Context.Provider>;
}
export function useProjectsIndexWorkspace(){return useContext(Context);}
