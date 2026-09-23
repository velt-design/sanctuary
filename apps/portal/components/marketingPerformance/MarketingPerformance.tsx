'use client';
import { useEffect, useState } from 'react';
import StaffPageHeader from '@/components/layout/StaffPageHeader';
import PageHeader from '@/components/layout/PageHeader';
import { Button, Select } from '@/components/ui/foundation/FoundationControls';
import { PageLayout, Card } from '@/components/ui/foundation/FoundationSurfaces';
import { AlertBanner } from '@/components/ui/foundation/FoundationAlert';
import { TabNavigation } from '@/components/ui/foundation/FoundationOperational';
import { defaultFilters, validPeriod, summarize, rate, type Filters } from '@/lib/marketingPerformance/contract';
import { hubDefaults, hubQuery, parseHubFilters, selectHub, views, eventLabels, evidenceForView, type HubFilters as FiltersState } from '@/lib/marketingPerformance/hub';
import BusinessOverview from './BusinessOverview';
import SalesActivity from './SalesActivity';
import HubToolbar from './HubToolbar';
import { Drawer } from '@/components/ui/drawer/Drawer';
import HubMetrics from './HubMetrics';
import HubRecords from './HubRecords';
import HubCompleteness from './HubCompleteness';
import EnquiryCharts from './EnquiryCharts';
import PortfolioChart from './PortfolioChart';
import PerformanceComparison from './PerformanceComparison';
import PerformanceDefinitions from './PerformanceDefinitions';
import PerformanceTrends from './PerformanceTrends';
import useHub, { loadHub, type HubLoader } from './useHub';
import { loadReport, type ReportLoader } from './useMarketingReports';
import useReportReturnPosition from './useReportReturnPosition';
import styles from './MarketingPerformance.module.css';

export default function MarketingPerformance({loader=loadHub,priorLoader=loadReport,synthetic=false,initialFilters,staging=false,previewDescription,productionSnapshot=false}: {
  loader?:HubLoader;priorLoader?:ReportLoader;synthetic?:boolean;initialFilters?:Filters;staging?:boolean;previewDescription?:string;productionSnapshot?:boolean;
}) {
  const [draft,setDraft]=useState<FiltersState>(()=>({...hubDefaults(initialFilters??defaultFilters()),view:'overview' as const}));
  const [applied,setApplied]=useState<FiltersState|null>(null), [validation,setValidation]=useState(''), [revision,setRevision]=useState(0);
  const [eventKind,setEventKind]=useState(''),[info,setInfo]=useState(false);
  const {hub,previous,busy,error,comparisonError}=useHub(applied,revision,loader,priorLoader);
  const position=useReportReturnPosition(busy);
  useEffect(()=>{
    const restore=()=>{const query=new URLSearchParams(window.location.search);const f=parseHubFilters(query,initialFilters??defaultFilters());if(!query.has('view'))f.view='overview';setDraft(f);setApplied(f);setEventKind(f.kind);};
    restore();window.addEventListener('popstate',restore);return()=>window.removeEventListener('popstate',restore);
  },[initialFilters]);
  const apply=(f:FiltersState)=>{
    if(!evidenceForView(f.view).some(([key])=>key===f.evidence)) f={...f,evidence:'all'};
    if(f.view==='sales') f={...f,inspect:'all'};
    if(!validPeriod(f.start,f.end)){setValidation('Choose valid dates, up to 366 days ending today or earlier.');return;}
    setValidation('');const url=new URL(window.location.href);
    const query=hubQuery(f);for(const key of ['failure','comparisonFailure','representative']){const value=url.searchParams.get(key);if(value)query.set(key,value);}
    // Let Next update its canonical URL; passing its internal history state skips that update.
    url.search=query.toString();window.history.replaceState(null,'',url);setDraft(f);setApplied(f);setEventKind(f.kind);
  };
  const inspectEvents=(kind:string)=>{if(applied)apply({...applied,kind});};
  const Header=synthetic?PageHeader:StaffPageHeader;
  const selected=hub&&applied?selectHub(hub,{...applied,inspect:'all'}):null;
  const totals=selected?summarize(selected.enquiries):null;
  const priorFiltered=hub&&previous&&applied?{...previous,rows:selectHub({...hub,enquiries:previous},{...applied,inspect:'all'}).enquiries}:null;
  return <PageLayout className={styles.page}>
    <Header variant="index" title="Marketing & Sales"/>
    {(synthetic||staging||previewDescription)&&<p className={styles.environmentLabel}>{productionSnapshot?'Private preview · Real snapshot · 22 Sep 2026':synthetic?'Demo · Fictional records':staging?'Staging · Test records':'Preview'}</p>}
    <TabNavigation items={views.map(v=>({...v,controls:'hub-results'}))} selectedKey={draft.view} onSelect={view=>apply({...draft,view,inspect:'all'})} ariaLabel="Marketing and sales views"/>
    <HubToolbar filters={applied??draft} apply={apply} hub={hub}/>{validation&&<p role="alert">{validation}</p>}
    <div id="hub-results" ref={position.region} className={styles.results} style={{minHeight:position.height}} onClickCapture={position.remember} aria-busy={busy}>
      {busy?<Card title="Loading evidence"><p role="status">Reading saved enquiries, projects and dated sales activity…</p></Card>:error?<AlertBanner tone="error" title="Hub unavailable" action={<Button variant="secondary" onClick={()=>setRevision(n=>n+1)}>Retry</Button>}>{error} No partial totals are shown.</AlertBanner>:hub&&applied&&selected&&totals?<>
        <div className={styles.contextLine}><span>{applied.view==='overview'?'Portfolio now · Sales in selected dates':applied.view==='portfolio'?applied.created?'Projects created in selected dates':'All project dates · Current position':applied.view==='enquiries'?'Enquiries received in selected dates · Outcomes to date':'Recorded events in selected dates'} · NZ time</span></div>
        {applied.view==='overview'?<BusinessOverview hub={hub} filters={applied} apply={apply}/>:<>
        <HubMetrics hub={hub} filters={applied} apply={apply} inspectEvents={inspectEvents}/>
        {applied.view==='enquiries'&&<div className={styles.contextLine}><div className={styles.coverageTrack}><span style={{width:rate(totals.attributed,totals.enquiries)}}/></div><span>{rate(totals.attributed,totals.enquiries)} source known · {totals.enquiries-totals.attributed} unknown</span><Button variant="quiet" onClick={()=>setInfo(true)}>How it’s counted</Button></div>}
        {applied.view==='enquiries'&&<EnquiryCharts rows={selected.enquiries} filters={applied} apply={apply}/>}
        {applied.view==='portfolio'&&<PortfolioChart projects={selected.projects} filters={applied} apply={apply}/>}
        {applied.view==='sales'&&<SalesActivity events={selected.events} filters={applied} apply={apply}/>}
        {applied.view==='sales'&&<Select label="Sales events to inspect" value={eventKind} onChange={e=>inspectEvents(e.target.value)}><option value="">All event types</option><option value="receipts">Payments and reversals</option>{Object.entries(eventLabels).map(([key,label])=><option key={key} value={key}>{label}</option>)}</Select>}
        <HubRecords productionSnapshot={productionSnapshot} hub={hub} filters={applied} synthetic={synthetic} eventKind={eventKind} apply={apply}/>
        </>}

        {applied.view==='enquiries'&&<>
          <details><summary>Compare sources & campaigns</summary><PerformanceComparison rows={selected.enquiries} onInspect={(source,campaign)=>apply({...applied,source,campaign,inspect:'all'})}/></details>
          <details><summary>Enquiry trends and previous-period comparison</summary><PerformanceTrends rows={selected.enquiries} filters={applied} previous={priorFiltered} earliestReceipt={hub.earliestReceipt} comparisonError={comparisonError} onRetry={()=>setRevision(n=>n+1)}/></details>

        </>}
        <footer className={styles.reportFooter}><span>Spend & acquisition cost: unavailable</span><span>{new Date(hub.asOf).toLocaleString('en-NZ',{timeZone:'Pacific/Auckland',dateStyle:'medium',timeStyle:'short'})} NZ <Button variant="quiet" onClick={()=>setRevision(n=>n+1)}>Refresh</Button><Button variant="quiet" onClick={()=>setInfo(true)}>Data & definitions</Button></span></footer>
        <Drawer title="Data & definitions" open={info} onClose={()=>setInfo(false)}>
          <p className={styles.muted}>{previewDescription??'Authoritative saved business records; observed attribution is separate from platform claims.'}</p>
          <HubCompleteness hub={hub} filters={applied} apply={next=>{apply(next);setInfo(false);}}/>
          <PerformanceDefinitions excludedTests={hub.enquiries.excludedTests} unlinked={totals.unlinked}/>
          <p>Spend is unavailable, not zero. Proposed input: evidence-backed CSV by period, source/campaign and NZD spend. Google and Meta conversion claims are not added to business outcomes.</p>
        </Drawer>
      </>:null}
    </div>
  </PageLayout>;
}
