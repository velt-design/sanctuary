import 'server-only';
import type {StudioAuthoringResponse} from './authoringRequest.server';
import {STUDIO_OPENING_TYPE,STUDIO_OPENING_PRICE_MS,STUDIO_OPENING_FRAME_BYTES,STUDIO_OPENING_TOTAL_BYTES,type StudioOpeningBinding,type StudioOpeningScope,type StudioOpeningPriceResult,type WebsitePrice,type StudioOpeningPresentation} from './studioOpening';
import type {StudioOpeningTerminal} from './studioRequestDiagnostics.server';

type StudioOpeningResponseArgs = {
 request:Request;scope:StudioOpeningScope;binding:StudioOpeningBinding|null;
 presentation?:StudioOpeningPresentation;retire?:()=>void;
 onTerminal?:(outcome:StudioOpeningTerminal)=>void;
 calculate:(signal:AbortSignal)=>Promise<Response>;
} & (
 {authoring:StudioAuthoringResponse;firstFrame?:never;contentType?:never} |
 {authoring?:never;firstFrame:unknown;contentType:string}
);

/** One fresh read's public record and optional price, never a retained cache. */
export function studioOpeningResponse(args:StudioOpeningResponseArgs) {
 const encoder=new TextEncoder(),first=encoder.encode(JSON.stringify(args.firstFrame??{kind:'authoring',scope:args.scope,authoring:args.authoring,binding:args.binding,...(args.presentation?{presentation:args.presentation}:{})})+'\n');
 if(first.byteLength>STUDIO_OPENING_FRAME_BYTES)throw Error('Opening too large');
 const stop=new AbortController();let active=true,start:ReturnType<typeof setTimeout>|undefined,deadline:ReturnType<typeof setTimeout>|undefined,close:(()=>void)|undefined;
 const clear=()=>{args.retire?.();clearTimeout(start);clearTimeout(deadline);args.request.signal.removeEventListener('abort',abort);};
 const report=(outcome:StudioOpeningTerminal)=>{try{args.onTerminal?.(outcome);}catch{}};
 const abort=()=>{if(!active)return;active=false;stop.abort();clear();close?.();report('request-aborted');};
 args.request.signal.addEventListener('abort',abort,{once:true});
 const stream=new ReadableStream<Uint8Array>({
  start(controller){
   close=()=>{try{controller.close();}catch{}};
   const finish=(result:StudioOpeningPriceResult,outcome?:StudioOpeningTerminal)=>{
    if(!active)return;
    let frame=encoder.encode(JSON.stringify({kind:'price',binding:args.binding,result})+'\n');
    if(frame.byteLength>STUDIO_OPENING_FRAME_BYTES||first.byteLength+frame.byteLength>STUDIO_OPENING_TOTAL_BYTES){outcome='price-error';frame=encoder.encode(JSON.stringify({kind:'price',binding:args.binding,result:{ok:false,error:'The initial price was too large. Retry price.'}})+'\n');}
    active=false;clear();stop.abort();controller.enqueue(frame);controller.close();report(outcome??(result.ok?'price-response':'price-error'));
   };
   if(args.request.signal.aborted){abort();return;}
   controller.enqueue(first);
   deadline=setTimeout(()=>finish({ok:false,error:'The initial price is taking too long. Retry price.'},'price-timeout'),STUDIO_OPENING_PRICE_MS);
   // Let the response reader receive its public DTO before synchronous canonical
   // composition/eligibility work begins. Enqueue alone is not an event-loop yield.
   start=setTimeout(()=>{void(async()=>{
    try {
     if(stop.signal.aborted)return;
     const response=await args.calculate(stop.signal),body:unknown=await response.json();
     if(response.ok)finish({ok:true,price:body as WebsitePrice});
     else finish({ok:false,error:body&&typeof body==='object'&&'error' in body&&typeof body.error==='string'?body.error:'The initial price is unavailable. Retry price.'});
    }catch{finish({ok:false,error:'Could not calculate this design. Your selections are kept.'});}
   })();},0);
  },
  cancel(){if(!active)return;active=false;stop.abort();clear();close?.();report('reader-canceled');},
 });
 return new Response(stream,{headers:{'Content-Type':(args.contentType??STUDIO_OPENING_TYPE)+'; charset=utf-8','Cache-Control':'private, no-store','Vary':'Accept'}});
}
