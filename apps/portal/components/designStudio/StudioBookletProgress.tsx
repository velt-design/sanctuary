"use client";
import {useEffect,useState} from 'react';
import {apiJson} from '@/lib/repo/apiClient';
import type {StudioClientDocumentStatus} from '@/lib/designStudio/clientDocumentStatus';
/** Progress is completed durable pages, never an elapsed-time animation. */
export default function StudioBookletProgress({quoteId,snapshotId,lifetime}:{quoteId:string;snapshotId:string;lifetime?:AbortSignal}){
 const [status,setStatus]=useState<StudioClientDocumentStatus|null>(null),[error,setError]=useState(false),[attempt,setAttempt]=useState(0),[retrying,setRetrying]=useState(false);
 const endpoint=`/api/quotes/${encodeURIComponent(quoteId)}/studio-document`;
 useEffect(()=>{
  const abort=new AbortController(),retire=()=>abort.abort();let timer:ReturnType<typeof setTimeout>|undefined;
  lifetime?.addEventListener('abort',retire,{once:true});if(lifetime?.aborted)retire();setStatus(null);setError(false);
  const read=async()=>{try{
   const result=await apiJson<{document:StudioClientDocumentStatus}>(endpoint,{signal:abort.signal});
   if(abort.signal.aborted)return;
   if(result.document.snapshotId!==snapshotId)throw Error('Wrong booklet revision');
   setStatus(result.document);setError(false);
   if(!['ready','failed','unavailable'].includes(result.document.state))timer=setTimeout(()=>void read(),1500);
  }catch{if(!abort.signal.aborted)setError(true);}};
  if(!abort.signal.aborted)void read();
  return()=>{abort.abort();clearTimeout(timer);lifetime?.removeEventListener('abort',retire);};
 },[endpoint,snapshotId,lifetime,attempt]);
 async function retry(){if(retrying||lifetime?.aborted)return;setRetrying(true);try{await apiJson(endpoint,{method:'POST',body:JSON.stringify({snapshotId}),signal:lifetime});if(!lifetime?.aborted)setAttempt(n=>n+1);}catch{if(!lifetime?.aborted)setError(true);}finally{setRetrying(false);}}
 return <section aria-label="Design booklet"><h3>Design booklet</h3>
 {error?<p role="alert">Booklet status is unavailable. <button onClick={()=>setAttempt(n=>n+1)}>Check again</button></p>:status?.state==='unavailable'?<p>This quote has no pergola drawings.</p>:status?.state==='ready'?<p><a download href={`${endpoint}?download=1`}>Download design booklet</a></p>:status?.state==='failed'?<p role="alert">The quote is ready. Its design booklet could not finish. {status.canRetry&&<button disabled={retrying} onClick={()=>void retry()}>{retrying?'Retrying…':'Retry booklet'}</button>}</p>:<><progress aria-label="Design booklet progress" max={100} value={status?.percent??0}/><p role="status">{status?`${status.completedPages} of ${status.totalPages} drawings prepared${status.completedPages===status.totalPages?', assembling booklet…':'…'}`:'Queued for preparation…'}</p><p>You can leave this page. The booklet will keep preparing.</p></>}
 </section>;
}
