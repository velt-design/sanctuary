import {act,StrictMode} from 'react';
import {afterEach,expect,it,vi} from 'vitest';
import {renderIntoDocument} from '../../../../test/reactHarness';
import Financials from './Financials';
import {sampleFinancialPanel} from '@/app/qa/marketing-performance-fixture/financialFixtures';
import {financialCurrentSchema,financialRequestKey,type FinancialCurrent,type FinancialPanelQuery} from '@/lib/xero/financials/contract';
import {financialTail,type FinancialTail,type FinancialPartsSeed,FINANCIAL_PARTS_MAX_BYTES} from '@/lib/xero/financials/profitParts';
import {financialProfitPartsResponse} from '@/lib/xero/financials/profitPartsResponse.server';
import {readFinancialProfitPartsFrom,type FinancialProfitLoader} from './loadFinancialProfitParts';
const query:FinancialPanelQuery={from:'2026-09-01',to:'2026-09-30',basis:'accrual',section:'profit'};
function evidence(q=query){const full=sampleFinancialPanel(q);const {months:_,...base}=full;void _;const current=financialCurrentSchema.parse({...base,schemaVersion:'sanctuary.financial-profit-current.v1'});return {full,current,tail:financialTail(current,full)};}
function deferred<T>(){let resolve!:(value:T)=>void,reject!:(error:unknown)=>void;const promise=new Promise<T>((yes,no)=>{resolve=yes;reject=no;});void promise.catch(()=>{});return {promise,resolve,reject};}
function read(){const current=deferred<FinancialCurrent>(),tail=deferred<FinancialTail>(),validity=deferred<null>();return {current,tail,validity,parts:{current:current.promise,tail:tail.promise,validity:validity.promise}};}
const params='view=financials&financeSection=profit&financeFrom=2026-09-01&financeTo=2026-09-30&financeBasis=accrual';
afterEach(()=>{window.history.replaceState(null,'','/');vi.unstubAllGlobals();});
it('uses the actual bounded response and parser to show complete primary figures before trend, then Refresh and basis use new requests with stable controls',async()=>{
 window.history.replaceState(null,'','/?'+params);
 const reads:ReturnType<typeof read>[]=[],queries:FinancialPanelQuery[]=[];
 const fetcher=vi.fn(async(path:string,init:RequestInit)=>{
   const q=Object.fromEntries(new URL(path,'https://fictional.test').searchParams) as unknown as FinancialPanelQuery;
   queries.push(q);const next=read();reads.push(next);
   return financialProfitPartsResponse(new Request('https://fictional.test/read',{signal:init.signal!}),financialRequestKey(q),async()=>({ok:true,report:next.parts}));
 });vi.stubGlobal('fetch',fetcher);
 const loader:FinancialProfitLoader=(q,s,p)=>readFinancialProfitPartsFrom('/read?'+new URLSearchParams({...q}),q,s,p);
 const view=renderIntoDocument(<StrictMode><Financials profitLoader={loader} synthetic initialQuery={params}/></StrictMode>);await act(async()=>{});
 expect(fetcher).toHaveBeenCalledOnce();const basis=view.container.querySelectorAll<HTMLSelectElement>('select')[1],account=view.container.querySelector('#financial-account-title'),chart=view.container.querySelector('[aria-label="Monthly trend chart"]');
 expect(view.container.textContent).toContain('Reading monthly reports');expect(view.container.textContent).not.toContain('$0');
 const first=evidence();await act(async()=>reads[0].current.resolve(first.current));
 expect(view.container.textContent).toContain('$201,468');expect(view.container.textContent).toContain('Selected report verified');expect(view.container.querySelector('[data-financial-complete="true"]')).toBeNull();expect(view.container.querySelectorAll('#financial-account-title')).toHaveLength(1);
 await act(async()=>{reads[0].tail.resolve(first.tail);reads[0].validity.resolve(null);});expect(view.container.querySelector('[data-financial-complete="true"]')).not.toBeNull();
 expect(view.container.querySelector('#financial-account-title')).toBe(account);expect(view.container.querySelector('[aria-label="Monthly trend chart"]')).toBe(chart);
 const refresh=[...view.container.querySelectorAll<HTMLButtonElement>('button')].find(button=>button.textContent==='Refresh Xero')!;await act(async()=>refresh.click());expect(fetcher).toHaveBeenCalledTimes(2);
 await act(async()=>{basis.value='cash';basis.dispatchEvent(new Event('change',{bubbles:true}));});expect(fetcher).toHaveBeenCalledTimes(3);expect(queries[2].basis).toBe('cash');
 const cash=evidence({...query,basis:'cash'});await act(async()=>reads[2].current.resolve(cash.current));
 await act(async()=>{reads[1].current.resolve(first.current);reads[1].tail.resolve(first.tail);reads[1].validity.resolve(null);});
 expect(view.container.querySelectorAll('select')[1]).toBe(basis);expect(view.container.textContent).toContain('Selected report verified');
 await act(async()=>{reads[2].tail.resolve(cash.tail);reads[2].validity.resolve(null);});expect(view.container.textContent).toContain('cash');view.unmount();
});
it('nested void-returning Flight thenables show primary once, and later generic503 invalidation clears all primary evidence with Retry',async()=>{
 window.history.replaceState(null,'','/?'+params);const first=evidence(),tail=deferred<{ok:true;report:FinancialTail}>(),validity=deferred<{ok:true;report:null}|{ok:false;status:number;error:string}>();
 const flight=Object.create(Promise.prototype,{then:{value:(yes:(value:{ok:true;report:FinancialCurrent})=>void)=>{yes({ok:true,report:first.current});}}}) as FinancialPartsSeed['current'];
 const seed:FinancialPartsSeed={key:financialRequestKey(query),current:flight,tail:tail.promise,validity:validity.promise};const loader=vi.fn<FinancialProfitLoader>(async q=>sampleFinancialPanel(q));
 const view=renderIntoDocument(<StrictMode><Financials profitLoader={loader} synthetic initialSeed={seed} initialQuery={params}/></StrictMode>);await act(async()=>{});expect(loader).not.toHaveBeenCalled();expect(view.container.textContent).toContain('$201,468');
 await act(async()=>validity.resolve({ok:false,status:503,error:'Source identity could not be verified. Retry.'}));expect(view.container.textContent).not.toContain('$201,468');expect(view.container.textContent).toContain('Financial reports unavailable');
 await act(async()=>tail.resolve({ok:true,report:first.tail}));expect(view.container.textContent).not.toContain('$201,468');
 const retry=[...view.container.querySelectorAll<HTMLButtonElement>('button')].find(button=>button.textContent==='Retry')!;await act(async()=>retry.click());expect(loader).toHaveBeenCalledOnce();expect(view.container.textContent).toContain('$201,468');view.unmount();
});
it.each(['truncated','duplicate','wrong-selection','oversized','tail-mismatch'])('rejects %s evidence instead of completing a partial or mismatched aggregate',async mode=>{
 const data=evidence(),key=financialRequestKey(query);let frames:unknown[]=[{key,phase:'current',report:data.current},{key,phase:'tail',report:data.tail},{key,done:true}];
 if(mode==='truncated')frames.pop();if(mode==='duplicate')frames.splice(1,0,frames[0]);if(mode==='wrong-selection')frames[0]={key:'wrong',phase:'current',report:data.current};if(mode==='oversized')frames=[{key,padding:'x'.repeat(FINANCIAL_PARTS_MAX_BYTES)}];if(mode==='tail-mismatch')frames[1]={key,phase:'tail',report:{...data.tail,identity:{...data.tail.identity,tenantId:'10000000-0000-4000-8000-000000000123'}}};
 vi.stubGlobal('fetch',vi.fn(async()=>new Response(frames.map(frame=>JSON.stringify(frame)+'\n').join(''),{headers:{'Content-Type':'application/x-ndjson'}})));
 await expect(readFinancialProfitPartsFrom('/read',query,new AbortController().signal,()=>{})).rejects.toMatchObject({clearEvidence:true});
});

it('keeps a verified primary when only monthly domains are honestly unavailable, but clears it immediately for later stream authority loss',async()=>{
 window.history.replaceState(null,'','/?'+params);const raw=read();
 vi.stubGlobal('fetch',vi.fn(async(_path:string,init:RequestInit)=>financialProfitPartsResponse(new Request('https://fictional.test/read',{signal:init.signal!}),financialRequestKey(query),async()=>({ok:true,report:raw.parts}))));
 const loader:FinancialProfitLoader=(q,s,p)=>readFinancialProfitPartsFrom('/read',q,s,p);
 const view=renderIntoDocument(<Financials profitLoader={loader} synthetic initialQuery={params}/>);await act(async()=>{});
 const primary=evidence();await act(async()=>raw.current.resolve(primary.current));expect(view.container.textContent).toContain('$201,468');
 await act(async()=>raw.validity.reject(new Error('POSITION_AUTHORITY_CHANGED')));expect(view.container.textContent).not.toContain('$201,468');expect(view.container.textContent).toContain('Financial reports unavailable');
 // Cleanup may still be draining its started worker. It cannot resurrect values.
 await act(async()=>raw.tail.resolve(primary.tail));expect(view.container.textContent).not.toContain('$201,468');view.unmount();
 const full=sampleFinancialPanel(query);full.months[0].report={status:'unavailable',reason:'provider_unavailable',requiredScopes:[]};
 const seed:FinancialPartsSeed={key:financialRequestKey(query),current:Promise.resolve({ok:true,report:primary.current}),tail:Promise.resolve({ok:true,report:financialTail(primary.current,full)}),validity:Promise.resolve({ok:true,report:null})};
 const next=renderIntoDocument(<Financials profitLoader={loader} synthetic initialQuery={params} initialSeed={seed}/>);await act(async()=>{});
 expect(next.container.textContent).toContain('$201,468');expect(next.container.textContent).toContain('Some monthly figures are unavailable');expect(next.container.querySelector('[data-financial-complete="true"]')).not.toBeNull();next.unmount();
});
it('retires all nested seed parts on A to B to A and ignores their late completion',async()=>{
 window.history.replaceState(null,'','/?'+params);const primary=deferred<{ok:true;report:FinancialCurrent}>(),data=evidence();
 const seed:FinancialPartsSeed={key:financialRequestKey(query),current:primary.promise,tail:Promise.resolve({ok:true,report:data.tail}),validity:Promise.resolve({ok:true,report:null})};
 const loader=vi.fn<FinancialProfitLoader>(async q=>sampleFinancialPanel(q));const view=renderIntoDocument(<Financials profitLoader={loader} initialSeed={seed} initialQuery={params} synthetic/>);await act(async()=>{});
 const basis=view.container.querySelectorAll<HTMLSelectElement>('select')[1];await act(async()=>{basis.value='cash';basis.dispatchEvent(new Event('change',{bubbles:true}));});
 await act(async()=>{basis.value='accrual';basis.dispatchEvent(new Event('change',{bubbles:true}));});expect(loader).toHaveBeenCalledTimes(2);
 await act(async()=>primary.resolve({ok:true,report:data.current}));expect(loader).toHaveBeenCalledTimes(2);expect(view.container.querySelector('[data-financial-complete="true"]')).not.toBeNull();view.unmount();
});

it('clears previously complete retained figures on fatal validity during ordinary Refresh and recovers only through a new verified request',async()=>{
 window.history.replaceState(null,'','/?'+params);const data=evidence(),reads:ReturnType<typeof read>[]=[];
 const fetcher=vi.fn(async(_path:string,init:RequestInit)=>{const raw=read();reads.push(raw);return financialProfitPartsResponse(new Request('https://fictional.test/read',{signal:init.signal!}),financialRequestKey(query),async()=>({ok:true,report:raw.parts}));});vi.stubGlobal('fetch',fetcher);
 const loader:FinancialProfitLoader=(q,s,p)=>readFinancialProfitPartsFrom('/read',q,s,p);
 const seed={key:financialRequestKey(query),result:Promise.resolve({ok:true as const,report:data.full})};
 const view=renderIntoDocument(<Financials profitLoader={loader} initialSeed={seed} initialQuery={params} synthetic/>);await act(async()=>{});expect(view.container.textContent).toContain('$201,468');expect(fetcher).not.toHaveBeenCalled();
 const refresh=[...view.container.querySelectorAll<HTMLButtonElement>('button')].find(button=>button.textContent==='Refresh Xero')!;await act(async()=>refresh.click());
 await act(async()=>reads[0].current.resolve(data.current));expect(view.container.textContent).toContain('$201,468');
 await act(async()=>reads[0].validity.reject(new Error('POSITION_AUTHORITY_CHANGED')));expect(view.container.textContent).not.toContain('$201,468');expect(view.container.querySelector('[data-financial-current="ready"]')).toBeNull();
 await act(async()=>reads[0].tail.resolve(data.tail));expect(view.container.textContent).not.toContain('$201,468');
 const retry=[...view.container.querySelectorAll<HTMLButtonElement>('button')].find(button=>button.textContent==='Retry')!;await act(async()=>retry.click());expect(fetcher).toHaveBeenCalledTimes(2);
 await act(async()=>{reads[1].current.resolve(data.current);reads[1].tail.resolve(data.tail);reads[1].validity.resolve(null);});expect(view.container.textContent).toContain('$201,468');view.unmount();
});
