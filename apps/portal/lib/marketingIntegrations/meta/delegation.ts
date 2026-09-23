import 'server-only';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import type { MetaPeriod } from './report';

// This checks the originating Velt operation, not Meta credentials or business
// facts. Other Sanctuary callers can authorize the shared reader locally.
export function metaDelegation(request:Request,period:MetaPeriod,retain:boolean,signal:AbortSignal,fetcher:typeof fetch=fetch) {
  const value=z.object({operation:z.uuid(),binding:z.string().regex(/^[a-f0-9]{64}$/),query:z.string().regex(/^[a-f0-9]{64}$/)}).strict().parse({
    operation:request.headers.get('x-velt-meta-operation'),binding:request.headers.get('x-velt-meta-binding'),query:request.headers.get('x-velt-meta-query')});
  const key=z.string().min(43).max(256).parse(process.env.SANCTUARY_META_VELT_AUTHORITY_KEY);
  const signature=createHmac('sha256',key).update(JSON.stringify(value)).digest('hex');
  const supplied=z.string().regex(/^[a-f0-9]{64}$/).parse(request.headers.get('x-velt-meta-proof'));
  const expectedQuery=createHash('sha256').update(JSON.stringify({kind:'marketing/meta',action:'refresh',period,retain})).digest('hex');
  if(!timingSafeEqual(Buffer.from(signature),Buffer.from(supplied))||value.query!==expectedQuery)throw new Error('Delegation unavailable.');
  return async()=>{
    signal.throwIfAborted();
    const response=await fetcher('https://velt.systems/api/connections/sanctuary-meta/authority',{method:'POST',cache:'no-store',redirect:'error',
      signal:AbortSignal.any([signal,AbortSignal.timeout(5000)]),headers:{'content-type':'application/json','x-velt-meta-proof':signature},body:JSON.stringify(value)});
    await response.body?.cancel();if(response.status!==204)throw new Error('Delegation revoked.');
  };
}
