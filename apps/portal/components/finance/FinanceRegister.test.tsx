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
const click=(label:string)=>act(()=>{Array.from(mounted.container.querySelectorAll<HTMLElement>('button,a')).find(element=>element.textContent===label)!.click();});
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
  expect(mounted.container.querySelectorAll('table thead th')).toHaveLength(6);
  expect(mounted.container.textContent).toContain('Reading invoice records…');
  expect(mounted.container.querySelector<HTMLInputElement>('input[name=search]')?.disabled).toBe(false);
  expect(mounted.container.textContent).not.toContain('No matching records');
  expect(mounted.container.textContent).not.toContain('0 records');
});
it('shows partial owing, successful portal delivery and a separate stale provider notice',async()=>{
  mounted=renderIntoDocument(<FinanceRegister/>); await settle();
  expect(mounted.container.textContent).toMatch(/NZD\s*60\.00/);
  expect(mounted.container.textContent).toContain('Due 31 Oct 2026');
  expect(mounted.container.textContent).toContain('Sent 1 Oct 2026');
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
  click('Paid');await settle();
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
  expect(mounted.container.querySelector('td[data-label="Status / expiry"] > span')?.textContent).toBe(label);
  expect(mounted.container.textContent).toContain('Review the existing delivery');
});
it('retains the sent label while disclosing an unfinished resend and makes pending delivery findable',async()=>{
  replace(null,'','/staff/payments?tab=quotes&view=awaiting');
  vi.mocked(fetch).mockResolvedValueOnce(response({...data,rows:[{...row,status:'SENT',reference:'Q-RESENT',version:1,sendState:'sent',deliveryState:'provider_accepted',sendNote:'Resend is being confirmed. Do not send again yet.'}]}));
  mounted=renderIntoDocument(<FinanceRegister/>);await settle();
  expect(mounted.container.querySelector('td[data-label="Status / expiry"] > span')?.textContent).toContain('Sent 1 Oct');
  expect(mounted.container.textContent).toContain('Resend is being confirmed');
  const delivery=mounted.container.querySelector<HTMLSelectElement>('select')!;
  act(()=>{delivery.value='pending';delivery.dispatchEvent(new Event('change',{bubbles:true}));});await settle();
  expect(window.location.search).toContain('sent=pending');expect(vi.mocked(fetch).mock.calls.at(-1)?.[0]).toContain('sent=pending');
});
it.each(['VOID','DECLINED','SUPERSEDED'])('does not call terminal %s history ordinary fresh sending work',async status=>{
  replace(null,'',`/staff/payments?tab=${status==='VOID'?'invoices':'quotes'}&view=all`);
  vi.mocked(fetch).mockResolvedValueOnce(response({...data,rows:[{...row,status,sentAt:null,sendState:'needs',providerNote:null}]}));
  mounted=renderIntoDocument(<FinanceRegister/>);await settle();
  expect(mounted.container.querySelector(`td[data-label="${status==='VOID'?'Delivery / due':'Status / expiry'}"] > span`)?.textContent).toBe('No Portal send recorded');
});
