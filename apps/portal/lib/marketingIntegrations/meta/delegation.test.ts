// @vitest-environment node
import { createHash, createHmac } from 'node:crypto';
import { afterEach, expect, it, vi } from 'vitest';
import { metaDelegation } from './delegation';
const key='synthetic-authority-key-'.repeat(3),period={start:'2026-08-01',end:'2026-08-07'};
function request(){const value={operation:'10000000-0000-4000-8000-000000000001',binding:'a'.repeat(64),query:createHash('sha256').update(JSON.stringify({kind:'marketing/meta',action:'refresh',period,retain:true})).digest('hex')};return new Request('https://source.test',{headers:{'x-velt-meta-operation':value.operation,'x-velt-meta-binding':value.binding,'x-velt-meta-query':value.query,'x-velt-meta-proof':createHmac('sha256',key).update(JSON.stringify(value)).digest('hex')}});}
afterEach(()=>vi.unstubAllEnvs());
it('checks only the fixed initiating-operation endpoint and fails on revocation',async()=>{
 vi.stubEnv('SANCTUARY_META_VELT_AUTHORITY_KEY',key);
 const fetcher=vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(null,{status:204})).mockResolvedValueOnce(new Response(null,{status:403}));
 const check=metaDelegation(request(),period,true,new AbortController().signal,fetcher);await check();await expect(check()).rejects.toThrow('revoked');
 expect(fetcher.mock.calls[0]?.[0]).toBe('https://velt.systems/api/connections/sanctuary-meta/authority');expect(fetcher.mock.calls[0]?.[1]?.redirect).toBe('error');
 expect(JSON.stringify(fetcher.mock.calls)).not.toContain(key);
});
it('rejects changing retention or dates in a signed request before any authority/provider access',()=>{
 vi.stubEnv('SANCTUARY_META_VELT_AUTHORITY_KEY',key);const fetcher=vi.fn<typeof fetch>();
 expect(()=>metaDelegation(request(),period,false,new AbortController().signal,fetcher)).toThrow();
 expect(()=>metaDelegation(request(),{...period,end:'2026-08-08'},true,new AbortController().signal,fetcher)).toThrow();expect(fetcher).not.toHaveBeenCalled();
});
