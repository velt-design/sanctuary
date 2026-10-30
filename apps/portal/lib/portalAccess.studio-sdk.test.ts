// @vitest-environment node
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {createServerClient} from '@supabase/ssr';
import {resolvePortalAccessState} from './portalAccess';
import {resolveStudioPortalAccessState,type StudioPortalAccessLookup} from './studioPortalAccess.server';
const actor='10000000-0000-4000-8000-000000000001',other='20000000-0000-4000-8000-000000000002';
const origin='https://studio-access-sdk.invalid',key='sb-studio-access-sdk-auth-token';
const user=(id=actor)=>({id,aud:'authenticated',role:'authenticated',email:'synthetic@example.invalid',app_metadata:{},user_metadata:{},created_at:'2026-01-01T00:00:00Z'});
const now=()=>Math.floor(Date.now()/1000);
function token(sub:string|null=actor){return Buffer.from(JSON.stringify({alg:'ES256',typ:'JWT'})).toString('base64url')+'.'+Buffer.from(JSON.stringify({...(sub?{sub}:{}),exp:now()+3600,role:'authenticated'})).toString('base64url')+'.c3ludGhldGlj';}
const session=(access=token(),expires=now()+3600)=>({access_token:access,refresh_token:'synthetic-refresh',expires_at:expires,expires_in:3600,token_type:'bearer',user:user()});
function deferred(){let resolve!:()=>void;const promise=new Promise<void>(done=>resolve=done);return{promise,resolve};}
let calls:Array<{path:string;subject:string|null;bearer:string|null;signal:AbortSignal|null|undefined}>,deny:boolean,role:string|null,roleFailure:boolean,badRefresh:boolean,gate:ReturnType<typeof deferred>|null,roleGate:ReturnType<typeof deferred>|null,verifiedActor:string;
let fresh:ReturnType<typeof session>;
const tick=async()=>{for(let i=0;i<5;i++)await new Promise(setImmediate);};
function client(value:ReturnType<typeof session>|null=session(),chunked=false){
 const serverActor=verifiedActor;
 const encoded=value?'base64-'+Buffer.from(JSON.stringify(value)).toString('base64url'):'';
 const jar=new Map<string,string>(value?(chunked?[[key+'.0',encoded.slice(0,100)],[key+'.1',encoded.slice(100)]]:[[key,encoded]]):[]),writes:Array<{name:string;value:string;options:any}>=[];
 const supabase=createServerClient(origin,'synthetic-public-key',{global:{fetch:async(input,init)=>{
  const url=new URL(String(input));expect(url.origin).toBe(origin);const headers=new Headers(init?.headers);
  calls.push({path:url.pathname,subject:url.searchParams.get('user_id'),bearer:headers.get('authorization'),signal:init?.signal});
  if(url.pathname==='/auth/v1/token')return badRefresh?Response.json({msg:'Synthetic refresh denied'},{status:400}):Response.json(fresh);
  if(url.pathname==='/auth/v1/user'){if(gate)await gate.promise;return deny?Response.json({msg:'Synthetic revoked session'},{status:401}):Response.json(user(serverActor));}
  if(url.pathname==='/rest/v1/portal_users'){if(roleGate)await roleGate.promise;return roleFailure?Response.json({message:'Synthetic role unavailable'},{status:503}):Response.json(url.searchParams.get('user_id')==='eq.'+serverActor?(role?{role}:null):{role:'admin'});}
  throw Error('No provider access permitted: '+url.pathname);
 }},cookies:{getAll:()=>[...jar].map(([name,value])=>({name,value})),setAll:changes=>{for(const change of changes){writes.push(change);if(change.options?.maxAge===0)jar.delete(change.name);else jar.set(change.name,change.value);}}}});
 return{supabase,jar,writes,lookup:supabase as unknown as StudioPortalAccessLookup};
}
beforeEach(()=>{calls=[];deny=false;role='staff';roleFailure=false;badRefresh=false;gate=null;roleGate=null;verifiedActor=actor;fresh=session(token());});
afterEach(()=>{gate?.resolve();roleGate?.resolve();vi.restoreAllMocks();});
it('starts same-client own-role while fresh user is held, and admits neither result early',async()=>{
 const c=client();gate=deferred();let settled=false;const pending=resolveStudioPortalAccessState(c.lookup).then(value=>{settled=true;return value;});
 try{await tick();expect(calls.map(c=>c.path)).toContain('/rest/v1/portal_users');expect(settled).toBe(false);}finally{gate.resolve();}
 expect(await pending).toMatchObject({kind:'authenticated',session:{user:{id:actor},role:'staff'}});expect(calls).toHaveLength(2);expect(new Set(calls.map(c=>c.bearer)).size).toBe(1);
});
it('keeps the default resolver serial without reading a session hint',async()=>{
 const c=client();const hint=vi.spyOn(c.supabase.auth,'getSession');gate=deferred();const pending=resolvePortalAccessState(c.lookup);await tick();expect(calls.map(c=>c.path)).toEqual(['/auth/v1/user']);gate.resolve();expect((await pending).kind).toBe('authenticated');expect(hint).toHaveBeenCalledTimes(1); // REST token acquisition only.
});
it('discards an already-read own role when fresh user is revoked',async()=>{
 const c=client();deny=true;gate=deferred();const pending=resolveStudioPortalAccessState(c.lookup);await tick();expect(calls.some(c=>c.path.includes('portal_users'))).toBe(true);gate.resolve();expect(await pending).toEqual({kind:'unauthenticated'});expect(calls.every(c=>c.path.includes('/user')||c.path.includes('portal_users'))).toBe(true);
});
it('does not admit a verified user until the current role has completed',async()=>{
 roleGate=deferred();let settled=false;const pending=resolveStudioPortalAccessState(client().lookup).then(result=>{settled=true;return result;});await tick();expect(calls).toHaveLength(2);expect(settled).toBe(false);roleGate.resolve();expect((await pending).kind).toBe('authenticated');
});
it('cancels the speculative permission query when fresh user verification throws',async()=>{
 const c=client();vi.spyOn(c.supabase.auth,'getUser').mockRejectedValueOnce(Error('Synthetic transport failure'));await expect(resolveStudioPortalAccessState(c.lookup)).rejects.toThrow('Synthetic transport failure');await tick();expect(calls.filter(call=>call.path.includes('portal_users')).every(call=>call.signal?.aborted)).toBe(true);
});
it.each([null,'customer'])('retains current role denial for %s',async value=>{role=value;expect(await resolveStudioPortalAccessState(client().lookup)).toMatchObject({kind:'no_access',user:{id:actor}});});
it('retains current role-read failure',async()=>{roleFailure=true;expect(await resolveStudioPortalAccessState(client().lookup)).toMatchObject({kind:'lookup_failed',user:{id:actor}});});
it('refreshes once, forwards cookie chunks, and verifies user and role with the same fresh token',async()=>{
 const c=client(session(token(),now()-60),true);expect((await resolveStudioPortalAccessState(c.lookup)).kind).toBe('authenticated');expect(calls.filter(c=>c.path.endsWith('/token'))).toHaveLength(1);expect(calls.filter(c=>c.path.endsWith('/user'))).toHaveLength(1);expect(calls.filter(c=>c.path.includes('portal_users'))).toHaveLength(1);expect(calls.filter(c=>!c.path.endsWith('/token')).every(c=>c.bearer==='Bearer '+fresh.access_token)).toBe(true);expect(c.jar.has(key+'.0')).toBe(false);expect(c.jar.has(key+'.1')).toBe(false);expect(c.jar.has(key)).toBe(true);expect(c.writes.some(c=>c.name===key+'.0'&&c.options.maxAge===0)).toBe(true);
});
it('does not retry a failed refresh and retains cookie removal/unauthenticated result',async()=>{
 badRefresh=true;const c=client(session(token(),now()-60));expect(await resolveStudioPortalAccessState(c.lookup)).toEqual({kind:'unauthenticated'});expect(calls.map(c=>c.path)).toEqual(['/auth/v1/token']);expect(c.jar.has(key)).toBe(false);
});
it('preserves a thrown session failure without a fresh-request retry',async()=>{
 const c=client();vi.spyOn(c.supabase.auth,'getSession').mockRejectedValueOnce(Error('Synthetic session storage failure'));await expect(resolveStudioPortalAccessState(c.lookup)).rejects.toThrow('Synthetic session storage failure');expect(calls).toHaveLength(0);
});
it('keeps fresh identity denial ahead of a speculative permission error',async()=>{
 deny=true;roleFailure=true;expect(await resolveStudioPortalAccessState(client().lookup)).toEqual({kind:'unauthenticated'});
});
it('keeps no-session denial without creating network requests',async()=>{expect(await resolveStudioPortalAccessState(client(null).lookup)).toEqual({kind:'unauthenticated'});expect(calls).toHaveLength(0);});
it.each(['missing','malformed','mismatch'])('uses only fresh actual-user role for %s subject hint',async kind=>{
 const access=kind==='missing'?token(null):kind==='malformed'?'opaque-synthetic-token':token(other);const c=client(session(access));expect(await resolveStudioPortalAccessState(c.lookup)).toMatchObject({kind:'authenticated',session:{user:{id:actor},role:'staff'}});const reads=calls.filter(c=>c.path.includes('portal_users'));expect(reads.some(read=>read.subject==='eq.'+actor)).toBe(true);expect(reads).toHaveLength(kind==='mismatch'?2:1);if(kind==='mismatch')expect(reads.find(read=>read.subject==='eq.'+other)?.signal?.aborted).toBe(true);
});
it('performs fresh user and role again for a new request rather than retaining permission',async()=>{await resolveStudioPortalAccessState(client().lookup);role='admin';expect(await resolveStudioPortalAccessState(client().lookup)).toMatchObject({kind:'authenticated',session:{role:'admin'}});expect(calls.filter(c=>c.path.endsWith('/user'))).toHaveLength(2);expect(calls.filter(c=>c.path.includes('portal_users'))).toHaveLength(2);});
it('isolates overlapping callers and ignores the cached session user identity',async()=>{
 gate=deferred();const first=client();verifiedActor=other;const second=client(session(token(other)));const pendingA=resolveStudioPortalAccessState(first.lookup),pendingB=resolveStudioPortalAccessState(second.lookup);await tick();expect(calls.filter(call=>call.path.includes('portal_users'))).toHaveLength(2);gate.resolve();expect(await pendingA).toMatchObject({kind:'authenticated',session:{user:{id:actor}}});expect(await pendingB).toMatchObject({kind:'authenticated',session:{user:{id:other}}});expect(calls).toHaveLength(4);
});

it('aborts an actually dispatched held permission request on fresh user denial without waiting for that query',async()=>{
 gate=deferred();roleGate=deferred();const pending=resolveStudioPortalAccessState(client().lookup);await tick();const reads=calls.filter(call=>call.path.includes('portal_users'));expect(reads).toHaveLength(1);expect(reads[0].signal?.aborted).toBe(false);deny=true;gate.resolve();expect(await pending).toEqual({kind:'unauthenticated'});expect(reads[0].signal?.aborted).toBe(true);roleGate.resolve();
});
