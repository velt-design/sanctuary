import { expect, it } from 'vitest';
import { sampleFinancials, sampleProfit } from './financialFixtures';
import { cents, reportLines } from '@/lib/xero/financials/model';
import { trendQueries, yearToDate, type FinancialsQuery } from '@/lib/xero/financials/contract';

const query={from:'2026-09-01',to:'2026-09-30',basis:'accrual' as const};
const values=(query:FinancialsQuery)=>reportLines(sampleProfit(query)).filter(row=>row.cents!==null).map(row=>row.cents!);
const add=(parts:number[][])=>parts.reduce((sum,part)=>part.map((value,index)=>value+(sum[index]??0)),[]);
it.each(['cash','accrual'] as const)('reconciles every %s account and total across custom, monthly, FYTD and leap dates',basis=>{
  const full={...query,basis};
  expect(values(full)).toEqual(add([values({...full,to:'2026-09-01'}),values({...full,from:'2026-09-02'})]));
  const fy={...yearToDate({month:3,day:31},new Date('2026-10-02T00:00:00Z')),basis};
  const months=trendQueries({...full,to:'2026-09-30'});
  expect(values(fy)).toEqual(add([...months.map(values),values({...fy,from:'2026-10-01'})]));
  const leap={...full,from:'2024-02-01',to:'2024-02-29'};
  expect(values(leap)).toEqual(add([values({...leap,to:'2024-02-28'}),values({...leap,from:'2024-02-29'})]));
  expect(sampleProfit(full)).toEqual(sampleProfit(full));
  const rows=reportLines(sampleProfit(full)),amount=(label:string)=>rows.find(row=>row.label===label)!.cents!;
  expect(amount('Total Income')).toBe(amount('Pergola sales')+amount('Installation services'));
  expect(amount('Total Cost of Sales')).toBe(amount('Materials')+amount('Subcontracted installation'));
  expect(amount('Total Operating Expenses')).toBe(amount('Team and administration')+amount('Premises and vehicle costs')+amount('Advertising'));
  expect(amount('Gross Profit')).toBe(amount('Total Income')-amount('Total Cost of Sales'));
  expect(amount('Net Profit')).toBe(amount('Gross Profit')-amount('Total Operating Expenses'));
});
it('keeps bank openings/closings continuous and movements additive across periods',()=>{
  const bank=(query:FinancialsQuery)=>{const family=sampleFinancials(query).position.bankSummary;if(family.status!=='available')throw new Error('fixture');return reportLines(family.data).filter(row=>row.type==='Row'||row.type==='SummaryRow').map(row=>row.values.map(value=>cents(value)!));};
  const first=bank({...query,to:'2026-09-01'}),rest=bank({...query,from:'2026-09-02'}),full=bank(query);
  full.forEach((values,index)=>{
    expect(values[0]).toBe(first[index][0]);expect(rest[index][0]).toBe(first[index][3]);expect(values[3]).toBe(rest[index][3]);
    expect(values[1]).toBe(first[index][1]+rest[index][1]);expect(values[2]).toBe(first[index][2]+rest[index][2]);expect(values[0]+values[1]-values[2]).toBe(values[3]);
  });
  expect(bank({...query,basis:'cash'})).toEqual(full);
  expect(bank({...query,from:'2026-10-01',to:'2026-10-31'}).map(row=>row[0])).toEqual(full.map(row=>row[3]));
});
it('balances every current invoice/bill, with plausible dates and unchanged populations across report selections',()=>{
  const report=sampleFinancials(query),custom=sampleFinancials({...query,from:'2026-09-02',basis:'cash'});
  for(const field of ['receivables','payables'] as const){
    const family=report.position[field];if(family.status!=='available')throw new Error('fixture');
    expect(custom.position[field]).toEqual(family);expect(family.data.count).toBe(family.data.items.length);
    for(const item of family.data.items){
      expect(item.lineItems.every(line=>line.lineAmount!==null&&line.taxAmount!==null)).toBe(true);
      expect(item.lineItems.reduce((sum,line)=>sum+cents(line.lineAmount!)!+cents(line.taxAmount!)!,0)).toBe(cents(item.total));
      expect(cents(item.amountPaid)!+cents(item.amountCredited)!+cents(item.amountDue)!).toBe(cents(item.total));
      expect(item.date<='2026-10-02').toBe(true);if(item.dueDate)expect(item.date<=item.dueDate).toBe(true);
    }
  }
});
