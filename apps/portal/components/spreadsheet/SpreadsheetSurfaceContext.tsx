'use client';
import {createContext,useContext,useMemo,useState,type KeyboardEvent,type ReactNode} from 'react';
import {useOwnedPortalPublication} from '@/components/page-state/PortalPageSource';
import {useSpreadsheetViewport} from './useSpreadsheetViewport';
import type {SpreadsheetColumn} from './types';
export type SpreadsheetSurfaceConfig={title:string;columns:readonly SpreadsheetColumn<string>[];zoomStorageKey:string};
type RuntimeEvidence={toolbar:ReactNode;onKeyDown:(event:KeyboardEvent<HTMLDivElement>)=>void};
type Controller={config:SpreadsheetSurfaceConfig;viewport:ReturnType<typeof useSpreadsheetViewport>;body:HTMLTableSectionElement|null;
  setBody:(node:HTMLTableSectionElement|null)=>void;publish:(value:RuntimeEvidence|null)=>void;read:RuntimeEvidence|null};
const Context=createContext<Controller|null>(null);
const ReadContext=createContext<RuntimeEvidence|null>(null);
function SurfaceEvidenceOwner({owner,config,viewport,active,children}:{owner:object|null;config:SpreadsheetSurfaceConfig;viewport:ReturnType<typeof useSpreadsheetViewport>;active:boolean;children:ReactNode}){
  const [body,setBody]=useState<HTMLTableSectionElement|null>(null);
  const read=useOwnedPortalPublication<RuntimeEvidence>(owner);
  const controller=useMemo(()=>({config,viewport,body,setBody,publish:read.publish,read:null}),[config,viewport,body,read.publish]);
  return <Context.Provider value={active?controller:null}><ReadContext.Provider value={read.value}>{children}</ReadContext.Provider></Context.Provider>;
}
export function SpreadsheetSurfaceProvider({owner,config,active=true,children}:{owner:object|null;config:SpreadsheetSurfaceConfig;active?:boolean;children:ReactNode}){
  const viewport=useSpreadsheetViewport(config.columns,config.zoomStorageKey,active);
  return <SurfaceEvidenceOwner owner={owner} config={config} viewport={viewport} active={active}>{children}</SurfaceEvidenceOwner>;
}
export function useSpreadsheetSurface(){return useContext(Context);}
export function useSpreadsheetSurfaceRead(){return useContext(ReadContext);}
