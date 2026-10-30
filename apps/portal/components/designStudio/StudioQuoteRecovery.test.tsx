import {act,type ReactNode} from 'react';
import {beforeEach,afterEach,expect,it,vi} from 'vitest';
import {renderIntoDocument} from '../../../../test/reactHarness';
import {ProjectCommercialProvider} from '@/components/projects/ProjectPage/ProjectCommercialContext';
import type {ProjectWorkProjection} from '@/lib/projects/workItems/types';
import {invalidateStudioLifecycle} from '@/lib/designStudio/studioLifecycle';
import {listStudioPendingCommands,studioPendingCommandKey,sendStudioCommand} from '@/lib/designStudio/saveTransport';
import {studioWorkingCopyKey} from '@/lib/designStudio/workingCopy';
import type {StudioAuthoringView} from '@/lib/designStudio/authoringView';
import StudioWebsiteReview from './StudioWebsiteReview';
const mocks=vi.hoisted(()=>({get:vi.fn(),keys:vi.fn(),update:vi.fn(),owner:vi.fn(),api:vi.fn(),committed:false,fault:'',created:0,firstBody:'',response:null as any}));
vi.mock('idb-keyval',()=>({get:mocks.get,keys:mocks.keys,update:mocks.update}));
vi.mock('@/lib/localFirst/store',()=>({getLocalFirstStoreOwner:mocks.owner,flushLocalFirstStore:async()=>{}}));
vi.mock('@/lib/repo/apiClient',async load=>({...await load<typeof import('@/lib/repo/apiClient')>(),apiJson:mocks.api}));
vi.mock('next/navigation',()=>({useRouter:()=>({push:vi.fn()})}));
vi.mock('next/dynamic',()=>({default:(load:()=>unknown)=>String(load).includes('StudioQuoteDocument')?({quote}:any)=><output aria-label="Completed quote">{quote.id}</output>:()=>null}));
vi.mock('@tanstack/react-query',()=>({useQueryClient:()=>({})}));
vi.mock('@/lib/queries/projectCache',()=>({invalidateProjectReadCaches:vi.fn()}));
vi.mock('@/lib/supabase/browserClient',()=>({supabaseRuntimeUrl:()=>'',supabaseHostFromUrl:()=>''}));
vi.mock('@/components/auth/PortalAuthProvider',()=>({usePortalSession:()=>({role:'staff'})}));
vi.mock('@/components/ui/toast/ToastProvider',()=>({useToast:()=>({error:vi.fn()})}));
vi.mock('./StudioCommercialPolicy',()=>({default:({children,projectId}:{children:ReactNode;projectId:string})=><ProjectCommercialProvider projectId={projectId} ready work={{effectiveState:'ACTIVE',stateRowVersion:1} as ProjectWorkProjection}>{children}</ProjectCommercialProvider>}));
vi.mock('./useStudioWebsitePrice',()=>({useStudioWebsitePrice:()=>({price:{status:'priced',amount:100,versionNumber:2},retry:vi.fn()})}));
vi.mock('./StudioSiteAddressPicker',()=>({default:()=>null}));
const scope={actorId:'10000000-0000-4000-8000-000000000001',projectId:'proj_20000000-0000-4000-8000-000000000001',estimateId:'est_30000000-0000-4000-8000-000000000001',designId:'recovery'};
const view:StudioAuthoringView={schemaVersion:'studio_authoring_view.v1',designId:scope.designId,revision:3,spatial:{houseAssembly:null,decks:[],openings:[],pergolas:[]},site:{siteAddressProof:{schemaVersion:'studio_selected_address.v1',projectId:scope.projectId,destinationCanonical:'12 Example Road, Auckland',placeId:'synthetic',issuedAt:1,proof:'a'.repeat(64)}},objectOptions:[],pricing:'unpriced'};
const updatedAt='2026-10-28T00:00:00Z',db=new Map<string,unknown>();let queue:Promise<unknown>;const mounts:ReturnType<typeof renderIntoDocument>[]=[];
function review(locked=false){const saved=locked?{...view,revision:4}:view;return{estimate:{id:scope.estimateId,projectId:scope.projectId,versionLabel:'V4',updatedAt:locked?'2026-10-28T00:00:02Z':updatedAt},websiteComposition:saved,nextAction:{kind:locked?'create-revision':'edit'},clientDocumentsEnabled:true};}
async function mount(locked=false){const m=renderIntoDocument(<StudioWebsiteReview review={review(locked) as any} actorId={scope.actorId}/>);mounts.push(m);await act(async()=>{});return m;}
async function click(m:ReturnType<typeof renderIntoDocument>,label:string){await act(async()=>{const button=[...m.container.querySelectorAll('button')].find(b=>b.textContent===label);expect(button).toBeTruthy();button!.click();});}
beforeEach(()=>{
 invalidateStudioLifecycle();vi.resetAllMocks();db.clear();queue=Promise.resolve();mocks.owner.mockReturnValue(scope.actorId);mocks.committed=false;mocks.created=0;mocks.fault='';mocks.firstBody='';
 Object.defineProperty(navigator,'locks',{configurable:true,value:{request:vi.fn(async(name,_options,callback)=>callback({name}))}});
 mocks.get.mockImplementation(async key=>structuredClone(db.get(key)));mocks.keys.mockImplementation(async()=>[...db.keys()]);
 mocks.update.mockImplementation((key:string,fn:(old:unknown)=>unknown)=>{
  const operation=queue.then(()=>{
   const value=fn(structuredClone(db.get(key)));
   if(mocks.committed&&mocks.fault==='receipt'&&typeof value==='object'&&value!==null&&(value as any).receipt)throw Error('receipt quota');
   if(mocks.committed&&mocks.fault==='ack'&&typeof value==='object'&&value!==null&&(value as any).acknowledged)throw Error('ack quota');
   if(mocks.committed&&key===studioWorkingCopyKey(scope)&&typeof value==='string'&&JSON.parse(value).session.pending===null){
    if(mocks.fault==='quota')throw Error('quota');
    if(mocks.fault==='lifecycle')invalidateStudioLifecycle();
    if(mocks.fault==='actor')mocks.owner.mockReturnValue('other-actor');
   }
   db.set(key,structuredClone(value));
  });queue=operation.catch(()=>{});return operation;
 });
 mocks.api.mockImplementation(async(url:string,options:any)=>{
  expect(url).toMatch(/studio-quote\/create$/);const command=JSON.parse(options.body);if(!mocks.firstBody)mocks.firstBody=options.body;else expect(options.body).toBe(mocks.firstBody);
  if(mocks.fault==='response-before')throw Error('Create response lost before commitment');
  if(!mocks.committed){mocks.committed=true;mocks.created++;}
  mocks.response={quoteVersion:{id:'qv-same',projectId:scope.projectId,sourceEstimateVersionId:scope.estimateId,studioDesign:{snapshotId:command.requestId,contentHash:'a'.repeat(64),schemaVersion:'studio_quote_snapshot.v2'}},saveReceipt:{revision:4,savedAt:'2026-10-28T00:00:01Z',alreadyExisted:false},savedView:{...view,revision:4},sourceUpdatedAt:'2026-10-28T00:00:02Z'};
  if(mocks.fault==='response')throw Error('Create response lost');
  if(mocks.fault==='cas'){const key=studioWorkingCopyKey(scope),other=JSON.parse(db.get(key) as string);other.session.generation++;other.session.edit.site.access='other-tab';db.set(key,JSON.stringify(other));}
  return mocks.response;
 });
});
afterEach(()=>mounts.splice(0).forEach(m=>m.unmount()));
it.each([false,true])('reopens the real Retry quote UI after a lost response and %s used-by-quote state, replaying one exact operation',async locked=>{
 mocks.fault=locked?'response':'response-before';let m=await mount();await click(m,'Create quote');expect(m.container.querySelector('[aria-label="Completed quote"]')).toBeNull();expect(m.container.textContent).not.toContain('Retry save');
 m.unmount();mocks.fault='';
 m=await mount(locked);expect(m.container.textContent).toContain('Retry quote');expect(m.container.querySelector('[aria-label="Quote confirmation"]')).toBeTruthy();expect(m.container.querySelector('fieldset')).toBeNull();expect(m.container.textContent).not.toContain('$100.00');expect(m.container.textContent).not.toContain('Retry price');expect(m.container.textContent).not.toContain('Create quote saves valid site changes');await click(m,'Retry quote');expect(m.container.querySelector('[aria-label="Completed quote"]')?.textContent).toBe('qv-same');expect(mocks.created).toBe(1);expect(mocks.api).toHaveBeenCalledTimes(2);
});
it.each(['quota','cas','lifecycle','actor','receipt','ack'])('does not display completed quote or retire its request after %s reconciliation failure',async fault=>{
 mocks.fault=fault;const m=await mount();await click(m,'Create quote');expect(m.container.querySelector('[aria-label="Completed quote"]')).toBeNull();
 const body=JSON.parse(mocks.firstBody),stored=db.get(studioPendingCommandKey(scope,body)) as any;expect(stored.operation).toBe('quote_create.v1');expect(stored.body).toBe(mocks.firstBody);expect(stored.acknowledged).not.toBe(true);
 if(fault!=='receipt')expect(stored.receipt).toEqual(mocks.response.saveReceipt);
 if(fault==='cas')expect(JSON.parse(db.get(studioWorkingCopyKey(scope)) as string).session.edit.site.access).toBe('other-tab');
 if(fault==='ack'||fault==='receipt'){mocks.fault='';await click(m,'Retry quote');expect(m.container.querySelector('[aria-label="Completed quote"]')).toBeTruthy();expect(mocks.created).toBe(1);}
});
it('preserves the versioned operation across ordinary Save dispatch attempts',async()=>{
 mocks.fault='response';const m=await mount();await click(m,'Create quote');const retained=await listStudioPendingCommands(scope);expect(retained).toMatchObject({state:'available',entries:[{recovery:{operation:'quote_create.v1'}}]});expect(m.container.textContent).not.toContain('Retry save');
 const count=mocks.api.mock.calls.length;await sendStudioCommand(scope,JSON.parse(mocks.firstBody),()=>true);expect(mocks.api).toHaveBeenCalledTimes(count);
});
it.each([false,true])('preserves a later dirty pending-free copy on quote-recovery remount with used-by-quote=%s',async locked=>{
 mocks.fault=locked?'response':'response-before';let m=await mount();await click(m,'Create quote');
 const key=studioWorkingCopyKey(scope),later=JSON.parse(db.get(key) as string);
 later.session.pending=null;later.session.status='idle';later.session.dirty=true;later.session.generation++;later.session.edit.site.access='hard';
 const exactLater=JSON.stringify(later);db.set(key,exactLater);
 const command=JSON.parse(mocks.firstBody),journalKey=studioPendingCommandKey(scope,command),exactJournal=structuredClone(db.get(journalKey));
 m.unmount();mocks.fault='';m=await mount(locked);
 expect(m.container.textContent).toContain('Newer local changes and the earlier quote request are both kept');
 expect([...m.container.querySelectorAll('button')].some(button=>button.textContent==='Retry quote')).toBe(false);
 const create=[...m.container.querySelectorAll('button')].find(button=>button.textContent==='Create quote');if(create)expect(create.disabled).toBe(true);
 expect(m.container.querySelector('[aria-label="Completed quote"]')).toBeNull();expect(mocks.api).toHaveBeenCalledTimes(1);
 expect(db.get(key)).toBe(exactLater);expect(db.get(journalKey)).toEqual(exactJournal);expect(mocks.created).toBe(locked?1:0);
});
