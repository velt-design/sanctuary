import {act,type ReactNode} from 'react';
import {CommercialProjectNotice,ProjectCommercialProvider} from '@/components/projects/ProjectPage/ProjectCommercialContext';
import type {ProjectWorkProjection} from '@/lib/projects/workItems/types';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {renderIntoDocument} from '../../../../test/reactHarness';
import {createStudioAuthoringEdit,type StudioAuthoringView} from '@/lib/designStudio/authoringView';
import StudioWebsiteReview from './StudioWebsiteReview';
const mocks=vi.hoisted(()=>({policyReady:true,policyState:'ACTIVE',policyVersion:1,api:vi.fn(),push:vi.fn(),session:vi.fn(),invalidate:vi.fn(),price:{status:'priced',amount:100,versionNumber:15} as any}));
vi.mock('./StudioCommercialPolicy',()=>({default:({children,projectId}: {children:ReactNode;projectId:string})=><ProjectCommercialProvider projectId={projectId} ready={mocks.policyReady} work={{effectiveState:mocks.policyState,stateRowVersion:mocks.policyVersion} as ProjectWorkProjection}><CommercialProjectNotice projectId={projectId} view="studio"/>{children}</ProjectCommercialProvider>}));
vi.mock('next/navigation',()=>({useRouter:()=>({push:mocks.push})}));
vi.mock('next/dynamic',()=>({default:(load:()=>unknown)=>String(load).includes('StudioDesignSpecification')?()=> <section aria-label="Selected design specification">Selected design</section>:({onCapture,disabled}:any)=><button disabled={disabled} onClick={()=>onCapture([{kind:'perspective',dataUrl:'data:image/png;base64,AA=='},{kind:'plan',dataUrl:'data:image/png;base64,AA=='}])}>Capture test views</button>}));
vi.mock('@tanstack/react-query',()=>({useQueryClient:()=>({})}));
vi.mock('@/lib/queries/projectCache',()=>({invalidateProjectReadCaches:mocks.invalidate}));
vi.mock('@/lib/supabase/browserClient',()=>({supabaseRuntimeUrl:()=>'',supabaseHostFromUrl:()=>''}));
vi.mock('@/lib/repo/apiClient',()=>({apiJson:mocks.api}));
vi.mock('@/components/auth/PortalAuthProvider',()=>({usePortalSession:()=>({role:'staff'})}));
vi.mock('./useStudioEditingSession',()=>({useStudioEditingSession:mocks.session}));
vi.mock('./useStudioWebsitePrice',()=>({useStudioWebsitePrice:()=>({price:mocks.price,retry:vi.fn()})}));
vi.mock('./StudioWebsiteRecovery',()=>({default:()=>null}));
const view:StudioAuthoringView={schemaVersion:'studio_authoring_view.v1',designId:'prepared-design',revision:3,spatial:{houseAssembly:null,pergolas:[],decks:[],openings:[]},site:{},objectOptions:[],pricing:'unpriced'};
const binding={snapshotId:'10000000-0000-4000-8000-000000000005',contentHash:'a'.repeat(64)};
const authoring={state:'ready',view,estimate:{updatedAt:'2026-10-20T00:00:00Z',requiresNewRevision:false},nextAction:'edit',preparedQuote:binding};
const review={estimate:{projectId:'proj-proof',id:'est-proof',versionLabel:'V1'}};
const mounts:ReturnType<typeof renderIntoDocument>[]=[];
beforeEach(()=>{vi.resetAllMocks();mocks.policyReady=true;mocks.policyState='ACTIVE';mocks.policyVersion=1;mocks.price={status:'priced',amount:100,versionNumber:15};mocks.session.mockReturnValue({edit:createStudioAuthoringEdit(view),status:'ready',localDurable:true,session:{dirty:false,pending:null},canSave:false,canEdit:true});mocks.api.mockImplementation(async(url:string)=>url.endsWith('/studio')?{authoring}:{quoteVersion:{id:'quote-result'}});});
afterEach(()=>mounts.splice(0).forEach(m=>m.unmount()));
async function mount(){const m=renderIntoDocument(<StudioWebsiteReview review={review as any} actorId="actor"/>);mounts.push(m);await act(async()=>{});return m;}
async function resume(container:HTMLElement){const button=[...container.querySelectorAll('button')].find(b=>b.textContent==='Resume prepared quote')!;expect(button.disabled).toBe(false);await act(async()=>button.click());}
it('resumes the saved capture after reload and uses exactly the same intent after an ambiguous create response',async()=>{
 let attempts=0;mocks.api.mockImplementation(async(url:string)=>{if(url.endsWith('/studio'))return {authoring};if(++attempts===1)throw Error('Response interrupted');return {quoteVersion:{id:'quote-result'}};});
 const first=await mount();await resume(first.container);expect(first.container.textContent).toContain('Response interrupted');first.unmount();mounts.pop();
 const reopened=await mount();await resume(reopened.container);
 const writes=mocks.api.mock.calls.filter(([url])=>url.endsWith('/quotes'));expect(writes).toHaveLength(2);
 expect(writes.map(([,options])=>JSON.parse(options.body))).toEqual(Array(2).fill({estimateVersionId:'est-proof',clientIntentId:`studio:${binding.snapshotId}`,studioSnapshot:binding}));
 expect(mocks.api.mock.calls.some(([url])=>url.endsWith('/studio-quote'))).toBe(false);
 expect(mocks.push).toHaveBeenCalledOnce();
 expect(reopened.container.querySelector('[aria-label="Admin cost review"]')).toBeNull();
});
it('opens the existing quote path after a completed request instead of creating again',async()=>{
 mocks.api.mockResolvedValue({authoring:{...authoring,nextAction:'create-revision',estimate:{...authoring.estimate,requiresNewRevision:true}}});
 const m=await mount();expect(m.container.textContent).toContain('already used by a quote');expect(m.container.textContent).not.toContain('Resume prepared quote');
 expect(m.container.querySelector('a')?.getAttribute('href')).toBe('/staff/projects/proj-proof?tab=quotes');
});
it('does not apply an old preparation to a changed retained local design',async()=>{
 const edit=createStudioAuthoringEdit(view);edit.site.travelExGst='25';mocks.session.mockReturnValue({edit,status:'ready',localDurable:true,session:{dirty:true,pending:null},canSave:true,canEdit:true});
 const m=await mount();expect(m.container.textContent).not.toContain('Resume prepared quote');expect(m.container.textContent).toContain('Save your current changes');
});
it('rechecks the saved source and permits fresh capture after a publication change without replaying the old preparation',async()=>{
 const m=await mount();const replace=[...m.container.querySelectorAll('button')].find(b=>b.textContent==='Prepare updated quote views')!;
 await act(async()=>replace.click());
 expect(mocks.api.mock.calls.filter(([url])=>url.endsWith('/studio'))).toHaveLength(2);
 expect(m.container.textContent).not.toContain('Resume prepared quote');
 expect([...m.container.querySelectorAll('button')].find(b=>b.textContent==='Create quote from this design')?.disabled).toBe(true);
 expect(mocks.api.mock.calls.some(([url])=>url.endsWith('/studio-quote')||url.endsWith('/quotes'))).toBe(false);
 const nextBinding={snapshotId:'10000000-0000-4000-8000-000000000006',contentHash:'b'.repeat(64)};
 mocks.api.mockImplementation(async(url:string)=>url.endsWith('/studio-quote')?nextBinding:{quoteVersion:{id:'new-quote'}});
 await act(async()=>[...m.container.querySelectorAll('button')].find(b=>b.textContent==='Capture test views')!.click());
 await act(async()=>[...m.container.querySelectorAll('button')].find(b=>b.textContent==='Create quote from this design')!.click());
 expect(JSON.parse(mocks.api.mock.calls.find(([url])=>url.endsWith('/quotes'))![1].body)).toMatchObject({clientIntentId:`studio:${nextBinding.snapshotId}`,studioSnapshot:nextBinding});
});

it('keeps the exact saved Review revision prepared after create fails and retries its original intent',async()=>{
 const session={edit:createStudioAuthoringEdit(view),status:'ready',localDurable:true,session:{dirty:false,pending:null},canSave:false,canEdit:true,save:vi.fn()};
 mocks.session.mockImplementation(()=>session);
 mocks.api.mockImplementation(async(url:string)=>url.endsWith('/studio')?{authoring:{...authoring,preparedQuote:undefined}}:url.endsWith('/studio-quote')?binding:Promise.reject(Error('Create response interrupted')));
 const m=await mount();
 session.edit={...session.edit,site:{access:'hard'},revision:4};session.session.dirty=true;session.canSave=true;
 session.save.mockImplementation(()=>{session.session.dirty=false;session.canSave=false;});
 m.rerender(<StudioWebsiteReview review={review as any} actorId="actor"/>);
 await act(async()=>[...m.container.querySelectorAll('button')].find(b=>b.textContent==='Save design and site details')!.click());
 m.rerender(<StudioWebsiteReview review={review as any} actorId="actor"/>);
 await act(async()=>[...m.container.querySelectorAll('button')].find(b=>b.textContent==='Capture test views')!.click());
 await act(async()=>[...m.container.querySelectorAll('button')].find(b=>b.textContent==='Create quote from this design')!.click());
 expect(m.container.textContent).toContain('Create response interrupted');
 expect(m.container.querySelector('fieldset')?.disabled).toBe(true);
 expect(JSON.parse(mocks.api.mock.calls.find(([url])=>url.endsWith('/studio-quote'))![1].body).source).toMatchObject({revision:4,site:{access:'hard'}});
 await resume(m.container);
 const attempts=mocks.api.mock.calls.filter(([url])=>url.endsWith('/quotes'));
 expect(attempts).toHaveLength(2);expect(attempts[0][1].body).toBe(attempts[1][1].body);
 expect(mocks.api.mock.calls.filter(([url])=>url.endsWith('/studio-quote'))).toHaveLength(1);
});

it('places the live views and selected specification before commercial fields without changing capture authority',async()=>{
 const m=await mount(),spec=m.container.querySelector('[aria-label="Selected design specification"]')!,fields=m.container.querySelector('fieldset')!;
 expect(spec).toBeTruthy();expect(spec.compareDocumentPosition(fields)&Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
 expect(m.container.textContent).toContain('Inherited setting · current price unavailable');
 expect([...m.container.querySelectorAll('button')].find(b=>b.textContent==='Capture test views')!.disabled).toBe(true);
 expect(mocks.api.mock.calls.some(([url])=>url.endsWith('/studio-quote'))).toBe(false);
});

it('shows a current pricing refusal and withholds stale inherited assumptions and capture',async()=>{
 mocks.price={status:'unavailable',amount:null,reason:'The selected house edge is too short.',siteAssumptions:{access:'Old value'}};
 const m=await mount();expect(m.container.textContent).toContain('Price unavailable');expect(m.container.textContent).toContain('The selected house edge is too short.');expect(m.container.textContent).not.toContain('Old value');expect([...m.container.querySelectorAll('button')].find(b=>b.textContent==='Capture test views')?.disabled).toBe(true);
});
it.each(['WAITING','CLOSED'])('keeps read and capture available but pauses %s quote preparation until acknowledgement',async state=>{
 mocks.policyState=state;mocks.api.mockImplementation(async(url:string)=>url.endsWith('/studio')?{authoring:{...authoring,preparedQuote:undefined}}:url.endsWith('/studio-quote')?binding:{quoteVersion:{id:'quote-result'}});
 const m=await mount();const button=(label:string)=>[...m.container.querySelectorAll('button')].find(b=>b.textContent===label)!;
 expect(button('Capture test views').disabled).toBe(false);
 await act(async()=>button('Capture test views').click());expect(button('Create quote from this design').disabled).toBe(true);
 expect(m.container.querySelector('a[href$="/edit"]')).toBeTruthy();
 await act(async()=>button('Review commercial actions').click());
 expect(button('Create quote from this design').disabled).toBe(false);
 await act(async()=>button('Create quote from this design').click());
 expect(mocks.api.mock.calls.filter(([url])=>url.endsWith('/studio-quote'))).toHaveLength(1);
 expect(mocks.api.mock.calls.filter(([url])=>url.endsWith('/quotes'))).toHaveLength(1);
});
it('retains the prepared identity when project state changes during preparation and resumes only after current acknowledgement',async()=>{
 let finish!: (value:typeof binding)=>void;
 mocks.api.mockImplementation(async(url:string)=>url.endsWith('/studio')?{authoring:{...authoring,preparedQuote:undefined}}:url.endsWith('/studio-quote')?new Promise(resolve=>{finish=resolve;}):{quoteVersion:{id:'quote-result'}});
 const m=await mount(),button=(label:string)=>[...m.container.querySelectorAll('button')].find(b=>b.textContent===label)!;
 await act(async()=>button('Capture test views').click());await act(async()=>button('Create quote from this design').click());
 mocks.policyState='WAITING';m.rerender(<StudioWebsiteReview review={review as any} actorId="actor"/>);
 await act(async()=>finish(binding));
 expect(button('Resume prepared quote').disabled).toBe(true);
 expect(mocks.api.mock.calls.filter(([url])=>url.endsWith('/quotes'))).toHaveLength(0);
 await act(async()=>button('Review commercial actions').click());
 mocks.policyVersion=2;m.rerender(<StudioWebsiteReview review={review as any} actorId="actor"/>);
 expect(button('Resume prepared quote').disabled).toBe(true);
 await act(async()=>button('Review commercial actions').click());await resume(m.container);
 expect(mocks.api.mock.calls.filter(([url])=>url.endsWith('/studio-quote'))).toHaveLength(1);
 expect(JSON.parse(mocks.api.mock.calls.find(([url])=>url.endsWith('/quotes'))![1].body).clientIntentId).toBe(`studio:${binding.snapshotId}`);
});
it('withholds resume while the project is unavailable, and does not dispatch an old identity after navigation',async()=>{
 mocks.policyReady=false;const m=await mount();
 expect([...m.container.querySelectorAll('button')].find(b=>b.textContent==='Resume prepared quote')!.disabled).toBe(true);
 mocks.policyReady=true;m.rerender(<StudioWebsiteReview review={review as any} actorId="actor"/>);
 let finish!: (value:typeof binding)=>void;
 mocks.api.mockImplementation(async(url:string)=>url.endsWith('/studio')?{authoring:{...authoring,preparedQuote:undefined}}:new Promise(resolve=>{finish=resolve;}));
 await act(async()=>[...m.container.querySelectorAll('button')].find(b=>b.textContent==='Prepare updated quote views')!.click());
 await act(async()=>[...m.container.querySelectorAll('button')].find(b=>b.textContent==='Capture test views')!.click());
 await act(async()=>[...m.container.querySelectorAll('button')].find(b=>b.textContent==='Create quote from this design')!.click());
 m.rerender(<StudioWebsiteReview review={{estimate:{...review.estimate,id:'est-other'}} as any} actorId="another-actor"/>);
 await act(async()=>finish(binding));
 expect(mocks.api.mock.calls.filter(([url])=>url.endsWith('/quotes'))).toHaveLength(0);expect(mocks.push).not.toHaveBeenCalled();
});
