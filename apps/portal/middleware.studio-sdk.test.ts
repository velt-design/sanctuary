// @vitest-environment node
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {generateKeyPairSync,sign,createHmac} from 'node:crypto';
import {createServerClient} from '@supabase/ssr';
import {NextRequest} from 'next/server';
import {middleware as proxy} from './middleware';
import {STUDIO_EDIT_CALLBACK_HEADER} from './lib/designStudio/studioEditRoute';

const pair=generateKeyPairSync('ec',{namedCurve:'P-256'}),wrong=generateKeyPairSync('ec',{namedCurve:'P-256'});
const jwk={...pair.publicKey.export({format:'jwk'}),kid:'studio-synthetic-es256',alg:'ES256',use:'sig'};
const actor='10000000-0000-4000-8000-000000000099';
const path='/staff/design-studio/proj_10000000-0000-4000-8000-000000000001/est_20000000-0000-4000-8000-000000000001/edit?intent=duplicate&name=Courtyard';
const user={id:actor,aud:'authenticated',role:'authenticated',email:'synthetic@example.invalid',app_metadata:{},user_metadata:{},created_at:'2026-01-01T00:00:00Z'};
const now=()=>Math.floor(Date.now()/1000);
function jwt(exp=now()+3600,key=pair.privateKey,alg='ES256'){
 const header=Buffer.from(JSON.stringify({alg,kid:jwk.kid,typ:'JWT'})).toString('base64url');
 const payload=Buffer.from(JSON.stringify({sub:actor,iss:'https://studio-sdk.invalid/auth/v1',aud:'authenticated',iat:now(),exp,role:'authenticated'})).toString('base64url');
 const input=header+'.'+payload,signature=alg==='HS256'?createHmac('sha256','synthetic-only').update(input).digest():sign('sha256',Buffer.from(input),{key,dsaEncoding:'ieee-p1363'});
 return input+'.'+signature.toString('base64url');
}
const session=(access=jwt(),expires=now()+3600)=>({access_token:access,refresh_token:'synthetic-refresh',expires_at:expires,expires_in:3600,token_type:'bearer',user});
const key='sb-studio-sdk-auth-token';
let calls:Array<{path:string;method:string;fresh:boolean}>,fresh:ReturnType<typeof session>,denyUser:boolean,badRefresh:boolean;
const interceptedFetch=async(input:RequestInfo|URL,init?:RequestInit)=>{
 const url=new URL(String(input));expect(url.origin).toBe('https://studio-sdk.invalid');
 calls.push({path:url.pathname,method:init?.method??'GET',fresh:new Headers(init?.headers).get('authorization')==='Bearer '+fresh.access_token});
 if(url.pathname==='/auth/v1/.well-known/jwks.json')return Response.json({keys:[jwk]});
 if(url.pathname==='/auth/v1/token')return badRefresh?Response.json({msg:'Synthetic refresh denied'},{status:400}):Response.json(fresh);
 if(url.pathname==='/auth/v1/user')return denyUser?Response.json({msg:'Synthetic revoked user'},{status:401}):Response.json(user);
 if(url.pathname==='/rest/v1/portal_users')return Response.json({role:'staff'});
 throw Error('Unexpected synthetic request '+url.pathname);
};
function request(value=session(),chunked=false,route=path){
 const encoded='base64-'+Buffer.from(JSON.stringify(value)).toString('base64url');
 const cookie=chunked?`${key}.0=${encoded.slice(0,120)}; ${key}.1=${encoded.slice(120)}`:`${key}=${encoded}`;
 return new NextRequest('https://local.invalid'+route,{headers:{cookie,[STUDIO_EDIT_CALLBACK_HEADER]:'/admin/imports'}});
}
beforeEach(()=>{
 vi.stubEnv('ENABLE_PORTAL_DESIGN_STUDIO','1');vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL','https://studio-sdk.invalid');vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY','synthetic-public-key');
 calls=[];fresh=session();denyUser=false;badRefresh=false;vi.stubGlobal('fetch',interceptedFetch);
});
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});

it('runs actual SDK session refresh without reading JWKS, user or database-role authority',async()=>{
 const response=await proxy(request());expect(response.headers.get('x-middleware-next')).toBe('1');
 expect(response.headers.get('x-middleware-request-'+STUDIO_EDIT_CALLBACK_HEADER)).toBe(path);expect(response.headers.get(STUDIO_EDIT_CALLBACK_HEADER)).toBeNull();
 expect(calls.some(call=>call.path.includes('/user')||call.path.includes('/portal_users'))).toBe(false);
 const again=await proxy(request());expect(again.headers.get('x-middleware-next')).toBe('1');expect(calls).toHaveLength(0);
});
it.each(['forged-signature','expired-JWT'])('treats %s cookie data only as refresh routing and leaves fresh server denial authoritative',async mode=>{
 denyUser=true;const req=request(session(mode==='forged-signature'?jwt(now()+3600,wrong.privateKey):jwt(now()-60),now()+3600));
 const response=await proxy(req);expect(response.headers.get('x-middleware-next')).toBe('1');expect(calls).toHaveLength(0);
 const rendered=createServerClient('https://studio-sdk.invalid','synthetic-public-key',{cookies:{getAll:()=>req.cookies.getAll(),setAll:()=>{}}});
 expect((await rendered.auth.getUser()).error).not.toBeNull();expect(calls.map(call=>call.path)).toEqual(['/auth/v1/user']);
});
it('forwards actual SDK refreshed cookies and removed chunks to render, and persists the same result on the response',async()=>{
 const req=request(session(jwt(now()-60),now()-60),true),response=await proxy(req);
 expect(response.headers.get('x-middleware-next')).toBe('1');expect(calls.filter(call=>call.path==='/auth/v1/token')).toHaveLength(1);
 expect(req.cookies.has(key+'.0')).toBe(false);expect(req.cookies.has(key+'.1')).toBe(false);expect(req.cookies.has(key)).toBe(true);
 expect(response.headers.get('x-middleware-request-cookie')).toBe(req.headers.get('cookie'));
 expect(response.cookies.get(key)?.value).toBe(req.cookies.get(key)?.value);expect(response.cookies.get(key+'.0')?.maxAge).toBe(0);expect(response.cookies.get(key+'.1')?.maxAge).toBe(0);
 const rendered=createServerClient('https://studio-sdk.invalid','synthetic-public-key',{cookies:{getAll:()=>req.cookies.getAll(),setAll:()=>{throw Error('Render must not refresh the old token again');}}});
 expect((await rendered.auth.getUser()).error).toBeNull();expect(calls.filter(call=>call.path==='/auth/v1/token')).toHaveLength(1);expect(calls.at(-1)).toMatchObject({path:'/auth/v1/user',fresh:true});
 // A following independent API request still verifies user and role freshly.
 const api=new NextRequest('https://local.invalid/api/unchanged',{headers:{cookie:`${key}=${response.cookies.get(key)!.value}`}});
 const apiClient=createServerClient('https://studio-sdk.invalid','synthetic-public-key',{cookies:{getAll:()=>api.cookies.getAll(),setAll:()=>{throw Error('Fresh API must not refresh twice');}}});
 expect((await apiClient.auth.getUser()).error).toBeNull();expect((await apiClient.from('portal_users').select('role').eq('user_id',actor).maybeSingle()).data).toEqual({role:'staff'});
 expect(calls.filter(call=>call.path==='/auth/v1/user')).toHaveLength(2);expect(calls.filter(call=>call.path==='/rest/v1/portal_users')).toHaveLength(1);
});
it('keeps actual SDK refresh failure closed and persists removal of invalid cookies',async()=>{
 badRefresh=true;const response=await proxy(request(session(jwt(now()-60),now()-60)));expect(response.status).toBe(307);expect(response.cookies.get(key)?.maxAge).toBe(0);
});
it.each(['HS256','no-WebCrypto'])('does not treat a %s session as permission before the independent server check',async fallback=>{
 denyUser=true;if(fallback==='no-WebCrypto')vi.stubGlobal('crypto',{});
 const req=request(session(fallback==='HS256'?jwt(now()+3600,pair.privateKey,'HS256'):jwt())),response=await proxy(req);
 expect(response.status).toBe(200);expect(calls).toHaveLength(0);
 const rendered=createServerClient('https://studio-sdk.invalid','synthetic-public-key',{cookies:{getAll:()=>req.cookies.getAll(),setAll:()=>{}}});
 expect((await rendered.auth.getUser()).error).not.toBeNull();expect(calls.some(call=>call.path==='/auth/v1/user')).toBe(true);expect(calls.some(call=>call.path.includes('portal_users'))).toBe(false);
});
