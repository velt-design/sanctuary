import {afterEach,expect,it,vi} from 'vitest';
import {studioOpeningResponse} from './studioOpening.server';
import type {StudioAuthoringResponse} from './authoringRequest.server';
import {STUDIO_OPENING_PRICE_MS} from './studioOpening';
const scope={actorId:'actor',role:'staff' as const,projectId:'p',estimateId:'e'};
const authoring={state:'unavailable',estimate:{id:'e',projectId:'p',versionLabel:'V1',updatedAt:null,requiresNewRevision:false},view:null,reason:'Unavailable',nextAction:'unavailable'} satisfies StudioAuthoringResponse;
const frame=async(reader:ReadableStreamDefaultReader<Uint8Array>)=>JSON.parse(new TextDecoder().decode((await reader.read()).value));
afterEach(()=>vi.useRealTimers());

it('yields before starting canonical price preparation and does not await its tail to deliver authoring',async()=>{
 vi.useFakeTimers();let release!:(r:Response)=>void;
 const calculate=vi.fn(()=>new Promise<Response>(resolve=>{release=resolve;})),response=studioOpeningResponse({request:new Request('http://localhost/studio'),scope,authoring,binding:null,calculate});
 const reader=response.body!.getReader();expect(await frame(reader)).toMatchObject({kind:'authoring',authoring});expect(calculate).not.toHaveBeenCalled();
 await vi.advanceTimersByTimeAsync(0);expect(calculate).toHaveBeenCalledTimes(1);release(Response.json({error:'No price'},{status:503}));
 expect(await frame(reader)).toMatchObject({kind:'price',result:{ok:false,error:'No price'}});expect((await reader.read()).done).toBe(true);reader.releaseLock();
 expect(response.headers.get('cache-control')).toBe('private, no-store');expect(response.headers.get('vary')).toBe('Accept');
});

it.each(['timeout','abort','cancel','throw'])('bounds a %s tail and cancels its request-local work',async cause=>{
 vi.useFakeTimers();let signal!:AbortSignal,release!:(r:Response)=>void;
 const retire=vi.fn(),stop=new AbortController(),calculate=vi.fn((s:AbortSignal)=>{signal=s;if(cause==='throw')throw Error('private backend detail');return new Promise<Response>(resolve=>{release=resolve;});});
 const response=studioOpeningResponse({request:new Request('http://localhost/studio',{signal:stop.signal}),scope,authoring,binding:null,calculate,retire}),reader=response.body!.getReader();
 await frame(reader);await vi.advanceTimersByTimeAsync(0);
 if(cause==='timeout')await vi.advanceTimersByTimeAsync(STUDIO_OPENING_PRICE_MS);
 if(cause==='abort')stop.abort();if(cause==='cancel')await reader.cancel();
 if(cause==='timeout'||cause==='throw'){const tail=await frame(reader);expect(tail).toMatchObject({kind:'price',result:{ok:false}});expect(JSON.stringify(tail)).not.toContain('private backend detail');}
 expect(signal.aborted).toBe(true);expect(retire).toHaveBeenCalledOnce();expect((await reader.read()).done).toBe(true);
 if(cause!=='throw'){release(Response.json({status:'priced',amount:999}));await vi.advanceTimersByTimeAsync(0);expect((await reader.read()).done).toBe(true);}
 reader.releaseLock();
});

it.each(['price-response','price-error','price-timeout','request-aborted','reader-canceled'] as const)('reports %s once after its existing terminal transition',async outcome=>{
 vi.useFakeTimers();let release!:(response:Response)=>void;
 const stop=new AbortController(),onTerminal=vi.fn(),retire=vi.fn(),response=studioOpeningResponse({request:new Request('http://localhost/studio',{signal:stop.signal}),scope,authoring,binding:null,retire,onTerminal,calculate:()=>new Promise(resolve=>{release=resolve;})}),reader=response.body!.getReader();
 await frame(reader);expect(onTerminal).not.toHaveBeenCalled();await vi.advanceTimersByTimeAsync(0);
 if(outcome==='request-aborted')stop.abort();
 else if(outcome==='reader-canceled')await reader.cancel();
 else if(outcome==='price-timeout')await vi.advanceTimersByTimeAsync(STUDIO_OPENING_PRICE_MS);
 else release(outcome==='price-response'?Response.json({status:'priced'}):Response.json({error:'No price'},{status:503}));
 if(outcome!=='request-aborted'&&outcome!=='reader-canceled')expect((await frame(reader)).kind).toBe('price');
 expect((await reader.read()).done).toBe(true);expect(onTerminal).toHaveBeenCalledExactlyOnceWith(outcome);expect(retire).toHaveBeenCalledOnce();
 release(Response.json({status:'priced'}));stop.abort();await vi.advanceTimersByTimeAsync(0);expect(onTerminal).toHaveBeenCalledOnce();reader.releaseLock();
});

it('isolates throwing terminal observers from the successful two-record stream',async()=>{
 const response=studioOpeningResponse({request:new Request('http://localhost/studio'),scope,authoring,binding:null,onTerminal:()=>{throw Error('Broken sink');},calculate:async()=>Response.json({status:'priced'})});
 const records=(await response.text()).trim().split('\n').map(line=>JSON.parse(line));expect(records).toHaveLength(2);expect(records[1].result).toEqual({ok:true,price:{status:'priced'}});
});

it('calls an HTTP-successful unavailable result a price response without claiming a business price',async()=>{
 const onTerminal=vi.fn();
 const response=studioOpeningResponse({request:new Request('http://localhost/studio'),scope,authoring,binding:null,onTerminal,calculate:async()=>Response.json({status:'unavailable',amount:null,reason:'Selected inputs need attention.'})});
 const records=(await response.text()).trim().split('\n').map(line=>JSON.parse(line));
 expect(records[1].result).toMatchObject({ok:true,price:{status:'unavailable'}});
 expect(onTerminal).toHaveBeenCalledExactlyOnceWith('price-response');
});
