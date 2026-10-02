import { expect,it,vi } from 'vitest';
import type { FinanceReportRow } from '../financePositionContract';
import type { PositionRead } from '../financePositionProvider';
import { PositionReadError } from '../financePositionProvider';
import { sampleProfit } from '../../../app/qa/marketing-performance-fixture/financialFixtures';
import { readFinancials } from './read';
const tenant='10000000-0000-4000-8000-000000000999',query={from:'2026-09-01',to:'2026-09-30',basis:'accrual' as const};
function wire(rows:FinanceReportRow[]):unknown[]{return rows.map(row=>({RowType:row.type,Title:row.title,Cells:row.cells.map(cell=>({Value:cell.value,Attributes:cell.attributes.map(attr=>({Id:attr.id,Value:attr.value}))})),Rows:wire(row.rows)}));}
function fixture(){
  return {now:()=>new Date('2026-10-02T00:00:00Z'),binding:vi.fn(async()=>({tenantId:tenant,scope:'organisation' as const})),read:vi.fn(async(input:PositionRead):Promise<unknown[]>=>{
    if(input.family==='organisation')return [{OrganisationID:tenant,Name:'Synthetic',BaseCurrency:'NZD',Timezone:'NEWZEALANDSTANDARDTIME',FinancialYearEndMonth:6,FinancialYearEndDay:30}];
    if(input.family==='receivables'||input.family==='payables')return [];
    const report=sampleProfit(input.query);return [{ReportID:input.family==='bankSummary'?'BankSummary':'ProfitAndLoss',ReportName:report.name,ReportTitles:report.titles,ReportDate:input.query.to,Rows:wire(report.rows)}];
  })};
}
it('reuses identical periods, pins dates/basis/tenant, and obtains FY metadata without changing the original source wire',async()=>{
  const deps=fixture(),result=await readFinancials(query,deps,new AbortController().signal);
  expect(result.financialYearEnd).toEqual({month:6,day:30});expect(result.position.organisation).not.toHaveProperty('data.financialYearEnd');
  const reports=deps.read.mock.calls.map(([input])=>input).filter(input=>input.family==='profitAndLoss');
  expect(reports).toHaveLength(7);expect(new Set(reports.map(input=>input.query.from)).size).toBe(7);
  expect(reports.every(input=>input.tenantId===tenant&&input.query.basis==='accrual')).toBe(true);expect(result.months).toHaveLength(6);
});
it('keeps one failed comparison unavailable without erasing primary reports or other months',async()=>{
  const deps=fixture(),read=deps.read.getMockImplementation()!;
  deps.read.mockImplementation(async input=>{if(input.family==='profitAndLoss'&&input.query.from==='2026-08-01')throw new PositionReadError('provider_unavailable');return read(input);});
  const result=await readFinancials(query,deps,new AbortController().signal);
  expect(result.previous.report.status).toBe('unavailable');expect(result.position.profitAndLoss.status).toBe('available');expect(result.yearAgo.report.status).toBe('available');
});
it('rejects all evidence when authority changes during comparative reads',async()=>{
  const deps=fixture();let reads=0;deps.binding.mockImplementation(async()=>({tenantId:++reads>9?'10000000-0000-4000-8000-000000000111':tenant,scope:'organisation'}));
  await expect(readFinancials(query,deps,new AbortController().signal)).rejects.toThrow('POSITION_AUTHORITY_CHANGED');
});
it('does not infer fiscal metadata from missing settings and never starts more than two comparison reads together',async()=>{
  const deps=fixture(),read=deps.read.getMockImplementation()!;let concurrent=0,peak=0;
  deps.read.mockImplementation(async input=>{concurrent++;peak=Math.max(peak,concurrent);await Promise.resolve();const result=await read(input);concurrent--;if(input.family==='organisation')return [{...(result[0] as object),FinancialYearEndMonth:undefined}];return result;});
  expect((await readFinancials(query,deps,new AbortController().signal)).financialYearEnd).toBeNull();expect(peak).toBeLessThanOrEqual(2);
});
