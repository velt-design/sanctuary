import { act } from 'react';
import { afterEach,expect,it,vi } from 'vitest';
import { renderIntoDocument } from '../../../../test/reactHarness';
import Financials from './Financials';
import OutstandingView from './OutstandingView';
import { sampleFinancials } from '@/app/qa/marketing-performance-fixture/financialFixtures';
import type { FinancialsQuery } from '@/lib/xero/financials/contract';
const query={from:'2026-09-01',to:'2026-09-30',basis:'accrual' as const};
afterEach(()=>window.history.replaceState(null,'','/'));
it('opens the selected account after reload and preserves basis/comparison when switching sections',async()=>{
  window.history.replaceState(null,'','/?view=financials&financeFrom=2026-09-01&financeTo=2026-09-30&financeBasis=cash&financeSection=profit&financeCompare=yearAgo&financeDetail=account%3A10000000-0000-4000-8000-000000000003');
  const loader=vi.fn(async (query:FinancialsQuery)=>sampleFinancials(query)),view=renderIntoDocument(<Financials loader={loader} synthetic/>);
  await act(async()=>{});
  expect(document.body.textContent).toContain('Materials');expect(document.body.textContent).toContain('2025-09-01');
  const close=document.querySelector<HTMLButtonElement>('[aria-label="Close Materials"]')!;act(()=>close.click());
  const bank=[...view.container.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find(button=>button.textContent==='Bank balances')!;act(()=>bank.click());
  expect(view.container.textContent).toContain('Opening Balance');expect(window.location.search).toContain('financeSection=bank');expect(window.location.search).toContain('financeBasis=cash');expect(window.location.search).toContain('financeCompare=yearAgo');expect(loader).toHaveBeenCalledTimes(1);view.unmount();
});
it('ageing drilldown matches the exact currency population and does not include a second currency',()=>{
  const report=sampleFinancials(query),family=report.position.receivables;if(family.status!=='available')throw new Error('fixture');
  const view=renderIntoDocument(<OutstandingView family={family} payable={false} onDetail={()=>{}} baseCurrency="NZD"/>);
  const currency=view.container.querySelector<HTMLElement>('[aria-label="AUD balances"]')!;
  const band=[...currency.querySelectorAll<HTMLButtonElement>('button')].find(button=>button.textContent?.startsWith('1–30'))!;act(()=>band.click());
  const rows=view.container.querySelectorAll('tbody tr');expect(rows).toHaveLength(1);expect(rows[0].textContent).toContain('AUD');expect(rows[0].textContent).not.toContain('NZD');view.unmount();
});
it('missing comparison and partial families stay explicit with retry while current profit remains visible',async()=>{
  window.history.replaceState(null,'','/?financeFrom=2026-09-01&financeTo=2026-09-30&financeBasis=accrual');
  const view=renderIntoDocument(<Financials loader={async query=>sampleFinancials(query,'partial')} synthetic/>);await act(async()=>{});
  expect(view.container.textContent).toContain('$198,550');expect(view.container.textContent).toContain('Comparison unavailable');
  const bills=[...view.container.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find(button=>button.textContent==='Bills to pay')!;act(()=>bills.click());
  expect(view.container.textContent).toContain('Bills to pay unavailable');expect(view.container.textContent).toContain('does not currently grant');expect(view.container.querySelectorAll('tbody tr')).toHaveLength(0);view.unmount();
});
