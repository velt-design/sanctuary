import {act} from 'react';
import {createClient,type SupabaseClient} from '@supabase/supabase-js';
import {afterEach,expect,it,vi} from 'vitest';
import {renderIntoDocument} from '../../../../test/reactHarness';
import StudioDocumentSlot from './StudioDocumentSlot';
import StudioDocumentPage from './StudioDocumentPage';
import {getLocalFirstStoreOwner,clearLocalFirstStoreOwner} from '@/lib/localFirst/store';
const mocks=vi.hoisted(()=>({sdk:null as SupabaseClient|null,order:[] as string[]}));
vi.mock('next/navigation',()=>({usePathname:()=>location.pathname,useSearchParams:()=>new URLSearchParams(location.search),useRouter:()=>({replace:vi.fn()})}));
vi.mock('@/lib/supabase/browserClient',()=>({supabaseRuntimeUrl:()=>'',supabaseHostFromUrl:()=>'',getSupabaseBrowser:()=>mocks.sdk}));
// The real leaf helper and real opening reader run. These two public module
// factories keep this ordering test small without evaluating/mounting a renderer.
vi.mock('./StudioEditor',()=>{mocks.order.push('Editor module');return{default:()=> <main>Editor</main>};});
vi.mock('./StudioHouseCanvas',()=>{mocks.order.push('Canvas module');return{default:()=> <main>Canvas</main>};});
let mounted:ReturnType<typeof renderIntoDocument>|undefined;
afterEach(()=>{mounted?.unmount();mounted=undefined;clearLocalFirstStoreOwner();vi.unstubAllGlobals();});
it('issues one real opening fetch after held installed-SDK recovery, before evaluating either actual public leaf import',async()=>{
 const actor='10000000-0000-4000-8000-000000000001',project='proj_20000000-0000-4000-8000-000000000001',estimate='est_30000000-0000-4000-8000-000000000001',callback=`/staff/design-studio/${project}/${estimate}/edit`;
 history.replaceState({},'',callback);mocks.order.length=0;vi.stubGlobal('BroadcastChannel',undefined);
 let release!:()=>void;const storage=new Promise<void>(resolve=>{release=resolve;});
 const session={access_token:'synthetic-access-token',refresh_token:'synthetic-refresh-token',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user:{id:actor}};
 const provider=vi.fn(()=>{throw Error('No provider calls are allowed.');});
 const sdk=createClient('https://sdk-bootstrap.invalid','synthetic-public-key',{global:{fetch:provider},auth:{persistSession:true,autoRefreshToken:false,detectSessionInUrl:false,storageKey:'sdk-preload-order',storage:{getItem:async()=>{await storage;return JSON.stringify(session);},setItem:async()=>{},removeItem:async()=>{}}}});mocks.sdk=sdk;
 const events:string[]=[],subscription=sdk.auth.onAuthStateChange(event=>{events.push(event);});
 const fetch=vi.fn((path:string,init:RequestInit)=>{
  expect(path).toBe(`/api/projects/${project}/estimates/${estimate}/studio`);mocks.order.push('authoring fetch');
  return new Promise<Response>((_resolve,reject)=>{init.signal!.addEventListener('abort',()=>reject(Error('Retired synthetic fetch')),{once:true});});
 });vi.stubGlobal('fetch',fetch);
 mounted=renderIntoDocument(<StudioDocumentSlot callback={callback}><StudioDocumentPage callback={callback}/></StudioDocumentSlot>);
 await act(async()=>{await new Promise(resolve=>setTimeout(resolve,20));});
 expect(fetch).not.toHaveBeenCalled();expect(mocks.order).toEqual([]);expect(getLocalFirstStoreOwner()).toBeNull();
 await act(async()=>release());await sdk.auth.initialize();await act(async()=>{await new Promise(resolve=>setTimeout(resolve,20));});
 expect(events).toContain('SIGNED_IN');expect(fetch).toHaveBeenCalledOnce();expect(provider).not.toHaveBeenCalled();
 expect(mocks.order[0]).toBe('authoring fetch');expect(mocks.order.slice(1).sort()).toEqual(['Canvas module','Editor module']);expect(getLocalFirstStoreOwner()).toBeNull();
 subscription.data.subscription.unsubscribe();
});
