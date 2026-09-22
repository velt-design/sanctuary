import { Button } from '@/components/ui/foundation/FoundationControls';
import ReportDetail from './ReportDetail';
import { MetricGrid } from '@/components/ui/foundation/FoundationOperational';
import { type HubReport, type HubFilters, selectHub, money } from '@/lib/marketingPerformance/hub';
import { summarize } from '@/lib/marketingPerformance/contract';
import { normalizePipelineStageKey } from '@/lib/projects/pipelineDefinition';
import styles from './MarketingPerformance.module.css';

export default function HubMetrics({hub,filters,apply,inspectEvents}: {hub:HubReport;filters:HubFilters;apply:(f:HubFilters)=>void;inspectEvents:(kind:string)=>void}) {
  const selected=selectHub(hub,{...filters,inspect:'all'}), totals=summarize(selected.enquiries);
  const inspect=(value:string|number,label:string,action:()=>void)=><Button className={styles.metricButton} variant="quiet" aria-label={`Inspect ${label}`} onClick={action}>{value}</Button>;
  const evidence=(key:string)=>apply({...filters,inspect:key});
  const eventCount=(kind:string)=>selected.events.filter(e=>e.kind===kind).length;
  const missingAmounts=selected.events.some(e=>['payment','reversal'].includes(e.kind)&&e.amountCents===null);
  const net=selected.events.filter(e=>['payment','reversal'].includes(e.kind)).reduce((sum,e)=>sum+(e.amountCents??0),0);
  const projects=selected.projects;
  const items=filters.view==='enquiries'?[
    {label:'Saved enquiry submissions',value:inspect(totals.enquiries,'saved enquiries',()=>evidence('all')),detail:`${totals.projects} linked projects · ${totals.repeats} repeats · ${totals.unlinked} unlinked`},
    {label:'Qualification assessments',value:inspect(!totals.eligible?'Not assessed':totals.unreviewed&&totals.eligible===totals.unreviewed?'Awaiting assessment':`${totals.qualified} qualified`,'qualification assessments',()=>evidence(totals.unreviewed&&totals.eligible===totals.unreviewed?'unreviewed':'qualified')),detail:`${totals.eligible} eligible · ${totals.unreviewed} awaiting · ${totals.notQualified} not qualified; other receipts outside criteria`},
    {label:'Recorded visit confirmations',value:inspect(totals.visit||'No evidence','visit confirmations',()=>evidence('visit')),detail:'Historical confirmation coverage is incomplete; absence is not zero visits.'},
    {label:'Projects with sent-quote evidence',value:inspect(totals.quote,'sent-quote projects',()=>evidence('quote')),detail:`Of ${totals.origins} origin projects; subsequent outcomes`},
    {label:'Projects with current accepted scope',value:inspect(totals.accepted,'accepted projects',()=>evidence('accepted')),detail:`Of ${totals.origins} origin projects; current commercial truth`},
    {label:'Payment-verified projects',value:inspect(totals.won,'payment-verified projects',()=>evidence('payment')),detail:`Of ${totals.origins} origin projects; includes qualifying partial deposits, not all business wins`},
  ]:filters.view==='sales'?[
    {label:'Quote versions sent',value:inspect(eventCount('quote_sent'),'quote versions sent',()=>inspectEvents('quote_sent')),detail:'Saved sent dates; revisions count separately'},
    {label:'Quote versions accepted',value:inspect(eventCount('quote_accepted'),'quote versions accepted',()=>inspectEvents('quote_accepted')),detail:'Saved acceptance dates; later cancellation does not erase activity'},
    {label:'Net recorded receipts',value:inspect(missingAmounts?'Unavailable':selected.events.some(e=>['payment','reversal'].includes(e.kind))?money(net):'No evidence','payments and reversals',()=>inspectEvents('receipts')),detail:'NZD incl. GST · payments + reversals on their event dates; incomplete historical ledger'},
    {label:'Payment entries',value:inspect(eventCount('payment'),'payment entries',()=>inspectEvents('payment')),detail:'Not unique projects; inspect later reversals'},
    {label:'Invoices marked paid',value:inspect(eventCount('invoice_paid'),'invoices marked paid',()=>inspectEvents('invoice_paid')),detail:'Status events only; not added to money received'},
    {label:'All recorded sales events',value:inspect(selected.events.length,'all sales events',()=>inspectEvents('')),detail:`${new Set(selected.events.map(e=>e.projectId)).size} unique projects; not a conversion funnel`},
  ]:[
    {label:'Projects in this selection',value:inspect(projects.length,'all projects',()=>evidence('all')),detail:`${projects.filter(p=>p.state!=='ARCHIVED').length} non-archived + ${projects.filter(p=>p.state==='ARCHIVED').length} archived`},
    {label:'Projects without receipts',value:inspect(projects.filter(p=>p.receiptCount===0).length,'projects without receipts',()=>evidence('no_receipt')),detail:'Included here; unavailable to enquiry-cohort reporting'},
    {label:'Projects marked paid',value:inspect(projects.filter(p=>normalizePipelineStageKey(p.stage)==='paid').length,'projects marked paid',()=>evidence('paid')),detail:'Current project stage; does not establish payment-ledger completeness'},
    {label:'Payment-verified projects',value:inspect(projects.filter(p=>p.paymentVerified).length,'portfolio payment evidence',()=>evidence('payment')),detail:'Current qualifying payment evidence; independent of project stage'},
    {label:'Paid stage, missing payment evidence',value:inspect(projects.filter(p=>normalizePipelineStageKey(p.stage)==='paid'&&!p.paymentVerified).length,'paid evidence gaps',()=>evidence('paid_gap')),detail:'Inspect before any historical backfill; no automatic changes'},
    {label:'Known / possible test projects',value:inspect(projects.filter(p=>p.knownTest||p.testCandidate).length,'test candidates',()=>evidence('test')),detail:'Included in portfolio reconciliation; labels are candidates, not automatic exclusions'},
  ];
  const labels=filters.view==='enquiries'?['Submissions','Qualification','Confirmed visits','Quoted projects','Accepted projects','Payment verified']:filters.view==='sales'?['Versions sent','Versions accepted','Net receipts · NZD','Payment entries','Invoices paid','Sales events']:['Projects','No enquiry receipt','Marked paid','Payment verified','Payment evidence gaps','Possible tests'];
  return <div className={styles.metrics}><MetricGrid columns={3} ariaLabel={`${filters.view} measures`} items={items.map((item,i)=>({...item,label:labels[i],detail:filters.view==='enquiries'&&i>=3?`${totals.origins} origin projects`:filters.view==='enquiries'&&i===2?'Partial historical coverage':filters.view==='sales'&&i===2?'Recorded ledger · incl. GST':undefined}))}/><ReportDetail title="How these totals are counted" label="Metric definitions">{items.map(item=><p key={item.label}><strong>{item.label}</strong><br/>{item.detail}</p>)}</ReportDetail></div>;
}
