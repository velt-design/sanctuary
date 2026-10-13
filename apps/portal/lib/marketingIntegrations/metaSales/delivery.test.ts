import { expect, it, vi } from 'vitest';
import { sendMetaSale } from './delivery';
import type { MetaSaleEvent } from './sales';
const event:MetaSaleEvent={event_name:'Purchase',event_id:'sanctuary-scope-44444444-4444-4444-8444-444444444444',event_time:1791840000,action_source:'other',
  user_data:{em:['a'.repeat(64)]},custom_data:{currency:'NZD',value:15000,order_id:'sanctuary-scope-44444444-4444-4444-8444-444444444444'}};
const input={datasetId:'123',token:'synthetic_secret',signal:new AbortController().signal,before:async()=>undefined};
it('routes one event with no dry-run or customer URL and confirms exact received count',async()=>{
  const fetcher=vi.fn(async()=>Response.json({events_received:1,messages:['private echoed text'],fbtrace_id:'safe_trace'}));
  expect(await sendMetaSale({...input,fetcher},event)).toEqual({receiptId:'safe_trace',warningCount:1});
  const [url,request]=fetcher.mock.calls[0] as unknown as [string,RequestInit];
  expect(url).toBe('https://graph.facebook.com/v26.0/123/events');expect(request.redirect).toBe('error');
  expect(JSON.parse(request.body as string)).toEqual({data:[event]});expect(url).not.toContain(input.token);
});
it.each([{events_received:0,fbtrace_id:'safe'},{success:true},{events_received:2,fbtrace_id:'safe'},{events_received:1,fbtrace_id:'contains private text'}])('does not turn malformed or partial confirmation into acceptance',async body=>{
  await expect(sendMetaSale({...input,fetcher:async()=>Response.json(body)},event)).rejects.toMatchObject({code:'RESPONSE_UNCONFIRMED'});
});
it('keeps only bounded numeric error codes and never echoes provider text',async()=>{
  await expect(sendMetaSale({...input,fetcher:async()=>Response.json({error:{code:4,error_subcode:12,is_transient:true,message:'customer@example.test'}},{status:400})},event))
    .rejects.toMatchObject({code:'META_REJECTED',retryable:true,diagnostics:{httpStatus:400,providerCode:4,subcode:12},message:'META_REJECTED'});
});
it('does not call the provider when the current source check rejects the frozen sale',async()=>{
  const fetcher=vi.fn();await expect(sendMetaSale({...input,before:async()=>{throw Error('changed');},fetcher},event)).rejects.toThrow('changed');expect(fetcher).not.toHaveBeenCalled();
});
it('retains uncertainty for transport and bounded-body failures',async()=>{
  await expect(sendMetaSale({...input,fetcher:async()=>{throw Error('private request');}},event)).rejects.toMatchObject({code:'TRANSPORT_UNCERTAIN',retryable:true});
  await expect(sendMetaSale({...input,fetcher:async()=>new Response('x'.repeat(32769))},event)).rejects.toMatchObject({code:'RESPONSE_UNCONFIRMED'});
});
