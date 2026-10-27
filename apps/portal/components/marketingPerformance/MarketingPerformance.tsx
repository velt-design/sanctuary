'use client';
import type { InitialReport } from '@/lib/marketingPerformance/reportRead';
import type { CommercialReport } from '@/lib/marketingPerformance/commercial';
import type { DesignerReport } from '@/lib/marketingPerformance/designerContract';
import type {InitialFinancialSeed} from '@/lib/xero/financials/profitParts';
import type {FinancialProfitLoader} from '@/components/financials/loadFinancialProfitParts';
import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import StaffPageHeader from '@/components/layout/StaffPageHeader';
import PageHeader from '@/components/layout/PageHeader';
import { Button, Select } from '@/components/ui/foundation/FoundationControls';
import { PageLayout } from '@/components/ui/foundation/FoundationSurfaces';
import { AlertBanner } from '@/components/ui/foundation/FoundationAlert';
import ReadStatus from '@/components/page-state/ReadStatus';
import { TabNavigation } from '@/components/ui/foundation/FoundationOperational';
import { defaultFilters, validPeriod, summarize, rate, type Filters } from '@/lib/marketingPerformance/contract';
import { hubDefaults, hubQuery, parseHubFilters, selectHub, views, eventLabels, evidenceForView, type HubFilters as FiltersState } from '@/lib/marketingPerformance/hub';
import HubToolbar from './HubToolbar';
import BusinessOverview from './BusinessOverview';
import { Drawer } from './MarketingDrawer';
import HubMetrics from './HubMetrics';
import HubRecords from './HubRecords';
import HubCompleteness from './HubCompleteness';
import type { MetaEvidenceLoader } from '@/lib/marketingPerformance/dataSources';
import PerformanceComparison from './PerformanceComparison';
import PerformanceDefinitions from './PerformanceDefinitions';
import PerformanceTrends from './PerformanceTrends';
import useHub, { loadHub, type HubLoader } from './useHub';
import { loadReport, type ReportLoader } from './useMarketingReports';
import useReportReturnPosition from './useReportReturnPosition';
import styles from './MarketingPerformance.module.css';
import theme from './MarketingTheme.module.css';
import Financials from '@/components/financials/Financials';
import type { FinancialsLoader } from '@/components/financials/useFinancials';
import useDesigner, { type DesignerLoader } from './useDesigner';
import type { OutcomeClient } from './ProjectSalesOutcome';
import type { AssignmentClient } from './SalesDesignerAssignment';
import useCommercial, { type CommercialLoader } from './useCommercial';
import useVisibleSelection from '@/components/financials/useVisibleSelection';
import usePreparedReportViews from './usePreparedReportViews';
import type { loadAdsStatus } from '@/lib/marketingIntegrations/googleAds/contract';
import type { loadMetaSaleStatus } from '@/lib/marketingIntegrations/metaSales/contract';
import type { InitialHubSeed } from '@/lib/marketingPerformance/initialHub';
import type { ColumnarReport } from '@/lib/marketingPerformance/columnarReports';

function documentFilters(query:string, defaults:Filters) { const params=new URLSearchParams(query),filters=parseHubFilters(params,defaults);if(!params.has('view'))filters.view='overview';return filters;}

const DataSources=dynamic(()=>import('./DataSources'),{loading:()=> <p role="status">Preparing report view…</p>});

export default function MarketingPerformance({loader=loadHub,priorLoader=loadReport,synthetic=false,initialFilters,initialHubSeed,initialCommercialSeed,initialDesignerSeed,initialFinancialSeed,staging=false,previewDescription,productionSnapshot=false,initialQuery,metaLoader,googleLoader,metaSaleLoader,financialsLoader,financialProfitLoader,commercialLoader,designerLoader,assignmentClient,outcomeClient}: {
  initialQuery?:string;initialHubSeed?:InitialHubSeed;initialCommercialSeed?:InitialReport<CommercialReport|ColumnarReport>;initialDesignerSeed?:InitialReport<DesignerReport|ColumnarReport>;initialFinancialSeed?:InitialFinancialSeed;
  financialsLoader?:FinancialsLoader;financialProfitLoader?:FinancialProfitLoader;commercialLoader?:CommercialLoader;designerLoader?:DesignerLoader;assignmentClient?:AssignmentClient;outcomeClient?:OutcomeClient;googleLoader?:typeof loadAdsStatus;metaSaleLoader?:typeof loadMetaSaleStatus;
  metaLoader?:MetaEvidenceLoader;loader?:HubLoader;priorLoader?:ReportLoader;synthetic?:boolean;initialFilters?:Filters;staging?:boolean;previewDescription?:string;productionSnapshot?:boolean;
}) {
  const [draft,setDraft]=useState<FiltersState>(()=>initialQuery?documentFilters(initialQuery,initialFilters??defaultFilters()):({...hubDefaults(initialFilters??defaultFilters()),view:'overview' as const}));
  const [applied,setApplied]=useState<FiltersState|null>(()=>initialQuery?documentFilters(initialQuery,initialFilters??defaultFilters()):null), [validation,setValidation]=useState(''), [revision,setRevision]=useState(0);
  const [eventKind,setEventKind]=useState(''),[info,setInfo]=useState(false),[sources,setSources]=useState(false);
  const [commercialRetry,setCommercialRetry]=useState(0),[designerRetry,setDesignerRetry]=useState(0);
  const [financialSeed,setFinancialSeed]=useState(initialFinancialSeed);
  const [financialQuery,setFinancialQuery]=useState(initialQuery);
  useEffect(()=>{if(applied&&applied.view!=='financials')setFinancialSeed(undefined);},[applied?.view]);
  const commercialEvidence=useCommercial(applied?.view==='overview'?applied:null,revision+commercialRetry,commercialLoader,initialCommercialSeed,Boolean(applied&&applied.view!=='overview'));
  const designerEvidence=useDesigner(applied?.view==='overview'?applied:null,revision+designerRetry,designerLoader,initialDesignerSeed,Boolean(applied&&applied.view!=='overview'));
  const {hub,previous,busy,error,accessDenied:hubAccessDenied,comparisonError,comparisonBusy}=useHub(applied?.view==='financials'?null:applied,revision,loader,priorLoader,applied?.view==='enquiries',initialHubSeed,applied?.view==='financials');
  const accessDenied=hubAccessDenied||commercialEvidence.accessDenied||designerEvidence.accessDenied;
  const prepared=usePreparedReportViews(applied?.view==='overview'?null:applied?.view??null);
  const {enquiries:EnquiryCharts,sales:SalesActivity,portfolio:PortfolioChart}=prepared.components;
  const panelState=prepared.error?<AlertBanner tone="error" title="Report view unavailable" action={<Button variant="secondary" onClick={prepared.retry}>Retry report view</Button>}>{prepared.error}</AlertBanner>:<p role="status">Preparing report view…</p>;
  const position=useReportReturnPosition(busy||prepared.preparing,busy);
  const tabs=useVisibleSelection(draft.view);
  useEffect(()=>{
    const restore=()=>{const query=new URLSearchParams(window.location.search);const f=parseHubFilters(query,initialFilters??defaultFilters());if(!query.has('view'))f.view='overview';if(f.view==='financials')setFinancialQuery(query.toString());setDraft(f);setApplied(f);setEventKind(f.kind);};
    restore();window.addEventListener('popstate',restore);return()=>window.removeEventListener('popstate',restore);
  },[initialFilters]);
  const apply=(f:FiltersState)=>{
    if(!evidenceForView(f.view).some(([key])=>key===f.evidence)) f={...f,evidence:'all'};
    if(f.view==='sales') f={...f,inspect:'all'};
    if(!validPeriod(f.start,f.end)){setValidation('Choose valid dates, up to 366 days ending today or earlier.');return;}
    setValidation('');const url=new URL(window.location.href);
    const query=hubQuery(f);for(const [key,value] of url.searchParams){if(key.startsWith('finance')||key==='designerScenario'||['progressive','failure','comparisonFailure','representative','commercialMetric','commercialMonth','commercialPeriod','commercialFailure','commercialCoverage'].includes(key))query.set(key,value);}
    // Let Next update its canonical URL; passing its internal history state skips that update.
    url.search=query.toString();window.history.replaceState(null,'',url);if(f.view==='financials')setFinancialQuery(url.searchParams.toString());setDraft(f);setApplied(f);setEventKind(f.kind);
  };
  const inspectEvents=(kind:string)=>{if(applied)apply({...applied,kind});};
  const Header=synthetic?PageHeader:StaffPageHeader;
  const selected=useMemo(()=>hub&&applied?selectHub(hub,{...applied,inspect:'all'}):null,[hub,applied]);
  const totals=selected?summarize(selected.enquiries):null;
  const priorFiltered=hub&&previous&&applied?{...previous,rows:selectHub({...hub,enquiries:previous},{...applied,inspect:'all'}).enquiries}:null;
  return <PageLayout width="full" className={`${theme.theme} ${styles.page}`} data-marketing-report>
    <Header className={styles.reportHeader} variant="index" title="Marketing & Sales" right={draft.view!=='financials'?<HubToolbar filters={applied??draft} apply={apply} hub={hub} feedback={<ReadStatus title={accessDenied?'Report access unavailable':error?'Hub unavailable':busy?'Reading reports…':'Report sources'} tone={accessDenied||error?'error':'neutral'} onRetry={accessDenied||error?()=>setRevision(n=>n+1):undefined} details={<p>{accessDenied?'Current developer access is required. Report values have been cleared.':error?`${error} No partial totals are shown.`:busy?'Reading complete saved source records.':'Authoritative saved business records; observed attribution is separate from platform claims.'}</p>}/>}/>:undefined} subtitle={(synthetic||staging||previewDescription)?<span className={styles.environmentLabel}>{productionSnapshot?'Private preview · Real snapshot · 22 Sep 2026':synthetic?'Demo · Fictional records':staging?'Staging · Test records':'Preview'}</span>:undefined}/>
    <div ref={tabs} style={{minWidth:0}}><TabNavigation items={views.map(v=>({...v,controls:'hub-results'}))} selectedKey={draft.view} onSelect={view=>apply({...draft,view,inspect:'all'})} ariaLabel="Marketing and sales views"/></div>
    {draft.view==='financials'?<div id="hub-results"><Financials initialQuery={financialQuery} initialSeed={financialSeed} loader={financialsLoader} profitLoader={financialProfitLoader} synthetic={synthetic}/></div>:<>
    {validation&&<p role="alert">{validation}</p>}
    <div id="hub-results" ref={position.region} className={styles.results} style={{minHeight:busy||prepared.preparing?position.height:undefined}} onClickCapture={position.remember} aria-busy={draft.view==='overview'?false:busy||prepared.preparing} data-hub-pending={busy||undefined} data-comparison-pending={comparisonBusy||undefined}>
      {!accessDenied&&draft.view==='overview'&&<BusinessOverview hubError={error} retryHub={()=>setRevision(n=>n+1)} commercialEvidence={commercialEvidence} designerEvidence={designerEvidence} retryCommercial={()=>setCommercialRetry(n=>n+1)} retryDesigner={()=>setDesignerRetry(n=>n+1)} hub={hub} filters={applied??draft} apply={apply} commercialLoader={commercialLoader} designerLoader={designerLoader} assignmentClient={assignmentClient} outcomeClient={outcomeClient} synthetic={synthetic} revision={revision}/>}
      {accessDenied?null:<>
        {draft.view!=='overview'&&<>
          <div className={styles.contextLine}><span>{draft.view==='portfolio'?draft.created?'Projects created in selected dates':'All project dates · Current position':draft.view==='enquiries'?'Enquiries received in selected dates · Outcomes to date':'Recorded events in selected dates'} · NZ time</span></div>
          <HubMetrics pending={busy} hub={hub} filters={applied??draft} apply={apply} inspectEvents={inspectEvents}/>
          {draft.view==='enquiries'&&<div className={styles.contextLine}><div className={styles.coverageTrack}><span style={{width:totals?rate(totals.attributed,totals.enquiries):'0%'}}/></div><span>{totals?`${rate(totals.attributed,totals.enquiries)} source known · ${totals.enquiries-totals.attributed} unknown`:busy?'Reading source coverage…':'Source coverage unavailable'}</span><Button variant="quiet" onClick={()=>setInfo(true)}>How it’s counted</Button></div>}
          {draft.view==='enquiries'&&(EnquiryCharts?<EnquiryCharts rows={selected?.enquiries??null} pending={busy} filters={applied??draft} apply={apply}/>:panelState)}
          {draft.view==='portfolio'&&(PortfolioChart?<PortfolioChart projects={selected?.projects??null} pending={busy} filters={applied??draft} apply={apply}/>:panelState)}
          {draft.view==='sales'&&(SalesActivity?<SalesActivity events={selected?.events??null} pending={busy} filters={applied??draft} apply={apply}/>:panelState)}
          {draft.view==='sales'&&<Select label="Sales events to inspect" value={eventKind} onChange={e=>inspectEvents(e.target.value)}><option value="">All event types</option><option value="receipts">Payments and reversals</option>{Object.entries(eventLabels).map(([key,label])=><option key={key} value={key}>{label}</option>)}</Select>}
          <HubRecords pending={busy} productionSnapshot={productionSnapshot} hub={hub} filters={applied??draft} synthetic={synthetic} eventKind={eventKind} apply={apply}/>
        </>}
        {draft.view==='enquiries'&&<>
          <details><summary>Compare sources & campaigns</summary><PerformanceComparison pending={busy} rows={selected?.enquiries??null} onInspect={(source,campaign)=>apply({...draft,source,campaign,inspect:'all'})}/></details>
          <details><summary>Enquiry trends and previous-period comparison</summary><PerformanceTrends pending={busy} rows={selected?.enquiries??null} filters={applied??draft} previous={priorFiltered} earliestReceipt={hub?.earliestReceipt} comparisonError={comparisonError} comparisonBusy={comparisonBusy} onRetry={()=>setRevision(n=>n+1)}/></details>
        </>}
        <footer className={styles.reportFooter}><span>Acquisition cost: unavailable <Button variant="quiet" disabled={!hub} onClick={()=>setSources(true)}>Data sources</Button></span><span>{hub?`${new Date(hub.asOf).toLocaleString('en-NZ',{timeZone:'Pacific/Auckland',dateStyle:'medium',timeStyle:'short'})} NZ`:busy?'Reading source time…':'Source time unavailable'} <Button variant="quiet" disabled={busy} onClick={()=>setRevision(n=>n+1)}>Refresh</Button><Button variant="quiet" onClick={()=>setInfo(true)}>Data & definitions</Button></span></footer>
        <Drawer title="Data sources" open={sources&&Boolean(hub)} onClose={()=>setSources(false)}>{sources&&hub&&<DataSources hub={hub} loader={metaLoader} googleLoader={googleLoader} metaSaleLoader={metaSaleLoader} synthetic={synthetic}/>}</Drawer>

      </>}
        <Drawer title="Data & definitions" open={info&&!accessDenied} onClose={()=>setInfo(false)}>
          <p className={styles.muted}>{previewDescription??'Authoritative saved business records; observed attribution is separate from platform claims.'}</p>
          {hub&&applied&&totals?<><HubCompleteness hub={hub} filters={applied} apply={next=>{apply(next);setInfo(false);}}/>
          <PerformanceDefinitions excludedTests={hub.enquiries.excludedTests} unlinked={totals.unlinked}/></>:<p role={busy?'status':undefined}>{busy?'Reading complete source definitions and coverage…':'Source coverage unavailable.'}</p>}
          <p>Advertising evidence is available through Data sources when a retained source report exists. Acquisition costs remain unavailable until spend and business outcomes have a verified matching basis. Google and Meta conversion claims are not added to business outcomes.</p>
        </Drawer>
    </div></>}
  </PageLayout>;
}
