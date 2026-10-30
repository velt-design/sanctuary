import {beforeEach,expect,it,vi} from 'vitest';
import {sendStudioCommand,retryStudioCommand,stageStudioCommand,readStudioPendingCommand} from './saveTransport';
import {sendStudioCreation,retryStudioCreation,stageStudioCreation,readStudioPendingCreation} from './createTransport';
import {createStudioSaveSession,changeStudioSaveSession,prepareStudioSave} from './saveSession';
const mocks=vi.hoisted(()=>({get:vi.fn(),keys:vi.fn(),update:vi.fn(),owner:vi.fn(),api:vi.fn()}));
vi.mock('idb-keyval',()=>({get:mocks.get,keys:mocks.keys,update:mocks.update}));
vi.mock('@/lib/localFirst/store',()=>({getLocalFirstStoreOwner:mocks.owner}));
vi.mock('@/lib/repo/apiClient',async load=>({...await load<typeof import('@/lib/repo/apiClient')>(),apiJson:mocks.api}));
const scope={actorId:'10000000-0000-4000-8000-000000000001',projectId:'proj_20000000-0000-4000-8000-000000000001',estimateId:'est_30000000-0000-4000-8000-000000000001',designId:'design'},requestId='40000000-0000-4000-8000-000000000001';
const initial=createStudioSaveSession(scope,{schemaVersion:'studio_authoring_view.v1',designId:'design',revision:1,spatial:{houseAssembly:null,decks:[],openings:[],pergolas:[]},site:{access:'normal'},objectOptions:[],pricing:'unpriced'},'2026-10-26T00:00:00Z');
const edit=structuredClone(initial.edit);edit.site.access='hard';const command=prepareStudioSave(changeStudioSaveSession(initial,edit),requestId).pending!.command;
const creation={schemaVersion:'studio_create.v1' as const,requestId,mode:'blank' as const,scope:'base' as const};
const createScope={actorId:scope.actorId,projectId:scope.projectId};
const db=new Map<string,unknown>();
beforeEach(()=>{vi.resetAllMocks();db.clear();mocks.owner.mockReturnValue(scope.actorId);mocks.get.mockImplementation(async key=>structuredClone(db.get(key)));mocks.keys.mockImplementation(async()=>[...db.keys()]);mocks.update.mockImplementation(async(key,fn)=>db.set(key,structuredClone(fn(structuredClone(db.get(key))))));mocks.api.mockResolvedValue({});});
const deferred=()=>{let resolve!:()=>void;return{promise:new Promise<void>(done=>{resolve=done;}),release:()=>resolve()};};
it.each(['save','create'] as const)('retains %s body but refuses HTTP if admission ends while stage/read is held',async kind=>{
 let admitted=true;const held=deferred(),update=mocks.update.getMockImplementation()!;mocks.update.mockImplementationOnce(async(key,fn)=>{await held.promise;return update(key,fn);});
 const pending=kind==='save'?sendStudioCommand(scope,command,()=>admitted):sendStudioCreation(createScope,creation,()=>admitted);
 admitted=false;held.release();expect((await pending).state).toBe('blocked');expect(mocks.api).not.toHaveBeenCalled();
 const retained=kind==='save'?await readStudioPendingCommand(scope,command):await readStudioPendingCreation(createScope,creation);expect(retained).toMatchObject({state:'valid',body:JSON.stringify(kind==='save'?command:creation),receipt:null});
});
it.each(['save','create'] as const)('refuses explicit %s retry overtaken while reading its retained body, without changing it',async kind=>{
 if(kind==='save')await stageStudioCommand(scope,command);else await stageStudioCreation(createScope,creation);const before=structuredClone([...db]);
 let admitted=true;const held=deferred(),get=mocks.get.getMockImplementation()!;mocks.get.mockImplementationOnce(async key=>{await held.promise;return get(key);});
 const pending=kind==='save'?retryStudioCommand(scope,command,()=>admitted):retryStudioCreation(createScope,creation,()=>admitted);admitted=false;held.release();expect((await pending).state).toBe('blocked');expect(mocks.api).not.toHaveBeenCalled();expect([...db]).toEqual(before);
});
it.each(['save','create'] as const)('retains an already dispatched %s receipt under its captured local owner after admission ends',async kind=>{
 let admitted=true;const held=deferred(),receipt=kind==='save'?{revision:2,savedAt:'2026-10-26T01:00:00Z',alreadyExisted:false}:{estimateId:scope.estimateId,designId:'new-design',revision:1,savedAt:'2026-10-26T01:00:00Z',alreadyExisted:false};
 mocks.api.mockImplementationOnce(async()=>{await held.promise;return{receipt,pricing:'unpriced'};});
 const pending=kind==='save'?sendStudioCommand(scope,command,()=>admitted):sendStudioCreation(createScope,creation,()=>admitted);
 for(let i=0;i<12&&!mocks.api.mock.calls.length;i++)await Promise.resolve();expect(mocks.api).toHaveBeenCalledOnce();admitted=false;held.release();
 expect(await pending).toMatchObject({state:'confirmed',receipt,receiptStored:true});const retained=kind==='save'?await readStudioPendingCommand(scope,command):await readStudioPendingCreation(createScope,creation);expect(retained).toMatchObject({state:'valid',receipt});expect(mocks.api).toHaveBeenCalledOnce();
});
