import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {bindLocalFirstStoreOwner,clearLocalFirstStoreOwner,createEmptyLocalFirstState,writeLocalFirstWorkingCopy,getLocalFirstWorkingCopy,getLocalFirstStoreOwner,__setLocalFirstStorageAdapterForTests,__resetLocalFirstStoreForTests} from '@/lib/localFirst/store';
import {invalidateStudioLifecycle,registerStudioLifecycle as compatibilityRegister,prepareStudioNavigation as compatibilityPrepare} from './studioLifecycle';
import {registerStudioLifecycle,prepareStudioNavigation} from './studioSessionLifecycle';
import {navigateStudioDocument} from './studioDocumentNavigation';

const deferred=()=>{let resolve!:()=>void;const promise=new Promise<void>(done=>{resolve=done;});return{promise,resolve};};
let saved:ReturnType<typeof createEmptyLocalFirstState>;
const save=vi.fn(async(value:ReturnType<typeof createEmptyLocalFirstState>,_ownerId:string)=>{saved=structuredClone(value);});
beforeEach(()=>{__resetLocalFirstStoreForTests();invalidateStudioLifecycle();saved=createEmptyLocalFirstState();save.mockReset();save.mockImplementation(async(value)=>{saved=structuredClone(value);});__setLocalFirstStorageAdapterForTests({get:async()=>saved,set:(...args)=>save(...args)});bindLocalFirstStoreOwner('actor');});
afterEach(()=>{clearLocalFirstStoreOwner();invalidateStudioLifecycle();__setLocalFirstStorageAdapterForTests(null);vi.restoreAllMocks();});

it('drains ordinary Portal local persistence with no Studio participant or server Save',async()=>{
 const hold=deferred();save.mockImplementationOnce(async value=>{await hold.promise;saved=structuredClone(value);});
 const write=writeLocalFirstWorkingCopy({entityKey:'estimate:one',data:{name:'Last ordinary edit'}});await Promise.resolve();await Promise.resolve();
 const navigate=vi.fn(),pending=navigateStudioDocument('/studio',false,navigate);expect(navigate).not.toHaveBeenCalled();
 hold.resolve();await write;await pending;
 expect(saved.workingCopies['estimate:one'].data).toEqual({name:'Last ordinary edit'});expect(navigate).toHaveBeenCalledExactlyOnceWith('/studio',false);expect(getLocalFirstStoreOwner()).toBe('actor');
});

it('includes a later accepted ordinary mutation before committing the document handoff',async()=>{
 const hold=deferred();save.mockImplementationOnce(async value=>{await hold.promise;saved=structuredClone(value);});
 const before=writeLocalFirstWorkingCopy({entityKey:'estimate:one',data:{name:'Before'}});
 const navigate=vi.fn(),pending=navigateStudioDocument('/studio',false,navigate);
 await Promise.resolve();const next=writeLocalFirstWorkingCopy({entityKey:'estimate:one',data:{name:'Newest'}});
 hold.resolve();await Promise.all([before,pending,next]);expect(saved.workingCopies['estimate:one'].data).toEqual({name:'Newest'});expect(navigate).toHaveBeenCalledOnce();
});

it('stops exit on local quota failure without dropping the current owner or accepted working copy',async()=>{
 vi.spyOn(console,'error').mockImplementation(()=>{});save.mockRejectedValueOnce(Error('quota'));await writeLocalFirstWorkingCopy({entityKey:'estimate:one',data:{name:'Kept'}});save.mockRejectedValueOnce(Error('quota'));
 const navigate=vi.fn();await expect(navigateStudioDocument('/studio',false,navigate)).rejects.toThrow('quota');
 expect(navigate).not.toHaveBeenCalled();expect(getLocalFirstStoreOwner()).toBe('actor');expect(getLocalFirstWorkingCopy('estimate:one')?.data).toEqual({name:'Kept'});
 await navigateStudioDocument('/studio',false,navigate);expect(navigate).toHaveBeenCalledOnce();
});

it('does not navigate on an old actor drain after the owner changes',async()=>{
 const hold=deferred();save.mockImplementationOnce(async()=>hold.promise);const write=writeLocalFirstWorkingCopy({entityKey:'estimate:one',data:{name:'A'}});void write.catch(()=>{});
 const navigate=vi.fn(),pending=navigateStudioDocument('/studio',false,navigate);void pending.catch(()=>{});await Promise.resolve();
 clearLocalFirstStoreOwner();bindLocalFirstStoreOwner('other');hold.resolve();await expect(pending).rejects.toThrow();expect(navigate).not.toHaveBeenCalled();expect(getLocalFirstStoreOwner()).toBe('other');
});


it('shares one participant/fence/epoch owner between lightweight navigation and the legacy retention adapter',async()=>{
 expect(compatibilityRegister).toBe(registerStudioLifecycle);expect(compatibilityPrepare).toBe(prepareStudioNavigation);
 Object.defineProperty(navigator,'locks',{configurable:true,value:{request:async(_name:string,_options:unknown,fn:(lock:unknown)=>unknown)=>fn({})}});
 const flush=vi.fn(async()=>true),registration=registerStudioLifecycle('actor',flush,()=>{});await registration.ready;expect(registration.allowed()).toBe(true);
 const navigation=compatibilityPrepare('actor');expect(registration.allowed()).toBe(false);await navigation.ready;expect(flush).toHaveBeenCalledOnce();navigation.release();
 invalidateStudioLifecycle();expect(registration.valid()).toBe(false);registration.detach();
});
