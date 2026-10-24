'use client';
import type {InitialFinancialSeed} from '@/lib/xero/financials/profitParts';
import type {FinancialProfitLoader} from './loadFinancialProfitParts';
import { useEffect, useState } from 'react';
import { ButtonLink } from '@/components/ui/foundation/FoundationControls';
import { TabNavigation } from '@/components/ui/foundation/FoundationOperational';
import { hasPartialCalendarMonth, selectionFromUrl, selectionToUrl, type FinancialSelection } from '@/lib/xero/financials/contract';
import { reportLines } from '@/lib/xero/financials/model';
import useFinancials, { type FinancialsLoader } from './useFinancials';
import FinancialToolbar from './FinancialToolbar';
import ProfitView from './ProfitView';
import BankView from './BankView';
import OutstandingView from './OutstandingView';
import FinancialDetail from './FinancialDetail';
import FinancialStatus from './FinancialStatus';
import styles from './Financials.module.css';
import useVisibleSelection from './useVisibleSelection';

const sections = [{key:'profit',label:'Profit & loss'},{key:'bank',label:'Bank balances'},{key:'receivables',label:'Money owed'},{key:'payables',label:'Bills to pay'}] as const;
const reasons: Record<string,string> = {
  missing_scope:'The existing Xero connection does not currently grant this report.', provider_denied:'Xero denied access to this report. The connection or its report rights need attention.',
  provider_unavailable:'Xero did not return this report within the read window. Retry shortly.', invalid_response:'The source report could not be verified. Partial figures are withheld.',
  limit_exceeded:'The source report exceeds the complete-read limit. Partial totals are withheld.', metadata_unavailable:'Organisation metadata is unavailable, so report currency cannot be verified.',
};
export default function Financials({loader,profitLoader,synthetic=false,initialSeed,initialQuery}:{initialQuery?:string;loader?:FinancialsLoader;profitLoader?:FinancialProfitLoader;synthetic?:boolean;initialSeed?:InitialFinancialSeed}) {
  const [selection,setSelection]=useState<FinancialSelection>(() => selectionFromUrl(new URLSearchParams(initialQuery))), [ready,setReady]=useState(initialQuery!==undefined), [revision,setRevision]=useState(0);
  useEffect(() => {
    const restore = () => {setSelection(selectionFromUrl(new URLSearchParams(window.location.search)));setReady(true);};
    restore();window.addEventListener('popstate',restore);return () => window.removeEventListener('popstate',restore);
  },[]);
  return <FinancialsContent enabled={ready} selection={selection} setSelection={setSelection} revision={revision} retry={() => setRevision(value => value+1)} loader={loader} profitLoader={profitLoader} synthetic={synthetic} initialSeed={initialSeed}/>;
}
function FinancialsContent({enabled,selection,setSelection,revision,retry,loader,profitLoader,synthetic,initialSeed}:{enabled:boolean;selection:FinancialSelection;setSelection:(selection:FinancialSelection)=>void;revision:number;retry:()=>void;loader?:FinancialsLoader;profitLoader?:FinancialProfitLoader;synthetic:boolean;initialSeed?:InitialFinancialSeed}) {
  const {report,retained,profitEvidence,busy,error,reportIsCurrent}=useFinancials(selection,revision,loader,initialSeed,enabled,profitLoader);
  const tabs=useVisibleSelection(selection.section);
  const apply=(next:FinancialSelection)=>{const url=new URL(window.location.href);url.search=selectionToUrl(url.searchParams,next).toString();window.history.replaceState(null,'',url);setSelection(next);};
  const position=report?.position;
  const mismatch=position && (position.query.from!==selection.from || position.query.to!==selection.to || position.query.basis!==selection.basis);
  const field=selection.section==='profit'?'profitAndLoss':selection.section==='bank'?'bankSummary':selection.section;
  const fresh=position?.[field];
  const displayedProfit=profitEvidence??(position?.profitAndLoss.status!=='not_requested'?report:null);
  const fallback=retained?.position[field];
  const family=fresh?.status==='available'?fresh:fallback?.status==='available'?fallback:fresh;
  const selectedPending=busy&&family?.status!=='available'&&!reportIsCurrent;
  const sourceReport=family?.status==='available' && (field==='profitAndLoss'||field==='bankSummary') && 'rows' in family.data ? family.data : null;
  const invoices=family?.status==='available' && 'items' in family.data ? family : null;
  const row=sourceReport?reportLines(sourceReport).find(row=>row.key===selection.detail)??null:null;
  const invoice=invoices && 'items' in invoices.data?invoices.data.items.find(item=>item.id===selection.detail)??null:null;
  const checked=family?.status==='available'?family.checkedAt:null;
  const currentTimestamp=checked?new Date(checked).toLocaleString('en-NZ',{timeZone:'Pacific/Auckland',dateStyle:'medium',timeStyle:'short'}):null;
  const stale=checked?Date.now()-Date.parse(checked)>30*3600000:false;
  const unavailable=reportIsCurrent&&fresh?.status==='unavailable';
  const currentOnly=report?.schemaVersion==='sanctuary.financial-profit-current.v1';
  const statusSummary=busy&&currentOnly&&reportIsCurrent?(fresh?.status==='available'?'Selected report verified · reading monthly trend…':'Selected report unavailable · reading monthly trend…'):busy?(family?.status==='available'?'Updating · earlier report shown':'Reading Xero reports…'):error?'Financial reports unavailable':unavailable?`${sections.find(s=>s.key===selection.section)?.label} unavailable`:stale?'Report older than 30 hours':currentTimestamp?`Checked ${currentTimestamp} NZ`:'';
  const statusMessage=[error,unavailable?reasons[fresh.reason]:null,
    mismatch&&report?`Showing ${sourceReport?.from??position!.query.from} to ${sourceReport?.to??position!.query.to} · ${sourceReport?.basis??position!.query.basis}. Selected ${selection.from} to ${selection.to} · ${selection.basis}. New evidence is not yet available.`:null,
    (error||unavailable)&&family?.status==='available'?`Last successful evidence checked ${currentTimestamp} NZ remains below with its original dates.`:null,
    stale?'This report is more than 30 hours old. Refresh Xero before relying on current balances.':null].filter(Boolean).join(' ');
  return <div className={styles.page}>
    <FinancialToolbar selection={selection} apply={apply} report={report} busy={busy} retry={retry}/>
    <div ref={tabs} style={{minWidth:0}}><TabNavigation items={sections.map(section=>({...section,controls:'financial-results'}))} selectedKey={selection.section} onSelect={section=>apply({...selection,section,detail:''})} ariaLabel="Financial reports"/></div>
    <div className={styles.result} id="financial-results" aria-busy={busy} data-financial-current={family?.status==='available'?(reportIsCurrent?"ready":"retained"):busy&&!reportIsCurrent?"pending":(!busy&&error)||report?"unavailable":"pending"} data-financial-complete={Boolean(report&&!currentOnly&&!busy&&!error)}>
      <FinancialStatus summary={statusSummary} message={statusMessage||undefined} retry={error||unavailable||stale?retry:undefined} busy={busy}/>
      {selection.section==='profit'&&<ProfitView pending={selectedPending} busy={busy} report={sourceReport} evidence={displayedProfit} selection={selection} apply={apply} onDetail={row=>apply({...selection,detail:row.key})} retry={retry}/>}
      {sourceReport && report && <>
        <p className={`${styles.context} ${styles.reportContext}`}>Showing {sourceReport.from} to {sourceReport.to} · {sourceReport.currency} · {sourceReport.basis==='bank_movements'?'recorded bank movements':`${sourceReport.basis} · excluding GST`}{hasPartialCalendarMonth(sourceReport)?' · partial calendar month':''}{position?.organisation.status==='available'?` · ${position.organisation.data.name}`:''}</p>

      </>}
      {selection.section==='bank'&&<BankView report={sourceReport} selection={selection} pending={selectedPending} onDetail={row=>apply({...selection,detail:row.key})}/>}
      {(selection.section==='receivables'||selection.section==='payables')&&<OutstandingView key={selection.section} family={invoices&&'items' in invoices.data?invoices as Extract<NonNullable<typeof position>['receivables'],{status:'available'}>:null} pending={selectedPending} baseCurrency={position?.organisation.status==='available'?position.organisation.data.baseCurrency:undefined} payable={selection.section==='payables'} onDetail={invoice=>apply({...selection,detail:invoice.id})}/>}

      {report && <>
        <details className={styles.source}><summary>Source & accounting basis</summary><p>Reports are read from the existing Sanctuary Xero connection. No accounting records are changed here.</p><p>Latest response read window: {report.position.startedAt} to {report.checkedAt}. Retained evidence keeps its original checked time above. Reports are read separately; bookkeeping can change between requests. Comparisons use the same requested basis and source currency, with exact dates shown.</p><p>Accrual reports recognise income and costs using accounting entries; cash reports use Xero’s payments-only calculation. Neither is the organisation’s GST-return setting. P&L values exclude GST. Bank movements and document balances retain their source tax treatment.</p><ul>{report.position.limitations.map(limit=><li key={limit}>{limit}</li>)}</ul>{!synthetic&&<ButtonLink href="/staff/payments" variant="quiet">Open operational Finance</ButtonLink>}</details>
        <FinancialDetail detail={row} report={sourceReport} evidence={selection.section==='profit'?(profitEvidence??report):report} invoice={invoice} close={()=>apply({...selection,detail:''})} synthetic={synthetic}/>
      </>}
    </div>
  </div>;
}
