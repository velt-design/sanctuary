import { ApiError } from '../../lib/repo/apiClient';
import { act } from 'react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../test/reactHarness';
import { useStudioEditingSession, type StudioEditingSessionProps } from './useStudioEditingSession';
import { changeStudioSaveSession, createStudioSaveSession, prepareStudioSave, settleStudioSave } from '../../lib/designStudio/saveSession';
import { persistStudioWorkingCopy, readStudioWorkingCopy, studioWorkingCopyKey } from '../../lib/designStudio/workingCopy';
import { listStudioPendingCommands, sendStudioCommand, stageStudioCommand } from '../../lib/designStudio/saveTransport';
import { invalidateStudioLifecycle, prepareStudioSignOut,prepareStudioNavigation } from '../../lib/designStudio/studioLifecycle';
import { buildNewStudioPergolaDraft } from '../../lib/designStudio/newPergola';
import { addWebsitePergola } from '../../lib/designStudio/websiteComposition';
import { createStudioAuthoringEdit,mergeStudioAuthoringEdit, projectStudioAuthoringView } from '../../lib/designStudio/authoringView';
import {ACCESSORY_REVIEW_RATES,getDefaultInstalledSellingRates,loadCostingConfigV1} from '@sp/costing';
import {calculateStudioCommercialPricing} from '@/lib/designStudio/studioCommercialPricing.server';
import {studioInstallationEstimate} from '@/lib/designStudio/studioInstallationEstimate';
import {studioTravelPlanForReceipt} from '@/lib/designStudio/studioTravelPlan';
import {studioTravelTotalCents,type StudioTravelReceipt} from '@/lib/designStudio/studioTravelAllowance';
import type {StudioWebsiteDesign} from '@/lib/designStudio/websiteDesign';
const mocks = vi.hoisted(() => ({ get: vi.fn(), keys: vi.fn(), update: vi.fn(), owner: vi.fn(), api: vi.fn() }));
vi.mock('idb-keyval', () => ({ get: mocks.get, keys: mocks.keys, update: mocks.update }));
vi.mock('@/lib/localFirst/store', () => ({ getLocalFirstStoreOwner: mocks.owner,flushLocalFirstStore:async()=>{} }));
vi.mock('@/lib/repo/apiClient', async load => ({ ...await load<typeof import('@/lib/repo/apiClient')>(), apiJson: mocks.api }));
const scope = { actorId: '10000000-0000-4000-8000-000000000001', projectId: 'proj_20000000-0000-4000-8000-000000000001', estimateId: 'est_30000000-0000-4000-8000-000000000001', designId: 'design' };
const requestId = '40000000-0000-4000-8000-000000000001';
const props: StudioEditingSessionProps = { scope, editable: true, updatedAt: '2026-09-24T00:00:00Z', view: { schemaVersion: 'studio_authoring_view.v1', designId: 'design', revision: 3, spatial: { houseAssembly: null, decks: [], openings: [], pergolas: [] }, site: { access: 'normal' }, objectOptions: [], pricing: 'unpriced' } };
const receipt = { revision: 4, savedAt: '2026-09-24T01:00:00Z', alreadyExisted: false };
const fresh = () => createStudioSaveSession(scope, props.view, props.updatedAt);
const pending = () => { const initial = fresh(); initial.edit.site.access = 'hard'; return prepareStudioSave(changeStudioSaveSession(fresh(), initial.edit), requestId); };
const db = new Map<string, unknown>();
let transactions: Promise<unknown>;
let latest: ReturnType<typeof useStudioEditingSession>;
const mounted: ReturnType<typeof renderIntoDocument>[] = [];
function Harness(input: StudioEditingSessionProps) { latest = useStudioEditingSession(input); return <div>{latest.status}</div>; }
function mount(input = props) { const result = renderIntoDocument(<Harness {...input} />); mounted.push(result); return result; }
const flush = async () => { await act(async () => {}); };
beforeEach(() => {
  invalidateStudioLifecycle();
  Object.defineProperty(navigator, 'locks', { configurable: true, value: {
    request: vi.fn(async (name, _options, callback) => callback({ name })),
  } });
  vi.resetAllMocks(); db.clear(); transactions = Promise.resolve(); mocks.owner.mockReturnValue(scope.actorId);
  mocks.get.mockImplementation(async key => structuredClone(db.get(key)));
  mocks.keys.mockImplementation(async () => [...db.keys()]);
  mocks.update.mockImplementation((key: string, fn: (old: unknown) => unknown) => {
    const operation = transactions.then(() => { db.set(key, structuredClone(fn(structuredClone(db.get(key))))); });
    transactions = operation.catch(() => undefined); return operation;
  });
  mocks.api.mockResolvedValue({ receipt, pricing: 'unpriced' });
});
afterEach(() => { for (const item of mounted.splice(0)) item.unmount(); });
async function edit(access: string) { await act(async () => { const next = structuredClone(latest.edit!); next.site.access = access; latest.change(next); }); }

it('retains one composite Create command through uncertainty, then reconciles the exact Save receipt and locked source timestamp',async()=>{
 mount();await flush();await edit('hard');let first!:import('@/lib/designStudio/saveTransport').StudioPendingCommand;
 await act(async()=>{first=await latest.beginQuote(requestId);});
 expect(first.edit.site.access).toBe('hard');expect(latest.canSubmitQuote(first)).toBe(true);expect(latest.change(structuredClone(latest.edit!)).kind).toBe('refused');
 expect((await listStudioPendingCommands(scope)).state).toBe('available');expect(mocks.api).not.toHaveBeenCalled();
 await act(async()=>{latest.failQuote();});await flush();let retry!:typeof first;
 await act(async()=>{retry=await latest.beginQuote('40000000-0000-4000-8000-000000000002');});expect(retry).toEqual(first);
 const savedView={...props.view,revision:receipt.revision,site:{access:'hard',travelExGst:'162.45'}};
 await act(async()=>latest.finishQuote(first,{saveReceipt:receipt,savedView,sourceUpdatedAt:'2026-09-24T01:00:01Z'}));
 expect(latest.message).toBeNull();expect(latest.status).toBe('locked');expect(latest.session?.dirty).toBe(false);expect(latest.session?.baseUpdatedAt).toBe('2026-09-24T01:00:01Z');expect(latest.session?.baseUpdatedAt).not.toBe(receipt.savedAt);
 expect(await readStudioWorkingCopy(scope)).toMatchObject({state:'valid',session:{baseRevision:4,dirty:false,edit:{site:savedView.site}}});
 expect(await listStudioPendingCommands(scope)).toMatchObject({state:'available',entries:[]});expect(mocks.api).not.toHaveBeenCalled();
 expect([...db.values()].some(value=>typeof value==='object'&&value!==null&&(value as any).operation==='quote_create.v1'&&(value as any).acknowledged===true&&(value as any).body===JSON.stringify(first)&&(value as any).receipt.savedAt===receipt.savedAt)).toBe(true);
});
it('keeps a composite command after actor withdrawal and refuses to certify a wrong saved source',async()=>{
 mount();await flush();await edit('hard');let command!:import('@/lib/designStudio/saveTransport').StudioPendingCommand;
 await act(async()=>{command=await latest.beginQuote(requestId);});
 await act(async()=>{await expect(latest.finishQuote(command,{saveReceipt:receipt,savedView:{...props.view,designId:'wrong',revision:4},sourceUpdatedAt:receipt.savedAt})).rejects.toThrow('could not be reconciled');});
 mocks.owner.mockReturnValue('other-actor');expect(latest.canSubmitQuote(command)).toBe(false);
 expect([...db.values()].some(value=>typeof value==='object'&&value!==null&&(value as any).body===JSON.stringify(command))).toBe(true);
});
it('does not convert an ordinary unconfirmed Save into a composite quote operation',async()=>{
 mount();await flush();await edit('hard');mocks.api.mockRejectedValueOnce(Error('Save response lost'));await act(async()=>latest.save());
 await act(async()=>{await expect(latest.beginQuote(requestId)).rejects.toThrow('previous Save');});
 const retained=await listStudioPendingCommands(scope);expect(retained).toMatchObject({state:'available',entries:[{recovery:{state:'valid'}}]});
 if(retained.state==='available'&&retained.entries[0].recovery.state==='valid')expect(retained.entries[0].recovery.operation).toBeUndefined();expect(mocks.api.mock.calls.every(([url])=>url.endsWith('/studio'))).toBe(true);
});

it('persists derived trips without trapping geometry Undo, retains coherent Redo and manual overrides through the real controller',async()=>{
 const config={...loadCostingConfigV1(),accessoryRates:ACCESSORY_REVIEW_RATES,installedSellingRates:getDefaultInstalledSellingRates()};
 const initial=addWebsitePergola(createStudioAuthoringEdit(props.view),'p');
 const dimensions=(value:typeof initial,width:string,projection:string)=>{(value.objectOptions[0].values.websiteDesign as unknown as StudioWebsiteDesign).rawDimensions={widthMm:width,projectionMm:projection};};
 const days=(value:typeof initial)=>studioInstallationEstimate(calculateStudioCommercialPricing(value,config).siteOutput)!.siteDays;
 dimensions(initial,'3000','2000');const beforeDays=days(initial);
 const unit:StudioTravelReceipt={schemaVersion:'studio_travel_receipt.v1',policyVersion:'studio-travel-local.v1',base:'71G Montgomerie Rd, Mangere, Auckland',projectId:scope.projectId,destinationCanonical:'12 Example Road, Auckland',placeId:'fixture',drivingCostPerRoundTripCents:5415,overnightEligible:false,proof:'a'.repeat(64)};
 const initialPlan=studioTravelPlanForReceipt(undefined,unit,beforeDays);initial.site={...initial.site,travelAllowance:initialPlan,travelExGst:(studioTravelTotalCents(initialPlan)/100).toFixed(2)};
 mount({...props,view:{...props.view,spatial:initial.spatial,objectOptions:initial.objectOptions,site:initial.site}});await flush();
 await act(async()=>{const next=structuredClone(latest.edit!);dimensions(next,'6000','4000');expect(latest.change(next).kind).toBe('accepted');});
 const afterDays=days(latest.edit!);expect(afterDays).toBeGreaterThan(beforeDays);const generation=latest.session!.generation;
 await act(async()=>{const next=structuredClone(latest.edit!),plan=studioTravelPlanForReceipt(next.site.travelAllowance,unit,afterDays);next.site={...next.site,travelAllowance:plan,travelExGst:(studioTravelTotalCents(plan)/100).toFixed(2)};expect(latest.changeDerived(next).kind).toBe('accepted');});
 expect(latest.session!.generation).toBe(generation+1);expect(latest.session!.history!.past).toHaveLength(1);
 expect((await readStudioWorkingCopy(scope))).toMatchObject({state:'valid',session:latest.session});
 await act(async()=>{expect(latest.undo().kind).toBe('accepted');});
 expect((latest.edit!.objectOptions[0].values.websiteDesign as unknown as StudioWebsiteDesign).rawDimensions).toEqual({widthMm:'3000',projectionMm:'2000'});
 expect(latest.edit!.site.travelAllowance).toMatchObject({tripCountSource:'site_days',plannedRoundTrips:String(beforeDays)});expect(latest.canUndo).toBe(false);
 await act(async()=>{expect(latest.redo().kind).toBe('accepted');});
 expect((latest.edit!.objectOptions[0].values.websiteDesign as unknown as StudioWebsiteDesign).rawDimensions).toEqual({widthMm:'6000',projectionMm:'4000'});
 expect(latest.edit!.site.travelAllowance).toMatchObject({tripCountSource:'site_days',plannedRoundTrips:String(afterDays)});
 await act(async()=>{const next=structuredClone(latest.edit!);next.site.travelAllowance={...initialPlan,tripCountSource:'manual',plannedRoundTrips:'2'};next.site.travelExGst='108.30';latest.change(next);});
 await act(async()=>{const next=structuredClone(latest.edit!);dimensions(next,'3000','2000');latest.change(next);});
 expect(latest.edit!.site.travelAllowance).toMatchObject({tripCountSource:'manual',plannedRoundTrips:'2'});
 await act(async()=>{latest.undo();});expect(latest.edit!.site.travelAllowance).toMatchObject({tripCountSource:'manual',plannedRoundTrips:'2'});
 const unchanged=structuredClone(latest.edit);invalidateStudioLifecycle();expect(latest.changeDerived(unchanged!).kind).toBe('refused');expect(latest.edit).toEqual(unchanged);
 expect(mocks.api).not.toHaveBeenCalled();
});

describe('studio sign-out lifecycle integration', () => {
  it('recovers a known accepted local unavailable write through the same-owner flush, preserving exact history without a server Save',async()=>{
    mount();await flush();mocks.update.mockRejectedValueOnce(Error('quota'));await edit('hard');
    expect(latest.status).toBe('unavailable');const expected=structuredClone(latest.session);
    let prepared!:ReturnType<typeof prepareStudioNavigation>;await act(async()=>{prepared=prepareStudioNavigation(scope.actorId);await prepared.ready;});act(()=>prepared.release());await flush();
    expect(await readStudioWorkingCopy(scope)).toMatchObject({state:'valid',session:expected});expect(latest.localDurable).toBe(true);expect(latest.canEdit).toBe(true);expect(mocks.api).not.toHaveBeenCalled();
  });
  it('keeps a still-unavailable accepted write and releases the navigation fence for a later local-only retry',async()=>{
    mount();await flush();mocks.update.mockRejectedValueOnce(Error('quota'));await edit('hard');
    const expected=structuredClone(latest.session),stored=db.get(studioWorkingCopyKey(scope));
    mocks.update.mockRejectedValueOnce(Error('quota'));
    let failed!:ReturnType<typeof prepareStudioNavigation>;
    await act(async()=>{failed=prepareStudioNavigation(scope.actorId);await expect(failed.ready).rejects.toThrow('could not be stored');failed.release();});
    expect(latest.status).toBe('unavailable');expect(latest.session).toEqual(expected);expect(db.get(studioWorkingCopyKey(scope))).toBe(stored);
    await act(async()=>{const next=prepareStudioNavigation(scope.actorId);await next.ready;next.release();});
    expect(latest.canEdit).toBe(true);expect(latest.session).toEqual(expected);expect(mocks.api).not.toHaveBeenCalled();
  });
  it('stops local retry at a different CAS token and never overwrites the other retained copy',async()=>{
    mount();await flush();mocks.update.mockRejectedValueOnce(Error('quota'));await edit('hard');
    const expected=structuredClone(latest.session),key=studioWorkingCopyKey(scope),other=JSON.parse(db.get(key) as string);other.session.edit.site.access='other-tab';const raw=JSON.stringify(other);db.set(key,raw);
    await act(async()=>{const next=prepareStudioNavigation(scope.actorId);await expect(next.ready).rejects.toThrow('could not be stored');next.release();});
    expect(latest.status).toBe('recovery');expect(latest.session).toEqual(expected);expect(db.get(key)).toBe(raw);const count=mocks.update.mock.calls.length;
    await act(async()=>{const next=prepareStudioNavigation(scope.actorId);await expect(next.ready).rejects.toThrow();next.release();});
    expect(mocks.update).toHaveBeenCalledTimes(count);expect(mocks.api).not.toHaveBeenCalled();
  });
  it.each(['actor','lifecycle'] as const)('does not restart an accepted unavailable write after its %s owner retires',async cause=>{
    mount();await flush();mocks.update.mockRejectedValueOnce(Error('quota'));await edit('hard');const count=mocks.update.mock.calls.length;
    let next!:ReturnType<typeof prepareStudioNavigation>;
    act(()=>{next=prepareStudioNavigation(scope.actorId);if(cause==='actor')mocks.owner.mockReturnValue('another-actor');else invalidateStudioLifecycle();});
    await act(async()=>{try{await expect(next.ready).rejects.toThrow();}finally{next.release();}});
    expect(mocks.update).toHaveBeenCalledTimes(count);expect(mocks.api).not.toHaveBeenCalled();
  });
  it('drains the latest accepted coalesced snapshot after UI unmount, joining concurrent flushes into one CAS',async()=>{
    const rendered=mount();await flush();const hold=(()=>{let resolve!:()=>void;return{promise:new Promise<void>(done=>{resolve=done;}),release:()=>resolve()};})();
    mocks.update.mockRejectedValueOnce(Error('quota'));
    act(()=>{const edit=structuredClone(latest.edit!);edit.site.access='hard';latest.change(edit);edit.site.access='easy';latest.change(edit);});await flush();
    const expected=structuredClone(latest.session);transactions=hold.promise;const count=mocks.update.mock.calls.length;
    let prepared!:ReturnType<typeof prepareStudioNavigation>;act(()=>{prepared=prepareStudioNavigation(scope.actorId);});
    rendered.unmount();expect(mocks.update.mock.calls.length).toBeLessThanOrEqual(count+1);
    await act(async()=>{hold.release();await prepared.ready;prepared.release();});
    expect(mocks.update).toHaveBeenCalledTimes(count+1);expect(await readStudioWorkingCopy(scope)).toMatchObject({state:'valid',session:expected});expect(mocks.api).not.toHaveBeenCalled();
  });
  it('never writes over an unknown failed storage restore',async()=>{
    mocks.get.mockRejectedValueOnce(Error('device read failed'));mount();await flush();expect(latest.status).toBe('unavailable');
    await act(async()=>{const next=prepareStudioNavigation(scope.actorId);await expect(next.ready).rejects.toThrow();next.release();});
    expect(mocks.update).not.toHaveBeenCalled();expect(mocks.api).not.toHaveBeenCalled();expect(latest.session).toBeNull();
  });
  it('locally drains an interrupted confirmation without replaying or retiring its journal, and retains Save recovery',async()=>{
    mount();await flush();await edit('hard');
    mocks.api.mockImplementationOnce(async()=>{const update=mocks.update.getMockImplementation()!;let working=true;mocks.update.mockImplementation((key,fn)=>{if(working&&key===studioWorkingCopyKey(scope)){working=false;return Promise.reject(Error('working storage'));}return update(key,fn);});return{receipt,pricing:'unpriced'};});
    await act(async()=>{await latest.save();});expect(latest.status).toBe('unavailable');
    const expected=structuredClone(latest.session),journal=await listStudioPendingCommands(scope);
    expect(journal).toMatchObject({entries:[{recovery:{receipt}}]});
    await act(async()=>{const next=prepareStudioNavigation(scope.actorId);await next.ready;next.release();});
    expect(latest).toMatchObject({status:'recovery',canEdit:false,localDurable:true});expect(latest.session).toEqual(expected);
    expect(await listStudioPendingCommands(scope)).toEqual(journal);expect(await readStudioWorkingCopy(scope)).toMatchObject({state:'recovery',session:expected});expect(mocks.api).toHaveBeenCalledOnce();
  });
  it('flushes the latest queued edit through unmount and refuses saved callbacks while frozen', async () => {
    const rendered = mount(); await flush(); await edit('hard');
    let release!: () => void;
    transactions = new Promise<void>(resolve => { release = resolve; });
    act(() => { const next = structuredClone(latest.edit!); next.site.access = 'easy'; latest.change(next); });
    const save = latest.save; const retry = latest.retry;
    let preparation!: ReturnType<typeof prepareStudioSignOut>;
    await act(async () => { preparation = prepareStudioSignOut(scope.actorId, () => true); });
    expect(latest.canEdit).toBe(false);
    await act(async () => { await save(); await retry(); });
    expect(mocks.api).not.toHaveBeenCalled(); expect(latest.session?.pending).toBeNull();
    rendered.unmount();
    let result!: Awaited<typeof preparation>;
    await act(async () => { release(); result = await preparation; });
    expect(result.state).toBe('ready');
    expect(await readStudioWorkingCopy(scope)).toMatchObject({ state: 'valid', session: { edit: { site: { access: 'easy' } }, dirty: true, pending: null } });
    if (result.state === 'ready') result.release();
  });
  it('blocks sign-out when the latest accepted edit fails durable storage', async () => {
    mount(); await flush(); mocks.update.mockRejectedValueOnce(Error('quota')); await edit('hard');
    mocks.update.mockRejectedValueOnce(Error('quota'));
    let result!: Awaited<ReturnType<typeof prepareStudioSignOut>>;
    await act(async () => { result = await prepareStudioSignOut(scope.actorId, () => true); });
    expect(result.state).toBe('blocked'); expect(latest.localDurable).toBe(false); expect(mocks.owner()).toBe(scope.actorId);
  });
  it('resumes initial restore after sign-out is cancelled during its read', async () => {
    let resolve!: (value: unknown) => void;
    mocks.get.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    mount(); await flush(); expect(latest.status).toBe('loading');
    let result!: Awaited<ReturnType<typeof prepareStudioSignOut>>;
    await act(async () => { result = await prepareStudioSignOut(scope.actorId, () => true); });
    await act(async () => resolve(undefined)); expect(latest.canEdit).toBe(false);
    await act(async () => { if (result.state === 'ready') result.release(); });
    await flush(); expect(latest).toMatchObject({ status: 'ready', canEdit: true, localDurable: true });
  });
  it('retains an in-flight exact request and ignores late success after A -> null -> A', async () => {
    let resolve!: (value: unknown) => void;
    mocks.api.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    mount(); await flush(); await edit('hard');
    let saving!: Promise<void>; await act(async () => { saving = latest.save(); });
    const body = mocks.api.mock.calls[0][1].body;
    let result!: Awaited<ReturnType<typeof prepareStudioSignOut>>;
    await act(async () => { result = await prepareStudioSignOut(scope.actorId, () => true); });
    expect(result.state).toBe('ready');
    await act(async () => {
      invalidateStudioLifecycle(); mocks.owner.mockReturnValue(null); mocks.owner.mockReturnValue(scope.actorId);
      resolve({ receipt, pricing: 'unpriced' }); await saving;
      if (result.state === 'ready') result.release();
    });
    expect(await listStudioPendingCommands(scope)).toMatchObject({ entries: [{ recovery: { state: 'valid', body, receipt } }] });
    expect(await readStudioWorkingCopy(scope)).toMatchObject({ state: 'recovery', session: { pending: { command: JSON.parse(body) } } });
    expect(latest.session?.baseRevision).toBe(3);
  });
});

describe('connected studio editing session', () => {
  it.each(['ceilingOption','flashings.rows','infills.items'])('reopens clean after saving then undoing %s from an absent public options row through real merge',async field=>{
    let serverView: StudioEditingSessionProps['view']={...addWebsitePergola(fresh().edit,'p'),schemaVersion:'studio_authoring_view.v1',pricing:'unpriced',objectOptions:[]};
    const input={...props,view:serverView};let savedAt=props.updatedAt;
    mocks.api.mockImplementation(async(_url,options)=>{
      const command=JSON.parse(options.body),revision=serverView.revision+1;
      const merged=mergeStudioAuthoringEdit({storedAuthored:{schemaVersion:'studio_authored.v1',designId:scope.designId,revision:serverView.revision,spatialOutputKey:'drawing_object_first',
        site:{validation:'preserved_unvalidated',values:serverView.site},objectOptions:serverView.objectOptions.map(row=>({objectId:row.objectId,options:{validation:'preserved_unvalidated',values:row.values}})),
        legacyCommercialAssociations:[],provenance:{sourceEstimateId:null,sourceKind:'authored',sourcePayload:null}},storedSpatial:serverView.spatial,edit:command.edit});
      expect(merged.ok).toBe(true);if(!merged.ok)throw Error(merged.message);
      const projected=projectStudioAuthoringView({authored:{...merged.value.authored,revision},spatial:merged.value.spatial});
      expect(projected.ok).toBe(true);if(!projected.ok)throw Error(projected.message);
      serverView=projected.value;savedAt=`2026-09-24T0${revision}:00:00Z`;
      return {receipt:{...receipt,revision,savedAt},pricing:'unpriced'};
    });
    const first=mount(input);await flush();const before=structuredClone(latest.edit!);
    const [section,collection]=field.split('.');
    await act(async()=>{const next=structuredClone(latest.edit!);next.objectOptions=[{objectId:'p',values:collection?{[section]:{[collection]:[{id:'added'}]}}:{ceilingOption:'cedar-100'}}];latest.change(next);});
    await act(async()=>{await latest.save();});
    act(()=>{expect(latest.restoreEdit(before).kind).toBe('accepted');});
    await act(async()=>{await latest.save();});
    expect(latest).toMatchObject({status:'ready',canSave:false,session:{dirty:false,pending:null}});
    first.unmount();mount({...input,view:serverView,updatedAt:savedAt});await flush();
    expect(latest).toMatchObject({status:'ready',canEdit:true,canSave:false,session:{dirty:false,pending:null}});
    expect(latest.session!.acknowledged!.edit.objectOptions).toEqual(serverView.objectOptions);
    expect(mocks.api).toHaveBeenCalledTimes(2);
  });
  it('rehydrates a matching large pending fallback only from the saved view and retries its exact staged command',async()=>{
    const input={...props,view:{...props.view,site:{access:'normal',travelExGst:'0'.repeat(1_800_000)}}};
    const base=createStudioSaveSession(scope,input.view,input.updatedAt),edit=structuredClone(base.edit);edit.site.access='hard';
    const pending=prepareStudioSave(changeStudioSaveSession(base,edit),requestId);
    const stored=await persistStudioWorkingCopy(scope,pending,null);expect(stored.state).toBe('persisted');
    if(stored.state!=='persisted')throw Error('Supported pending copy setup');
    expect(JSON.parse(stored.token).session).not.toHaveProperty('acknowledged');
    await stageStudioCommand(scope,pending.pending!.command);
    mount(input);await flush();
    expect(latest).toMatchObject({canRetry:true,session:{dirty:true}});
    expect(latest.session!.acknowledged!.edit).toEqual(base.edit);
    expect(latest.session!.pending!.command).toEqual(pending.pending!.command);
    expect(JSON.parse(db.get(studioWorkingCopyKey(scope)) as string).session).not.toHaveProperty('acknowledged');
    await act(async()=>{await latest.retry();});
    expect(mocks.api.mock.calls[0][1].body).toBe(JSON.stringify(pending.pending!.command));
    expect(latest).toMatchObject({canSave:false,session:{dirty:false,pending:null}});
    expect(latest.session!.acknowledged!.edit.site.access).toBe('hard');
    expect(latest.edit!.site.travelExGst).toBe(input.view.site.travelExGst);
  });
  it.each(['different-current','return-to-sent'] as const)('saves supported large raw work through fallback and reload with %s acknowledgement',async mode=>{
    let resolve!:(value:unknown)=>void;mocks.api.mockImplementationOnce(()=>new Promise(done=>{resolve=done;}));
    const input={...props,view:{...props.view,site:{access:'normal',travelExGst:'0'.repeat(1_800_000)}}};
    const first=mount(input);await flush();await edit('hard');
    const baseline=structuredClone(latest.session!.acknowledged);
    let saving!:Promise<void>;await act(async()=>{saving=latest.save();});
    const command=JSON.parse(mocks.api.mock.calls[0][1].body),stored=JSON.parse(db.get(studioWorkingCopyKey(scope)) as string);
    expect(stored.session).not.toHaveProperty('acknowledged');
    expect(stored.session.pending.command).toEqual(command);
    expect(latest.session!.acknowledged).toEqual(baseline);
    expect(latest.session!.dirty).toBe(true);
    await edit('easy');if(mode==='return-to-sent')await edit('hard');
    const generation=latest.session!.generation;
    await act(async()=>{resolve({receipt,pricing:'unpriced'});await saving;});
    expect(latest.session!.generation).toBe(generation);
    expect(latest.session!.acknowledged!.edit.site).toEqual(command.edit.site);
    expect(latest.edit!.site.travelExGst).toBe(input.view.site.travelExGst);
    expect(latest.canSave).toBe(mode==='different-current');
    expect(await listStudioPendingCommands(scope)).toMatchObject({entries:[]});
    const current=structuredClone(latest.edit!);
    first.unmount();mount({...input,view:{...input.view,site:command.edit.site,revision:4},updatedAt:receipt.savedAt});await flush();
    expect(latest.edit).toEqual(current);expect(latest.canSave).toBe(mode==='different-current');
    expect(latest.session!.acknowledged!.edit.site).toEqual(command.edit.site);
    expect(mocks.api).toHaveBeenCalledTimes(1);
  });
  it('opens a matching oversized legacy copy with a live baseline and lets its raw work be reduced',async()=>{
    const input={...props,view:{...props.view,site:{access:'normal',travelExGst:'0'.repeat(3_100_000)}}};
    const state=createStudioSaveSession(scope,input.view,input.updatedAt);
    const stored=await persistStudioWorkingCopy(scope,state,null);expect(stored.state).toBe('persisted');
    if(stored.state!=='persisted')throw Error('Large local copy setup');
    expect(JSON.parse(stored.token).session).not.toHaveProperty('acknowledged');
    mount(input);await flush();expect(latest).toMatchObject({canEdit:true,canSave:false});
    expect(latest.session!.acknowledged!.edit).toEqual(state.edit);
    expect(JSON.parse(db.get(studioWorkingCopyKey(scope)) as string).session).not.toHaveProperty('acknowledged');
    await act(async()=>{const edit=structuredClone(latest.edit!);edit.site.travelExGst='0';latest.change(edit);});
    expect(latest).toMatchObject({canEdit:true,canSave:true});
    expect(latest.session!.acknowledged!.edit.site.travelExGst).toBe(input.view.site.travelExGst);
    expect(latest.edit!.site.travelExGst).toBe('0');expect(mocks.api).not.toHaveBeenCalled();
  });
  it('retains a mismatched large fallback copy without manufacturing a saved baseline',async()=>{
    const input={...props,view:{...props.view,site:{access:'normal',travelExGst:'0'.repeat(3_100_000)}}};
    const state=createStudioSaveSession(scope,input.view,input.updatedAt),edit=structuredClone(state.edit);edit.site.access='hard';
    const stored=await persistStudioWorkingCopy(scope,changeStudioSaveSession(state,edit),null);expect(stored.state).toBe('persisted');
    if(stored.state!=='persisted')throw Error('Large local copy setup');
    mount({...input,updatedAt:receipt.savedAt});await flush();
    expect(latest).toMatchObject({canEdit:false,canSave:false,status:'recovery'});
    expect(latest.session!.acknowledged).toBeUndefined();
    expect(db.get(studioWorkingCopyKey(scope))).toBe(stored.token);expect(mocks.api).not.toHaveBeenCalled();
  });
  it('cleans a newer generation returned to the exact sent edit only after its matching acknowledgement', async () => {
    let resolve!: (value: unknown) => void;
    mocks.api.mockImplementationOnce(() => new Promise(done => {resolve=done;}));
    mount(); await flush(); await edit('hard');
    let saving!: Promise<void>; await act(async () => {saving=latest.save();});
    const sent = JSON.parse(mocks.api.mock.calls[0][1].body);
    await edit('easy'); await edit('hard');
    expect(latest.session?.dirty).toBe(true);
    const generation=latest.session!.generation;
    await act(async () => {resolve({receipt,pricing:'unpriced'});await saving;});
    expect(latest).toMatchObject({canEdit:true,canSave:false,session:{generation,dirty:false,pending:null,baseRevision:4}});
    expect(latest.session!.acknowledged!.edit).toEqual({...sent.edit,revision:4});
    expect((JSON.parse(mocks.api.mock.calls[0][1].body))).toEqual(sent);
    expect(sent.edit).not.toHaveProperty('acknowledged');
    expect(await readStudioWorkingCopy(scope)).toMatchObject({state:'valid',session:{dirty:false,acknowledged:latest.session!.acknowledged}});
  });
  it('keeps an earlier settled but unconfirmed journal dirty until exact retry confirms it', async () => {
    const state=pending(), settled=settleStudioSave(state,requestId,{kind:'success',receipt});
    await persistStudioWorkingCopy(scope,settled,null); await stageStudioCommand(scope,state.pending!.command);
    mount({...props,view:{...props.view,revision:4,site:{access:'hard'}},updatedAt:receipt.savedAt});await flush();
    expect(latest).toMatchObject({canEdit:false,canRetry:true,canSave:false,session:{dirty:true,pending:null}});
    await act(async()=>{await latest.retry();});
    expect(mocks.api.mock.calls[0][1].body).toBe(JSON.stringify(state.pending!.command));
    expect(latest).toMatchObject({canEdit:true,canSave:false,session:{dirty:false,pending:null}});
    expect(await listStudioPendingCommands(scope)).toMatchObject({entries:[]});
    expect(await readStudioWorkingCopy(scope)).toMatchObject({state:'valid',session:{dirty:false}});
  });
  it('enriches legacy metadata from the matching saved view without losing dirty fields', async()=>{
    const state=fresh();const changed=structuredClone(state.edit);changed.site.access='hard';
    const legacy=changeStudioSaveSession(state,changed);delete legacy.acknowledged;
    await persistStudioWorkingCopy(scope,legacy,null);
    mount();await flush();
    expect(latest).toMatchObject({canEdit:true,canSave:true,session:{edit:{site:{access:'hard'}},acknowledged:{edit:{site:{access:'normal'}}}}});
    await edit('normal');expect(latest.canSave).toBe(false);
    expect(latest.session!.generation).toBe(2);
  });
  it.each(['revision','timestamp','foreign'] as const)('preserves legacy/foreign raw work when %s cannot establish a baseline',async fault=>{
    const legacy=fresh();const edit=structuredClone(legacy.edit);edit.site.access='hard';
    const state=changeStudioSaveSession(legacy,edit);delete state.acknowledged;
    await persistStudioWorkingCopy(scope,state,null);
    const key=studioWorkingCopyKey(scope);
    if(fault==='foreign'){const raw=JSON.parse(db.get(key) as string);raw.session.scope.actorId='foreign';db.set(key,JSON.stringify(raw));}
    const raw=db.get(key);
    mount(fault==='revision'?{...props,view:{...props.view,revision:4}}:fault==='timestamp'?{...props,updatedAt:receipt.savedAt}:props);await flush();
    expect(latest.canEdit).toBe(false);expect(latest.canSave).toBe(false);
    expect(db.get(key)).toBe(raw);expect(mocks.api).not.toHaveBeenCalled();
  });
  it('retains structurally valid baseline metadata when it contradicts the verified saved view',async()=>{
    const state=fresh();state.acknowledged!.edit.site.access='hard';state.dirty=true;
    const stored=await persistStudioWorkingCopy(scope,state,null);expect(stored.state).toBe('persisted');
    const raw=db.get(studioWorkingCopyKey(scope));mount();await flush();
    expect(latest).toMatchObject({status:'recovery',canEdit:false,canSave:false});
    expect(latest.message).toContain('baseline differs');
    expect(db.get(studioWorkingCopyKey(scope))).toBe(raw);
  });
  it('retains the confirmed receipt when recovered duplication cannot be settled', async () => {
    const state = pending();
    const retained = await sendStudioCommand(scope, state.pending!.command);
    expect(retained.state).toBe('confirmed');
    const copy = buildNewStudioPergolaDraft({pergolaId:'unsent-copy',currentPergolas:[]});
    // Represents a retained working copy from an interrupted/older client,
    // containing an operation absent from the confirmed command.
    state.edit.schemaVersion='studio_authoring_edit.v2';
    state.edit.spatial.pergolas.push(copy);
    state.edit.objectOptions.push({objectId:copy.id,values:{}});
    state.edit.duplications=[{targetId:copy.id,sourceId:null,values:{},rowOrigins:{flashings:{},infills:{}}}];
    state.generation += 1;
    expect((await persistStudioWorkingCopy(scope,state,null)).state).toBe('persisted');
    mount({...props,view:{...props.view,revision:4},updatedAt:receipt.savedAt});await flush();
    expect(latest).toMatchObject({status:'recovery',canEdit:false,session:{baseRevision:3}});
    expect(latest.session?.pending?.command.requestId).toBe(requestId);
    expect(await listStudioPendingCommands(scope)).toMatchObject({entries:[{recovery:{state:'valid',receipt}}]});
    expect(latest.message).toContain('confirmed save is retained');
  });
  it('refreshes a clean acknowledged cache when a newer saved design is loaded', async () => {
    const acknowledged = { ...fresh(), generation: 9 };
    expect((await persistStudioWorkingCopy(scope, acknowledged, null)).state).toBe('persisted');
    mount({ ...props, view: { ...props.view, revision: 4, site: { access: 'easy' } }, updatedAt: receipt.savedAt });
    await flush();
    expect(latest).toMatchObject({ status: 'ready', canEdit: true, canSave: false, localDurable: true,
      session: { baseRevision: 4, generation: 9, dirty: false, pending: null, edit: { site: { access: 'easy' } } } });
    expect(await readStudioWorkingCopy(scope)).toMatchObject({ state: 'valid', session: { baseRevision: 4, dirty: false } });
    expect(mocks.api).not.toHaveBeenCalled();
  });
  it('preserves unsaved edits when the saved design advances', async () => {
    const state = fresh(); state.edit.site.access = 'hard';
    expect((await persistStudioWorkingCopy(scope, changeStudioSaveSession(fresh(), state.edit), null)).state).toBe('persisted');
    mount({ ...props, view: { ...props.view, revision: 4 }, updatedAt: receipt.savedAt }); await flush();
    expect(latest).toMatchObject({ status: 'recovery', canEdit: false, session: { baseRevision: 3, dirty: true, edit: { site: { access: 'hard' } } } });
    expect(await readStudioWorkingCopy(scope)).toMatchObject({ state: 'valid', session: { baseRevision: 3, dirty: true } });
    expect(mocks.api).not.toHaveBeenCalled();
  });
  it('does not replace a clean cache with an older server revision', async () => {
    expect((await persistStudioWorkingCopy(scope, fresh(), null)).state).toBe('persisted');
    mount({ ...props, view: { ...props.view, revision: 2 } }); await flush();
    expect(latest).toMatchObject({ status: 'recovery', canEdit: false, session: { baseRevision: 3 } });
    expect(await readStudioWorkingCopy(scope)).toMatchObject({ state: 'valid', session: { baseRevision: 3 } });
  });
  it('loads local storage before editing, persists edits and restores dirty work on reload', async () => {
    const first = mount(); expect(latest.canEdit).toBe(false); await flush();
    expect(latest).toMatchObject({ status: 'ready', localDurable: true, canEdit: true });
    await edit('hard'); expect(latest.session?.dirty).toBe(true);
    first.unmount(); mount(); await flush();
    expect(latest.edit?.site.access).toBe('hard'); expect(latest.canSave).toBe(true);
  });
  it('keeps edits made during the request and durably settles them before acknowledgement', async () => {
    let resolve!: (value: unknown) => void;
    mocks.api.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    mount(); await flush(); await edit('hard');
    let saving!: Promise<void>; await act(async () => { saving = latest.save(); });
    const body = mocks.api.mock.calls[0][1].body;
    await edit('easy'); expect(latest.edit?.site.access).toBe('easy');
    await act(async () => { resolve({ receipt, pricing: 'unpriced' }); await saving; });
    expect(latest).toMatchObject({ status: 'ready', localDurable: true, session: { baseRevision: 4, dirty: true, pending: null } });
    expect(JSON.parse(body).edit.site.access).toBe('hard');
    expect(await readStudioWorkingCopy(scope)).toMatchObject({ state: 'valid', session: { edit: { site: { access: 'easy' } }, dirty: true } });
    expect(await listStudioPendingCommands(scope)).toMatchObject({ state: 'available', entries: [] });
  });
  it('retries an unconfirmed save using its exact body despite later edits', async () => {
    mocks.api.mockRejectedValueOnce(Error('offline'));
    mount(); await flush(); await edit('hard'); await act(async () => { await latest.save(); });
    expect(latest.canRetry).toBe(true);
    const body = mocks.api.mock.calls[0][1].body;
    await edit('easy'); await act(async () => { await latest.retry(); });
    expect(mocks.api.mock.calls[1][1].body).toBe(body);
    expect(latest.session?.dirty).toBe(true);
  });
  it.each([false, true])('recovers a confirmed receipt after reload (already settled: %s)', async settledAlready => {
    const state = pending(); const stored = await persistStudioWorkingCopy(scope, state, null);
    await sendStudioCommand(scope, state.pending!.command);
    if (settledAlready && stored.state === 'persisted') await persistStudioWorkingCopy(scope, settleStudioSave(state, requestId, { kind: 'success', receipt }), stored.token);
    mocks.api.mockClear(); mount({ ...props, view: { ...props.view, revision: 4, site: state.pending!.command.edit.site }, updatedAt: receipt.savedAt }); await flush();
    expect(latest).toMatchObject({ status: 'ready', session: { baseRevision: 4, pending: null }, localDurable: true });
    expect(mocks.api).not.toHaveBeenCalled();
    expect(await listStudioPendingCommands(scope)).toMatchObject({ entries: [] });
  });
  it('restores a prepared unstaged request without inventing a new request identity', async () => {
    const state = pending(); await persistStudioWorkingCopy(scope, state, null);
    mount(); await flush(); expect(latest.canRetry).toBe(true); expect(mocks.api).not.toHaveBeenCalled();
    await act(async () => { await latest.retry(); });
    expect(mocks.api.mock.calls[0][1].body).toBe(JSON.stringify(state.pending!.command));
  });
  it.each(['corrupt', 'orphan', 'cross-base'])('blocks editing and preserves %s recovery data', async fault => {
    if (fault === 'corrupt') db.set(studioWorkingCopyKey(scope), '{bad');
    if (fault === 'orphan') await stageStudioCommand(scope, pending().pending!.command);
    if (fault === 'cross-base') {
      const local = fresh(); local.edit.site.access = 'hard';
      await persistStudioWorkingCopy(scope, changeStudioSaveSession(fresh(), local.edit), null);
    }
    const before = structuredClone([...db]);
    mount(fault === 'cross-base' ? { ...props, updatedAt: receipt.savedAt } : props); await flush();
    expect(latest.status).toBe('recovery'); expect(latest.canEdit).toBe(false);
    expect([...db]).toEqual(before); expect(mocks.api).not.toHaveBeenCalled();
  });
  it('blocks a stale CAS write and retains the unsaved edit in memory without sending', async () => {
    mount(); await flush();
    const key = studioWorkingCopyKey(scope); const replacement = JSON.parse(db.get(key) as string); replacement.session.generation = 20;
    db.set(key, JSON.stringify(replacement)); await edit('hard');
    expect(latest).toMatchObject({ status: 'recovery', localDurable: false });
    expect(latest.edit?.site.access).toBe('hard');
    await act(async () => { await latest.save(); }); expect(mocks.api).not.toHaveBeenCalled();
    expect(JSON.parse(db.get(key) as string).session.generation).toBe(20);
  });
  it('retains the receipt when settled working-copy persistence fails', async () => {
    mount(); await flush(); await edit('hard');
    mocks.api.mockImplementationOnce(async () => { mocks.update.mockRejectedValueOnce(Error('receipt storage')).mockRejectedValueOnce(Error('working storage')); return { receipt, pricing: 'unpriced' }; });
    await act(async () => { await latest.save(); });
    expect(latest.canEdit).toBe(false);
    const journal = await listStudioPendingCommands(scope); expect(journal.state).toBe('available');
    if (journal.state === 'available') expect(journal.entries).toHaveLength(1);
  });
  it('does not expose old-owner responses or permit writes after owner change', async () => {
    let resolve!: (value: unknown) => void; mocks.api.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    const rendered = mount(); await flush(); await edit('hard');
    let saving!: Promise<void>; await act(async () => { saving = latest.save(); });
    mocks.owner.mockReturnValue('another'); rendered.rerender(<Harness {...props} />);
    expect(latest.session).toBeNull();
    await act(async () => { resolve({ receipt, pricing: 'unpriced' }); await saving; });
    expect(latest.session).toBeNull(); expect(latest.canEdit).toBe(false);
  });
  it('keeps locked versions read-only without writing a new working copy', async () => {
    mount({ ...props, editable: false }); await flush();
    expect(latest.status).toBe('locked'); expect(db.size).toBe(0); expect(latest.canEdit).toBe(false);
  });
  it('drains accepted edits after unmount without starting a network request', async () => {
    const rendered = mount(); await flush();
    act(() => { const next = structuredClone(latest.edit!); next.site.access = 'hard'; latest.change(next); rendered.unmount(); });
    await flush();
    expect(await readStudioWorkingCopy(scope)).toMatchObject({ state: 'valid', session: { dirty: true, edit: { site: { access: 'hard' } } } });
    expect(mocks.api).not.toHaveBeenCalled();
  });
  it.each([4, 5])('allows only exact replay after a lost response with server revision %s, without rebasing edits', async serverRevision => {
    const state = pending(); const later = structuredClone(state.edit); later.site.access = 'easy';
    const local = changeStudioSaveSession(state, later);
    await persistStudioWorkingCopy(scope, local, null); await stageStudioCommand(scope, state.pending!.command);
    mount({ ...props, view: { ...props.view, revision: serverRevision, site: state.pending!.command.edit.site }, updatedAt: receipt.savedAt }); await flush();
    expect(latest).toMatchObject({ canRetry: true, canEdit: false, canSave: false, session: { baseRevision: 3 } });
    await edit('hard'); expect(latest.edit?.site.access).toBe('easy');
    await act(async () => { await latest.retry(); });
    expect(mocks.api.mock.calls[0][1].body).toBe(JSON.stringify(state.pending!.command));
    if (serverRevision === 4) {
      expect(latest).toMatchObject({ canEdit: true, session: { baseRevision: 4, dirty: true, pending: null } });
    } else {
      expect(latest).toMatchObject({ status: 'recovery', canEdit: false, session: { baseRevision: 3 } });
      expect((await listStudioPendingCommands(scope)).state).toBe('available');
    }
    expect(latest.edit?.site.access).toBe('easy');
  });
  it('retains pending reconciliation after receipt storage fails, then reloads and retries without losing later edits', async () => {
    let resolve!: (value: unknown) => void;
    mocks.api.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    const first = mount(); await flush(); await edit('hard');
    let saving!: Promise<void>; await act(async () => { saving = latest.save(); });
    const body = mocks.api.mock.calls[0][1].body;
    await edit('easy');
    mocks.update.mockRejectedValueOnce(Error('receipt quota'));
    await act(async () => { resolve({ receipt, pricing: 'unpriced' }); await saving; });
    expect(latest).toMatchObject({ canRetry: true, canEdit: false, session: { baseRevision: 3, dirty: true } });
    expect(latest.session?.pending).not.toBeNull();
    first.unmount(); mount({ ...props, view: { ...props.view, revision: 4, site: {access:'hard'} }, updatedAt: receipt.savedAt }); await flush();
    expect(latest.canRetry).toBe(true);
    await act(async () => { await latest.retry(); });
    expect(mocks.api.mock.calls[1][1].body).toBe(body);
    expect(latest).toMatchObject({ canEdit: true, session: { baseRevision: 4, pending: null, dirty: true } });
    expect(latest.edit?.site.access).toBe('easy');
    expect(await listStudioPendingCommands(scope)).toMatchObject({ entries: [] });
  });
  it('recovers an earlier already-settled working copy whose journal has no receipt', async () => {
    const state = pending(); const later = structuredClone(state.edit); later.site.access = 'easy';
    const settled = settleStudioSave(changeStudioSaveSession(state, later), requestId, { kind: 'success', receipt });
    await persistStudioWorkingCopy(scope, settled, null); await stageStudioCommand(scope, state.pending!.command);
    mount({ ...props, view: { ...props.view, revision: 4, site: state.pending!.command.edit.site }, updatedAt: receipt.savedAt }); await flush();
    expect(latest).toMatchObject({ canRetry: true, canEdit: false, session: { pending: null, dirty: true } });
    await act(async () => { await latest.retry(); });
    expect(mocks.api.mock.calls[0][1].body).toBe(JSON.stringify(state.pending!.command));
    expect(latest).toMatchObject({ canEdit: true, session: { pending: null, dirty: true } });
    expect(latest.edit?.site.access).toBe('easy');
    expect(await listStudioPendingCommands(scope)).toMatchObject({ entries: [] });
  });
  it('recovers an already-settled no-op receipt at the original revision without losing later edits', async () => {
    const state = pending(); const later = structuredClone(state.edit); later.site.access = 'easy';
    const noOpReceipt = { ...receipt, revision: state.baseRevision };
    const settled = settleStudioSave(changeStudioSaveSession(state, later), requestId, { kind: 'success', receipt: noOpReceipt });
    await persistStudioWorkingCopy(scope, settled, null); await stageStudioCommand(scope, state.pending!.command);
    mocks.api.mockResolvedValue({ receipt: noOpReceipt, pricing: 'unpriced' });
    mount({ ...props, view: {...props.view, site: state.pending!.command.edit.site}, updatedAt: noOpReceipt.savedAt }); await flush();
    expect(latest).toMatchObject({ canRetry: true, canEdit: false, canSave: false, session: { baseRevision: 3, pending: null, dirty: true } });
    await edit('hard'); expect(latest.edit?.site.access).toBe('easy');
    await act(async () => { await latest.retry(); });
    expect(mocks.api.mock.calls[0][1].body).toBe(JSON.stringify(state.pending!.command));
    expect(latest).toMatchObject({ canEdit: true, localDurable: true, session: { baseRevision: 3, baseUpdatedAt: noOpReceipt.savedAt, pending: null, dirty: true } });
    expect(latest.edit?.site.access).toBe('easy');
    expect(await listStudioPendingCommands(scope)).toMatchObject({ entries: [] });
  });
});

describe('explicit saved-basis recovery', () => {
 it.each([400, 409, 422])('reopens a recorded %s refusal and explicitly uses fresh saved authority without losing its rejected edit', async status => {
  const state = pending(), command = structuredClone(state.pending!.command);
  mocks.api.mockRejectedValueOnce(new ApiError('STUDIO_STALE', {status,body:{code:'STUDIO_STALE'}}));
  expect((await sendStudioCommand(scope, command)).state).toBe('rejected');
  const rejected = settleStudioSave(state, command.requestId, {kind:status===409?'conflict':'rejected'});
  await persistStudioWorkingCopy(scope, rejected, null);
  const before = structuredClone([...db]);
  const newer = {...props,view:{...props.view,revision:4,site:{access:'easy'}},updatedAt:receipt.savedAt};
  const rendered = mount(newer); await flush();
  expect(latest).toMatchObject({canUseSaved:true,canEdit:false,canRetry:false});
  expect(latest.edit?.site.access).toBe('hard');expect([...db]).toEqual(before);
  mocks.api.mockResolvedValueOnce({authoring:{state:'ready',nextAction:'edit',view:newer.view,estimate:{id:scope.estimateId,projectId:scope.projectId,updatedAt:newer.updatedAt,requiresNewRevision:false}}});
  await act(async()=>{await latest.useSaved();});
  expect(latest).toMatchObject({canEdit:true,canSave:false,canUseSaved:false,localDurable:true});
  expect(latest.edit?.site.access).toBe('easy');
  expect(latest.retainedCopies[0].session).toEqual(rejected);
  expect(latest.retainedCopies[0].session.pending!.command).toEqual(command);
  expect(await listStudioPendingCommands(scope)).toMatchObject({entries:[]});
  expect(mocks.api).toHaveBeenCalledTimes(2);expect(mocks.api.mock.calls[1][1]).toBeUndefined();
  rendered.unmount();mount(newer);await flush();
  expect(latest).toMatchObject({canEdit:true,canUseSaved:false,session:{pending:null,dirty:false}});
  expect(latest.edit?.site.access).toBe('easy');
 });
 it('offers the same recovery immediately after a stale Save and permits ordinary edits after using saved', async()=>{
  mount();await flush();await edit('hard');
  mocks.api.mockRejectedValueOnce(new ApiError('STUDIO_STALE',{status:409,body:{code:'STUDIO_STALE'}}));
  await act(async()=>{await latest.save();});
  expect(latest).toMatchObject({canEdit:false,canUseSaved:true});
  const command=structuredClone(latest.session!.pending!.command);
  const newer={...props.view,revision:4,site:{access:'easy'}};
  mocks.api.mockResolvedValueOnce({authoring:{state:'ready',nextAction:'edit',view:newer,estimate:{id:scope.estimateId,projectId:scope.projectId,updatedAt:receipt.savedAt,requiresNewRevision:false}}});
  await act(async()=>{await latest.useSaved();});await edit('normal');
  expect(latest).toMatchObject({canEdit:true,canSave:true});
  expect(latest.retainedCopies[0].session.pending!.command).toEqual(command);
  mocks.api.mockResolvedValueOnce({receipt:{...receipt,revision:5,savedAt:'2026-09-24T02:00:00Z'},pricing:'unpriced'});
  await act(async()=>{await latest.save();});
  expect(latest).toMatchObject({canEdit:true,canSave:false,session:{baseRevision:5,pending:null,dirty:false}});
  expect(JSON.parse(mocks.api.mock.calls[2][1].body).expectedRevision).toBe(4);
 });
 it('preserves both accepted memory and newer durable work after local CAS loss before explicit saved recovery',async()=>{
  mount();await flush();const key=studioWorkingCopyKey(scope),other=JSON.parse(db.get(key) as string);
  other.session.generation=20;other.session.edit.site.access='easy';other.session.dirty=true;
  db.set(key,JSON.stringify(other));await edit('hard');
  expect(latest).toMatchObject({canEdit:false,canUseSaved:true,localDurable:false});
  const memory=structuredClone(latest.session);
  mocks.api.mockResolvedValueOnce({authoring:{state:'ready',nextAction:'edit',view:{...props.view,revision:4},estimate:{id:scope.estimateId,projectId:scope.projectId,updatedAt:receipt.savedAt,requiresNewRevision:false}}});
  await act(async()=>{await latest.useSaved();});
  expect(latest).toMatchObject({canEdit:true,canSave:false,localDurable:true,session:{generation:20,baseRevision:4,pending:null}});
  expect(latest.retainedCopies.map(copy=>copy.session)).toEqual([memory,other.session]);
  expect(latest.edit?.site.access).toBe('normal');expect(mocks.api).toHaveBeenCalledTimes(1);
 });
 it('cannot replace the durable copy after local CAS loss to an unresolved other-tab save',async()=>{
  mount();await flush();const key=studioWorkingCopyKey(scope),token=db.get(key) as string;
  const other=pending();await persistStudioWorkingCopy(scope,other,token);await stageStudioCommand(scope,other.pending!.command);
  const before=structuredClone([...db]);await edit('easy');
  expect(latest).toMatchObject({canEdit:false,canUseSaved:false});
  await act(async()=>{await latest.useSaved();});expect([...db]).toEqual(before);expect(mocks.api).not.toHaveBeenCalled();
 });
 it('keeps exact retry when the server refusal could not be recorded, including after reload',async()=>{
  const rendered=mount();await flush();await edit('hard');
  mocks.api.mockImplementationOnce(async()=>{mocks.update.mockRejectedValueOnce(Error('journal quota'));throw new ApiError('STUDIO_STALE',{status:409,body:{}});});
  await act(async()=>{await latest.save();});
  expect(latest).toMatchObject({canUseSaved:false,canRetry:true});
  const command=structuredClone(latest.session!.pending!.command),before=structuredClone([...db]);
  rendered.unmount();mount({...props,view:{...props.view,revision:4},updatedAt:receipt.savedAt});await flush();
  expect(latest).toMatchObject({canUseSaved:false,canRetry:true,canEdit:false});
  expect(latest.session!.pending!.command).toEqual(command);expect([...db]).toEqual(before);
 });
 it('does not discard a rejected working copy when preservation runs out of local storage',async()=>{
  const state=pending();mocks.api.mockRejectedValueOnce(new ApiError('stale',{status:409,body:{}}));
  await sendStudioCommand(scope,state.pending!.command);await persistStudioWorkingCopy(scope,settleStudioSave(state,requestId,{kind:'conflict'}),null);
  mount({...props,view:{...props.view,revision:4},updatedAt:receipt.savedAt});await flush();
  const before=structuredClone([...db]);mocks.api.mockClear();mocks.update.mockRejectedValueOnce(Error('quota'));
  await act(async()=>{await latest.useSaved();});
  expect(latest).toMatchObject({canUseSaved:true,canEdit:false});expect([...db]).toEqual(before);expect(mocks.api).not.toHaveBeenCalled();
 });

 it('offers an explicit choice for retained local work and loads saved only after preservation', async () => {
  const state = fresh(), edit = structuredClone(state.edit); edit.site.access = 'hard';
  await persistStudioWorkingCopy(scope, changeStudioSaveSession(state, edit), null);
  const newer = { ...props, view: { ...props.view, revision: 4 }, updatedAt: '2026-09-28T01:00:00Z' };
  mount(newer); await flush();
  expect(latest.canEdit).toBe(false); expect(latest.canUseSaved).toBe(true); expect(latest.edit?.site.access).toBe('hard');
  mocks.api.mockResolvedValueOnce({ authoring: { state: 'ready', nextAction: 'edit', view: newer.view, estimate: { id: scope.estimateId, projectId: scope.projectId, updatedAt: newer.updatedAt, requiresNewRevision: false } } });
  await act(async () => { await latest.useSaved(); });
  expect(latest).toMatchObject({ canEdit: true, canSave: false, canUseSaved: false, localDurable: true });
  expect(latest.edit?.site.access).toBe('normal'); expect(latest.retainedCopies[0].session.edit.site.access).toBe('hard');
 });
 it('clears the prior successful-save message when a new edit starts', async () => {
  mount(); await flush(); await edit('hard'); await act(async () => { await latest.save(); });
  expect(latest.message).toBe('Saved.'); await edit('easy'); expect(latest.message).toBeNull(); expect(latest.session?.dirty).toBe(true);
 });
});

describe('verify recovery authority before writes or journal retirement', () => {
  it.each(['both', 'options'] as const)('keeps contradictory large baseline bytes and recovery across reload before enriching missing %s snapshots', async missing => {
    const input: StudioEditingSessionProps = { ...props, view: { ...props.view,
      spatial: { ...props.view.spatial, pergolas: [{ id: 'p1', label: 'Pergola', family: 'mono', attachmentEdgeId: null, attachmentZoneId: null, side: 'rear', strategy: null }] },
      objectOptions: [{ objectId: 'p1', values: { rafterSpacingMm: '0'.repeat(1_800_000) } }] } };
    const saved = createStudioSaveSession(scope, input.view, input.updatedAt), edit = structuredClone(saved.edit); edit.site.access = 'easy';
    const state = changeStudioSaveSession(saved, edit);
    delete state.baselineObjectOptions;
    if (missing === 'both') delete state.baselinePergolaIds;
    state.acknowledged!.edit.site.access = 'hard';
    const stored = await persistStudioWorkingCopy(scope, state, null);
    expect(stored.state).toBe('persisted'); if (stored.state !== 'persisted') throw Error('Recovery fixture');
    expect(JSON.parse(stored.token).session.acknowledged.edit.site.access).toBe('hard');
    const writes = mocks.update.mock.calls.length;
    for (let attempt = 0; attempt < 2; attempt++) {
      const rendered = mount(input); await flush();
      expect(latest).toMatchObject({ status: 'recovery', canEdit: false, canSave: false });
      expect(latest.message).toContain('baseline differs');
      expect(latest.edit).toEqual(state.edit);
      expect(db.get(studioWorkingCopyKey(scope))).toBe(stored.token);
      expect(mocks.update).toHaveBeenCalledTimes(writes);
      expect(mocks.api).not.toHaveBeenCalled();
      rendered.unmount(); await flush();
    }
  });
  it.each(['unstaged', 'staged', 'receipt-pending', 'receipt-settled'] as const)('retains the original token and %s evidence when loaded saved content contradicts authority', async kind => {
    let state = pending();
    const later = structuredClone(state.edit); later.site.access = 'easy';
    state = changeStudioSaveSession(state, later);
    const command = state.pending!.command;
    if (kind === 'staged') await stageStudioCommand(scope, command);
    if (kind.startsWith('receipt')) await sendStudioCommand(scope, command);
    if (kind === 'receipt-settled') state = settleStudioSave(state, requestId, { kind: 'success', receipt });
    if (!kind.startsWith('receipt')) state.acknowledged!.edit.site.access = 'hard';
    const stored = await persistStudioWorkingCopy(scope, state, null);
    expect(stored.state).toBe('persisted'); if (stored.state !== 'persisted') throw Error('Retained evidence fixture');
    const journal = await listStudioPendingCommands(scope), writes = mocks.update.mock.calls.length, api = mocks.api.mock.calls.length;
    mount(kind.startsWith('receipt') ? { ...props, view: { ...props.view, revision: 4 }, updatedAt: receipt.savedAt } : props);
    await flush();
    expect(latest).toMatchObject({ status: 'recovery', canEdit: false, canSave: false });
    expect(latest.message).toContain('baseline differs');
    expect(latest.edit).toEqual(state.edit);
    expect(db.get(studioWorkingCopyKey(scope))).toBe(stored.token);
    expect(await listStudioPendingCommands(scope)).toEqual(journal);
    expect(mocks.update).toHaveBeenCalledTimes(writes);
    expect(mocks.api).toHaveBeenCalledTimes(api);
  });
  it.each(['hard', 'normal'] as const)('retains an unverified old-base retry token until confirmation, then checks genuinely loaded %s content', async savedAccess => {
    const state = pending(), edit = structuredClone(state.edit); edit.site.access = 'easy';
    const current = changeStudioSaveSession(state, edit), stored = await persistStudioWorkingCopy(scope, current, null);
    expect(stored.state).toBe('persisted'); if (stored.state !== 'persisted') throw Error('Retry fixture');
    const command = state.pending!.command; await stageStudioCommand(scope, command);
    const staged = await listStudioPendingCommands(scope);
    mount({ ...props, view: { ...props.view, revision: 4, site: { access: savedAccess } }, updatedAt: receipt.savedAt }); await flush();
    expect(latest).toMatchObject({ canEdit: false, canRetry: true });
    expect(db.get(studioWorkingCopyKey(scope))).toBe(stored.token);
    mocks.api.mockRejectedValueOnce(Error('offline'));
    await act(async () => { await latest.retry(); });
    expect(db.get(studioWorkingCopyKey(scope))).toBe(stored.token);
    expect(await listStudioPendingCommands(scope)).toEqual(staged);
    await act(async () => { await latest.retry(); });
    expect(mocks.api.mock.calls.map(call => call[1].body)).toEqual([JSON.stringify(command), JSON.stringify(command)]);
    expect(latest.edit?.site.access).toBe('easy');
    if (savedAccess === 'hard') {
      expect(latest).toMatchObject({ canEdit: true, session: { dirty: true, baseRevision: 4 } });
      expect(latest.session!.acknowledged!.edit.site.access).toBe('hard');
      expect(await listStudioPendingCommands(scope)).toMatchObject({ entries: [] });
    } else {
      expect(latest).toMatchObject({ status: 'recovery', canEdit: false });
      expect(db.get(studioWorkingCopyKey(scope))).toBe(stored.token);
      expect(await listStudioPendingCommands(scope)).toMatchObject({ entries: [{ recovery: { receipt } }] });
    }
  });
  it('does not certify or replace a baseline-free clean legacy token from a different saved revision', async () => {
    const state = fresh(); delete state.acknowledged;
    const stored = await persistStudioWorkingCopy(scope, state, null);
    expect(stored.state).toBe('persisted'); if (stored.state !== 'persisted') throw Error('Legacy fixture');
    mount({ ...props, view: { ...props.view, revision: 4 }, updatedAt: receipt.savedAt }); await flush();
    expect(latest).toMatchObject({ status: 'recovery', canEdit: false, canUseSaved: true });
    expect(db.get(studioWorkingCopyKey(scope))).toBe(stored.token);
  });
});
