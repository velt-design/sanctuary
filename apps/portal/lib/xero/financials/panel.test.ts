import { expect,it,vi } from 'vitest';
import { readFinancialPanel } from './panel';
import { financialPanelSchema, type FinancialSection } from './contract';
import { readFinancials } from './read';
import { sampleFinancials } from '../../../app/qa/marketing-performance-fixture/financialFixtures';
import type { FinanceReportRow } from '../financePositionContract';
import { PositionReadError, type PositionRead } from '../financePositionProvider';
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

it('starts a second exact period while the primary waits and refills free slots without pair barriers',async()=>{
 const deps=fixture(),original=deps.read.getMockImplementation()!;
 const pending:Array<{input:PositionRead;resolve:(value:unknown[])=>void}>=[];
 deps.read.mockImplementation(input=>input.family==='organisation'?original(input):new Promise(resolve=>pending.push({input,resolve})));
 const result=readFinancialPanel({...query,section:'profit'},deps,new AbortController().signal);
 for(let i=0;i<20&&pending.length<2;i++)await Promise.resolve();expect(pending).toHaveLength(2);
 expect(pending[0].input.query).toEqual(query);pending[1].resolve(await original(pending[1].input));
 for(let i=0;i<20&&pending.length<3;i++)await Promise.resolve();expect(pending).toHaveLength(3);
 // The third started without waiting for the slower current report.
 pending[0].resolve(await original(pending[0].input));
 for(let i=2;i<7;i++){
  for(let turn=0;turn<20&&pending.length<=i;turn++)await Promise.resolve();
  pending[i].resolve(await original(pending[i].input));
 }
 const actual=await result,full=await readFinancials(query,fixture(),new AbortController().signal);
 expect(actual.position.profitAndLoss).toEqual(full.position.profitAndLoss);expect(actual.months).toEqual(full.months);
 expect(deps.read).toHaveBeenCalledTimes(8);
});

it('preserves complete unavailable-metadata evidence and historical scope labels against the full reader',async()=>{
 const make=()=>{const deps=fixture();deps.read.mockRejectedValue(new PositionReadError('provider_unavailable'));return deps;};
 const panel=await readFinancialPanel({...query,section:'profit'},make(),new AbortController().signal),full=await readFinancials(query,make(),new AbortController().signal);
 expect(panel.position.profitAndLoss).toEqual(full.position.profitAndLoss);expect(panel.previous).toEqual(full.previous);expect(panel.months).toEqual(full.months);expect(panel.yearAgo).toEqual(full.yearAgo);
});
it('stops queued periods on authority revocation and waits for both started workers before rejecting',async()=>{
 const deps=fixture(),original=deps.read.getMockImplementation()!;
 const pending:Array<(value:unknown[])=>void>=[];let revoked=false;
 deps.binding.mockImplementation(async()=>{if(revoked)throw new Error('FINANCIALS_ACCESS_CHANGED');return {tenantId:tenant,scope:'organisation'};});
 deps.read.mockImplementation(input=>input.family==='organisation'?original(input):new Promise(resolve=>pending.push(resolve)));
 const request=readFinancialPanel({...query,section:'profit'},deps,new AbortController().signal);let settled=false;void request.then(()=>{settled=true;},()=>{settled=true;});
 for(let i=0;i<30&&pending.length<2;i++)await Promise.resolve();expect(pending).toHaveLength(2);
 revoked=true;pending[0](await original({family:'profitAndLoss',tenantId:tenant,query,page:1}));
 for(let i=0;i<30;i++)await Promise.resolve();expect(settled).toBe(false);expect(deps.read).toHaveBeenCalledTimes(3);
 pending[1](await original({family:'profitAndLoss',tenantId:tenant,query:{...query,from:'2026-08-01',to:'2026-08-31'},page:1}));
 await expect(request).rejects.toThrow('FINANCIALS_ACCESS_CHANGED');expect(deps.read).toHaveBeenCalledTimes(3);
});
it('withholds all completed P&L evidence when final publication authority changes',async()=>{
 const deps=fixture();deps.binding.mockImplementation(async()=>{if(deps.read.mock.calls.length===8)throw new Error('POSITION_AUTHORITY_CHANGED');return {tenantId:tenant,scope:'organisation'};});
 await expect(readFinancialPanel({...query,section:'profit'},deps,new AbortController().signal)).rejects.toThrow('POSITION_AUTHORITY_CHANGED');
});
