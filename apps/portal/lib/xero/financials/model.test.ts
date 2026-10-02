import { describe, expect, it } from 'vitest';
import { sampleFinancials, sampleProfit } from '../../../app/qa/marketing-performance-fixture/financialFixtures';
import { completedMonth, hasPartialCalendarMonth, previousQuery, yearAgoQuery, trendQueries, yearToDate, selectionFromUrl, selectionToUrl } from './contract';
import { cents, profitMetrics, reportLines, matchingLine, bankMetrics, invoiceTotals, ageBand } from './model';
const query={from:'2026-09-01',to:'2026-09-30',basis:'accrual' as const};
describe('financial calendar and exact source values',()=>{
  it('uses NZ last completed month, full-month comparison, equal-day custom comparison and leap-safe year comparison',()=>{
    expect(completedMonth(new Date('2026-09-30T11:30:00Z'))).toEqual(query);
    expect(previousQuery(query)).toEqual({...query,from:'2026-08-01',to:'2026-08-31'});
    expect(previousQuery({...query,from:'2026-09-10',to:'2026-09-17'})).toEqual({...query,from:'2026-09-02',to:'2026-09-09'});
    expect(yearAgoQuery({...query,from:'2024-02-01',to:'2024-02-29'}).to).toBe('2023-02-28');
    expect(trendQueries({...query,to:'2026-09-15'}).at(-1)).toEqual({...query,from:'2026-08-01',to:'2026-08-31'});
    expect(yearToDate({month:6,day:30},new Date('2026-10-01T00:00:00Z'))).toEqual({...query,from:'2026-07-01',to:'2026-10-01'});
  });
  it.each([
    ['2026-09-02','2026-09-30',true],['2026-09-01','2026-09-29',true],
    ['2026-09-01','2026-09-30',false],['2026-07-01','2026-09-30',false],
    ['2024-02-01','2024-02-29',false],['2024-02-02','2024-02-29',true],
    ['2026-04-01','2026-10-02',true],
  ])('identifies incomplete calendar coverage for %s through %s',(from,to,partial)=>{
    expect(hasPartialCalendarMonth({from,to})).toBe(partial);
  });
  it('does exact cent conversion without replacing empty, malformed or high-precision cells with zero',()=>{
    expect(cents('1,234.56')).toBe(123456);expect(cents('(1,234.56)')).toBe(-123456);expect(cents('-0.01')).toBe(-1);
    for(const value of ['', '—', '1,2', 'NZ$2.00', '1.234', '9007199254740999.00'])expect(cents(value)).toBeNull();
  });
  it('finds standard totals including Gross/Net Row records; ambiguous totals remain missing',()=>{
    const report=sampleProfit(query),metrics=profitMetrics(report);
    expect(metrics.revenue?.cents).toBe(20146800);expect(metrics.gross?.cents).toBe(7700800);expect(metrics.net?.cents).toBe(3102100);
    report.rows.push({...report.rows[3],rows:[...report.rows[3].rows]});
    expect(profitMetrics(report).gross).toBeNull();
  });
  it('matches source account identity through a label change but rejects duplicates',()=>{
    const original=reportLines(sampleProfit(query)).find(row=>row.key.startsWith('account:'))!;
    const changed={...original,label:'Renamed source account'};
    expect(matchingLine([changed],original)).toBe(changed);expect(matchingLine([changed,changed],original)).toBeNull();
  });
  it('preserves bank column meanings and current receivable currency/ageing partitions',()=>{
    const report=sampleFinancials(query);if(report.position.bankSummary.status!=='available'||report.position.receivables.status!=='available')throw new Error('fixture');
    expect(bankMetrics(report.position.bankSummary.data).map(item=>[item.label,item.value])).toEqual([['Opening Balance',41790000],['Cash Received',22590000],['Cash Spent',18690000],['Closing Balance',45690000]]);
    const items=report.position.receivables.data.items,totals=invoiceTotals(items,'2026-10-02');
    expect(totals.map(group=>group.currency)).toEqual(['AUD','NZD']);
    for(const group of totals)expect(group.bands.reduce((sum,band)=>sum+(band.amount??0),0)).toBe(group.total);
    expect(ageBand({...items[0],dueDate:'2026-10-02'},'2026-10-02')).toBe('Not due');
    expect(ageBand({...items[0],dueDate:null},'2026-10-02')).toBe('No due date');
  });
  it('restores period, basis, section and detail while preserving unrelated hub selections',()=>{
    const selection={...query,basis:'cash' as const,section:'payables' as const,comparison:'yearAgo' as const,detail:'account:example'};
    const params=selectionToUrl(new URLSearchParams('view=financials&source=facebook'),selection);
    expect(selectionFromUrl(params)).toEqual(selection);expect(params.get('source')).toBe('facebook');
    expect(selectionFromUrl(new URLSearchParams('financeFrom=bad')).from).not.toBe('bad');
  });
});
