'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/foundation/FoundationControls';
import { Card } from '@/components/ui/foundation/FoundationSurfaces';
import { loadMetaSaleStatus, metaSaleAttention, metaSaleReasons, type MetaSaleStatus } from '@/lib/marketingIntegrations/metaSales/contract';
import styles from './GoogleAdvertising.module.css';
const labels: Record<string,string> = { READY:'Ready to send', SENDING:'Sending', RETRY:'Scheduled retry', ACCEPTED:'Received by Meta', REVIEW_REQUIRED:'Needs review', SUPPRESSED:'Stopped before sending' };
export default function MetaSaleDelivery({ loader = loadMetaSaleStatus }: { loader?: typeof loadMetaSaleStatus }) {
  const [status,setStatus] = useState<MetaSaleStatus|null>(null),[error,setError] = useState(''),[busy,setBusy] = useState(true),[revision,setRevision] = useState(0);
  useEffect(()=>{const controller=new AbortController();setBusy(true);setError('');setStatus(null);
    loader(controller.signal).then(value=>{if(!controller.signal.aborted)setStatus(value);})
      .catch(()=>{if(!controller.signal.aborted)setError('Meta sale evidence could not be checked. Retry or inspect the source connection.');})
      .finally(()=>{if(!controller.signal.aborted)setBusy(false);});return()=>controller.abort();},[loader,revision]);
  const attention=status?metaSaleAttention(status):[];
  return <Card title="Meta sale reporting" padding="compact">
    <div aria-live="polite" aria-busy={busy}>{busy?<p role="status">Checking saved sale evidence…</p>:error?<p role="alert">{error}</p>:status&&<p>{status.deliveryAuthority==='READY'?status.mode==='canary'?'Delivery is restricted to one selected sale.':status.mode==='historical'?'Delivery is restricted to individually approved historical sales.':'Automatic delivery is enabled at the source.':'Sale delivery is not active.'}</p>}</div>
    {attention.length>0&&<div role="status" aria-label="Meta sale attention"><strong>Meta connection needs attention</strong><ul>{attention.map(item=><li key={item}>{item}</li>)}</ul></div>}
    <Button variant="secondary" disabled={busy} onClick={()=>setRevision(value=>value+1)}>Check saved sale status</Button>
    {status&&<>
      <p>{status.assessedCount?`${status.assessedCount} paid-scope records assessed. Assessment may include previously sent scopes that have since changed.`:'No sale records have been assessed yet.'} {status.assessedAt&&`Checked ${new Date(status.assessedAt).toLocaleString('en-NZ',{timeZone:'Pacific/Auckland'})} NZ.`}</p>
      <dl className={styles.coverage}>{Object.entries(status.counts).map(([state,count])=><div key={state}><dt>{labels[state]??'Unknown state'}</dt><dd>{count}</dd></div>)}</dl>
      <p>One sale represents one accepted scope after a verified positive deposit, using its full agreed value including GST. Meta receiving an event does not prove it matched a customer or received advertising credit.</p>
      <details><summary>Eligibility and recovery details</summary>
        {Object.entries(status.credentials??{}).map(([capability,value])=><p key={capability}>{capability==='reports'?'Report':'Sale'} access: {value.tokenExpiresAt?`token expires ${new Date(value.tokenExpiresAt).toLocaleDateString('en-NZ',{timeZone:'Pacific/Auckland'})}.`:'the verified token has no scheduled expiry.'}
          {' '}{value.approvalEndsAt?`Connection approval ends ${new Date(value.approvalEndsAt).toLocaleDateString('en-NZ',{timeZone:'Pacific/Auckland'})}.`:'Connection approval remains revocable.'}
          {' '}{value.dataAccessExpiresAt&&`Provider data access expires ${new Date(value.dataAccessExpiresAt).toLocaleDateString('en-NZ',{timeZone:'Pacific/Auckland'})}.`}
          {' '}{value.assetVerifiedAt?`Asset assignment checked ${new Date(value.assetVerifiedAt).toLocaleDateString('en-NZ',{timeZone:'Pacific/Auckland'})}.`:'Asset assignment has not been verified.'}</p>)}
        <p>These deposit events must reach Meta within seven days. Historical records need individual permission evidence. A record can have several exclusion reasons, so these counts must not be added together.</p>
        <dl className={styles.reasons}>{Object.entries(status.assessmentReasons).map(([reason,count])=><div key={reason}><dt>{metaSaleReasons[reason]??'Eligibility needs review'}</dt><dd>{count}</dd></div>)}</dl>
        <dl className={styles.reasons}>{Object.entries(status.reasons).map(([reason,count])=><div key={reason}><dt>{metaSaleReasons[reason]??'Connection or provider result needs review'}</dt><dd>{count}</dd></div>)}</dl>
        <p>Cancellation and value changes after sending need review. Meta’s event endpoint does not offer a sale correction or retraction operation; the original receipt stays visible. Current business records remain the authority for corrected scope value.</p>
      </details>
    </>}
  </Card>;
}
