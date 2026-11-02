import { act, StrictMode } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../test/reactHarness';
import StudioDocument from './StudioDocument';
import StudioDocumentPage from './StudioDocumentPage';
import StudioEditor from './StudioEditor';
import * as editing from './useStudioEditingSession';
import { prepareStudioCreation } from '@/lib/designStudio/createPreparation';
import { projectStudioAuthoringView } from '@/lib/designStudio/authoringView';
import { STUDIO_OUTPUT_KEY, STUDIO_SPATIAL_OUTPUT_KEY } from '@/lib/designStudio/contracts';
import { createStudioSaveSession, changeStudioSaveSession, prepareStudioSave } from '@/lib/designStudio/saveSession';
import { persistStudioWorkingCopy, studioWorkingCopyKey } from '@/lib/designStudio/workingCopy';
import { stageStudioCommand, studioPendingCommandKey } from '@/lib/designStudio/saveTransport';
import { stageStudioCreation, sendStudioCreation } from '@/lib/designStudio/createTransport';
import { bindLocalFirstStoreOwner, clearLocalFirstStoreOwner, __resetLocalFirstStoreForTests } from '@/lib/localFirst/store';
import { __resetLocalFirstQueueForTests } from '@/lib/localFirst/queue';
import { stopLocalFirstRuntime } from '@/lib/localFirst/runtime';
import { invalidateStudioLifecycle } from '@/lib/designStudio/studioLifecycle';
import { ApiError } from '@/lib/repo/apiClient';

const mocks = vi.hoisted(() => ({opening:vi.fn(),api:vi.fn(),get:vi.fn(),set:vi.fn(),update:vi.fn(),keys:vi.fn(),del:vi.fn(),navigate:vi.fn()}));
vi.mock('next/navigation', () => ({usePathname:()=>location.pathname,useSearchParams:()=>new URLSearchParams(location.search),useRouter:()=>({refresh:vi.fn(),replace:vi.fn()})}));
vi.mock('next/link',()=>({default:({prefetch,...props}:React.ComponentProps<'a'>&{prefetch?:boolean})=><a {...props}/>}));
vi.mock('./studioLeafLoading', async original => ({...await original<typeof import('./studioLeafLoading')>(),loadStudioEditor:async()=>StudioEditor}));
vi.mock('next/dynamic', async () => {const Canvas=(await import('./StudioHouseCanvas')).default;return{default:()=>Canvas};});
vi.mock('@sp/geometry-viewer/react/canvas',()=>({SceneCanvas:()=> <div data-webgl-host/>}));
vi.mock('@/lib/designStudio/studioOpeningTransport', async original=>({...await original<typeof import('@/lib/designStudio/studioOpeningTransport')>(),readStudioOpening:mocks.opening}));
vi.mock('@/lib/designStudio/studioDocumentNavigation', async original=>{const real=await original<typeof import('@/lib/designStudio/studioDocumentNavigation')>();return {...real,navigateStudioDocument:(href:string,replace=false,_native?:unknown,signal?:AbortSignal,preparation?:Parameters<typeof real.navigateStudioDocument>[4])=>real.navigateStudioDocument(href,replace,mocks.navigate,signal,preparation)};});
vi.mock('@/lib/supabase/browserClient',()=>({supabaseRuntimeUrl:()=>'',supabaseHostFromUrl:()=>'',getSupabaseBrowser:()=>({auth:{initialize:async()=>({error:null}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})}})}));
vi.mock('@/lib/repo/apiClient',async original=>({...await original<typeof import('@/lib/repo/apiClient')>(),apiJson:mocks.api}));
vi.mock('idb-keyval',()=>({get:mocks.get,set:mocks.set,update:mocks.update,keys:mocks.keys,del:mocks.del}));

const actor='10000000-0000-4000-8000-000000000001',projectId='proj_20000000-0000-4000-8000-000000000001',estimateId='est_30000000-0000-4000-8000-000000000001';
const updatedAt='2026-11-02T00:00:00Z',callback=`/staff/design-studio/${projectId}/${estimateId}/edit`;
const prepared=prepareStudioCreation({mode:'blank',projectId,designId:'protected-view',commercialScopeId:null});
if(!prepared.ok)throw Error(prepared.message);
const projected=projectStudioAuthoringView({authored:prepared.prepared.row.outputs[STUDIO_OUTPUT_KEY],spatial:prepared.prepared.row.outputs[STUDIO_SPATIAL_OUTPUT_KEY]});
if(!projected.ok)throw Error(projected.message);
const source=projected.value,scope={actorId:actor,projectId,estimateId,designId:source.designId};
const authoring=(history:'quoted'|'archived'='quoted')=>({state:'ready',view:source,estimate:{id:estimateId,projectId,versionLabel:'V2',updatedAt,requiresNewRevision:true},nextAction:'create-revision',reason:null,identity:{projectName:'Synthetic courtyard',internalName:'Protected pergola',createdAt:updatedAt,history,quoteLabel:'Q-SYNTHETIC'}});
let db:Map<string,unknown>,mounted:ReturnType<typeof renderIntoDocument>|undefined,sessionSpy:ReturnType<typeof vi.spyOn>;
const flush=async()=>{await act(async()=>{await new Promise(resolve=>setTimeout(resolve,1));});};
const click=async(text:string)=>{await act(async()=>[...mounted!.container.querySelectorAll('button')].find(b=>b.textContent===text)!.click());await flush();};
beforeEach(()=>{
 stopLocalFirstRuntime({clearOwner:true});__resetLocalFirstStoreForTests();__resetLocalFirstQueueForTests();invalidateStudioLifecycle();vi.clearAllMocks();sessionStorage.clear();localStorage.clear();db=new Map();history.replaceState({},'',callback);
 sessionSpy=vi.spyOn(editing,'useStudioEditingSession');
 mocks.get.mockImplementation(async key=>structuredClone(db.get(key)));mocks.keys.mockImplementation(async()=>[...db.keys()]);mocks.set.mockImplementation(async(key,value)=>db.set(key,structuredClone(value)));mocks.del.mockImplementation(async key=>db.delete(key));mocks.update.mockImplementation(async(key,fn)=>db.set(key,structuredClone(fn(structuredClone(db.get(key))))));
 mocks.opening.mockResolvedValue({scope:{actorId:actor,role:'staff',projectId,estimateId},authoring:authoring()});
 mocks.api.mockImplementation(async(url:string,options?:RequestInit)=>{
  if(url===`/api/projects/${projectId}/studio`&&!options?.method)return{projectId,project:{id:projectId.slice(5),name:'Synthetic courtyard'},designs:[],loadError:false};
  if(url===`/api/staff/v1/projects/${projectId}/command-centre`&&!options?.method)return{projectId,workModel:'legacy'};
  throw Error('Unexpected request '+url);
 });
 Object.defineProperty(navigator,'onLine',{configurable:true,value:true});Object.defineProperty(navigator,'locks',{configurable:true,value:{request:async(name:string,optionsOrCallback:unknown,fn?:(lock:unknown)=>unknown)=>(typeof optionsOrCallback==='function'?optionsOrCallback:fn!)({name})}});
 Object.defineProperty(SVGSVGElement.prototype,'clientWidth',{configurable:true,get:()=>1000});Object.defineProperty(SVGSVGElement.prototype,'clientHeight',{configurable:true,get:()=>700});
 Object.defineProperty(Element.prototype,'setPointerCapture',{configurable:true,value:()=>{}});Object.defineProperty(Element.prototype,'releasePointerCapture',{configurable:true,value:()=>{}});
 vi.stubGlobal('DOMPoint',class{constructor(public x:number,public y:number){}matrixTransform(){return{x:this.x,y:this.y};}});
});
afterEach(()=>{mounted?.unmount();mounted=undefined;stopLocalFirstRuntime({clearOwner:true});__resetLocalFirstQueueForTests();invalidateStudioLifecycle();clearLocalFirstStoreOwner();vi.restoreAllMocks();vi.unstubAllGlobals();});
async function open(strict=false){const frame=<StudioDocument callback={callback}><StudioDocumentPage callback={callback}/></StudioDocument>;mounted=renderIntoDocument(strict?<StrictMode>{frame}</StrictMode>:frame);await flush();await vi.waitFor(()=>expect(mounted!.container.querySelector('[data-studio-read-only]')).not.toBeNull(),{interval:0});}

it.each(['quoted','archived'] as const)('opens the actual admitted %s model without an editable session, reprice, storage write or creation discovery',async history=>{
 mocks.opening.mockResolvedValue({scope:{actorId:actor,role:'staff',projectId,estimateId},authoring:authoring(history)});
 await open();expect(sessionSpy).not.toHaveBeenCalled();expect(mounted!.container.querySelector('[data-webgl-host]')).not.toBeNull();expect(mounted!.container.textContent).toContain(history==='quoted'?'Quoted · read only':'Archived · read only');
 expect([...mounted!.container.querySelectorAll('button')].some(b=>b.textContent==='Save design'||b.textContent==='+ Pergola'||b.textContent==='+ House')).toBe(false);
 expect(mounted!.container.querySelector('input')).toBeNull();expect(mounted!.container.textContent).toContain('6,000');expect(mounted!.container.querySelector('a[href$="/edit?intent=revision"]')).toBeNull();
 const reads=mocks.api.mock.calls.map(([url])=>url);expect(reads,JSON.stringify(reads)).toEqual([`/api/projects/${projectId}/studio`]);expect(mocks.keys).not.toHaveBeenCalled();expect(mocks.update).not.toHaveBeenCalled();expect(mocks.navigate).not.toHaveBeenCalled();
 await click('Plan');const svg=mounted!.container.querySelector('svg[aria-label="Studio design Plan"]')!;expect(svg).not.toBeNull();expect(svg.querySelectorAll('polygon').length).toBeGreaterThan(0);
 const before=svg.innerHTML;for(const key of ['Delete','ArrowLeft','Backspace','z','v'])act(()=>svg.dispatchEvent(new KeyboardEvent('keydown',{bubbles:true,key,ctrlKey:key==='z'||key==='v'})));
 const hit=svg.querySelector('[role="button"][aria-label="Select Pergola 1"]')!;expect(hit).not.toBeNull();
 for(const type of ['pointerdown','pointermove','pointerup'])act(()=>hit.dispatchEvent(new MouseEvent(type,{bubbles:true,button:0,clientX:type==='pointerdown'?50:150,clientY:100})));
 expect(svg.innerHTML).toBe(before);await click('3D');expect(sessionSpy).not.toHaveBeenCalled();expect(mocks.update).not.toHaveBeenCalled();expect(mocks.api.mock.calls.every(([,options])=>!options?.method||options.method==='GET')).toBe(true);
});

it('keeps conflicting dirty work and a pending quote journal untouched while displaying only the frozen saved view',async()=>{
 await bindLocalFirstStoreOwner(actor);let dirty=createStudioSaveSession(scope,source,updatedAt);const changed=structuredClone(dirty.edit);(changed.objectOptions[0].values.websiteDesign as any).rawDimensions.widthMm='7100';dirty=prepareStudioSave(changeStudioSaveSession(dirty,changed),'40000000-0000-4000-8000-000000000001','quote_create.v1');
 expect((await stageStudioCommand(scope,dirty.pending!.command,'quote_create.v1')).state).toBe('valid');expect((await persistStudioWorkingCopy(scope,dirty,null)).state).toBe('persisted');const copyKey=studioWorkingCopyKey(scope),journalKey=studioPendingCommandKey(scope,dirty.pending!.command),before=[structuredClone(db.get(copyKey)),structuredClone(db.get(journalKey))];mocks.get.mockClear();mocks.update.mockClear();mocks.keys.mockClear();
 await open();expect(sessionSpy).not.toHaveBeenCalled();expect(mounted!.container.textContent).toContain('6,000');expect(mounted!.container.textContent).not.toContain('7,100');expect(mocks.get.mock.calls.some(([key])=>key===copyKey||key===journalKey)).toBe(false);expect(mocks.keys).not.toHaveBeenCalled();expect([db.get(copyKey),db.get(journalKey)]).toEqual(before);expect(mocks.update).not.toHaveBeenCalled();
});

it('keeps an older confirmed edited clone intact and creates a NEW exact-source revision only after the deliberate action',async()=>{
 await bindLocalFirstStoreOwner(actor);const createScope={actorId:actor,projectId},command={schemaVersion:'studio_create.v1' as const,requestId:'40000000-0000-4000-8000-000000000002',mode:'clone' as const,sourceEstimateId:estimateId,expectedRevision:source.revision,expectedUpdatedAt:updatedAt};
 const receipt={estimateId:'est_30000000-0000-4000-8000-000000000002',designId:'new-revision',revision:1,savedAt:updatedAt,alreadyExisted:false};
 const staged=await stageStudioCreation(createScope,command);expect(staged.state).toBe('valid');if(staged.state!=='valid')throw Error('Expected retained request');mocks.api.mockResolvedValueOnce({receipt,pricing:'unpriced'});expect((await sendStudioCreation(createScope,command)).state).toBe('confirmed');const previousReceipt=structuredClone(db.get(staged.key));mocks.api.mockClear();mocks.get.mockClear();mocks.keys.mockClear();mocks.update.mockClear();
 const freshId='est_30000000-0000-4000-8000-000000000004',oldEdited=structuredClone(source),api=mocks.api.getMockImplementation()!;(oldEdited.objectOptions[0].values.websiteDesign as any).rawDimensions.widthMm='7100';
 mocks.api.mockImplementation(async(url:string,options?:RequestInit)=>{
  if(url.endsWith('/studio-revisions')&&options?.method==='POST')return{receipt:{...receipt,estimateId:freshId,designId:'fresh-source-copy'},pricing:'unpriced'};
  if(url===`/api/projects/${projectId}/estimates/${receipt.estimateId}/studio`)return{authoring:{...authoring(),view:oldEdited,estimate:{...authoring().estimate,id:receipt.estimateId,requiresNewRevision:false},nextAction:'edit'}};
  if(url===`/api/projects/${projectId}/estimates/${freshId}/studio`)return{authoring:{...authoring(),view:source,estimate:{...authoring().estimate,id:freshId,requiresNewRevision:false},nextAction:'edit'}};
  return api(url,options);
 });
 await open();expect(mocks.keys).not.toHaveBeenCalled();expect(mocks.navigate).not.toHaveBeenCalled();expect(mounted!.container.textContent).toContain('Edit a new revision');
 await click('Edit a new revision');await vi.waitFor(()=>expect(mocks.navigate).toHaveBeenCalledWith(`/staff/design-studio/${projectId}/${freshId}/edit`,false),{interval:0});
 const posts=mocks.api.mock.calls.filter(([,options])=>options?.method==='POST');expect(posts).toHaveLength(1);expect(JSON.parse(posts[0][1].body)).toMatchObject({mode:'clone',sourceEstimateId:estimateId,expectedRevision:source.revision,expectedUpdatedAt:updatedAt});expect(JSON.parse(posts[0][1].body).requestId).not.toBe(command.requestId);
 expect(mocks.api.mock.calls.some(([url])=>url===`/api/projects/${projectId}/estimates/${receipt.estimateId}/studio`)).toBe(false);expect(db.get(staged.key)).toEqual(previousReceipt);
});

it('sends one exact-source clone after the single revision action and opens the new editable canvas destination',async()=>{
 const nextId='est_30000000-0000-4000-8000-000000000003',original=structuredClone(source),api=mocks.api.getMockImplementation()!;
 mocks.api.mockImplementation(async(url:string,options?:RequestInit)=>{
  if(url===`/api/projects/${projectId}/studio-revisions`&&options?.method==='POST')return{pricing:'unpriced',receipt:{estimateId:nextId,designId:'new-editable',revision:1,savedAt:updatedAt,alreadyExisted:false}};
  if(url===`/api/projects/${projectId}/estimates/${nextId}/studio`)return{authoring:{...authoring(),estimate:{...authoring().estimate,id:nextId,requiresNewRevision:false},nextAction:'edit'}};
  return api(url,options);
 });
 await open(true);await click('Edit a new revision');await vi.waitFor(()=>expect(mocks.navigate,mounted!.container.textContent).toHaveBeenCalledWith(`/staff/design-studio/${projectId}/${nextId}/edit`,false),{interval:0});
 const posts=mocks.api.mock.calls.filter(([,options])=>options?.method==='POST');expect(posts).toHaveLength(1);expect(JSON.parse(posts[0][1].body)).toMatchObject({mode:'clone',sourceEstimateId:estimateId,expectedRevision:source.revision,expectedUpdatedAt:updatedAt});expect(source).toEqual(original);expect(mocks.api.mock.calls.some(([url,options])=>url.includes(estimateId)&&['PUT','PATCH'].includes(options?.method))).toBe(false);
});

it('recovers an older UNKNOWN request only through explicit Retry with its exact nonce/body, before any new creation',async()=>{
 await bindLocalFirstStoreOwner(actor);const createScope={actorId:actor,projectId},command={schemaVersion:'studio_create.v1' as const,requestId:'40000000-0000-4000-8000-000000000005',mode:'clone' as const,sourceEstimateId:estimateId,expectedRevision:source.revision,expectedUpdatedAt:updatedAt};
 const staged=await stageStudioCreation(createScope,command);expect(staged.state).toBe('valid');if(staged.state!=='valid')throw Error('Expected unknown request');const before=structuredClone(db.get(staged.key)),nextId='est_30000000-0000-4000-8000-000000000005',api=mocks.api.getMockImplementation()!;
 mocks.api.mockImplementation(async(url:string,options?:RequestInit)=>{
  if(url.endsWith('/studio-revisions')&&options?.method==='POST')return{pricing:'unpriced',receipt:{estimateId:nextId,designId:'recovered',revision:1,savedAt:updatedAt,alreadyExisted:true}};
  if(url===`/api/projects/${projectId}/estimates/${nextId}/studio`)return{authoring:{...authoring(),estimate:{...authoring().estimate,id:nextId,requiresNewRevision:false},nextAction:'edit'}};
  return api(url,options);
 });
 await open();await click('Edit a new revision');await vi.waitFor(()=>expect(mounted!.container.textContent).toContain('Retry creation'),{interval:0});expect(mocks.api.mock.calls.some(([,options])=>options?.method==='POST')).toBe(false);expect(db.get(staged.key)).toEqual(before);expect(mounted!.container.querySelector('[data-studio-read-only]')).not.toBeNull();
 await click('Retry creation');await vi.waitFor(()=>expect(mocks.navigate).toHaveBeenCalledWith(`/staff/design-studio/${projectId}/${nextId}/edit`,false),{interval:0});const posts=mocks.api.mock.calls.filter(([,options])=>options?.method==='POST');expect(posts).toHaveLength(1);expect(posts[0][1].body).toBe(staged.body);
});

it('keeps rejected creation evidence without starting a new request on a later deliberate revision action',async()=>{
 await bindLocalFirstStoreOwner(actor);const createScope={actorId:actor,projectId},command={schemaVersion:'studio_create.v1' as const,requestId:'40000000-0000-4000-8000-000000000006',mode:'clone' as const,sourceEstimateId:estimateId,expectedRevision:source.revision,expectedUpdatedAt:updatedAt};
 const staged=await stageStudioCreation(createScope,command);expect(staged.state).toBe('valid');if(staged.state!=='valid')throw Error('Expected rejected request');mocks.api.mockRejectedValueOnce(new ApiError('Synthetic stale source',{status:409,body:{}}));expect((await sendStudioCreation(createScope,command)).state).toBe('rejected');const before=structuredClone(db.get(staged.key));mocks.api.mockClear();
 await open();await click('Edit a new revision');await vi.waitFor(()=>expect(mounted!.container.textContent).toContain('previous creation request was rejected'),{interval:0});expect(mocks.api.mock.calls.some(([,options])=>options?.method==='POST')).toBe(false);expect(db.get(staged.key)).toEqual(before);expect(mocks.navigate).not.toHaveBeenCalled();
});

it('treats two separate deliberate New revision journeys as two distinct exact-source clones',async()=>{
 const ids=['est_30000000-0000-4000-8000-000000000007','est_30000000-0000-4000-8000-000000000008'],api=mocks.api.getMockImplementation()!;let creations=0;
 mocks.api.mockImplementation(async(url:string,options?:RequestInit)=>{
  if(url.endsWith('/studio-revisions')&&options?.method==='POST'){const target=ids[creations++];return{pricing:'unpriced',receipt:{estimateId:target,designId:target,revision:1,savedAt:updatedAt,alreadyExisted:false}};}
  const target=ids.find(id=>url===`/api/projects/${projectId}/estimates/${id}/studio`);if(target)return{authoring:{...authoring(),estimate:{...authoring().estimate,id:target,requiresNewRevision:false},nextAction:'edit'}};
  return api(url,options);
 });
 for(const id of ids){await open(true);await click('Edit a new revision');await vi.waitFor(()=>expect(mocks.navigate).toHaveBeenCalledWith(`/staff/design-studio/${projectId}/${id}/edit`,false),{interval:0});mounted!.unmount();mounted=undefined;await flush();history.replaceState({},'',callback);}
 const commands=mocks.api.mock.calls.filter(([,options])=>options?.method==='POST').map(([,options])=>JSON.parse(options.body));expect(commands).toHaveLength(2);expect(new Set(commands.map(c=>c.requestId)).size).toBe(2);expect(commands.every(c=>c.sourceEstimateId===estimateId&&c.expectedRevision===source.revision&&c.expectedUpdatedAt===updatedAt)).toBe(true);
 expect(mocks.api.mock.calls.filter(([url])=>url===`/api/projects/${projectId}/estimates/${ids[0]}/studio`)).toHaveLength(1);
});
