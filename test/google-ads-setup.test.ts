// @vitest-environment node
import { expect,it } from 'vitest';
import { authorizationUrl,validCallbackState,callback,scopes } from '../scripts/google-ads-setup.mjs';
it('dedicated consent flow pins scopes, callback, state and PKCE without incremental GA4 authority',()=>{
  const url=new URL(authorizationUrl('public-client','random-state','verifier'));
  expect(url.origin).toBe('https://accounts.google.com');expect(url.searchParams.get('redirect_uri')).toBe(callback);
  expect(url.searchParams.get('scope')).toBe(scopes.join(' '));expect(url.searchParams.get('include_granted_scopes')).toBe('false');
  expect(url.searchParams.get('code_challenge_method')).toBe('S256');expect(url.searchParams.get('code_challenge')).not.toContain('verifier');
});
it('rejects malformed multibyte callback state without an exception',()=>{
  expect(validCallbackState('é','a')).toBe(false);expect(validCallbackState('same','same')).toBe(true);expect(validCallbackState('','test')).toBe(false);
});
