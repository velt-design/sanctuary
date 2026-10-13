'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/foundation/FoundationControls';
import { Card } from '@/components/ui/foundation/FoundationSurfaces';
import { loadAdsStatus, type AdsStatus } from '@/lib/marketingIntegrations/googleAds/contract';
import { advertisingRows, advertisingAttention, deliveryLabels, reasonLabels } from '@/lib/marketingIntegrations/googleAds/view';
import { diagnosticLabel } from '@/lib/marketingIntegrations/googleAds/diagnostics';
import styles from './MarketingPerformance.module.css';
import googleStyles from './GoogleAdvertising.module.css';
export default function GoogleAdvertising({ loader = loadAdsStatus }: { loader?: typeof loadAdsStatus }) {
  const [status,setStatus] = useState<AdsStatus|null>(null), [busy,setBusy] = useState(true), [error,setError] = useState(''), [revision,setRevision] = useState(0);
  const [grain,setGrain] = useState<'campaign'|'keyword'>('campaign'),[basis,setBasis] = useState<'interaction'|'conversion'>('interaction');
  const [start,setStart] = useState(''),[end,setEnd] = useState(''),[now,setNow] = useState(Date.now());
  useEffect(() => { const controller = new AbortController(); setBusy(true); setError(''); setStatus(null);
    loader(controller.signal).then(value => { if (!controller.signal.aborted) { setStatus(value); setStart(value.report?.start ?? ''); setEnd(value.report?.end ?? ''); setNow(Date.now()); } })
      .catch(() => { if (!controller.signal.aborted) setError('Google advertising evidence could not be verified. Retry or check the source connection.'); })
      .finally(() => { if (!controller.signal.aborted) setBusy(false); }); return () => controller.abort();
  },[loader,revision]);
  useEffect(() => { const timer=setInterval(()=>setNow(Date.now()),30000);return()=>clearInterval(timer); },[]);
  const report = status?.report && status.expiresAt && Date.parse(status.expiresAt)>now ? status.report : null;
  const attention=status?advertisingAttention(status):[];
  const validDates = report && start>=report.start && end<=report.end && start<=end;
  const rows = report && validDates ? advertisingRows(report,{ grain,dateBasis:basis,start,end,saleActionId:status!.saleActionId,enquiryActionIds:status!.enquiryActionIds }) : [];
  const money = (value:number|null) => value===null?'Not mapped':new Intl.NumberFormat('en-NZ',{style:'currency',currency:report?.currency??'NZD'}).format(value);
  const count = (value:number|null) => value===null?'Not mapped':value.toLocaleString('en-NZ',{maximumFractionDigits:2});
  return <Card title="Google advertising" padding="compact">
    <div aria-live="polite" aria-busy={busy}>{busy?<p role="status">Checking saved Google evidence…</p>:error?<p role="alert">{error}</p>:!status?.enabled?<p>The Google connection is not active.</p>:!report?<p>No current saved report is available. This does not mean zero spend or sales.</p>:<>
      <p>{report.start} to {report.end} · {report.currency} · {report.timezone}</p>
      <p className={styles.muted}>Fetched {new Date(report.fetchedAt).toLocaleString('en-NZ',{timeZone:'Pacific/Auckland'})} NZ.{now-Date.parse(report.fetchedAt)>30*3600000?' Older evidence.':''} Report dates are independent of the business-record filters.</p>
    </>}</div>
    {attention.length>0&&<div role="status" aria-label="Google advertising attention"><p><strong>Google advertising needs attention</strong></p><ul>{attention.map(message=><li key={message}>{message}</li>)}</ul></div>}
    <Button variant="secondary" disabled={busy} onClick={()=>setRevision(n=>n+1)}>Check saved Google report</Button>
    {report&&<details><summary>Compare campaigns and keywords</summary>
      <p>Advertising spend, submitted enquiry actions and attributed closed sales. Website design starts and reviews are excluded from the enquiry mapping.</p>
      <div className={googleStyles.toolbar}>
        <label>View <select value={grain} onChange={e=>setGrain(e.target.value as typeof grain)}><option value="campaign">Campaigns</option><option value="keyword">Keywords</option></select></label>{' '}
        <label>Outcomes by <select value={basis} onChange={e=>setBasis(e.target.value as typeof basis)}><option value="interaction">Ad interaction date</option><option value="conversion">Conversion date</option></select></label>
        <label>From <input type="date" min={report.start} max={report.end} value={start} onChange={e=>setStart(e.target.value)}/></label><label>To <input type="date" min={report.start} max={report.end} value={end} onChange={e=>setEnd(e.target.value)}/></label>
      </div>
      {!validDates?<p role="alert">Choose dates within the saved report period.</p>:<div className={googleStyles.scroll} tabIndex={0} role="region" aria-label="Advertising performance table"><table className={googleStyles.table}><caption>{grain==='campaign'?'Campaign':'Keyword'} performance from {start} to {end}</caption>
        <thead><tr><th scope="col">{grain==='campaign'?'Campaign':'Keyword'}</th><th scope="col">Spend</th><th scope="col">Clicks</th><th scope="col">Enquiries</th><th scope="col">Attributed sales</th><th scope="col">Sales value</th></tr></thead>
        <tbody>{rows.map(row=><tr key={row.key}><th scope="row">{row.label}<small className={styles.muted}> · {row.campaignId}</small></th><td>{money(row.cost)}</td><td>{count(row.clicks)}</td><td>{count(row.enquiries)}</td><td>{count(row.sales)}</td><td>{money(row.value)}</td></tr>)}</tbody>
      </table>{rows.length===0&&<p>No returned rows in these dates. Google can omit zero-activity rows.</p>}</div>}
      <p className={styles.muted}>{basis==='conversion'?'Outcomes use conversion dates; spend still uses ad interaction dates. These are different cohorts.':'Outcomes are attributed to the original ad interaction date and can change as later sales are matched.'} Keyword rows cover keyword-based advertising only. Campaign and keyword rows are separate views, never added together.</p>
      <p className={styles.muted}>Google may credit fractional conversions. Attributed scope value includes GST; it is not banked cash, profit or proof that the ad caused the sale. Missing mappings stay unavailable.</p>
      <details><summary>Conversion definitions</summary><p>Enquiry actions: {status!.enquiryActionIds.map(id=>report.actions.find(a=>a.id===id)?.name??id).join(', ')||'Not mapped'}. Closed sale: {report.actions.find(a=>a.id===status!.saleActionId)?.name??'Not mapped'}.</p></details>
    </details>}
    {status&&<details><summary>Sale reporting coverage and recovery</summary>
      <p>{status.uploadsEnabled?'Automatic sale delivery is active.':'Automatic sale delivery is not active.'} One sale record represents one commercial scope, including separately accepted add-ons.</p>
      <dl className={googleStyles.coverage}>{Object.entries(status.counts).map(([state,total])=><div key={state}><dt>{deliveryLabels[state]??'Unrecognised delivery state'}</dt><dd>{total}</dd></div>)}</dl>
      {Object.keys(status.counts).length===0&&<p>No delivery records have been assessed yet.</p>}
      <p>Google ingestion confirmation means the event was processed. Matching and advertising credit are established separately by the report above; individual sales are not exposed by Google’s aggregate diagnostics.</p>
      <dl className={googleStyles.reasons}>{Object.entries(status.reasons).map(([reason,total])=><div key={reason}><dt>{reasonLabels[reason]??'Provider or connection issue requiring review'}</dt><dd>{total}</dd></div>)}</dl>
      {status.diagnostics.length>0&&<dl className={googleStyles.reasons}>{status.diagnostics.map((entry,index)=><div key={`${entry.severity}/${entry.code}/${index}`}><dt>{diagnosticLabel(entry.code)} <small>{entry.code}</small></dt><dd>{entry.count} {entry.severity==='errors'?'error':'warning'} records</dd></div>)}</dl>}
    </details>}
  </Card>;
}
