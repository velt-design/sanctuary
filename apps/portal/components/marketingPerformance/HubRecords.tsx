import { useEffect, useState } from 'react';
import { Card, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/foundation/FoundationSurfaces';
import { Button, Select } from '@/components/ui/foundation/FoundationControls';
import { type HubReport, type HubFilters, type HubEvent, selectHub, eventLabels, evidenceForView, money } from '@/lib/marketingPerformance/hub';
import { UNKNOWN_SOURCE, NO_CAMPAIGN } from '@/lib/marketingPerformance/contract';
import { resolveProjectJourney } from '@/lib/projects/projectJourney';
import { normalizePipelineStageKey } from '@/lib/projects/pipelineDefinition';
import ReportDetail from './ReportDetail';
import styles from './MarketingPerformance.module.css';

export default function HubRecords({hub,filters,synthetic,eventKind,apply,productionSnapshot=false}: {hub:HubReport;filters:HubFilters;synthetic:boolean;eventKind:string;productionSnapshot?:boolean;apply:(f:HubFilters)=>void}) {
  const [page,setPage] = useState(0);
  useEffect(()=>{ const n=Number(new URLSearchParams(window.location.search).get('recordsPage'));setPage(Number.isInteger(n)&&n>0?n:0); },[filters,eventKind]);
  const selected=selectHub(hub,filters);
  const date=(value:string)=>new Date(value).toLocaleDateString('en-NZ',{timeZone:'Pacific/Auckland',dateStyle:'medium'});
  const link=(id:string,enquiry:string|null)=>synthetic ? `/qa/marketing-performance-fixture/project?project=${id}&enquiry=${enquiry??''}&return=${encodeURIComponent(typeof window==='undefined'?'':window.location.search)}` : `${productionSnapshot?'https://portal.sanctuarypergolas.co.nz':''}/staff/projects/proj_${id}?tab=${filters.view==='sales'?'quotes':'activity'}`;
  const entries=filters.view==='enquiries' ? selected.enquiries.map(r=>({
    id:r.enquiryId,projectId:r.projectId,enquiry:r.enquiryId,name:r.projectName??'Unlinked enquiry',date:date(r.receivedAt),source:r.source,campaign:r.campaign,
    detail:r.origin?'Origin enquiry':r.projectId?'Repeat submission; outcome credited to origin':'No linked project',
    evidence:[r.qualification==='unreviewed'?'Awaiting assessment':r.qualification==='ineligible'?'Outside configured qualification criteria':r.qualification==='unavailable'?'Assessment unavailable':r.qualification.replaceAll('_',' '),
      r.origin&&r.visit?'Recorded confirmation':null,r.origin&&r.quote?'Sent quote':null,r.origin&&r.accepted?'Current accepted scope':null,r.origin&&r.won?'Payment verified':null].filter(Boolean).join(' · '),
  })) : filters.view==='portfolio' ? [...selected.projects].sort((a,b)=>filters.age?a.createdAt.localeCompare(b.createdAt):0).map(p=>({
    id:p.id,projectId:p.id,enquiry:p.originId,name:p.name??'Unnamed project',date:date(p.createdAt),source:p.source,campaign:p.campaign,
    detail:`${p.state.toLowerCase()} · ${p.owner??'unassigned'} · ${p.receiptCount} saved receipt${p.receiptCount===1?'':'s'}`,
    evidence:`${resolveProjectJourney(normalizePipelineStageKey(p.stage)).stageLabel} · ${p.paymentVerified?'Payment verified':'No qualifying payment evidence'}${p.knownTest?' · Known test':p.testCandidate?' · Possible test; review required':''}`,
  })) : selected.events.filter(e=>!eventKind||e.kind===eventKind||(eventKind==='receipts'&&['payment','reversal'].includes(e.kind))).map(e=>{
    const p=selected.projectMap.get(e.projectId)!;
    return {id:e.id,projectId:p.id,enquiry:p.originId,name:p.name??'Unnamed project',date:e.day,source:p.source,campaign:p.campaign,
      detail:eventLabels[e.kind],evidence:`${eventDetail(e)}${e.amountCents===null?'':` · ${money(e.amountCents)} NZD incl. GST`}`};
  });
  const current=Math.min(page,Math.max(0,Math.ceil(entries.length/25)-1));
  const change=(n:number)=>{setPage(n);const url=new URL(window.location.href);url.searchParams.set('recordsPage',String(n));window.history.replaceState(null,'',url);};
  return <Card title="Underlying records" padding="compact">
    {filters.view!=='sales'&&<Select label="Records to inspect within current filters" value={filters.inspect} onChange={e=>apply({...filters,inspect:e.target.value})}>
      {evidenceForView(filters.view).map(([key,label])=><option key={key} value={key}>{key==='all'?'All matching records':label}</option>)}
      {filters.view==='portfolio'&&<option value="paid">Projects marked paid</option>}
    </Select>}
    <p id="hub-record-count" role="status">{entries.length} {filters.view==='enquiries'?'submissions':filters.view==='sales'?'recorded events':'projects'} match · {filters.view==='sales'?(eventKind?eventKind==='receipts'?'Payments and reversals':eventLabels[eventKind as HubEvent['kind']]:'All event types'):'Current filters'}</p>
    <div className={`${styles.tableScroll} ${styles.evidenceTable}`} tabIndex={0} role="region" aria-label="Underlying hub records">
      <Table><TableHeader><TableRow><TableHead>Project / record</TableHead><TableHead>{filters.view==='enquiries'?'Received':filters.view==='sales'?'Event date':'Project created'} (NZ)</TableHead><TableHead>Observed source / campaign</TableHead><TableHead>Recorded evidence</TableHead></TableRow></TableHeader>
        <TableBody>{entries.slice(current*25,(current+1)*25).map(r=><TableRow key={r.id}>
          <TableHead scope="row" className={styles.source}>{r.projectId?<a href={link(r.projectId,r.enquiry)}>{r.name}</a>:r.name}<span>{r.detail}</span><span className={styles.recordId} title={r.id}>{r.id}</span></TableHead>
          <TableCell>{r.date}</TableCell><TableCell className={styles.source}>{r.source??UNKNOWN_SOURCE}<span>{r.campaign??NO_CAMPAIGN}</span></TableCell><TableCell>{r.evidence}</TableCell>
        </TableRow>)}</TableBody></Table>
      {!entries.length&&<p>No matching records. Clear filters or choose another view. Projects without receipts are available in Project portfolio.</p>}
    </div>
    <div className={styles.pagination}><Button variant="secondary" disabled={!current} onClick={()=>change(current-1)}>Previous</Button><span>Page {current+1} of {Math.max(1,Math.ceil(entries.length/25))}</span><Button variant="secondary" disabled={(current+1)*25>=entries.length} onClick={()=>change(current+1)}>Next</Button></div>
    <ReportDetail title="Inspecting records" label="About these records"><p>Open a project to inspect Original enquiry or Commercial evidence. Browser Back restores this view. Source on Sales and Portfolio comes only from the earliest saved enquiry, never a later repeat submission.</p></ReportDetail>
  </Card>;
}
function eventDetail(event:HubEvent) {
  if(event.kind==='quote_sent'||event.kind==='quote_accepted') return `Recorded version event · current version status: ${event.status.toLowerCase()}`;
  if(event.kind==='invoice_paid') return 'Invoice status evidence only; not added to receipt totals';
  if(event.kind==='adjustment') return 'Ledger adjustment; not counted as money received';
  return event.status==='REVERSED'?'Payment later reversed; reversal appears on its own recorded date':event.status.toLowerCase();
}
