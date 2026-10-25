import {z} from 'zod';
import {financeOrganisationBinding} from '../financePositionContract';
import {financialCurrentSchema,financialPanelSchema,financialsQuery,financialRequestKey,type FinancialCurrent,type FinancialPanel,type FinancialEvidence} from './contract';
import type {InitialReport,ReportRead} from '@/lib/marketingPerformance/reportRead';

const FINANCIAL_PANEL_MAX_BYTES=4*1024*1024;
// The business evidence retains its 4 MiB bound. One request has a separate,
// small framing allowance rather than a fresh 4 MiB allowance for every part.
export const FINANCIAL_PARTS_MAX_BYTES=FINANCIAL_PANEL_MAX_BYTES+4096;
const dated=financialCurrentSchema.shape.previous;
const referencedMonth=z.object({query:financialsQuery,source:z.enum(['current','previous','yearAgo'])}).strict();
export const financialTailSchema=z.object({
  schemaVersion:z.literal('sanctuary.financial-profit-tail.v1'),
  query:financialsQuery,identity:financeOrganisationBinding,startedAt:z.string().datetime(),
  checkedAt:z.string().datetime(),positionCheckedAt:z.string().datetime(),
  months:z.array(z.union([dated,referencedMonth])).length(6),
}).strict();
export type FinancialTail=z.infer<typeof financialTailSchema>;
export type FinancialPartsSeed={key:string;current:Promise<ReportRead<FinancialCurrent>>;tail:Promise<ReportRead<FinancialTail>>;validity:Promise<ReportRead<null>>};
export type InitialFinancialSeed=InitialReport<FinancialEvidence>|FinancialPartsSeed;
function assertFinancialSize(value:unknown,limit=FINANCIAL_PANEL_MAX_BYTES){
  if(new TextEncoder().encode(JSON.stringify(value)).byteLength>limit)throw new Error('Financial evidence exceeds the complete-read limit.');
}
const sameQuery=(a:FinancialCurrent['position']['query'],b:FinancialCurrent['position']['query'])=>a.from===b.from&&a.to===b.to&&a.basis===b.basis;
function primaryReports(current:FinancialCurrent){
  return {current:{query:current.position.query,report:current.position.profitAndLoss},previous:current.previous,yearAgo:current.yearAgo};
}
export function financialTail(current:FinancialCurrent,full:FinancialPanel):FinancialTail{
  const sources=primaryReports(current);
  // Exact periods already share a provider promise. References avoid repeating
  // their report rows when a selected/comparison period also belongs to trend.
  const months=full.months.map(month=>{
    const entry=Object.entries(sources).find(([,source])=>sameQuery(source.query,month.query));
    if(!entry)return month;
    if(JSON.stringify(entry[1].report)!==JSON.stringify(month.report))throw new Error('Financial source changed within the request.');
    return {query:month.query,source:entry[0]};
  });
  const tail=financialTailSchema.parse({schemaVersion:'sanctuary.financial-profit-tail.v1',query:full.position.query,
    identity:full.position.identity,startedAt:full.position.startedAt,checkedAt:full.checkedAt,positionCheckedAt:full.position.checkedAt,months});
  const reconstructed=assembleFinancialParts(current,tail);
  if(JSON.stringify(reconstructed)!==JSON.stringify(full))throw new Error('Financial parts do not match the complete source report.');
  return tail;
}
export function assembleFinancialParts(currentInput:unknown,tailInput:unknown):FinancialPanel{
  assertFinancialSize(currentInput);
  const current=financialCurrentSchema.parse(currentInput),tail=financialTailSchema.parse(tailInput);
  if(!sameQuery(current.position.query,tail.query)||current.position.identity.tenantId!==tail.identity.tenantId||current.position.identity.scope!==tail.identity.scope||current.position.startedAt!==tail.startedAt||tail.checkedAt<current.checkedAt||tail.positionCheckedAt<current.position.checkedAt)throw new Error('Financial parts have different source identity, dates or read window.');
  const sources=primaryReports(current);
  const months=tail.months.map(month=>{
    if(!('source' in month))return month;
    const source=sources[month.source];
    if(!sameQuery(source.query,month.query)||source.report.status==='not_requested')throw new Error('Invalid monthly source reference.');
    return {query:month.query,report:source.report};
  });
  const panel=financialPanelSchema.parse({...current,schemaVersion:'sanctuary.financial-panel.v1',checkedAt:tail.checkedAt,
    position:{...current.position,checkedAt:tail.positionCheckedAt},months});
  assertFinancialSize(panel);
  return panel;
}
export function validateFinancialCurrent(value:unknown,key:string):FinancialCurrent{
  assertFinancialSize(value);
  const report=financialCurrentSchema.parse(value);
  if(financialRequestKey({...report.position.query,section:'profit'})!==key)throw new Error('The source returned different report dates or basis. Retry.');
  return report;
}
