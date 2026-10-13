// @vitest-environment node
import { afterEach,expect,it,vi } from 'vitest';
import { authorizationUrl,validCallbackState,callback,scopes,json,sourceRpc,syntheticIngestRequest } from '../scripts/google-ads-setup.mjs';
afterEach(()=>vi.unstubAllGlobals());
it('dedicated consent flow pins scopes, callback, state and PKCE without incremental GA4 authority',()=>{
  const url=new URL(authorizationUrl('public-client','random-state','verifier'));
  expect(url.origin).toBe('https://accounts.google.com');expect(url.searchParams.get('redirect_uri')).toBe(callback);
  expect(url.searchParams.get('scope')).toBe(scopes.join(' '));expect(url.searchParams.get('include_granted_scopes')).toBe('false');
  expect(url.searchParams.get('code_challenge_method')).toBe('S256');expect(url.searchParams.get('code_challenge')).not.toContain('verifier');
});
it('rejects malformed multibyte callback state without an exception',()=>{
  expect(validCallbackState('é','a')).toBe(false);expect(validCallbackState('same','same')).toBe(true);expect(validCallbackState('','test')).toBe(false);
});
it.each([204,200])('accepts the void credential settlement HTTP %s before continuing account verification',async(status)=>{
  const fetcher=vi.fn().mockResolvedValueOnce(new Response(null,{status}))
    .mockResolvedValueOnce(Response.json({results:[{customer:{id:'synthetic-account'}}]}));
  vi.stubGlobal('fetch',fetcher);
  const checkpoint={p_actor:'synthetic-actor',p_binding:'synthetic-binding',p_run:'synthetic-run'};
  await expect(sourceRpc('https://fixture.supabase.co','synthetic-service','google_ads_credential_settled',checkpoint)).resolves.toBeNull();
  await expect(json('https://googleads.googleapis.com/v25/customers/synthetic/googleAds:search')).resolves.toEqual({results:[{customer:{id:'synthetic-account'}}]});
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(fetcher.mock.calls[0][0]).toBe('https://fixture.supabase.co/rest/v1/rpc/google_ads_credential_settled');
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual(checkpoint);
});
it('rejects unsuccessful empty settlement and malformed nonempty settlement responses',async()=>{
  const fetcher=vi.fn().mockResolvedValueOnce(new Response(null,{status:403})).mockResolvedValueOnce(new Response('not-json'));
  vi.stubGlobal('fetch',fetcher);
  await expect(sourceRpc('https://fixture.supabase.co','synthetic-service','google_ads_credential_settled',{})).rejects.toThrow('HTTP 403');
  await expect(sourceRpc('https://fixture.supabase.co','synthetic-service','google_ads_credential_settled',{})).rejects.toThrow();
});
it.each(['empty','malformed'])('still requires JSON for token, account and command responses when %s',async(kind)=>{
  vi.stubGlobal('fetch',vi.fn(async()=>kind==='empty'?new Response(null,{status:204}):new Response('not-json')));
  await expect(json('https://oauth2.googleapis.com/token')).rejects.toThrow();
  await expect(json('https://googleads.googleapis.com/v25/customers/synthetic/googleAds:search')).rejects.toThrow();
  await expect(sourceRpc('https://fixture.supabase.co','synthetic-service','google_ads_command',{p_action:'begin'})).rejects.toThrow();
});
it('preflights only synthetic data with explicit event-to-destination routing',async()=>{
  const fetcher=vi.fn().mockResolvedValue(Response.json({}));vi.stubGlobal('fetch',fetcher);
  const run={conversionCustomerId:'1234567890',managerId:'1234567891',actionId:'123'},now=new Date('2026-10-13T10:00:00Z');
  await json('https://datamanager.googleapis.com/v1/events:ingest',{method:'POST',body:JSON.stringify(syntheticIngestRequest(run,now))});
  const body=JSON.parse(fetcher.mock.calls[0][1].body as string);
  expect(body).toMatchObject({validateOnly:true,encoding:'HEX',destinations:[{reference:'sanctuary_closed_sale',
    operatingAccount:{accountType:'GOOGLE_ADS',accountId:run.conversionCustomerId},loginAccount:{accountType:'GOOGLE_ADS',accountId:run.managerId},productDestinationId:run.actionId}],
    events:[{destinationReferences:['sanctuary_closed_sale'],transactionId:'sanctuary-preflight-synthetic',eventTimestamp:now.toISOString(),conversionValue:1,currency:'NZD',
      consent:{adUserData:'CONSENT_STATUS_UNSPECIFIED',adPersonalization:'CONSENT_DENIED'}}]});
  expect(body.events[0].userData.userIdentifiers).toEqual([{emailAddress:expect.stringMatching(/^[a-f0-9]{64}$/)}]);
  expect(JSON.stringify(body)).not.toContain('synthetic@example.invalid');
  expect(syntheticIngestRequest({...run,managerId:undefined},now).destinations[0]).not.toHaveProperty('loginAccount');
});
