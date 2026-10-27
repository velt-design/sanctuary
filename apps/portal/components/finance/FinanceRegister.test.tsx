import { act, useSyncExternalStore } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../test/reactHarness';
import { type RegisterData, type RegisterRow } from '@/lib/finance/register';
import FinanceRegister from './FinanceRegister';
vi.mock('next/navigation',()=>({useSearchParams:()=>new URLSearchParams(useSyncExternalStore(
  listener=>{window.addEventListener('popstate',listener);window.addEventListener('next-history-change',listener);return()=>{window.removeEventListener('popstate',listener);window.removeEventListener('next-history-change',listener);};},
  ()=>window.location.search,()=>''))}));
// Native links here model Next's history bridge; browser QA checks Next itself.
vi.mock('next/link',()=>({default:({href,children,...props}:any)=><a href={href} {...props} onClick={event=>{if(!props.target){event.preventDefault();window.history.pushState(null,'',href);}}}>{children}</a>}));
const push=window.history.pushState.bind(window.history),replace=window.history.replaceState.bind(window.history);
let mounted:ReturnType<typeof renderIntoDocument>;
const id='40000000-0000-4000-8000-000000000004';
const row:RegisterRow={id,projectId:'10000000-0000-4000-8000-000000000001',reference:'INV-SYNTHETIC',customer:'Synthetic customer',project:'Synthetic courtyard',status:'OPEN',expired:false,currency:'NZD',totalCents:10000,paidCents:4000,balanceCents:6000,issueDate:'2026-10-01',dueDate:'2026-10-31',sentAt:'2026-10-01T01:00:00Z',sendState:'sent',sendNote:null,deliveryState:null,lastAttemptAt:null,nextRetryAt:null,checkReason:null,providerNote:'Xero payment check is out of date.',providerCheckedAt:'2026-10-01T01:00:00Z',quoteId:null,version:null,pendingDraftVersion:null,acceptedVersion:null,historyCount:0,history:[]};
const data:RegisterData={checkedAt:'2026-10-23T01:00:00Z',count:1,hasMore:false,draftsAllowed:true,rows:[row],totals:[{currency:'NZD',totalCents:10000,paidCents:4000,balanceCents:6000,unconfirmedCount:0}]};
const response=(value=data)=>({ok:true,status:200,json:async()=>value}) as Response;
const click=(label:string)=>act(()=>{Array.from(mounted.container.querySelectorAll<HTMLElement>('button,a')).find(element=>element.textContent===label || element.getAttribute('aria-label')===label)!.click();});
const changeSelect=(name:string,value:string)=>act(()=>{const select=mounted.container.querySelector<HTMLSelectElement>(`select[name="${name}"]`)!;select.value=value;select.dispatchEvent(new Event('change',{bubbles:true}));});
const settle=async()=>{await act(async()=>{await new Promise(resolve=>setTimeout(resolve,0));});};
beforeEach(()=>{
  replace(null,'','/staff/payments');
  for(const [method,original] of [['pushState',push],['replaceState',replace]] as const)vi.spyOn(window.history,method).mockImplementation((...args)=>{original(...args);window.dispatchEvent(new Event('next-history-change'));});
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(response()));
});
afterEach(()=>{mounted?.unmount();vi.restoreAllMocks();vi.unstubAllGlobals();replace(null,'','/');});
it('keeps real filters and table headings available while the first read remains unresolved',()=>{
  vi.mocked(fetch).mockReturnValue(new Promise(()=>{}));
  mounted=renderIntoDocument(<FinanceRegister/>);
  expect(mounted.container.querySelector('table thead')).not.toBeNull();
  expect(mounted.container.querySelectorAll('table thead th')).toHaveLength(7);
  expect(mounted.container.textContent).toContain('Reading invoice records…');
  expect(mounted.container.querySelector<HTMLInputElement>('input[name=search]')?.disabled).toBe(false);
  expect(mounted.container.textContent).not.toContain('No matching records');
  expect(mounted.container.textContent).not.toContain('0 records');
});
it('retains the actual table, deliberate columns and search through first read, empty filtering and failure',async()=>{
  let resolveRead!:(value:Response)=>void;
  vi.mocked(fetch).mockReturnValueOnce(new Promise(resolve=>{resolveRead=resolve;}));
  mounted=renderIntoDocument(<FinanceRegister/>);
  const table=mounted.container.querySelector('table')!,head=table.querySelector('thead'),search=mounted.container.querySelector('input[name=search]');
  const columns=Array.from(table.querySelectorAll('col')).map(col=>col.style.width);
  expect(columns).toHaveLength(7);expect(columns.every(Boolean)).toBe(true);
  await act(async()=>resolveRead(response()));await settle();
  expect(mounted.container.querySelector('table')).toBe(table);expect(table.querySelector('thead')).toBe(head);
  vi.mocked(fetch).mockResolvedValueOnce(response({...data,rows:[],count:0}));click('Refresh');await settle();
  expect(table.textContent).toContain('No matching records');
  expect(mounted.container.querySelector('input[name=search]')).toBe(search);
  vi.mocked(fetch).mockRejectedValueOnce(new Error('unavailable'));click('Refresh');await settle();
  expect(mounted.container.querySelector('table')).toBe(table);expect(mounted.container.textContent).toContain('Try again');
  expect(Array.from(table.querySelectorAll('col')).map(col=>col.style.width)).toEqual(columns);
});
it('shows partial owing, successful portal delivery and a separate stale provider notice',async()=>{
  mounted=renderIntoDocument(<FinanceRegister/>); await settle();
  expect(mounted.container.textContent).toMatch(/NZD\s*60\.00/);
  expect(mounted.container.querySelector('td[data-label="Due"]')?.textContent).toContain('31 Oct 2026');
  expect(mounted.container.querySelector('td[data-label="Sent from Portal"]')?.textContent).toContain('1 Oct 2026');
  expect(mounted.container.querySelector('tbody')?.textContent).toContain('Part paid');
  expect(mounted.container.querySelector('tbody')?.textContent).not.toContain('Outstanding');
  click('INV-SYNTHETIC');
  expect(window.location.search).toContain(`selected=${id}`);
  expect(mounted.container.textContent).toContain('Xero payment check is out of date.');
  expect(mounted.container.querySelector('a[href^="/staff/projects/"]')?.getAttribute('href')).toContain('proj_10000000');
});
it('keeps checked rows during refresh failure, retries and removes private rows after access denial',async()=>{
  mounted=renderIntoDocument(<FinanceRegister/>); await settle();
  vi.mocked(fetch).mockRejectedValueOnce(new Error('unavailable')); click('Refresh'); await settle();
  expect(mounted.container.textContent).toContain('Previously checked records remain below');
  expect(mounted.container.textContent).toContain('INV-SYNTHETIC');
  click('Try again'); await settle(); expect(mounted.container.textContent).not.toContain('could not be refreshed');
  vi.mocked(fetch).mockResolvedValueOnce({ok:false,status:403} as Response);click('Refresh');await settle();
  expect(mounted.container.textContent).toContain('Finance access is no longer available');expect(mounted.container.textContent).not.toContain('INV-SYNTHETIC');
});
it('preserves selected detail through job-style navigation and Back without changing filters',async()=>{
  replace(null,'',`/staff/payments?tab=invoices&view=outstanding&search=Synthetic&sent=sent&selected=${id}`);
  mounted=renderIntoDocument(<FinanceRegister/>);await settle();
  const before=window.location.search;expect(mounted.container.querySelector('[aria-expanded=true]')).not.toBeNull();
  push(null,'','/staff/projects/proj_example?tab=invoices');
  await act(async()=>{await new Promise<void>(resolve=>{window.addEventListener('popstate',()=>resolve(),{once:true});window.history.back();});});
  expect(window.location.search).toBe(before);expect(mounted.container.querySelector('[aria-expanded=true]')).not.toBeNull();
});
it('ignores an obsolete response after a rapid filter change',async()=>{
  let oldResolve!:(value:Response)=>void;
  vi.mocked(fetch).mockReturnValueOnce(new Promise(resolve=>{oldResolve=resolve;}));
  mounted=renderIntoDocument(<FinanceRegister/>);
  changeSelect('view','paid');await settle();
  await act(async()=>oldResolve(response({...data,rows:[{...row,reference:'OBSOLETE'}]})));
  expect(window.location.search).toContain('view=paid');expect(mounted.container.textContent).not.toContain('OBSOLETE');
});
it.each([
  ['prepared','prepared','Delivery prepared'],['dispatching','pending','Confirming delivery'],['provider_accepted','pending','Confirming delivery'],
  ['failed','failed','Send failed'],['needs_attention','review','Delivery needs attention'],
] as const)('shows %s delivery before the DRAFT fallback',async(deliveryState,sendState,label)=>{
  replace(null,'','/staff/payments?tab=quotes&view=drafts');
  vi.mocked(fetch).mockResolvedValueOnce(response({...data,rows:[{...row,status:'DRAFT',reference:'Q-PREPARED',version:4,sentAt:null,sendState,deliveryState,sendNote:'Review the existing delivery in the quote.'}]}));
  mounted=renderIntoDocument(<FinanceRegister/>);await settle();
  expect(mounted.container.querySelector('td[data-label="Sent from Portal"] > span')?.textContent).toBe(label);
  expect(mounted.container.textContent).not.toContain('Review the existing delivery');
  click('Q-PREPARED v4');
  expect(mounted.container.textContent).toContain('Review the existing delivery');
});
it('retains the sent label while disclosing an unfinished resend and makes pending delivery findable',async()=>{
  replace(null,'','/staff/payments?tab=quotes&view=awaiting');
  vi.mocked(fetch).mockResolvedValueOnce(response({...data,rows:[{...row,status:'SENT',reference:'Q-RESENT',version:1,sendState:'sent',deliveryState:'provider_accepted',sendNote:'Resend is being confirmed. Do not send again yet.'}]}));
  mounted=renderIntoDocument(<FinanceRegister/>);await settle();
  expect(mounted.container.querySelector('td[data-label="Sent from Portal"] > span')?.textContent).toContain('1 Oct');
  expect(mounted.container.textContent).toContain('Resend pending');
  click('Q-RESENT v1');expect(mounted.container.textContent).toContain('Resend is being confirmed');
  const delivery=mounted.container.querySelector<HTMLSelectElement>('select[name="delivery"]')!;
  act(()=>{delivery.value='pending';delivery.dispatchEvent(new Event('change',{bubbles:true}));});await settle();
  expect(window.location.search).toContain('sent=pending');expect(vi.mocked(fetch).mock.calls.at(-1)?.[0]).toContain('sent=pending');
});
it.each(['VOID','DECLINED','SUPERSEDED'])('does not call terminal %s history ordinary fresh sending work',async status=>{
  replace(null,'',`/staff/payments?tab=${status==='VOID'?'invoices':'quotes'}&view=all`);
  vi.mocked(fetch).mockResolvedValueOnce(response({...data,rows:[{...row,status,sentAt:null,sendState:'needs',providerNote:null}]}));
  mounted=renderIntoDocument(<FinanceRegister/>);await settle();
  expect(mounted.container.querySelector('td[data-label="Sent from Portal"] > span')?.textContent).toBe('No Portal send recorded');
});

it('keeps Outstanding inclusive and offers a returnable Sent from Portal quick filter',async()=>{
  mounted=renderIntoDocument(<FinanceRegister/>);await settle();
  expect(vi.mocked(fetch).mock.calls[0][0]).toContain('view=outstanding');
  expect(vi.mocked(fetch).mock.calls[0][0]).toContain('sent=all');
  click('Sent from Portal');await settle();
  expect(window.location.search).toContain('view=outstanding');expect(window.location.search).toContain('sent=sent');
  expect(mounted.container.querySelector('button[aria-pressed=true]')?.textContent).toBe('Sent from Portal');
  click('Sent from Portal');await settle();expect(window.location.search).toContain('sent=all');
});

it('shows full-set totals and per-currency unknown exclusions, never totals inferred from this page',async()=>{
  vi.mocked(fetch).mockResolvedValueOnce(response({...data,count:151,hasMore:true,totals:[
    {currency:'NZD',totalCents:9000000,paidCents:1200000,balanceCents:4500000,unconfirmedCount:2},
    {currency:'AUD',totalCents:100000,paidCents:10000,balanceCents:90000,unconfirmedCount:0},
  ]}));
  mounted=renderIntoDocument(<FinanceRegister/>);await settle();
  const summary=mounted.container.querySelector('[aria-label="Matching records summary"]')!;
  expect(summary.textContent).toContain('151');expect(summary.textContent).toMatch(/NZD\s*45,000\.00/);
  expect(summary.textContent).toMatch(/NZD\s*12,000\.00/);expect(summary.textContent).toMatch(/AUD\s*900\.00/);
  expect(summary.textContent).toContain('2 needing checks excluded');expect(summary.textContent).not.toMatch(/NZD\s*60\.00/);
  expect(mounted.container.textContent).not.toContain('Overdue total');
});

it('keeps the previous invoice summary explicitly labelled while Quotes are loading',async()=>{
  mounted=renderIntoDocument(<FinanceRegister/>);await settle();
  vi.mocked(fetch).mockReturnValueOnce(new Promise(()=>{}));click('Quotes');await settle();
  expect(mounted.container.querySelector('[aria-label="Previous results summary"]')?.textContent).toContain('invoices · previous results');
  expect(mounted.container.querySelector('table thead')?.textContent).toContain('Invoice');
});


it('keeps local header recovery, genuine pager controls and focus through the first read',async()=>{
 let resolveRead!:(value:Response)=>void;vi.mocked(fetch).mockReturnValueOnce(new Promise(resolve=>{resolveRead=resolve;}));
 mounted=renderIntoDocument(<FinanceRegister/>);
 const header=mounted.container.querySelector('header')!,details=header.querySelector<HTMLButtonElement>('button[aria-haspopup="dialog"]')!;
 const pager=mounted.container.querySelector('[aria-label="Register pages"]')!,previous=pager.querySelector('a'),next=pager.querySelector('a:last-child');
 expect(previous?.getAttribute('aria-disabled')).toBe('true');expect(next?.getAttribute('aria-disabled')).toBe('true');act(()=>details.focus());
 await act(async()=>resolveRead(response()));await settle();
 expect(mounted.container.querySelector('header')).toBe(header);expect(header.querySelector('button[aria-haspopup="dialog"]')).toBe(details);expect(document.activeElement).toBe(details);
 expect(mounted.container.querySelector('[aria-label="Register pages"]')).toBe(pager);expect(pager.querySelector('a')).toBe(previous);expect(pager.querySelector('a:last-child')).toBe(next);
 expect(mounted.container.querySelector('tbody')?.textContent).toContain('NZD');expect(mounted.container.querySelector('tbody')?.textContent).toContain('Part paid');
});
