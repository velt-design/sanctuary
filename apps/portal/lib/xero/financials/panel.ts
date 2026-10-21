import 'server-only';
import { z } from 'zod';
import { financePositionReader, type PositionDependencies } from '../financePosition';
import { PositionReadError } from '../financePositionProvider';
import { financialPanelSchema, previousQuery, yearAgoQuery, trendQueries, type FinancialPanelQuery } from './contract';
import { readProfitComparisons } from './read';

/** Only the requested panel enters the provider read window. No omitted family is a failed read. */
export async function readFinancialPanel(input: FinancialPanelQuery, deps: PositionDependencies, signal: AbortSignal) {
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
  const notRequested={status:'not_requested' as const};
  const profitAndLoss=section==='profit'?await reader.reportDomain('profitAndLoss'):notRequested;
  const bankSummary=section==='bank'?await reader.reportDomain('bankSummary'):notRequested;
  const receivables=section==='receivables'?await reader.invoices('receivables'):notRequested;
  const payables=section==='payables'?await reader.invoices('payables'):notRequested;
  const comparisons=profitAndLoss.status!=='not_requested'
    ?await readProfitComparisons(query,{identity:reader.identity,organisation:reader.organisation,profitAndLoss},deps,signal)
    :{previous:{query:previousQuery(query),report:notRequested},yearAgo:{query:yearAgoQuery(query),report:notRequested},months:trendQueries(query).map(query=>({query,report:notRequested}))};
  await reader.finish();
  const checkedAt=deps.now().toISOString();
  const result=financialPanelSchema.parse({schemaVersion:'sanctuary.financial-panel.v1',requestedSection:section,financialYearEnd,
    checkedAt,...comparisons,position:{schemaVersion:'sanctuary.praxis.finance-position.v1',query,
      identity:reader.identity,startedAt:reader.startedAt,checkedAt,consistency:'sequential_read_window',
      organisation:reader.organisation,profitAndLoss,bankSummary,receivables,payables,
      limitations:['Only the requested report family is read. Other families are not requested, not failed or zero.',
        'Reports describe selected dates; outstanding invoices and bills describe the current read window, not historical balances.',
        'Bank movements are accounting balances, not bank-statement balances or spendable cash. Unentered activity and commitments are outside this read.',
        'Document currencies remain separate. No accounting records are written or reconciled.']}});
  if(Buffer.byteLength(JSON.stringify(result))>4*1024*1024)throw new PositionReadError('limit_exceeded');
  return result;
}
