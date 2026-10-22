import {expect,it,vi} from 'vitest';
import {startFinancialProfitRead} from './profitParts.server';
import {assembleFinancialParts} from './profitParts';
import {readFinancialPanel} from './panel';
import type {PositionRead} from '../financePositionProvider';
import type {FinanceReportRow} from '../financePositionContract';
import {sampleProfit} from '@/app/qa/marketing-performance-fixture/financialFixtures';
const query={from:'2026-09-01',to:'2026-09-30',basis:'accrual' as const,section:'profit' as const},tenant='10000000-0000-4000-8000-000000000999';
const wire=(rows:FinanceReportRow[]):unknown[]=>rows.map(row=>({RowType:row.type,Title:row.title,Cells:row.cells.map(cell=>({Value:cell.value,Attributes:cell.attributes.map(attribute=>({Id:attribute.id,Value:attribute.value}))})),Rows:wire(row.rows)}));
function fixture(){
 const original=async(input:PositionRead):Promise<unknown[]>=>{
  if(input.family==='organisation')return [{OrganisationID:tenant,Name:'Fictional company',BaseCurrency:'NZD',Timezone:'NEWZEALANDSTANDARDTIME',FinancialYearEndMonth:6,FinancialYearEndDay:30}];
  const report=sampleProfit(input.query);return [{ReportID:'ProfitAndLoss',ReportName:report.name,ReportTitles:report.titles,Rows:wire(report.rows)}];
 };
 const deps={now:()=>new Date('2026-10-22T00:00:00Z'),binding:vi.fn(async()=>({tenantId:tenant,scope:'organisation' as const})),read:vi.fn(original)};
 return {deps,original};
}
async function until(check:()=>boolean){for(let turn=0;turn<100;turn++){if(check())return;await Promise.resolve();}expect(check()).toBe(true);}
async function staged(){
 const {deps,original}=fixture();
 const pending:Array<{input:PositionRead;resolve:(value:unknown[])=>void}>=[];
 deps.read.mockImplementation(input=>input.family==='organisation'?original(input):new Promise(resolve=>pending.push({input,resolve})));
 const close=vi.fn(async()=>{}),read=startFinancialProfitRead(query,deps,new AbortController().signal,close);
 await until(()=>pending.length===2);
 pending[0].resolve(await original(pending[0].input));pending[1].resolve(await original(pending[1].input));
 await until(()=>pending.length===4);
 pending[2].resolve(await original(pending[2].input));
 return {deps,original,pending,close,read};
}
it('publishes only complete validated selected/comparison evidence early, preserves exact JSON reconstruction and avoids repeated source/wire periods',async()=>{
 const {deps,original,pending,close,read}=await staged();
 const current=await read.current;
 expect(current.previous.report.status).toBe('available');expect(current.yearAgo.report.status).toBe('available');expect(current).not.toHaveProperty('months');expect(close).not.toHaveBeenCalled();
 let finished=false;void read.tail.then(()=>{finished=true;});await Promise.resolve();expect(finished).toBe(false);
 for(let index=3;index<7;index++){await until(()=>pending.length>index);pending[index].resolve(await original(pending[index].input));}
 const tail=await read.tail;await expect(read.validity).resolves.toBeNull();expect(close).toHaveBeenCalledOnce();
 const canonical=await readFinancialPanel(query,fixture().deps,new AbortController().signal);
 expect(assembleFinancialParts(current,tail)).toEqual(canonical);
 expect(tail.months.filter(month=>'source' in month)).toHaveLength(2);
 expect(new Set(pending.map(part=>JSON.stringify(part.input.query))).size).toBe(7);expect(deps.read).toHaveBeenCalledTimes(8);
 expect(new TextEncoder().encode(JSON.stringify(current)+JSON.stringify(tail)).length).toBeLessThan(new TextEncoder().encode(JSON.stringify(canonical)).length);
});
it('invalidates an already-published primary immediately on later authority failure, while the second started worker still owns its connection',async()=>{
 const {deps,original,pending,close,read}=await staged();await read.current;
 await until(()=>pending.length===5);
 deps.binding.mockRejectedValue(new Error('POSITION_AUTHORITY_CHANGED'));
 pending[3].resolve(await original(pending[3].input));
 await expect(read.validity).rejects.toThrow('POSITION_AUTHORITY_CHANGED');expect(close).not.toHaveBeenCalled();
 let closed=false;void read.tail.catch(()=>{closed=true;});await Promise.resolve();expect(closed).toBe(false);
 pending[4].resolve(await original(pending[4].input));
 await expect(read.tail).rejects.toThrow('POSITION_AUTHORITY_CHANGED');expect(close).toHaveBeenCalledOnce();expect(deps.read).toHaveBeenCalledTimes(6);
});
it('a failed cleanup invalidates the primary and rejects the tail without inventing a complete response',async()=>{
 const {deps}=fixture(),failure=new Error('Private cleanup failure'),close=vi.fn(async()=>{throw failure;});
 const read=startFinancialProfitRead(query,deps,new AbortController().signal,close);await read.current;
 await expect(read.tail).rejects.toBe(failure);await expect(read.validity).rejects.toBe(failure);expect(close).toHaveBeenCalledOnce();
});

it('withholds early figures until their own fresh post-read authority gate, then invalidates and drains started workers after denial',async()=>{
 const {deps,original}=fixture();let hold=false;
 const gates:Array<(error:Error)=>void>=[];
 const waiting:Array<{input:PositionRead;resolve:(value:unknown[])=>void}>=[];
 deps.read.mockImplementation(input=>input.family==='organisation'?original(input):new Promise(resolve=>waiting.push({input,resolve})));
 deps.binding.mockImplementation(async()=>{
  if(hold)return new Promise((_,reject)=>{gates.push(reject);});
  return {tenantId:tenant,scope:'organisation'};
 });
 const close=vi.fn(async()=>{}),read=startFinancialProfitRead(query,deps,new AbortController().signal,close);
 await until(()=>waiting.length===2);waiting[0].resolve(await original(waiting[0].input));waiting[1].resolve(await original(waiting[1].input));
 await until(()=>waiting.length===4);hold=true;waiting[2].resolve(await original(waiting[2].input));await until(()=>gates.length===2);
 let shown=false;void read.current.then(()=>{shown=true;},()=>{});await Promise.resolve();expect(shown).toBe(false);
 for(const reject of gates)reject(new Error('FINANCIALS_ACCESS_CHANGED'));await expect(read.current).rejects.toThrow('FINANCIALS_ACCESS_CHANGED');expect(close).not.toHaveBeenCalled();
 for(let i=3;i<waiting.length;i++)waiting[i].resolve(await original(waiting[i].input));
 await expect(read.tail).rejects.toThrow('FINANCIALS_ACCESS_CHANGED');expect(close).toHaveBeenCalledOnce();
});
it('aborts a queued pool without starting more periods and waits for the already-started source to settle before close',async()=>{
 const {deps,original}=fixture(),controller=new AbortController(),close=vi.fn(async()=>{});
 const waiting:Array<{input:PositionRead;resolve:(value:unknown[])=>void}>=[];
 deps.read.mockImplementation(input=>input.family==='organisation'?original(input):new Promise(resolve=>waiting.push({input,resolve})));
 const read=startFinancialProfitRead(query,deps,controller.signal,close);await until(()=>waiting.length===2);controller.abort(new Error('Cancelled request'));
 await expect(read.validity).rejects.toThrow('Cancelled request');expect(close).not.toHaveBeenCalled();
 for(const part of waiting)part.resolve(await original(part.input));
 await expect(read.tail).rejects.toThrow('Cancelled request');expect(close).toHaveBeenCalledOnce();expect(waiting).toHaveLength(2);
});
