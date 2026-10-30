'use client';
import {useEffect,useState} from 'react';
import {navigateStudioDocument} from '@/lib/designStudio/studioDocumentNavigation';

/** A cached ordinary root cannot become the public Studio document by soft
 * navigation. No editor/provider/storage is mounted in this fallback. */
export default function StudioNativeEntry({callback}:{callback:string}) {
 const [error,setError]=useState<string|null>(null),[attempt,setAttempt]=useState(0);
 useEffect(()=>{const controller=new AbortController();void navigateStudioDocument(callback,true,undefined,controller.signal).catch(cause=>{if(!controller.signal.aborted)setError(cause instanceof Error?cause.message:'The design could not be opened.');});return()=>controller.abort();},[callback,attempt]);
 return <main><h1>Design Studio</h1><p role="status">Opening saved design…</p>{error&&<div role="alert"><p>{error}</p><button onClick={()=>setAttempt(v=>v+1)}>Try again</button></div>}</main>;
}
