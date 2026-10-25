import 'server-only';
import { z } from 'zod';
import { financePositionReader, type PositionDependencies } from '../financePosition';
import { PositionReadError } from '../financePositionProvider';
import { financialPanelSchema, financialCurrentSchema, previousQuery, yearAgoQuery, trendQueries, type FinancialPanelQuery, type FinancialPanel, type FinancialCurrent, type FinancialsQuery } from './contract';
import { readProfitPanel } from './profitPanel';

type PanelObserver = {current:(report:FinancialCurrent)=>void; fatal:(error:unknown)=>void};
type Reader = Awaited<ReturnType<typeof financePositionReader>>;
const notRequested={status:'not_requested' as const};
function panelBase(reader:Reader,query:FinancialsQuery,financialYearEnd:FinancialPanel['financialYearEnd'],checkedAt:string,families:Pick<FinancialPanel['position'],'profitAndLoss'|'bankSummary'|'receivables'|'payables'>){
  return {checkedAt,financialYearEnd,position:{schemaVersion:'sanctuary.praxis.finance-position.v1' as const,query,
    identity:reader.identity,startedAt:reader.startedAt,checkedAt,consistency:'sequential_read_window' as const,
    organisation:reader.organisation,...families,
    limitations:['Only the requested report family is read. Other families are not requested, not failed or zero.',
      'Reports describe selected dates; outstanding invoices and bills describe the current read window, not historical balances.',
      'Bank movements are accounting balances, not bank-statement balances or spendable cash. Unentered activity and commitments are outside this read.',
      'Document currencies remain separate. No accounting records are written or reconciled.']}};
}
/** Only the requested panel enters the provider read window. No omitted family is a failed read. */
export async function readFinancialPanel(input: FinancialPanelQuery, deps: PositionDependencies, signal: AbortSignal, observer?:PanelObserver) {
  const {section,...query}=input;
  let financialYearEnd:{month:number;day:number}|null=null;
  const reader=await financePositionReader(query,{...deps,read:async(input,signal)=>{
    const values=await deps.read(input,signal);
    if(input.family==='organisation'&&values.length===1){
      const parsed=z.object({FinancialYearEndMonth:z.number().int().min(1).max(12),FinancialYearEndDay:z.number().int().min(1).max(31)}).safeParse(values[0]);
      if(parsed.success){const {FinancialYearEndMonth:month,FinancialYearEndDay:day}=parsed.data;if(new Date(Date.UTC(2000,month-1,day)).getUTCMonth()===month-1)financialYearEnd={month,day};}
    }
    return values;
  }},signal);
  const profit=section==='profit'?await readProfitPanel(query,reader,observer?async primary=>{
    // The original full reader requires this fresh check. Early evidence must
    // pass it too, rather than waiting for the final monthly publication check.
    await reader.finish();
    const checkedAt=deps.now().toISOString();
    const current=financialCurrentSchema.parse({schemaVersion:'sanctuary.financial-profit-current.v1',requestedSection:'profit',
      ...panelBase(reader,query,financialYearEnd,checkedAt,{profitAndLoss:primary.profitAndLoss,bankSummary:notRequested,receivables:notRequested,payables:notRequested}),
      previous:primary.previous,yearAgo:primary.yearAgo});
    if(Buffer.byteLength(JSON.stringify(current))>4*1024*1024)throw new PositionReadError('limit_exceeded');
    observer.current(current);
  }:undefined,observer?.fatal):null;
  const profitAndLoss=profit?.profitAndLoss??notRequested;
  const bankSummary=section==='bank'?await reader.reportDomain('bankSummary'):notRequested;
  const receivables=section==='receivables'?await reader.invoices('receivables'):notRequested;
  const payables=section==='payables'?await reader.invoices('payables'):notRequested;
  const comparisons=profit
    ?{previous:profit.previous,yearAgo:profit.yearAgo,months:profit.months}
    :{previous:{query:previousQuery(query),report:notRequested},yearAgo:{query:yearAgoQuery(query),report:notRequested},months:trendQueries(query).map(query=>({query,report:notRequested}))};
  await reader.finish();
  const checkedAt=deps.now().toISOString();
  const result=financialPanelSchema.parse({schemaVersion:'sanctuary.financial-panel.v1',requestedSection:section,
    ...panelBase(reader,query,financialYearEnd,checkedAt,{profitAndLoss,bankSummary,receivables,payables}),...comparisons});
  if(Buffer.byteLength(JSON.stringify(result))>4*1024*1024)throw new PositionReadError('limit_exceeded');
  return result;
}
