// @vitest-environment node
import { expect, it, vi } from 'vitest';
import { verifyMeta } from './verify';
import type { MetaConfig } from './config';
import type { Boundary } from './boundary';
const config:MetaConfig={actor:'10000000-0000-4000-8000-000000000001',account:'123',app:'12',principal:'13',business:'14',token:'synthetic-token',appSecret:'synthetic-secret',expiresAt:new Date(Date.now()+86400000).toISOString(),binding:'a'.repeat(64)};
const boundary:Boundary=async(_step,execute)=>execute();
const token=()=>({data:{app_id:'12',user_id:'13',type:'SYSTEM_USER',is_valid:true,scopes:['ads_read'],expires_at:0,data_access_expires_at:0}});
const account=()=>({id:'act_123',account_id:'123',account_status:1,currency:'NZD',timezone_name:'Pacific/Auckland'});
const response=(body:unknown)=>Response.json([{code:200,body:JSON.stringify(body)}]);
it('verifies exact account/app/principal and scopes through fixed audited reads',async()=>{
 const fetcher=vi.fn<typeof fetch>().mockResolvedValueOnce(response(token())).mockResolvedValueOnce(response(account()));
 expect(await verifyMeta(config,boundary,fetcher)).toEqual({timezone:'Pacific/Auckland',currency:'NZD'});
 expect(fetcher).toHaveBeenCalledTimes(2);for(const [url,init] of fetcher.mock.calls){expect(url).toBe('https://graph.facebook.com/v26.0/');expect(init?.redirect).toBe('error');expect(String(url)).not.toContain('synthetic-token');}
});
it.each(['scope','principal','app','type','expired','wrong-account','inactive','timezone'])('rejects %s evidence',async kind=>{
 const t=token(),a=account();if(kind==='scope')t.data.scopes.push('ads_management');if(kind==='principal')t.data.user_id='999';if(kind==='app')t.data.app_id='99';if(kind==='type')t.data.type='USER';if(kind==='expired')t.data.expires_at=1;if(kind==='wrong-account')a.account_id='999';if(kind==='inactive')a.account_status=2;if(kind==='timezone')a.timezone_name='invalid';
 const fetcher=vi.fn<typeof fetch>().mockResolvedValueOnce(response(t)).mockResolvedValueOnce(response(a));await expect(verifyMeta(config,boundary,fetcher)).rejects.toThrow();
});
it('a denied boundary prevents provider access',async()=>{const fetcher=vi.fn<typeof fetch>();await expect(verifyMeta(config,async()=>{throw new Error('revoked');},fetcher)).rejects.toThrow();expect(fetcher).not.toHaveBeenCalled();});
