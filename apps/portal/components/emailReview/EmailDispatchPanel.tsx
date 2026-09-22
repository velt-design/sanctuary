'use client';
import { useCallback, useEffect, useState } from 'react';
import { apiJson } from '@/lib/repo/apiClient';
import type { DispatchOverview } from '@/lib/emailReview/dispatch/contracts';
import { Button, Textarea } from '@/components/ui/foundation/FoundationControls';
import OutlookBatchControls from './OutlookBatchControls';
import styles from './EmailReview.module.css';

/** Approval is deliberately separate from Outlook execution. Never sends on a checkbox. */
export default function EmailDispatchPanel({batchId,canManage,reviewEditing=false,onChanged}:{batchId:string;canManage:boolean;reviewEditing?:boolean;onChanged?:()=>void}) {
  const [data,setData]=useState<DispatchOverview|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const endpoint=`/api/admin/email-review/${encodeURIComponent(batchId)}/dispatch`;
  const refresh=useCallback(async()=>{
    try{setData(await apiJson<DispatchOverview>(endpoint));setError('');}
    catch{setError('Send progress is unavailable. Your review is still saved.');}
  },[endpoint]);
  useEffect(()=>{setData(null);if(canManage)void refresh();},[canManage,refresh]);
  async function change(action:'prepare'|'cancel') {
    setBusy(true);setError('');
    try{setData(await apiJson<DispatchOverview>(action==='prepare'?endpoint:`${endpoint}/cancel`,{method:'POST',body:JSON.stringify({commandId:crypto.randomUUID()})}));onChanged?.();}
    catch{setError('The batch could not be updated. Finish reviewing every item, then refresh and try again. No email was sent.');}
    finally{setBusy(false);}
  }
  if(!canManage)return <p className="text-sm">Ticking off a message saves your approval. Jordan will arrange sending after the review is complete.</p>;
  return <details className={styles.import}>
    <summary className="cursor-pointer font-medium">Sending after review</summary>
    <div className="mt-3 space-y-3">
      <p className="text-sm">Once every message is approved or skipped, prepare the approved batch. This locks those versions for sending as Outlook replies from info@sanctuarypergolas.co.nz, signed Ellen. Preparing does not send emails.</p>
      {data&&<p role="status" className="text-sm">{data.counts.ready} ready · {data.counts.attempting} awaiting confirmation · {data.counts.sent} sent · {data.counts.uncertain} need checking</p>}
      <div className="flex flex-wrap gap-3">
        <Button variant="secondary" disabled={reviewEditing||busy||!data} onClick={()=>void change('prepare')}>Prepare approved batch</Button>
        <Button variant="secondary" disabled={reviewEditing||busy||!data?.counts.ready} onClick={()=>void change('cancel')}>Return unsent messages to review</Button>
        <Button variant="quiet" disabled={busy} onClick={()=>void refresh()}>Refresh send progress</Button>
      </div>
      <p className="text-sm">Ask Codex to send the prepared batch through the connected Outlook inbox. Messages already attempted stay locked until their Outlook result is checked; they are never automatically retried.</p>
      {error&&<p role="alert" className="text-sm">{error}</p>}
      {reviewEditing&&<p>Finish saving or discard your draft edits before changing the sending batch.</p>}
      <OutlookBatchControls key={batchId} batchId={batchId} disabled={reviewEditing||busy||!data?.prepared} onChanged={()=>{void refresh();onChanged?.();}} />
      {!!data?.items.some(item=>item.state==='attempting'||item.state==='uncertain')&&<details><summary>Dispatch reconciliation IDs</summary><Textarea label="Attempted messages for reconciliation" rows={8} readOnly value={JSON.stringify(data.items.filter(item=>item.state==='attempting'||item.state==='uncertain').map(item=>({intentId:item.id,attemptId:item.attemptId,projectName:item.projectName,to:item.to,state:item.state})),null,2)} /></details>}
      {!!data?.items.length&&<ul className="max-h-48 overflow-auto text-sm" aria-label="Send results">{data.items.filter(item=>item.state!=='cancelled').map(item=><li key={item.id} className="py-1">{item.projectName}: {item.state==='attempting'?'awaiting Outlook confirmation':item.state}{item.outlookWebLink&&<> · <a href={item.outlookWebLink} target="_blank" rel="noopener noreferrer" className="underline">View in Outlook</a></>}</li>)}</ul>}
    </div>
  </details>;
}
