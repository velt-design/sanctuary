'use client';
import {createContext,useContext,useMemo,useState,type Dispatch,type ReactNode,type SetStateAction} from 'react';
import {DESIGN_LIST_COLUMNS} from '@/lib/designPackages/columns';
import {RUNNING_JOBS_COLUMNS} from '@/lib/runningJobs/columns';
import DraftingQueueToolbar,{DEFAULT_DRAFTING_QUEUE_FILTERS,type DraftingQueueFilters} from '@/app/staff/projects/design-packages/DraftingQueueToolbar';
import RunningJobsToolbar,{DEFAULT_RUNNING_JOBS_FILTERS,type RunningJobsFilters} from '@/app/staff/projects/running-jobs/RunningJobsToolbar';
import {SpreadsheetSurfaceProvider} from './SpreadsheetSurfaceContext';
import SpreadsheetSurface from './SpreadsheetSurface';
type Kind='design'|'running';
type Controller={kind:Kind|null;designFilters:DraftingQueueFilters;runningFilters:RunningJobsFilters;
  setDesignFilters:Dispatch<SetStateAction<DraftingQueueFilters>>;setRunningFilters:Dispatch<SetStateAction<RunningJobsFilters>>};
const Context=createContext<Controller|null>(null);
const designConfig={title:'Drafting Queue',columns:DESIGN_LIST_COLUMNS,zoomStorageKey:'sp_design_list_sheet_zoom_v1'};
const runningConfig={title:'Running Jobs',columns:RUNNING_JOBS_COLUMNS,zoomStorageKey:'sp_running_jobs_sheet_zoom_v1'};
export function SpreadsheetWorkspace({owner,kind,entryIdentity,unavailable=false,onRetry,children}:{
  owner:object|null;kind:Kind|null;entryIdentity:object|string;unavailable?:boolean;onRetry?:()=>void;children:ReactNode;
}){
  const [entry,setEntry]=useState(entryIdentity);
  const [designFilters,setDesignFilters]=useState(DEFAULT_DRAFTING_QUEUE_FILTERS);
  const [runningFilters,setRunningFilters]=useState(DEFAULT_RUNNING_JOBS_FILTERS);
  if(entry!==entryIdentity){setEntry(entryIdentity);setDesignFilters(DEFAULT_DRAFTING_QUEUE_FILTERS);setRunningFilters(DEFAULT_RUNNING_JOBS_FILTERS);}
  const controller=useMemo(()=>({kind,designFilters,runningFilters,setDesignFilters,setRunningFilters}),[kind,designFilters,runningFilters]);
  const readState=unavailable?'unavailable':'pending';
  const toolbar=kind==='running'?<RunningJobsToolbar filters={runningFilters} onChange={patch=>setRunningFilters(current=>({...current,...patch}))}
    years={[]} crews={[]} stages={[]} totalRows={null} visibleRows={null} generatedAt={null} readState={readState} onRetry={onRetry}/>:
    <DraftingQueueToolbar filters={designFilters} onChange={patch=>setDesignFilters(current=>({...current,...patch}))}
      years={[]} designers={[]} totalRows={null} visibleRows={null} generatedAt={null} readState={readState} onRetry={onRetry}/>;
  return <Context.Provider value={kind?controller:null}>
    <SpreadsheetSurfaceProvider owner={owner} active={Boolean(kind)} config={kind==='running'?runningConfig:designConfig}>
      {kind?<SpreadsheetSurface toolbar={toolbar} loading={!unavailable} hasError={unavailable}
        loadingMessage={kind==='running'?'Loading running jobs...':'Loading drafting queue...'} errorMessage={kind==='running'?'Could not load running jobs.':'Could not load drafting queue.'}
        emptyMessage={kind==='running'?'No matching jobs.':'No matching requests.'}/>:null}
      {children}
    </SpreadsheetSurfaceProvider>
  </Context.Provider>;
}
export function useSpreadsheetWorkspace(){return useContext(Context);}
