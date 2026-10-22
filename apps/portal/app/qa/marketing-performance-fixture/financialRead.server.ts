import 'server-only';
import {startFinancialProfitRead} from '@/lib/xero/financials/profitParts.server';
import {sampleProfit} from './financialFixtures';
import type {FinancialPanelQuery} from '@/lib/xero/financials/contract';
import {previousQuery,yearAgoQuery} from '@/lib/xero/financials/contract';
import type {FinanceReportRow} from '@/lib/xero/financePositionContract';
import type {PositionDependencies} from '@/lib/xero/financePosition';
import {PositionReadError} from '@/lib/xero/financePositionProvider';
const tenantId='10000000-0000-4000-8000-000000000999';
const wire=(rows:FinanceReportRow[]):unknown[]=>rows.map(row=>({RowType:row.type,Title:row.title,Cells:row.cells.map(cell=>({Value:cell.value,Attributes:cell.attributes.map(attribute=>({Id:attribute.id,Value:attribute.value}))})),Rows:wire(row.rows)}));
function pause(ms:number,signal:AbortSignal){return new Promise<void>((resolve,reject)=>{
  const abort=()=>{clearTimeout(timer);reject(signal.reason??new Error('Cancelled'));};
  const timer=setTimeout(()=>{signal.removeEventListener('abort',abort);resolve();},ms);
  if(signal.aborted)abort();else signal.addEventListener('abort',abort,{once:true});
});}
/** Actual panel reader, exact-period pool, authority checks, parts and cleanup.
 * Only this gated source is synthetic; timings are controlled, not benchmarks. */
export function fixtureFinancialRead(query:FinancialPanelQuery,signal:AbortSignal,scenario='complete'){
  const key=(q:{from:string;to:string;basis:string})=>`${q.from}:${q.to}:${q.basis}`;
  const primary=new Set([query,previousQuery(query),yearAgoQuery(query)].map(key));
  let revoked=false;
  const deps:PositionDependencies={now:()=>new Date(),binding:async()=>{signal.throwIfAborted();if(revoked)throw new Error('POSITION_AUTHORITY_CHANGED');return {tenantId,scope:'organisation'};},read:async(input,readSignal)=>{
    if(input.family==='organisation'){
      await pause(100,readSignal);
      return [{OrganisationID:tenantId,Name:'Fictional demonstration company',BaseCurrency:'NZD',Timezone:'NEWZEALANDSTANDARDTIME',FinancialYearEndMonth:3,FinancialYearEndDay:31}];
    }
    const essential=primary.has(key(input.query));
    await pause(essential?500:1800,readSignal);
    if(scenario==='failure'&&essential)throw new Error('Synthetic financial source failure');
    if(scenario==='late-denial'&&!essential){revoked=true;throw new Error('POSITION_AUTHORITY_CHANGED');}
    if(scenario==='partial'&&!essential)throw new PositionReadError('provider_unavailable');
    const report=sampleProfit(input.query);
    return [{ReportID:'ProfitAndLoss',ReportName:report.name,ReportTitles:report.titles,Rows:wire(report.rows)}];
  }};
  return startFinancialProfitRead(query,deps,signal,async()=>{if(scenario==='cleanup-failure')throw new Error('Synthetic cleanup failure');});
}
