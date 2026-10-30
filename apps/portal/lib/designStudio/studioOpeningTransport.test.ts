import {afterEach,expect,it,vi} from 'vitest';
import {readStudioOpening,studioOpeningPriceResult} from './studioOpeningTransport';
import {STUDIO_OPENING_TYPE,STUDIO_OPENING_FRAME_BYTES,studioOpeningPrice,type StudioOpeningBinding} from './studioOpening';

const scope={actorId:'actor',role:'staff' as const,projectId:'project',estimateId:'estimate'};
const binding:StudioOpeningBinding={...scope,designId:'design',revision:1,requestKey:'complete-key'};
const authoring={state:'ready',estimate:{id:'estimate',projectId:'project',requiresNewRevision:false},view:{designId:'design',revision:1},nextAction:'edit'};
const price={requestKey:binding.requestKey,designId:'design',revision:1,selectionDigest:'selection',publicationId:'publication',versionNumber:1,publicationContentHash:'content',pricingDigest:'price',status:'priced' as const,amount:123};
const first=()=>({kind:'authoring',scope,authoring,binding});
const second=()=>({kind:'price',binding,result:{ok:true,price}});
const encode=(value:unknown)=>new TextEncoder().encode(JSON.stringify(value)+'\n');
it('admits only a staff-safe positive whole site-day estimate on either priced or travel-pending tails',()=>{
 for(const status of ['priced','unavailable']){
  const body={...price,status,amount:status==='priced'?123:null,installationEstimate:{siteDays:3}};
  expect(studioOpeningPriceResult({ok:true,price:body},binding)).toEqual({ok:true,price:body});
  for(const installationEstimate of [{siteDays:0},{siteDays:1.5},{siteDays:3,crewHours:20},{siteDays:'3'},null])
   expect(()=>studioOpeningPriceResult({ok:true,price:{...body,installationEstimate}},binding)).toThrow();
 }
});
function wire(){
 let controller!:ReadableStreamDefaultController<Uint8Array>;
 const cancel=vi.fn(),body=new ReadableStream<Uint8Array>({start(c){controller=c;},cancel});
 const fetcher=vi.fn(async(_path:string,_init:RequestInit)=>new Response(body,{headers:{'content-type':STUDIO_OPENING_TYPE}}));vi.stubGlobal('fetch',fetcher);
 return{controller,body,cancel,fetcher,start:()=>readStudioOpening('/studio',scope,new AbortController().signal)};
}
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();});

it('admits a public shell only from the fresh response scope, without a browser actor or role',async()=>{
 const w=wire(),pending=readStudioOpening('/studio',{projectId:'project',estimateId:'estimate'},new AbortController().signal);
 w.controller.enqueue(encode(first()));const opened=await pending;
 expect(opened.scope).toEqual(scope);
 w.controller.enqueue(encode(second()));w.controller.close();
 expect(await opened.openingPrice!.result).toEqual({ok:true,price});
});

it.each(['unauthenticated','no_access','lookup_failed'] as const)('keeps typed %s denial separate from missing target and generic failures',async kind=>{
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json({error:'Unauthorized'},{status:401,headers:{'x-studio-access-state':kind}})));
 await expect(readStudioOpening('/studio',{projectId:'project',estimateId:'estimate'},new AbortController().signal)).rejects.toMatchObject({kind});
});

it.each([{theme:{'--portal-accent':'#123456;bad'}},{theme:{'wrong-key':'#123456'}},{theme:{'--portal-accent':123}}])('rejects malformed presentation before settling the first frame: %j',async appearance=>{
 const w=wire(),pending=w.start();w.controller.enqueue(encode({...first(),presentation:appearance}));
 await expect(pending).rejects.toThrow('saved design');expect(w.cancel).toHaveBeenCalled();
});

it('returns authoring while the tail is held, accepts split UTF8, and releases its reader',async()=>{
 const w=wire(),pending=w.start();const bytes=encode({...first(),authoring:{...authoring,reason:'façade'}});
 for(const byte of bytes)w.controller.enqueue(Uint8Array.of(byte));
 const opened=await pending;expect(opened.authoring).toMatchObject({reason:'façade'});let settled=false;
 void opened.openingPrice!.result.then(()=>{settled=true;});await Promise.resolve();expect(settled).toBe(false);
 const tail=encode(second());w.controller.enqueue(tail.slice(0,17));w.controller.enqueue(tail.slice(17));w.controller.close();
 expect(await opened.openingPrice!.result).toEqual({ok:true,price});await Promise.resolve();expect(w.body.locked).toBe(false);
 expect(w.fetcher.mock.calls[0][1]).toMatchObject({credentials:'same-origin',cache:'no-store',headers:{accept:STUDIO_OPENING_TYPE}});
});

it.each(['missing','third','out-of-order','wrong-key','private-staff','wrong-binding','invalid-utf8','unterminated','unknown','oversized','bad-json'])('keeps authoring usable and rejects a %s tail',async kind=>{
 const w=wire(),pending=w.start();w.controller.enqueue(encode(first()));const opened=await pending;
 const tail:any=second();
 if(kind==='wrong-key')tail.result.price={...price,requestKey:'other'};
 if(kind==='private-staff')tail.result.price={...price,internalCosts:{materialsExGst:1}};
 if(kind==='wrong-binding')tail.binding={...binding,actorId:'other'};
 if(kind==='unknown')tail.extra=true;
 if(kind==='oversized')tail.result={ok:false,error:'x'.repeat(STUDIO_OPENING_FRAME_BYTES)};
 if(kind==='out-of-order')w.controller.enqueue(encode(first()));
 else if(kind==='invalid-utf8')w.controller.enqueue(Uint8Array.of(0xc3,0x28));
 else if(kind==='bad-json')w.controller.enqueue(new TextEncoder().encode('{oops}\n'));
 else if(kind!=='missing'){const bytes=encode(tail);w.controller.enqueue(kind==='unterminated'?bytes.slice(0,-1):bytes);}
 if(kind==='third')w.controller.enqueue(encode(second()));w.controller.close();
 expect(await opened.openingPrice!.result).toMatchObject({ok:false});await Promise.resolve();expect(w.body.locked).toBe(false);
});

it.each(['actor','project','estimate','revision','unknown','price-first'])('rejects a %s first record before mounting any design',async kind=>{
 const w=wire(),pending=w.start(),frame:any=first();
 if(kind==='actor')frame.binding={...binding,actorId:'foreign'};
 if(kind==='project')frame.authoring={...authoring,estimate:{...authoring.estimate,projectId:'foreign'}};
 if(kind==='estimate')frame.authoring={...authoring,estimate:{...authoring.estimate,id:'foreign'}};
 if(kind==='revision')frame.binding={...binding,revision:2};
 if(kind==='unknown')frame.extra=true;
 w.controller.enqueue(encode(kind==='price-first'?second():frame));
 await expect(pending).rejects.toThrow('could not be loaded');expect(w.cancel).toHaveBeenCalled();expect(w.body.locked).toBe(false);
});

it('bounds both a missing first record and a hanging tail, cancelling and releasing reads',async()=>{
 vi.useFakeTimers();const firstWire=wire(),pending=firstWire.start(),rejected=expect(pending).rejects.toThrow('could not be loaded');
 await vi.advanceTimersByTimeAsync(15_000);await rejected;expect(firstWire.cancel).toHaveBeenCalled();expect(firstWire.body.locked).toBe(false);
 const tailWire=wire(),started=tailWire.start();tailWire.controller.enqueue(encode(first()));const opened=await started;
 await vi.advanceTimersByTimeAsync(15_000);expect(await opened.openingPrice!.result).toMatchObject({ok:false});expect(tailWire.cancel).toHaveBeenCalled();expect(tailWire.body.locked).toBe(false);
});

it('cancels on lifetime abort without publishing a late tail',async()=>{
 const w=wire(),stop=new AbortController(),pending=readStudioOpening('/studio',scope,stop.signal);w.controller.enqueue(encode(first()));const opened=await pending;
 stop.abort();expect(await opened.openingPrice!.result).toMatchObject({ok:false});expect(w.cancel).toHaveBeenCalled();expect(w.body.locked).toBe(false);
});

it('admits only one exact hook owner, permits StrictMode reacquisition, and permanently retires on edit',async()=>{
 const cancel=vi.fn(),opening=studioOpeningPrice(binding,Promise.resolve({ok:true,price}),cancel),owner={};
 const current={...binding};const lease=opening.acquire(owner,current)!;opening.release(owner,lease.lease);
 expect(opening.acquire(owner,current)).not.toBeNull();await Promise.resolve();expect(cancel).not.toHaveBeenCalled();
 expect(opening.acquire(owner,{...current,requestKey:'changed'})).toBeNull();expect(cancel).toHaveBeenCalledTimes(1);
 expect(opening.acquire(owner,current)).toBeNull();
 const other=studioOpeningPrice(binding,Promise.resolve({ok:true,price}),cancel);expect(other.acquire({},current)).not.toBeNull();expect(other.acquire({},current)).toBeNull();
});

it.each(['staff','admin'] as const)('preserves public authoring when cached %s differs from the fresh role, without admitting its tail',async role=>{
 const w=wire(),pending=readStudioOpening('/studio',{...scope,role},new AbortController().signal);w.controller.enqueue(encode({...first(),scope:{...scope,role:role==='staff'?'admin':'staff'},binding:{...binding,role:role==='staff'?'admin':'staff'}}));
 const opened=await pending;expect(opened.authoring).toMatchObject(authoring);expect(opened.openingPrice).toBeUndefined();expect(w.cancel).toHaveBeenCalled();expect(w.body.locked).toBe(false);
});

it('rejects a changed actor even when the optional price is absent',async()=>{
 const w=wire(),pending=w.start();w.controller.enqueue(encode({...first(),scope:{...scope,actorId:'foreign'},binding:null}));await expect(pending).rejects.toThrow('could not be loaded');expect(w.cancel).toHaveBeenCalled();
});
it('bounds total bytes independently of each otherwise valid record',async()=>{
 const w=wire(),pending=w.start();w.controller.enqueue(encode({...first(),authoring:{...authoring,reason:'x'.repeat(4*1024*1024)}}));const opened=await pending;
 w.controller.enqueue(encode({...second(),result:{ok:true,price:{...price,reason:'x'.repeat(4*1024*1024)}}}));w.controller.close();
 expect(await opened.openingPrice!.result).toMatchObject({ok:false});expect(w.body.locked).toBe(false);
});
it('never starts an opening reader when its lifetime was already cancelled',async()=>{
 const w=wire(),stop=new AbortController();stop.abort();await expect(readStudioOpening('/studio',scope,stop.signal)).rejects.toThrow('could not be loaded');expect(w.body.locked).toBe(false);expect(w.cancel).toHaveBeenCalled();
});

it.each([true,false])('finishes a fully validated price transport normally (priced=%s), including later retirement',async priced=>{
 const w=wire(),nativeReader=w.body.getReader.bind(w.body);let cancel!:ReturnType<typeof vi.spyOn>;
 vi.spyOn(w.body,'getReader').mockImplementation(()=>{const reader=nativeReader();cancel=vi.spyOn(reader,'cancel');return reader as any;});
 const stop=new AbortController(),pending=readStudioOpening('/studio',scope,stop.signal);w.controller.enqueue(encode(first()));const opened=await pending;
 w.controller.enqueue(encode(priced?second():{...second(),result:{ok:false,error:'Current price unavailable'}}));w.controller.close();
 expect((await opened.openingPrice!.result).ok).toBe(priced);
 const signal=w.fetcher.mock.calls[0][1].signal as AbortSignal;
 expect(signal.aborted).toBe(false);expect(cancel).not.toHaveBeenCalled();expect(w.body.locked).toBe(false);
 opened.openingPrice!.retire();stop.abort();await Promise.resolve();expect(signal.aborted).toBe(false);expect(cancel).not.toHaveBeenCalled();
});

it('does not mark two parsed records complete until validated EOF arrives',async()=>{
 const w=wire(),stop=new AbortController(),pending=readStudioOpening('/studio',scope,stop.signal);w.controller.enqueue(encode(first()));const opened=await pending;
 w.controller.enqueue(encode(second()));await Promise.resolve();stop.abort();
 expect(await opened.openingPrice!.result).toMatchObject({ok:false});expect(w.fetcher.mock.calls[0][1].signal?.aborted).toBe(true);expect(w.cancel).toHaveBeenCalled();expect(w.body.locked).toBe(false);
});
