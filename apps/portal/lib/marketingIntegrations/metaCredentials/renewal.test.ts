// @vitest-environment node
import { expect, it, vi } from 'vitest';
import { credentialConfig, fingerprint, type MetaCredentialConfig } from './config';
import { metaCredentialSession } from './lifecycle';
import { metaCredentialVault, type SavedMetaCredential } from './vault';
import { metaCredentialProvider, type ExchangeTransport } from './provider';
const id='44444444-4444-4444-8444-000000000090',token='synthetic_previous_'.repeat(3),next='synthetic_replacement_'.repeat(3);
const expiresAt=new Date(Math.floor(Date.now()/1000)*1000+10*86400000).toISOString(), nextExpiry=new Date(Math.floor(Date.now()/1000)*1000+60*86400000).toISOString();
const identity={capability:'reports' as const,actorId:id,appId:'123',principalId:'456',businessId:'789',targetId:'101',scopes:['ads_read','public_profile'],vaultId:'a'.repeat(26),itemId:'b'.repeat(26)};
const config:MetaCredentialConfig={identity,binding:fingerprint(JSON.stringify(identity)),renewalEnabled:true,vaultToken:'synthetic_vault',appSecret:'synthetic_app_secret'};
const saved:SavedMetaCredential={version:1,binding:config.binding,accessToken:token,expiresAt,dataAccessExpiresAt:null};
function fixture(state='READY') {
  const lease={operation:id,state,tokenHash:fingerprint(token),vaultVersion:3,expiresAt,dataAccessExpiresAt:null,
    candidateHash:state==='VAULT_PENDING'?fingerprint(next):null,candidateExpiresAt:state==='VAULT_PENDING'?nextExpiry:null,candidateDataAccessExpiresAt:null,candidateVaultVersion:state==='VAULT_PENDING'?3:null};
  const command=vi.fn(async(action:string):Promise<any>=>action==='begin'?lease:{});
  const vault={read:vi.fn(async()=>({credential:saved,version:3})),write:vi.fn(async()=>({version:4}))};
  const provider={verify:vi.fn(async(t:string)=>({expiresAt:t===token?expiresAt:nextExpiry,dataAccessExpiresAt:null})),refresh:vi.fn(async()=>next)};
  return {config,command,vault,provider,signal:new AbortController().signal};
}
it('renews through persisted exchange and vault checkpoints without persisting tokens',async()=>{
  const f=fixture();expect(await metaCredentialSession(f,'renew')).toEqual({renewed:true});
  const actions=f.command.mock.calls.map(([a])=>a);expect(actions.indexOf('exchange_pending')).toBeLessThan(actions.indexOf('vault_pending'));
  expect(actions.indexOf('vault_pending')).toBeLessThan(actions.indexOf('activate'));expect(JSON.stringify(f.command.mock.calls)).not.toContain(token);
  expect(JSON.stringify(f.command.mock.calls)).not.toContain(next);expect(f.vault.write).toHaveBeenCalledOnce();
});
it('does not access the vault/provider when renewal is not due',async()=>{
  const f=fixture();f.command.mockResolvedValue({skip:true});expect(await metaCredentialSession(f,'renew')).toEqual({renewed:false});
  expect(f.vault.read).not.toHaveBeenCalled();expect(f.provider.refresh).not.toHaveBeenCalled();
});
it('does not enter source or vault maintenance while the environment switch is off',async()=>{
  const f=fixture();f.config={...f.config,renewalEnabled:false};await expect(metaCredentialSession(f,'renew')).rejects.toThrow('disabled');expect(f.command).not.toHaveBeenCalled();
});
it('quarantines a returned replacement that fails verification instead of automatically exchanging again',async()=>{
  const f=fixture();f.provider.verify.mockResolvedValueOnce({expiresAt,dataAccessExpiresAt:null}).mockRejectedValueOnce(Error('scope changed'));
  await expect(metaCredentialSession(f,'renew')).rejects.toThrow('requires review');expect(f.vault.write).not.toHaveBeenCalled();
  expect(f.command.mock.calls.some(([action])=>action==='quarantine')).toBe(true);
});
it.each(['refresh','write'] as const)('keeps %s uncertainty and never repeats an effect in the same run',async(step)=>{
  const f=fixture();if(step==='refresh')f.provider.refresh.mockRejectedValue(new Error('private-token'));else f.vault.write.mockRejectedValue(new Error('private-token'));
  await expect(metaCredentialSession(f,'renew')).rejects.toThrow('requires review');
  expect(f.provider.refresh).toHaveBeenCalledOnce();expect(f.vault.write).toHaveBeenCalledTimes(step==='write'?1:0);
  expect(f.command.mock.calls.some(([a])=>a==='activate')).toBe(false);expect(f.command.mock.calls.at(-1)?.[0]).toBe('failed');
});
it('reconciles only the exact acknowledged candidate after lost vault acknowledgement',async()=>{
  const f=fixture('VAULT_PENDING');f.vault.read.mockResolvedValue({credential:{...saved,accessToken:next,expiresAt:nextExpiry},version:4});
  expect(await metaCredentialSession(f,'reconcile')).toEqual({renewed:true});expect(f.provider.refresh).not.toHaveBeenCalled();expect(f.vault.write).not.toHaveBeenCalled();
});
it('does not treat an old vault read as proof that an uncertain write never happened',async()=>{
  const f=fixture('VAULT_PENDING');await expect(metaCredentialSession(f,'reconcile')).rejects.toThrow('requires review');
  expect(f.command.mock.calls.some(([a])=>a==='activate')).toBe(false);expect(f.vault.write).not.toHaveBeenCalled();
});
it('can reconcile a lost exchange response against the still-valid unchanged old token',async()=>{
  const f=fixture('EXCHANGE_PENDING');expect(await metaCredentialSession(f,'reconcile')).toEqual({renewed:false});
  expect(f.command.mock.calls.some(([a])=>a==='exchange_reconciled')).toBe(true);expect(f.provider.refresh).not.toHaveBeenCalled();
});
it('rejects a candidate attached to a different prior vault revision',async()=>{
  const f=fixture('VAULT_PENDING');const lease=await f.command('begin');
  f.command.mockResolvedValue({...lease,candidateVaultVersion:2});
  f.vault.read.mockResolvedValue({credential:{...saved,accessToken:next,expiresAt:nextExpiry},version:4});
  await expect(metaCredentialSession(f,'reconcile')).rejects.toThrow('requires review');
  expect(f.provider.verify).not.toHaveBeenCalled();expect(f.vault.write).not.toHaveBeenCalled();
});
it('denies identity or expiry drift before exposing a use token',async()=>{
  const f=fixture();f.provider.verify.mockResolvedValue({expiresAt:nextExpiry,dataAccessExpiresAt:null});
  await expect(metaCredentialSession(f,'use')).rejects.toThrow();expect(f.provider.refresh).not.toHaveBeenCalled();
});
it('fences revocation immediately before a vault write',async()=>{
  const f=fixture();let pending=false;const original=f.command.getMockImplementation()!;
  f.command.mockImplementation(async(action)=>{if(action==='vault_pending')pending=true;else if(action==='check'&&pending)throw Error('revoked');return original(action);});
  await expect(metaCredentialSession(f,'renew')).rejects.toThrow();expect(f.vault.write).not.toHaveBeenCalled();
});
it('uses a dedicated concealed item and never retries an uncertain put',async()=>{
  const item={id:identity.itemId,vaultId:identity.vaultId,category:'api',version:3,fields:[{id:'meta_credential',fieldType:'concealed',value:JSON.stringify(saved)}]};
  const put=vi.fn(async()=>{throw Error('uncertain');}),get=vi.fn(async()=>item);
  const vault=metaCredentialVault(config,{apiCredentialsCategory:'api',concealedFieldType:'concealed',createClient:async()=>({items:{get,put}})});
  await vault.read();await expect(vault.write({...saved,accessToken:next})).rejects.toThrow();await expect(vault.write(saved)).rejects.toThrow();
  await expect(vault.read()).rejects.toThrow();expect(put).toHaveBeenCalledOnce();expect(item.fields[0].value).toBe(JSON.stringify(saved));
});
function providerFixture(capability:'reports'|'sales'='reports') {
  const pin={...config,identity:{...identity,capability}};
  const debug={app_id:'123',user_id:'456',type:'SYSTEM_USER',is_valid:true,scopes:['public_profile','ads_read'],expires_at:Date.parse(expiresAt)/1000,data_access_expires_at:0,granular_scopes:[{scope:'ads_read',target_ids:[]}]};
  const fetcher=vi.fn<typeof fetch>(async(_url,init)=>{
    const batch=JSON.parse(new URLSearchParams(String(init?.body)).get('batch')!);
    const body=batch[0].relative_url.startsWith('debug_token')?{data:debug}:{id:'act_101',account_id:'101',account_status:1,business:{id:'789'}};
    return Response.json([{code:200,body:JSON.stringify(body)}]);
  });
  const exchange=vi.fn<ExchangeTransport>(async()=>({access_token:next})),before=vi.fn(async()=>{});
  return {debug,fetcher,exchange,before,provider:metaCredentialProvider(pin,new AbortController().signal,fetcher,exchange)};
}
it('verifies exact report scope and account business, accepting empty granular targets',async()=>{
  const f=providerFixture();expect(await f.provider.verify(token,f.before)).toEqual({expiresAt,dataAccessExpiresAt:null});expect(f.fetcher).toHaveBeenCalledTimes(2);expect(f.before).toHaveBeenCalledTimes(2);
});
it.each(['scope','principal','target','expired'] as const)('rejects %s drift without requesting new permissions',async(change)=>{
  const f=providerFixture();if(change==='scope')f.debug.scopes.push('ads_management');if(change==='principal')f.debug.user_id='999';
  if(change==='target')f.debug.granular_scopes[0].target_ids=['999'] as never[];if(change==='expired')f.debug.expires_at=1;
  await expect(f.provider.verify(token,f.before)).rejects.toThrow();expect(f.fetcher).toHaveBeenCalledOnce();expect(f.exchange).not.toHaveBeenCalled();
});
it('does not fabricate a dataset probe or send an event to verify a sales token',async()=>{
  const f=providerFixture('sales');await f.provider.verify(token,f.before);expect(f.fetcher).toHaveBeenCalledOnce();
});
it('preserves provider zero expiry as nonexpiring, separately from local approval and data access',async()=>{
  const f=providerFixture('sales');f.debug.expires_at=0;expect(await f.provider.verify(token,f.before)).toEqual({expiresAt:null,dataAccessExpiresAt:null});expect(f.exchange).not.toHaveBeenCalled();
});
it('checks the caller delegation again before releasing any credential',async()=>{
  const f=fixture(),authorize=vi.fn(async()=>{throw Error('Velt stopped');});
  await expect(metaCredentialSession({...f,authorize},'use')).rejects.toThrow();expect(f.vault.read).not.toHaveBeenCalled();expect(f.provider.verify).not.toHaveBeenCalled();
});
it('pins documented OAuth GET in the native adapter and never puts it through fetch',async()=>{
  const f=providerFixture();expect(await f.provider.refresh(token,f.before)).toBe(next);expect(f.fetcher).not.toHaveBeenCalled();
  const options=f.exchange.mock.calls[0][0] as any;expect(options.hostname).toBe('graph.facebook.com');expect(options.method).toBe('GET');
  const query=new URL('https://graph.facebook.com'+options.path).searchParams;expect(query.get('set_token_expires_in_60_days')).toBe('true');expect(query.get('fb_exchange_token')).toBe(token);
  f.exchange.mockRejectedValue(Error('url-with-private-token'));await expect(f.provider.refresh(token,f.before)).rejects.toThrow('exchange outcome uncertain');
});
it('stable binding excludes changing token and service-account secrets, and report scopes remain narrow',()=>{
  const env={SANCTUARY_META_VAULT_ENABLED:'true',SANCTUARY_META_ACTOR_ID:id,SANCTUARY_META_APP_ID:'123',SANCTUARY_META_PRINCIPAL_ID:'456',SANCTUARY_META_BUSINESS_ID:'789',SANCTUARY_META_ACCOUNT_ID:'101',
    SANCTUARY_META_EXPECTED_SCOPES:'public_profile ads_read',SANCTUARY_META_VAULT_ID:identity.vaultId,SANCTUARY_META_CREDENTIAL_ITEM_ID:identity.itemId,SANCTUARY_META_BINDING_SHA256:config.binding,
    SANCTUARY_META_SERVICE_ACCOUNT_TOKEN:'synthetic',SANCTUARY_META_APP_SECRET:config.appSecret};
  expect(credentialConfig('reports',env).binding).toBe(config.binding);expect(credentialConfig('reports',{...env,SANCTUARY_META_SERVICE_ACCOUNT_TOKEN:'rotated'}).binding).toBe(config.binding);
  expect(()=>credentialConfig('reports',{...env,SANCTUARY_META_EXPECTED_SCOPES:'ads_read ads_management'})).toThrow();
});
