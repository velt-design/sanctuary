import {act} from 'react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {renderIntoDocument} from '../../../../test/reactHarness';
import StudioQuoteDocument from './StudioQuoteDocument';
const mocks=vi.hoisted(()=>({pdf:vi.fn(),api:vi.fn(),revision:vi.fn()}));
vi.mock('next/dynamic',()=>({default:()=>({data}:any)=><div aria-label="Actual PDF renderer">{data.byteLength} bytes</div>}));
vi.mock('@/lib/quotes/quotesRepo',()=>({previewQuotePdf:mocks.pdf}));
vi.mock('@/lib/repo/apiClient',()=>({apiJson:mocks.api}));
vi.mock('./StudioRevisionStart',()=>({default:(props:any)=>{mocks.revision(props);return <button>Edit a new revision</button>;}}));
vi.mock('@/components/ui/toast/ToastProvider',()=>({useToast:()=>({error:vi.fn()})}));
const review:any={estimate:{id:'est-source',projectId:'proj-project',versionLabel:'V2'}};
const quote:any={id:'qv-exact',projectId:'proj-project',sourceEstimateVersionId:'est-source',quoteRef:'Q-TEST',status:'DRAFT',versionNumber:2,sentAt:null,sendLogs:[],totals:{totalIncGstCents:12345}};
const source={estimate:{id:'est-source',projectId:'proj-project',updatedAt:'2026-10-27T00:00:00Z'},view:{revision:4}};
let mounted:ReturnType<typeof renderIntoDocument>|undefined;
beforeEach(()=>{vi.resetAllMocks();mocks.pdf.mockResolvedValue(new Uint8Array([1,2,3]));mocks.api.mockResolvedValue({authoring:source});});
afterEach(()=>{mounted?.unmount();mounted=undefined;vi.restoreAllMocks();vi.unstubAllGlobals();});
async function mount(){mounted=renderIntoDocument(<StudioQuoteDocument review={review} quote={quote} actorId="actor"/>);await act(async()=>{});return mounted.container;}
it('prepares the exact frozen PDF once, retains one primary download and a direct revision action, without quote mutations',async()=>{
 const container=await mount();expect(mocks.pdf).toHaveBeenCalledWith(quote,{signal:expect.any(AbortSignal)});expect(container.querySelector('[aria-label="Actual PDF renderer"]')?.textContent).toBe('3 bytes');expect(container.textContent).toContain('Draft · not sent');expect([...container.querySelectorAll('button')].filter(b=>b.textContent==='Download PDF')).toHaveLength(1);expect([...container.querySelectorAll('a')].map(a=>a.getAttribute('href'))).toContain('/staff/projects/proj-project?tab=quotes&quoteId=qv-exact');expect(mocks.revision.mock.calls.at(-1)?.[0]).toMatchObject({revision:4,estimateId:'est-source',openOnCreated:true});
 mounted!.rerender(<StudioQuoteDocument review={{...review}} quote={quote} actorId="actor"/>);await act(async()=>{});expect(mocks.pdf).toHaveBeenCalledOnce();expect(mocks.api).toHaveBeenCalledOnce();expect(mocks.api.mock.calls[0][1].method).toBeUndefined();
});
it('keeps a failed document recoverable and retries only the same canonical frozen quote',async()=>{
 mocks.pdf.mockRejectedValueOnce(Error('PDF temporarily unavailable'));const container=await mount();expect(container.textContent).toContain('PDF temporarily unavailable');await act(async()=>[...container.querySelectorAll('button')].find(b=>b.textContent==='Retry document')!.click());expect(mocks.pdf).toHaveBeenCalledTimes(2);expect(mocks.pdf.mock.calls.every(([arg])=>arg===quote)).toBe(true);expect(mocks.api).toHaveBeenCalledOnce();
});
it('retires a held PDF request on unmount and never publishes the old bytes',async()=>{
 let resolve!:(value:Uint8Array)=>void;mocks.pdf.mockImplementation(()=>new Promise(r=>{resolve=r;}));await mount();const signal=mocks.pdf.mock.calls[0][1].signal;mounted!.unmount();mounted=undefined;expect(signal.aborted).toBe(true);await act(async()=>resolve(new Uint8Array([4])));expect(mocks.pdf).toHaveBeenCalledOnce();
});
it('retries an unavailable source independently while retaining the already rendered PDF',async()=>{
 mocks.api.mockRejectedValueOnce(Error('Read unavailable'));const container=await mount();expect(mocks.revision).not.toHaveBeenCalled();await act(async()=>[...container.querySelectorAll('button')].find(b=>b.textContent==='Retry source design')!.click());expect(mocks.revision).toHaveBeenCalled();expect(mocks.pdf).toHaveBeenCalledOnce();expect(container.querySelector('[aria-label="Actual PDF renderer"]')).toBeTruthy();
});
it('revokes a downloaded private PDF URL on teardown',async()=>{
 vi.stubGlobal('URL',Object.assign(URL,{createObjectURL:vi.fn(()=> 'blob:private-pdf'),revokeObjectURL:vi.fn()}));vi.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(()=>{});const container=await mount();await act(async()=>[...container.querySelectorAll('button')].find(b=>b.textContent==='Download PDF')!.click());expect(URL.createObjectURL).toHaveBeenCalledOnce();mounted!.unmount();mounted=undefined;expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:private-pdf');
});
it('synchronously cancels held PDF and source reads on frame withdrawal before component unmount',async()=>{
 const lifetime=new AbortController();let pdf!:(value:Uint8Array)=>void,sourceRead!:(value:unknown)=>void;
 mocks.pdf.mockImplementation(()=>new Promise(r=>{pdf=r;}));mocks.api.mockImplementation(()=>new Promise(r=>{sourceRead=r;}));
 mounted=renderIntoDocument(<StudioQuoteDocument review={review} quote={quote} actorId="actor" lifetime={lifetime.signal}/>);await act(async()=>{});
 const pdfSignal=mocks.pdf.mock.calls[0][1].signal,sourceSignal=mocks.api.mock.calls[0][1].signal;
 lifetime.abort();expect(pdfSignal.aborted).toBe(true);expect(sourceSignal.aborted).toBe(true);
 await act(async()=>{pdf(new Uint8Array([7]));sourceRead({authoring:source});});
 expect(mounted.container.querySelector('[aria-label="Actual PDF renderer"]')).toBeNull();expect(mocks.revision).not.toHaveBeenCalled();
});
it('revokes a previously downloaded URL at withdrawal and cannot download old bytes before teardown',async()=>{
 vi.stubGlobal('URL',Object.assign(URL,{createObjectURL:vi.fn(()=> 'blob:private-pdf'),revokeObjectURL:vi.fn()}));vi.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(()=>{});
 const lifetime=new AbortController();mounted=renderIntoDocument(<StudioQuoteDocument review={review} quote={quote} actorId="actor" lifetime={lifetime.signal}/>);await act(async()=>{});
 const button=[...mounted.container.querySelectorAll('button')].find(b=>b.textContent==='Download PDF')!;act(()=>button.click());expect(URL.createObjectURL).toHaveBeenCalledOnce();
 lifetime.abort();expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:private-pdf');act(()=>button.click());expect(URL.createObjectURL).toHaveBeenCalledOnce();
});

it('opens the cached v2 financial PDF and never regenerates it through the legacy image preview',async()=>{
 const fetch=vi.fn().mockResolvedValue(new Response(new Uint8Array([37,80,68,70])));vi.stubGlobal('fetch',fetch);
 mocks.api.mockImplementation(async(url:string)=>url.endsWith('/studio-document')?{document:{snapshotId:'snapshot-v2',state:'ready',percent:100,completedPages:5,totalPages:5}}:{authoring:source});
 const v2={...quote,studioDesign:{schemaVersion:'studio_quote_snapshot.v2',documentMode:'separate_v1',snapshotId:'snapshot-v2'}} as any;
 mounted=renderIntoDocument(<StudioQuoteDocument review={review} quote={v2} actorId="actor"/>);await act(async()=>{});
 expect(fetch).toHaveBeenCalledWith('/api/quotes/qv-exact/pdf?disposition=inline',expect.objectContaining({signal:expect.any(AbortSignal),credentials:'same-origin'}));expect(mocks.pdf).not.toHaveBeenCalled();expect(mounted.container.textContent).toContain('Client package');expect([...mounted.container.querySelectorAll('[role=tab]')].map(tab=>tab.textContent)).toEqual(['Quote','Booklet','Rendered']);
});

it('uses PDF bytes from the just-committed v2 command only when its render hash matches',async()=>{
 const fetch=vi.fn().mockResolvedValue(new Response(new Uint8Array([1])));vi.stubGlobal('fetch',fetch);
 mocks.api.mockImplementation(async(url:string)=>url.endsWith('/studio-document')?{document:{snapshotId:'snapshot-v2',state:'ready',percent:100,completedPages:5,totalPages:5}}:{authoring:source});
 const v2={...quote,renderHash:'a'.repeat(64),studioDesign:{schemaVersion:'studio_quote_snapshot.v2',documentMode:'separate_v1',snapshotId:'snapshot-v2'}} as any;
 mounted=renderIntoDocument(<StudioQuoteDocument review={review} quote={v2} actorId="actor" initialPdf={{renderHash:'a'.repeat(64),contentBase64:'JVBERi0='}}/>);await act(async()=>{});
 expect(fetch).not.toHaveBeenCalled();expect(mocks.pdf).not.toHaveBeenCalled();expect(mounted.container.querySelector('[aria-label="Actual PDF renderer"]')?.textContent).toBe('5 bytes');
});
