'use client';
import {createContext,useCallback,useLayoutEffect,useState,type ComponentType,type ReactNode} from 'react';
import {usePathname,useSearchParams} from 'next/navigation';
import {studioDocumentCallback} from '@/lib/designStudio/studioEditRoute';

type Frame=ComponentType<{callback:string;children:ReactNode}>;
/** Public component composition only. No admission, actor or retained authoring. */
export const StudioDocumentInstallation=createContext<{callback:string;install:(frame:Frame)=>void}|null>(null);

export default function StudioDocumentSlot({callback,children}:{callback:string;children:ReactNode}){
 const [initial]=useState(callback),[Frame,setFrame]=useState<Frame|null>(null);
 const pathname=usePathname(),search=useSearchParams();
 const exact=studioDocumentCallback(pathname+(search.size?`?${search}`:''),true)===initial;
 const install=useCallback((frame:Frame)=>setFrame((current:Frame|null)=>current??frame),[]);
 useLayoutEffect(()=>{
  // Before installation no actor/storage runtime exists to drain. Once installed,
  // its retained frame owns all withdrawal, accepted-write drain and native exit.
  if(!Frame&&!exact)location.replace(location.href);
 },[Frame,exact]);
 return <StudioDocumentInstallation.Provider value={{callback:initial,install}}>
  {Frame?<Frame callback={initial}>{children}</Frame>:exact?children:<main><h1>Design Studio</h1><p role="status">Opening saved design…</p></main>}
 </StudioDocumentInstallation.Provider>;
}
