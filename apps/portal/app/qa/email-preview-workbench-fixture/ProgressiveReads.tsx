'use client';
import {useLayoutEffect,useState,type ReactNode} from 'react';
/** Gated QA-only read delays. Exact preview HTML still comes from the existing local QA renderer. */
export default function ProgressiveReads({children}:{children:ReactNode}){
 const [active,setActive]=useState(false);
 useLayoutEffect(()=>{
  const params=new URL(window.location.href).searchParams;if(params.get('progressive')!=='1')return;setActive(true);
  const original=window.fetch,failed=new Set<string>(),failure=params.get('readFailure')==='1';
  window.fetch=async(input,init)=>{
   const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url,window.location.href);
   if(url.pathname!=='/api/qa/email-preview-workbench')return original(input,init);
   if((init?.method??(input instanceof Request?input.method:'GET')).toUpperCase()!=='GET')return Response.json({error:'Read-only progressive fixture. Sending is unavailable.'},{status:403});
   const signal=init?.signal??(input instanceof Request?input.signal:undefined);
   await new Promise<void>((resolve,reject)=>{if(signal?.aborted){reject(new DOMException('Aborted','AbortError'));return;}const timer=setTimeout(resolve,1200);signal?.addEventListener('abort',()=>{clearTimeout(timer);reject(new DOMException('Aborted','AbortError'));},{once:true});});
   if(failure&&!failed.has(url.href)){failed.add(url.href);return Response.json({error:'Synthetic preview read failure. Retry the same local source.'},{status:503});}
   return original(input,init);
  };
  return()=>{window.fetch=original;};
 },[]);
 return <>{active&&<aside><p>Controlled local QA preview reads1200 ms. Exact HTML comes from the existing QA renderer. All sending requests are rejected. This is not production timing.</p></aside>}{children}</>;
}
