import {act,type ReactNode} from 'react';
import {CommercialProjectNotice,ProjectCommercialProvider} from '@/components/projects/ProjectPage/ProjectCommercialContext';
import type {ProjectWorkProjection} from '@/lib/projects/workItems/types';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {renderIntoDocument} from '../../../../test/reactHarness';
import {createStudioAuthoringEdit,type StudioAuthoringView} from '@/lib/designStudio/authoringView';
import StudioWebsiteReview from './StudioWebsiteReview';
const mocks=vi.hoisted(()=>({finishQuote:vi.fn(),failQuote:vi.fn(),priceArgs:vi.fn(),captureFailure:false,views:vi.fn(),chunkFailure:false,loadViews:vi.fn(),priceError:null as string|null,policyReady:true,policyState:'ACTIVE',policyVersion:1,api:vi.fn(),push:vi.fn(),session:vi.fn(),invalidate:vi.fn(),price:{status:'priced',amount:100,versionNumber:15} as any}));
vi.mock('./StudioCommercialPolicy',()=>({default:({children,projectId}: {children:ReactNode;projectId:string})=><ProjectCommercialProvider projectId={projectId} ready={mocks.policyReady} work={{effectiveState:mocks.policyState,stateRowVersion:mocks.policyVersion} as ProjectWorkProjection}><CommercialProjectNotice projectId={projectId} view="studio"/>{children}</ProjectCommercialProvider>}));
vi.mock('next/navigation',()=>({useRouter:()=>({push:mocks.push})}));
vi.mock('next/dynamic',async(importOriginal)=>{const actual=await importOriginal<any>();const {useEffect,useRef}=await import('react');function Views({onCapture,onCaptureError,disabled,captureRequest}:any){mocks.views();const seen=useRef(0);useEffect(()=>{if(captureRequest&&seen.current!==captureRequest&&!disabled){seen.current=captureRequest;if(mocks.captureFailure){onCaptureError('Capture could not be completed.');return;}onCapture([{kind:'perspective',dataUrl:'data:image/png;base64,AA=='},{kind:'plan',dataUrl:'data:image/png;base64,AA=='}]);}},[captureRequest,disabled,onCapture]);return <button disabled={disabled} onClick={()=>onCapture([{kind:'perspective',dataUrl:'data:image/png;base64,AA=='},{kind:'plan',dataUrl:'data:image/png;base64,AA=='}])}>Capture test views</button>;}return{default:(load:()=>unknown,options:any)=>String(load).includes('StudioQuoteDocument')?({quote}:any)=><div aria-label="Committed quote">{quote.id}</div>:String(load).includes('StudioDesignSpecification')?()=> <section aria-label="Selected design specification">Selected design</section>:actual.default(async()=>{mocks.loadViews();if(mocks.chunkFailure)throw Error('Chunk unavailable');return{default:Views};},options)};});
vi.mock('@tanstack/react-query',()=>({useQueryClient:()=>({})}));
vi.mock('@/lib/queries/projectCache',()=>({invalidateProjectReadCaches:mocks.invalidate}));
vi.mock('@/lib/supabase/browserClient',()=>({supabaseRuntimeUrl:()=>'',supabaseHostFromUrl:()=>''}));
vi.mock('@/lib/repo/apiClient',()=>({apiJson:mocks.api}));
vi.mock('@/components/auth/PortalAuthProvider',()=>({usePortalSession:()=>({role:'staff'})}));
vi.mock('./useStudioEditingSession',()=>({useStudioEditingSession:(...args:any[])=>{const value=mocks.session(...args);return {...value,beginQuote:value.beginQuote??(async(requestId:string)=>({requestId,expectedUpdatedAt:'2026-10-20T00:00:00Z',expectedRevision:value.edit.revision,edit:value.edit})),canSubmitQuote:value.canSubmitQuote??(()=>true),finishQuote:value.finishQuote??mocks.finishQuote,failQuote:value.failQuote??mocks.failQuote,changeDerived:value.changeDerived??value.change,authoredIdentity:value.authoredIdentity??'proof',captureEdit:value.captureEdit??(()=>value.edit)};}}));
vi.mock('./useStudioWebsitePrice',()=>({useStudioWebsitePrice:(args:unknown)=>{mocks.priceArgs(args);return{price:mocks.price,error:mocks.priceError,retry:vi.fn()};}}));
vi.mock('./StudioWebsiteRecovery',()=>({default:()=>null}));
vi.mock('./StudioSiteAddressPicker',()=>({default:({projectId,disabled,onSaved}: {projectId:string;disabled:boolean;onSaved:(proof:any)=>void})=><><input aria-label="Site address" data-project={projectId} disabled={disabled} /><button disabled={disabled} onClick={()=>onSaved(addressProof)}>Choose test address</button></>}));
const addressProof={schemaVersion:'studio_selected_address.v1',projectId:'proj-proof',destinationCanonical:'12 Example Road, Auckland 1010',placeId:'fixture_place',issuedAt:1,proof:'a'.repeat(64)};
const view:StudioAuthoringView={schemaVersion:'studio_authoring_view.v1',designId:'prepared-design',revision:3,spatial:{houseAssembly:null,pergolas:[],decks:[],openings:[]},site:{siteAddressProof:addressProof},objectOptions:[],pricing:'unpriced'};
const binding={snapshotId:'10000000-0000-4000-8000-000000000005',contentHash:'a'.repeat(64)};
const authoring={state:'ready',view,estimate:{id:'est-proof',projectId:'proj-proof',versionLabel:'V1',updatedAt:'2026-10-20T00:00:00Z',requiresNewRevision:false},nextAction:'edit',preparedQuote:binding};
const review={estimate:{projectId:'proj-proof',id:'est-proof',versionLabel:'V1'}};
const mounts:ReturnType<typeof renderIntoDocument>[]=[];
beforeEach(()=>{vi.resetAllMocks();mocks.captureFailure=false;mocks.chunkFailure=false;mocks.priceError=null;mocks.policyReady=true;mocks.policyState='ACTIVE';mocks.policyVersion=1;mocks.price={status:'priced',amount:100,versionNumber:15};mocks.session.mockReturnValue({edit:createStudioAuthoringEdit(view),status:'ready',localDurable:true,session:{dirty:false,pending:null},canSave:false,canEdit:true});mocks.api.mockImplementation(async(url:string)=>url.endsWith('/studio')?{authoring}:{quoteVersion:{id:'quote-result'}});});
afterEach(()=>mounts.splice(0).forEach(m=>m.unmount()));
async function mount(){const m=renderIntoDocument(<StudioWebsiteReview review={review as any} actorId="actor"/>);mounts.push(m);await act(async()=>{});return m;}
async function resume(container:HTMLElement){const button=[...container.querySelectorAll('button')].find(b=>b.textContent==='Finish creating this quote')!;expect(button.disabled).toBe(false);await act(async()=>button.click());}
it('replaces corrupt retained travel after a genuine successful address selection and recovers the three-day field without approving the corrupt price',async()=>{
 let current=createStudioAuthoringEdit(view);current.site={travelExGst:'435.50',travelAllowance:{mode:'automatic',broken:true}};
 const change=vi.fn(next=>{current=next;});
 mocks.session.mockImplementation(()=>({edit:current,status:'ready',localDurable:true,session:{dirty:false,pending:null},canSave:false,canEdit:true,change,captureEdit:()=>current}));
 mocks.price={status:'unavailable',amount:null,reason:'Travel details are incomplete or unsupported.',installationEstimate:{siteDays:3}};
 mocks.api.mockImplementation(async(url:string)=>url.endsWith('/studio')?{authoring:{...authoring,preparedQuote:undefined}}:url.endsWith('/site-travel')?{receipt:{schemaVersion:'studio_travel_receipt.v1',policyVersion:'studio-travel-local.v1',base:'71G Montgomerie Rd, Mangere, Auckland',projectId:'proj-proof',destinationCanonical:addressProof.destinationCanonical,placeId:'fixture_place',drivingCostPerRoundTripCents:5415,overnightEligible:false,proof:'b'.repeat(64)},outboundSeconds:1200,returnSeconds:1400}:{});
 const m=await mount();expect(change).not.toHaveBeenCalled();expect(m.container.textContent).toContain('Travel details are incomplete');
 expect([...m.container.querySelectorAll('button')].find(b=>b.textContent==='Create quote')?.disabled).toBe(true);
 await act(async()=>[...m.container.querySelectorAll('button')].find(b=>b.textContent==='Choose test address')!.click());
 expect(change.mock.calls[0][0].site).toMatchObject({siteAddressProof:addressProof,travelAllowance:{mode:'pending'}});
 expect(current.site).toMatchObject({travelExGst:'162.45',travelAllowance:{mode:'automatic',tripCountSource:'site_days',plannedRoundTrips:'3'}});
 expect(mocks.api.mock.calls.filter(([url])=>url.endsWith('/site-travel'))).toHaveLength(1);
});
it('keeps useful manual-zero design price but disables fresh quote until physical-address proof exists',async()=>{
 const edit=createStudioAuthoringEdit(view);edit.site={travelExGst:'0',travelAllowance:{mode:'manual'},siteAddressProof:null};
 mocks.session.mockReturnValue({edit,status:'ready',localDurable:true,session:{dirty:false,pending:null},canSave:false,canEdit:true});
 mocks.api.mockResolvedValue({authoring:{...authoring,preparedQuote:undefined}});
 const m=await mount();expect(m.container.textContent).toContain('$100.00');expect(m.container.textContent).toContain('Choose a physical site address');
 const button=[...m.container.querySelectorAll('button')].find(b=>b.textContent==='Create quote')!;expect(button.disabled).toBe(true);
 expect((m.container.querySelector('input[aria-label="Site address"]') as HTMLInputElement).disabled).toBe(false);
 await act(async()=>button.click());expect(mocks.api.mock.calls.some(([,options])=>options?.method==='POST')).toBe(false);
});
it('does not load capture code on entry and retries a rejected capture chunk from the explicit quote action',async()=>{
 mocks.chunkFailure=true;mocks.api.mockImplementation(async(url:string)=>url.endsWith('/studio')?{authoring:{...authoring,preparedQuote:undefined}}:url.endsWith('/studio-quote')?binding:{quoteVersion:{id:'qv-created'}});
 const m=await mount();expect(mocks.loadViews).not.toHaveBeenCalled();expect(mocks.views).not.toHaveBeenCalled();
 await act(async()=>[...m.container.querySelectorAll('button')].find(b=>b.textContent==='Create quote')!.click());
 expect(m.container.textContent).toContain('design views could not be opened');expect(mocks.api.mock.calls.some(([,o])=>o?.method==='POST')).toBe(false);
 mocks.chunkFailure=false;await act(async()=>[...m.container.querySelectorAll('button')].find(b=>b.textContent==='Retry views')!.click());
 expect(mocks.loadViews).toHaveBeenCalledTimes(2);expect(mocks.api.mock.calls.filter(([url])=>url.endsWith('/studio-quote'))).toHaveLength(1);
});

it('uses the same fresh Review source without another authoring request and leaves fields usable while price is pending or failed',async()=>{
 mocks.price=null;const fresh={...review,websiteComposition:view,nextAction:{kind:'edit'},estimate:{...review.estimate,updatedAt:authoring.estimate.updatedAt}};
 const m=renderIntoDocument(<StudioWebsiteReview review={fresh as any} actorId="actor"/>);mounts.push(m);await act(async()=>{});
 expect(mocks.api).not.toHaveBeenCalled();expect(mocks.views).not.toHaveBeenCalled();expect(m.container.querySelector('fieldset')?.disabled).toBe(false);expect(m.container.textContent).toContain('Calculating');
 mocks.priceError='Pricing unavailable';m.rerender(<StudioWebsiteReview review={fresh as any} actorId="actor"/>);expect(m.container.textContent).toContain('Pricing unavailable');expect(m.container.querySelector('fieldset')?.disabled).toBe(false);
 expect(mocks.api).not.toHaveBeenCalled();
});

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
 const m=await mount();expect(m.container.textContent).toContain('already used by a quote');expect(m.container.textContent).not.toContain('Finish creating this quote');
 expect(m.container.querySelector('a[href="/staff/projects/proj-proof?tab=quotes"]')).toBeTruthy();
});
it('does not apply an old preparation to a changed retained local design',async()=>{
 const edit=createStudioAuthoringEdit(view);edit.site.travelExGst='25';mocks.session.mockReturnValue({edit,status:'ready',localDurable:true,session:{dirty:true,pending:null},canSave:true,canEdit:true});
 const m=await mount();expect(m.container.textContent).not.toContain('Finish creating this quote');expect(m.container.textContent).toContain('Your current changes will be saved first');
});
it('rechecks the saved source and permits fresh capture after a publication change without replaying the old preparation',async()=>{
 const m=await mount();const replace=[...m.container.querySelectorAll('button')].find(b=>b.textContent==='Use updated views and price')!;
 await act(async()=>replace.click());
 expect(mocks.api.mock.calls.filter(([url])=>url.endsWith('/studio'))).toHaveLength(2);
 expect(m.container.textContent).not.toContain('Finish creating this quote');
 expect([...m.container.querySelectorAll('button')].find(b=>b.textContent==='Create quote')?.disabled).toBe(false);
 expect(mocks.api.mock.calls.some(([url])=>url.endsWith('/studio-quote')||url.endsWith('/quotes'))).toBe(false);
 const nextBinding={snapshotId:'10000000-0000-4000-8000-000000000006',contentHash:'b'.repeat(64)};
 mocks.api.mockImplementation(async(url:string)=>url.endsWith('/studio-quote')?nextBinding:{quoteVersion:{id:'new-quote'}});
 await act(async()=>[...m.container.querySelectorAll('button')].find(b=>b.textContent==='Create quote')!.click());
 expect(JSON.parse(mocks.api.mock.calls.find(([url])=>url.endsWith('/quotes'))![1].body)).toMatchObject({clientIntentId:`studio:${nextBinding.snapshotId}`,studioSnapshot:nextBinding});
});

it('keeps the exact saved Review revision prepared after create fails and retries its original intent',async()=>{
 const session={edit:createStudioAuthoringEdit(view),status:'ready',localDurable:true,session:{dirty:false,pending:null},canSave:false,canEdit:true,save:vi.fn()};
 mocks.session.mockImplementation(()=>session);
 mocks.api.mockImplementation(async(url:string)=>url.endsWith('/studio')?{authoring:{...authoring,preparedQuote:undefined}}:url.endsWith('/studio-quote')?binding:Promise.reject(Error('Create response interrupted')));
 const m=await mount();
 session.edit={...session.edit,site:{...view.site,access:'hard'},revision:4};session.session.dirty=true;session.canSave=true;
 session.save.mockImplementation(()=>{session.session.dirty=false;session.canSave=false;});
 m.rerender(<StudioWebsiteReview review={review as any} actorId="actor"/>);
 await act(async()=>[...m.container.querySelectorAll('button')].find(b=>b.textContent==='Create quote')!.click());
 expect(m.container.textContent).toContain('Create response interrupted');
 expect(m.container.querySelector('fieldset')?.disabled).toBe(true);
 expect(JSON.parse(mocks.api.mock.calls.find(([url])=>url.endsWith('/studio-quote'))![1].body).source).toMatchObject({revision:4,site:{access:'hard'}});
 await resume(m.container);
 const attempts=mocks.api.mock.calls.filter(([url])=>url.endsWith('/quotes'));
 expect(attempts).toHaveLength(2);expect(attempts[0][1].body).toBe(attempts[1][1].body);
 expect(mocks.api.mock.calls.filter(([url])=>url.endsWith('/studio-quote'))).toHaveLength(1);
});

it('shows editable inputs without mounting the renderer or hidden specification on entry',async()=>{
 mocks.api.mockResolvedValue({authoring:{...authoring,preparedQuote:undefined}});const m=await mount();expect(m.container.querySelector('fieldset')?.disabled).toBe(false);expect(m.container.querySelector('[aria-label="Selected design specification"]')).toBeNull();expect(m.container.textContent).not.toContain('Capture test views');expect(mocks.views).not.toHaveBeenCalled();expect(mocks.api.mock.calls.some(([url])=>url.endsWith('/studio-quote'))).toBe(false);
});

it('shows a current pricing refusal and withholds stale inherited assumptions and capture',async()=>{
 mocks.price={status:'unavailable',amount:null,reason:'The selected house edge is too short.',siteAssumptions:{access:'Old value'}};mocks.api.mockResolvedValue({authoring:{...authoring,preparedQuote:undefined}});
 const m=await mount();expect(m.container.textContent).toContain('Price unavailable');expect(m.container.textContent).toContain('The selected house edge is too short.');expect(m.container.textContent).not.toContain('Old value');expect([...m.container.querySelectorAll('button')].find(b=>b.textContent==='Capture test views')).toBeUndefined();expect(m.container.querySelector('fieldset')?.disabled).toBe(false);
});
it.each(['WAITING','CLOSED'])('keeps read and capture available but pauses %s quote preparation until acknowledgement',async state=>{
 mocks.policyState=state;mocks.api.mockImplementation(async(url:string)=>url.endsWith('/studio')?{authoring:{...authoring,preparedQuote:undefined}}:url.endsWith('/studio-quote')?binding:{quoteVersion:{id:'quote-result'}});
 const m=await mount();const button=(label:string)=>[...m.container.querySelectorAll('button')].find(b=>b.textContent===label)!;
 expect(mocks.views).not.toHaveBeenCalled();
expect(button('Create quote').disabled).toBe(true);
 expect(m.container.querySelector('a[href$="/edit"]')).toBeTruthy();
 await act(async()=>button('Review commercial actions').click());
 expect(button('Create quote').disabled).toBe(false);
 await act(async()=>button('Create quote').click());
 expect(mocks.api.mock.calls.filter(([url])=>url.endsWith('/studio-quote'))).toHaveLength(1);
 expect(mocks.api.mock.calls.filter(([url])=>url.endsWith('/quotes'))).toHaveLength(1);
});
it('retains the prepared identity when project state changes during preparation and resumes only after current acknowledgement',async()=>{
 let finish!: (value:typeof binding)=>void;
 mocks.api.mockImplementation(async(url:string)=>url.endsWith('/studio')?{authoring:{...authoring,preparedQuote:undefined}}:url.endsWith('/studio-quote')?new Promise(resolve=>{finish=resolve;}):{quoteVersion:{id:'quote-result'}});
 const m=await mount(),button=(label:string)=>[...m.container.querySelectorAll('button')].find(b=>b.textContent===label)!;
await act(async()=>button('Create quote').click());
 mocks.policyState='WAITING';m.rerender(<StudioWebsiteReview review={review as any} actorId="actor"/>);
 await act(async()=>finish(binding));
 expect(button('Finish creating this quote').disabled).toBe(true);
 expect(mocks.api.mock.calls.filter(([url])=>url.endsWith('/quotes'))).toHaveLength(0);
 await act(async()=>button('Review commercial actions').click());
 mocks.policyVersion=2;m.rerender(<StudioWebsiteReview review={review as any} actorId="actor"/>);
 expect(button('Finish creating this quote').disabled).toBe(true);
 await act(async()=>button('Review commercial actions').click());await resume(m.container);
 expect(mocks.api.mock.calls.filter(([url])=>url.endsWith('/studio-quote'))).toHaveLength(1);
 expect(JSON.parse(mocks.api.mock.calls.find(([url])=>url.endsWith('/quotes'))![1].body).clientIntentId).toBe(`studio:${binding.snapshotId}`);
});
it('withholds resume while the project is unavailable, and does not dispatch an old identity after navigation',async()=>{
 mocks.policyReady=false;const m=await mount();
 expect([...m.container.querySelectorAll('button')].find(b=>b.textContent==='Finish creating this quote')!.disabled).toBe(true);
 mocks.policyReady=true;m.rerender(<StudioWebsiteReview review={review as any} actorId="actor"/>);
 let finish!: (value:typeof binding)=>void;
 mocks.api.mockImplementation(async(url:string)=>url.endsWith('/studio')?{authoring:{...authoring,preparedQuote:undefined}}:new Promise(resolve=>{finish=resolve;}));
 await act(async()=>[...m.container.querySelectorAll('button')].find(b=>b.textContent==='Use updated views and price')!.click());
 await act(async()=>[...m.container.querySelectorAll('button')].find(b=>b.textContent==='Create quote')!.click());
 m.rerender(<StudioWebsiteReview review={{estimate:{...review.estimate,id:'est-other'}} as any} actorId="another-actor"/>);
 await act(async()=>finish(binding));
 expect(mocks.api.mock.calls.filter(([url])=>url.endsWith('/quotes'))).toHaveLength(0);expect(mocks.push).not.toHaveBeenCalled();
});

// This isolated presenter fixture supplies the native entry link's existing Portal toast surface.
vi.mock('@/components/ui/toast/ToastProvider',()=>({useToast:()=>({error:vi.fn()})}));

it('creates from one explicit action, captures automatically, and stays inside Studio',async()=>{
 mocks.api.mockImplementation(async(url:string)=>url.endsWith('/studio')?{authoring:{...authoring,preparedQuote:undefined}}:url.endsWith('/studio-quote')?binding:{quoteVersion:{id:'qv-created'}});
 const m=await mount();expect(mocks.api.mock.calls.filter(([,options])=>options?.method==='POST')).toHaveLength(0);
 const primary=[...m.container.querySelectorAll('button')].find(b=>/Create.*quote/i.test(b.textContent??''))!;
 expect(primary.disabled).toBe(false);await act(async()=>primary.click());
 expect(mocks.api.mock.calls.filter(([url])=>url.endsWith('/studio-quote'))).toHaveLength(1);
 expect(mocks.api.mock.calls.filter(([url])=>url.endsWith('/quotes'))).toHaveLength(1);
 expect(mocks.push).toHaveBeenCalledWith('/staff/design-studio/proj-proof/est-proof?quoteVersionId=qv-created');
});
it('waits for the exact saved revision and its current price before capturing and committing',async()=>{
 let saved!:()=>void;const session={edit:{...createStudioAuthoringEdit(view),site:{...view.site,travelExGst:'75'}},status:'ready',localDurable:true,session:{dirty:true,pending:null},canSave:true,canEdit:true,save:vi.fn(()=>new Promise<void>(r=>{saved=r;}))};mocks.session.mockImplementation(()=>session);
 mocks.api.mockImplementation(async(url:string)=>url.endsWith('/studio')?{authoring:{...authoring,preparedQuote:undefined}}:url.endsWith('/studio-quote')?binding:{quoteVersion:{id:'qv-created'}});
 const m=await mount();await act(async()=>[...m.container.querySelectorAll('button')].find(b=>b.textContent==='Create quote')!.click());expect(session.save).toHaveBeenCalledOnce();expect(mocks.api.mock.calls.some(([url])=>url.endsWith('/studio-quote'))).toBe(false);
 session.edit={...session.edit,revision:4};session.session.dirty=false;session.canSave=false;mocks.price=null as any;
 await act(async()=>{saved();});m.rerender(<StudioWebsiteReview review={review as any} actorId="actor"/>);await act(async()=>{});expect(mocks.api.mock.calls.some(([url])=>url.endsWith('/studio-quote'))).toBe(false);
 mocks.price={status:'priced',amount:175,versionNumber:16};await act(async()=>m.rerender(<StudioWebsiteReview review={review as any} actorId="actor"/>));
 const writes=mocks.api.mock.calls.filter(([url])=>url.endsWith('/studio-quote'));expect(writes).toHaveLength(1);expect(JSON.parse(writes[0][1].body).source).toMatchObject({revision:4,site:{travelExGst:'75'}});
});
it('keeps failed capture recoverable without preparing or creating a quote',async()=>{
 mocks.captureFailure=true;mocks.api.mockResolvedValue({authoring:{...authoring,preparedQuote:undefined}});const m=await mount();await act(async()=>[...m.container.querySelectorAll('button')].find(b=>b.textContent==='Create quote')!.click());expect(m.container.textContent).toContain('Capture could not be completed.');expect(mocks.api.mock.calls.some(([,options])=>options?.method==='POST')).toBe(false);expect([...m.container.querySelectorAll('button')].find(b=>b.textContent==='Create quote')!.disabled).toBe(false);
});
it('keeps the actual design and exact related quote links useful after quote locking',async()=>{
 mocks.api.mockResolvedValue({authoring:{...authoring,nextAction:'create-revision',estimate:{...authoring.estimate,requiresNewRevision:true}}});const m=renderIntoDocument(<StudioWebsiteReview review={review as any} actorId="actor" relatedQuotes={[{id:'qv-exact',status:'DRAFT',label:'Q-TEST · v2'}]}/>);mounts.push(m);await act(async()=>{});expect([...m.container.querySelectorAll('a[href$="?quoteVersionId=qv-exact"]')].some(a=>a.textContent?.includes('Q-TEST'))).toBe(true);expect(mocks.views).not.toHaveBeenCalled();expect(mocks.api.mock.calls.some(([,options])=>options?.method==='POST')).toBe(false);
});

it('binds saved quoted-field wording only to the locked Review branch',async()=>{
 mocks.api.mockResolvedValue({authoring:{...authoring,nextAction:'create-revision',estimate:{...authoring.estimate,requiresNewRevision:true}}});
 const m=await mount();
 expect(m.container.textContent).toContain('Inherited setting · saved with quoted design');
 expect(m.container.textContent).not.toContain('current price unavailable');
 expect(m.container.querySelector('fieldset')?.disabled).toBe(true);
 expect(mocks.api.mock.calls.some(([,options])=>options?.method==='POST')).toBe(false);
});

it('retains preparation but does not commit after the real editing capability withdraws during the request',async()=>{
 let finish!:(value:typeof binding)=>void;let allowed=true;const edit=createStudioAuthoringEdit(view);mocks.session.mockReturnValue({edit,status:'ready',localDurable:true,session:{dirty:false,pending:null},canSave:false,canEdit:true,captureEdit:()=>allowed?edit:null});mocks.api.mockImplementation(async(url:string)=>url.endsWith('/studio')?{authoring:{...authoring,preparedQuote:undefined}}:new Promise(r=>{finish=r;}));const m=await mount();await act(async()=>[...m.container.querySelectorAll('button')].find(b=>b.textContent==='Create quote')!.click());allowed=false;await act(async()=>finish(binding));expect(mocks.api.mock.calls.some(([url])=>url.endsWith('/quotes'))).toBe(false);expect(m.container.textContent).toContain('prepared');
});

it.each(['loading','clean','dirty','pending','recovery','retry-only'])('binds the same-request initial price only to a fresh clean Review: %s',async state=>{
 const {studioOpeningPrice}=await import('@/lib/designStudio/studioOpening');
 const opening=studioOpeningPrice({actorId:'actor',role:'staff',projectId:'proj-proof',estimateId:'est-proof',designId:view.designId,revision:view.revision,requestKey:'test'},Promise.resolve({ok:false,error:'fixture'}),vi.fn());
 const session={edit:createStudioAuthoringEdit(view),status:state==='loading'?'loading':state==='recovery'?'recovery':'ready',localDurable:true,session:{dirty:state==='dirty',pending:state==='pending'?{}:null},retryOnly:state==='retry-only',canEdit:true,canSave:false};mocks.session.mockReturnValue(session);
 const fresh={...review,websiteComposition:view,nextAction:{kind:'edit'},estimate:{...review.estimate,updatedAt:authoring.estimate.updatedAt}};
 const m=renderIntoDocument(<StudioWebsiteReview review={fresh as any} actorId="actor" openingPrice={opening}/>);mounts.push(m);await act(async()=>{});
 expect(mocks.api).not.toHaveBeenCalled();expect(mocks.priceArgs).toHaveBeenLastCalledWith(expect.objectContaining({openingPrice:opening,openingState:state==='clean'?'eligible':state==='loading'?'waiting':'ineligible'}));
});

it('creates an admitted v2 quote from a dirty Review in one request without Save/price/capture round trips',async()=>{
 const reviewV2={...review,clientDocumentsEnabled:true},edit=createStudioAuthoringEdit(view),save=vi.fn();
 edit.site={...edit.site,travelExGst:'162.45'};
 mocks.session.mockReturnValue({edit,status:'ready',localDurable:true,session:{dirty:true,pending:null},canSave:true,canEdit:true,save});mocks.price=null;
 mocks.api.mockImplementation(async(url:string,options:any)=>url.endsWith('/studio')?{authoring:{...authoring,preparedQuote:undefined}}:{quoteVersion:{id:'qv-v2',projectId:'proj-proof',sourceEstimateVersionId:'est-proof',studioDesign:{...binding,snapshotId:JSON.parse(options.body).requestId,schemaVersion:'studio_quote_snapshot.v2',documentMode:'separate_v1'}},saveReceipt:{revision:4,savedAt:'2026-10-28T00:00:00Z',alreadyExisted:false},savedView:{...view,revision:4},sourceUpdatedAt:'2026-10-28T00:00:01Z'});
 const m=renderIntoDocument(<StudioWebsiteReview review={reviewV2 as any} actorId="actor"/>);mounts.push(m);await act(async()=>{});
 expect(m.container.textContent).toContain('prepares the design booklet in the background');expect(m.container.textContent).not.toContain('includes the current Plan and 3D views');
 await act(async()=>[...m.container.querySelectorAll('button')].find(b=>b.textContent==='Create quote')!.click());
 const writes=mocks.api.mock.calls.filter(([,options])=>options?.method==='POST');expect(writes).toHaveLength(1);expect(writes[0][0]).toMatch(/studio-quote\/create$/);
 expect(JSON.parse(writes[0][1].body)).toMatchObject({expectedRevision:3,edit:{site:{travelExGst:'162.45'}}});expect(save).not.toHaveBeenCalled();expect(mocks.finishQuote).toHaveBeenCalledOnce();
 expect(mocks.views).not.toHaveBeenCalled();expect(mocks.loadViews).not.toHaveBeenCalled();expect(mocks.push).not.toHaveBeenCalled();expect(m.container.querySelector('[aria-label="Committed quote"]')?.textContent).toBe('qv-v2');
 expect(mocks.api.mock.calls.some(([url])=>url.includes('/studio-review')||url.endsWith('/quotes')||url.endsWith('/website-price'))).toBe(false);expect(location.pathname+location.search).toBe('/staff/design-studio/proj-proof/est-proof?quoteVersionId=qv-v2');
});
it('retries the same retained composite body after an uncertain response and rejects a wrong committed binding',async()=>{
 const command={requestId:binding.snapshotId,expectedUpdatedAt:authoring.estimate.updatedAt,expectedRevision:view.revision,edit:createStudioAuthoringEdit(view)};
 mocks.session.mockReturnValue({edit:command.edit,status:'ready',localDurable:true,session:{dirty:false,pending:null},canSave:false,canEdit:true,beginQuote:async()=>command});
 mocks.api.mockImplementation(async(url:string)=>url.endsWith('/studio')?{authoring:{...authoring,preparedQuote:undefined}}:Promise.reject(Error('Response interrupted')));
 const m=renderIntoDocument(<StudioWebsiteReview review={{...review,clientDocumentsEnabled:true} as any} actorId="actor"/>);mounts.push(m);await act(async()=>{});
 const click=async()=>act(async()=>[...m.container.querySelectorAll('button')].find(b=>b.textContent==='Create quote')!.click());await click();expect(mocks.failQuote).toHaveBeenCalledOnce();
 mocks.api.mockResolvedValue({quoteVersion:{id:'wrong',projectId:'proj-other',sourceEstimateVersionId:'est-proof',studioDesign:{snapshotId:command.requestId}}});await click();
 const writes=mocks.api.mock.calls.filter(([,options])=>options?.method==='POST');expect(writes).toHaveLength(2);expect(writes[0][1].body).toBe(writes[1][1].body);expect(mocks.finishQuote).not.toHaveBeenCalled();expect(m.container.querySelector('[aria-label="Committed quote"]')).toBeNull();
});
it('resumes an existing plain prepared-v2 intent through its original quote command without new preparation or archiving',async()=>{
 mocks.api.mockImplementation(async(url:string)=>url.endsWith('/studio')?{authoring:{...authoring,preparedQuote:{...binding,documentMode:'separate_v1'}}}:{quoteVersion:{id:'qv-existing',projectId:'proj-proof',sourceEstimateVersionId:'est-proof',studioDesign:{...binding,schemaVersion:'studio_quote_snapshot.v2',documentMode:'separate_v1'}}});
 const m=renderIntoDocument(<StudioWebsiteReview review={{...review,clientDocumentsEnabled:true} as any} actorId="actor"/>);mounts.push(m);await act(async()=>{});await resume(m.container);
 const writes=mocks.api.mock.calls.filter(([,options])=>options?.method==='POST');expect(writes).toHaveLength(1);expect(writes[0][0]).toBe('/api/projects/proj-proof/quotes');expect(JSON.parse(writes[0][1].body).studioSnapshot).toEqual(binding);expect(m.container.querySelector('[aria-label="Committed quote"]')?.textContent).toBe('qv-existing');expect(location.search).toBe('?quoteVersionId=qv-existing');
});
