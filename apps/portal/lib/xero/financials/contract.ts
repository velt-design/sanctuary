import { z } from 'zod';
import { financePositionQuery, financePositionSchema, financeReport, financeUnavailable } from '../financePositionContract';

export const financialsQuery = financePositionQuery;
const reportEvidence = z.union([z.object({ status: z.literal('available'), complete: z.literal(true), checkedAt: z.string().datetime(), data: financeReport }).strict(), financeUnavailable]);
export const financialsSchema = z.object({
  schemaVersion: z.literal('sanctuary.financials.v1'),
  position: financePositionSchema,
  checkedAt: z.string().datetime(),
  financialYearEnd: z.object({ month: z.number().int().min(1).max(12), day: z.number().int().min(1).max(31) }).strict().nullable(),
  previous: z.object({ query: financialsQuery, report: reportEvidence }).strict(),
  yearAgo: z.object({ query: financialsQuery, report: reportEvidence }).strict(),
  months: z.array(z.object({ query: financialsQuery, report: reportEvidence }).strict()).length(6),
}).strict().superRefine((value,ctx) => {
  const query=value.position.query,expected=[previousQuery(query),yearAgoQuery(query),...trendQueries(query)];
  const reports=[value.previous,value.yearAgo,...value.months];
  const same=(a:{from:string;to:string;basis:string},b:FinancialsQuery)=>a.from===b.from&&a.to===b.to&&a.basis===b.basis;
  if(reports.some((item,index)=>!same(item.query,expected[index])||(item.report.status==='available'&&(!same(item.report.data,item.query)||(value.position.organisation.status==='available'&&item.report.data.currency!==value.position.organisation.data.baseCurrency)))))ctx.addIssue({code:'custom',message:'Comparison dates, basis or currency do not match the source selection.'});
  if(value.checkedAt<value.position.checkedAt)ctx.addIssue({code:'custom',message:'Invalid source read window.'});
});
export type Financials = z.infer<typeof financialsSchema>;
export type FinancialReport = z.infer<typeof financeReport>;
export type ReportEvidence = z.infer<typeof reportEvidence>;
export type FinancialsQuery = z.infer<typeof financialsQuery>;
type FinancialSection = 'profit' | 'bank' | 'receivables' | 'payables';
export type FinancialSelection = FinancialsQuery & { section: FinancialSection; comparison: 'previous' | 'yearAgo'; detail: string };

export function nzDay(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Pacific/Auckland', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
function dateAt(year: number, month: number, day: number) { return new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10); }
export function hasPartialCalendarMonth(query: Pick<FinancialsQuery, 'from' | 'to'>) {
  const [year, month] = query.to.split('-').map(Number);
  return !query.from.endsWith('-01') || query.to !== dateAt(year, month, 0);
}
export function completedMonth(now = new Date()): FinancialsQuery {
  const [year, month] = nzDay(now).split('-').map(Number);
  return { from: dateAt(year, month - 2, 1), to: dateAt(year, month - 1, 0), basis: 'accrual' };
}
export function previousQuery(query: FinancialsQuery): FinancialsQuery {
  const [year, month] = query.from.split('-').map(Number);
  if (query.from.endsWith('-01') && query.to === dateAt(year, month, 0))
    return { ...query, from: dateAt(year, month - 2, 1), to: dateAt(year, month - 1, 0) };
  const days = (Date.parse(query.to) - Date.parse(query.from)) / 86400000 + 1;
  return { ...query, from: new Date(Date.parse(query.from) - days * 86400000).toISOString().slice(0, 10), to: new Date(Date.parse(query.from) - 86400000).toISOString().slice(0, 10) };
}
export function yearAgoQuery(query: FinancialsQuery): FinancialsQuery {
  const shift = (day: string) => {
    const [year, month, date] = day.split('-').map(Number);
    return dateAt(year - 1, month - 1, Math.min(date, new Date(Date.UTC(year - 1, month, 0)).getUTCDate()));
  };
  return { ...query, from: shift(query.from), to: shift(query.to) };
}
export function trendQueries(query: FinancialsQuery): FinancialsQuery[] {
  const [year, month] = query.to.split('-').map(Number);
  const endMonth = query.to === dateAt(year, month, 0) ? month : month - 1;
  return Array.from({ length: 6 }, (_, i) => ({ basis: query.basis, from: dateAt(year, endMonth - 6 + i, 1), to: dateAt(year, endMonth - 5 + i, 0) }));
}
export function yearToDate(end: {month: number; day: number}, now = new Date()): FinancialsQuery {
  const to = nzDay(now), year = Number(to.slice(0, 4));
  const endDate = (year:number) => dateAt(year,end.month-1,Math.min(end.day,new Date(Date.UTC(year,end.month,0)).getUTCDate()));
  const lastEnd = endDate(year - (to <= endDate(year) ? 1 : 0));
  return { from: new Date(Date.parse(lastEnd) + 86400000).toISOString().slice(0, 10), to, basis: 'accrual' };
}
export function selectionFromUrl(params: URLSearchParams): FinancialSelection {
  const parsed = financialsQuery.safeParse({ from: params.get('financeFrom'), to: params.get('financeTo'), basis: params.get('financeBasis') });
  const query = parsed.success && parsed.data.to <= nzDay() ? parsed.data : completedMonth();
  const section = params.get('financeSection');
  return { ...query, section: section === 'bank' || section === 'receivables' || section === 'payables' ? section : 'profit',
    comparison: params.get('financeCompare') === 'yearAgo' ? 'yearAgo' : 'previous', detail: (params.get('financeDetail') ?? '').slice(0, 200) };
}
export function selectionToUrl(params: URLSearchParams, selection: FinancialSelection) {
  for (const [key, value] of Object.entries({ financeFrom: selection.from, financeTo: selection.to, financeBasis: selection.basis, financeSection: selection.section, financeCompare: selection.comparison, financeDetail: selection.detail })) {
    if (value) params.set(key, value); else params.delete(key);
  }
  return params;
}
