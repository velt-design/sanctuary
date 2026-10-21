import { expect,it,vi } from 'vitest';
import { readFinancialPanel } from './panel';
import { financialPanelSchema, type FinancialSection } from './contract';
import { readFinancials } from './read';
import { sampleFinancials } from '../../../app/qa/marketing-performance-fixture/financialFixtures';
import type { FinanceReportRow } from '../financePositionContract';
import type { PositionRead } from '../financePositionProvider';
const query={from:'2026-09-01',to:'2026-09-30',basis:'accrual' as const},tenant='10000000-0000-4000-8000-000000000999';
const wire=(rows:FinanceReportRow[]):unknown[]=>rows.map(row=>({RowType:row.type,Title:row.title,Cells:row.cells.map(cell=>({Value:cell.value,Attributes:cell.attributes.map(attr=>({Id:attr.id,Value:attr.value}))})),Rows:wire(row.rows)}));
function fixture(){
  return {now:()=>new Date('2026-10-21T00:00:00Z'),binding:vi.fn(async()=>({tenantId:tenant,scope:'organisation' as const})),read:vi.fn(async(input:PositionRead):Promise<unknown[]>=>{
    if(input.family==='organisation')return [{OrganisationID:tenant,Name:'Synthetic',BaseCurrency:'NZD',Timezone:'NEWZEALANDSTANDARDTIME',FinancialYearEndMonth:6,FinancialYearEndDay:30}];
    if(input.family==='receivables'||input.family==='payables')return [];
    const report=sampleFinancials(input.query).position[input.family];if(report.status!=='available')throw new Error('fixture');
    return [{ReportID:report.data.id,ReportName:report.data.name,ReportTitles:report.data.titles,Rows:wire(report.data.rows)}];
  })};
}
it.each(['bank','receivables','payables'] as FinancialSection[])('reads only organisation and selected %s family, preserving explicit unrequested evidence',async section=>{
  const deps=fixture(),result=await readFinancialPanel({...query,section},deps,new AbortController().signal);
  expect(result.requestedSection).toBe(section);expect(deps.read.mock.calls.map(([input])=>input.family)).toEqual(['organisation',section==='bank'?'bankSummary':section]);
  expect(deps.binding).toHaveBeenCalledTimes(4);expect(result.position.profitAndLoss.status).toBe('not_requested');expect(result.previous.report.status).toBe('not_requested');
});
it('preserves exact full-reader P&L and comparisons with fewer provider reads and at most two concurrent reports',async()=>{
  const deps=fixture(),original=deps.read.getMockImplementation()!;let active=0,peak=0;
  deps.read.mockImplementation(async input=>{active++;peak=Math.max(peak,active);await Promise.resolve();try{return await original(input);}finally{active--;}});
  const panel=await readFinancialPanel({...query,section:'profit'},deps,new AbortController().signal),full=await readFinancials(query,fixture(),new AbortController().signal);
  expect(panel.position.profitAndLoss).toEqual(full.position.profitAndLoss);expect(panel.previous).toEqual(full.previous);expect(panel.yearAgo).toEqual(full.yearAgo);expect(panel.months).toEqual(full.months);
  expect(deps.read.mock.calls).toHaveLength(8);expect(peak).toBe(2);expect(deps.read.mock.calls.every(([input])=>['organisation','profitAndLoss'].includes(input.family))).toBe(true);
});
it('does not publish evidence when final authority is revoked',async()=>{
  const deps=fixture();deps.binding.mockResolvedValueOnce({tenantId:tenant,scope:'organisation'}).mockResolvedValueOnce({tenantId:tenant,scope:'organisation'}).mockResolvedValueOnce({tenantId:tenant,scope:'organisation'}).mockRejectedValueOnce(new Error('FINANCIALS_ACCESS_CHANGED'));
  await expect(readFinancialPanel({...query,section:'bank'},deps,new AbortController().signal)).rejects.toThrow('FINANCIALS_ACCESS_CHANGED');
});
it('rejects section/family mismatch rather than accepting unrequested evidence or a zero substitute',async()=>{
  const result=await readFinancialPanel({...query,section:'bank'},fixture(),new AbortController().signal);
  expect(financialPanelSchema.safeParse({...result,requestedSection:'profit'}).success).toBe(false);
  expect(financialPanelSchema.safeParse({...result,position:{...result.position,bankSummary:{status:'not_requested'}}}).success).toBe(false);
});
