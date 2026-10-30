import type {StudioAuthoringResponse} from './authoringRequest.server';
import {STUDIO_PRICE_KEY_CHARACTERS,STUDIO_OPENING_TYPE,STUDIO_OPENING_FIRST_MS,STUDIO_OPENING_PRICE_MS,STUDIO_OPENING_FRAME_BYTES,STUDIO_OPENING_TOTAL_BYTES,studioOpeningPrice,type StudioOpeningBinding,type StudioOpeningPrice,type StudioOpeningPriceResult,type StudioOpeningScope,type StudioOpeningPresentation,type WebsitePrice} from './studioOpening';

const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const exact=(v:unknown,keys:string[]):v is Record<string,unknown>=>object(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const errorResult=():StudioOpeningPriceResult=>({ok:false,error:'The initial price could not be confirmed. Retry price to calculate these choices.'});
export class StudioOpeningAccessError extends Error {
 constructor(readonly kind:'unauthenticated'|'no_access'|'lookup_failed'){super('Studio access could not be confirmed.');}
}
export function studioOpeningPresentation(value:unknown):StudioOpeningPresentation {
 if(!exact(value,['theme'])||!object(value.theme)||Object.keys(value.theme).length>40||Object.entries(value.theme).some(([k,v])=>!/^--(?:portal-[a-z-]+|sp-accent(?:-rgb)?|accentRed|accentRgb|fg|muted|bg|panel|border)$/.test(k)||typeof v!=='string'||v.length>256||/[{};<>]/.test(v)))throw Error('Invalid opening presentation');
 return value as StudioOpeningPresentation;
}
export function studioOpeningBinding(value:unknown):value is StudioOpeningBinding {
 return exact(value,['actorId','role','projectId','estimateId','designId','revision','requestKey'])&&['actorId','projectId','estimateId','designId','requestKey'].every(k=>typeof value[k]==='string'&&!!value[k])&&['staff','admin'].includes(String(value.role))&&Number.isSafeInteger(value.revision)&&Number(value.revision)>=1&&String(value.requestKey).length<=STUDIO_PRICE_KEY_CHARACTERS;
}
export function studioOpeningPriceResult(value:unknown,scope:StudioOpeningBinding):StudioOpeningPriceResult {
 if(exact(value,['ok','error'])&&value.ok===false&&typeof value.error==='string'&&value.error.length>0&&value.error.length<=2000)return{ok:false,error:value.error};
 if(!exact(value,['ok','price'])||value.ok!==true||!object(value.price))throw Error('Invalid initial price');
 const price=value.price,allowed=['requestKey','designId','revision','selectionDigest','publicationId','versionNumber','publicationContentHash','pricingDigest','status','amount','breakdown','basis','siteAssumptions','internalCosts','reason','installationEstimate'];
 if(Object.keys(price).some(k=>!allowed.includes(k))||price.requestKey!==scope.requestKey||price.designId!==scope.designId||price.revision!==scope.revision||!['priced','unavailable'].includes(String(price.status))||(price.status==='priced'?typeof price.amount!=='number'||!Number.isFinite(price.amount):price.amount!==null)||typeof price.publicationId!=='string'||!Number.isSafeInteger(price.versionNumber)||typeof price.selectionDigest!=='string'||typeof price.pricingDigest!=='string'||typeof price.publicationContentHash!=='string')throw Error('Unverified initial price');
 if(price.internalCosts!==undefined&&(scope.role!=='admin'||!exact(price.internalCosts,['materialsExGst','installExGst','overheadExGst','travelExGst','extrasExGst','engineCostExGst','crewHours'])||Object.values(price.internalCosts).some(v=>typeof v!=='number'||!Number.isFinite(v))))throw Error('Invalid private price');
 if(price.installationEstimate!==undefined&&(!exact(price.installationEstimate,['siteDays'])||!Number.isSafeInteger(price.installationEstimate.siteDays)||Number(price.installationEstimate.siteDays)<1))throw Error('Invalid installation estimate');
 if(price.breakdown!==undefined&&(!Array.isArray(price.breakdown)||price.breakdown.some(v=>!exact(v,['label','amount','detail','provisional'])||typeof v.label!=='string'||typeof v.amount!=='number'||!Number.isFinite(v.amount)||typeof v.detail!=='string'||typeof v.provisional!=='boolean')))throw Error('Invalid price breakdown');
 if(price.siteAssumptions!==undefined&&(!object(price.siteAssumptions)||Object.entries(price.siteAssumptions).some(([k,v])=>!['access','height','jobType','pricingClassification','approvalRequirement'].includes(k)||typeof v!=='string')))throw Error('Invalid price assumptions');
 if(['reason','basis'].some(k=>price[k]!==undefined&&typeof price[k]!=='string'))throw Error('Invalid price text');
 return{ok:true,price:price as WebsitePrice};
}

/** Exactly two private records. Resolve the ordinary authoring boundary after
 * record1; a missing/failed tail never turns that design into a loading failure. */
export function readStudioOpening(path:string,expected:Pick<StudioOpeningBinding,'projectId'|'estimateId'>&Partial<Pick<StudioOpeningBinding,'actorId'|'role'>>,outer:AbortSignal):Promise<{authoring:StudioAuthoringResponse;scope:StudioOpeningScope;presentation?:StudioOpeningPresentation;openingPrice?:StudioOpeningPrice}> {
 return new Promise((resolve,reject)=>{
  const controller=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined,reader:ReadableStreamDefaultReader<Uint8Array>|undefined,first=false,completed=false,settlePrice:((v:StudioOpeningPriceResult)=>void)|undefined;
  const abort=()=>{if(completed||controller.signal.aborted)return;controller.abort();void reader?.cancel().catch(()=>{});};outer.addEventListener('abort',abort,{once:true});if(outer.aborted)abort();
  const deadline=(ms:number)=>{clearTimeout(timer);timer=setTimeout(abort,ms);};deadline(STUDIO_OPENING_FIRST_MS);
  void(async()=>{
   try {
    const response=await fetch(path,{credentials:'same-origin',cache:'no-store',signal:controller.signal,headers:{accept:STUDIO_OPENING_TYPE}});
    if(!response.ok){
     const denial=response.headers.get('x-studio-access-state');
     if(['unauthenticated','no_access','lookup_failed'].includes(denial??'')){void response.body?.cancel().catch(()=>{});throw new StudioOpeningAccessError(denial as 'unauthenticated'|'no_access'|'lookup_failed');}
    }
    if(controller.signal.aborted||!response.ok||response.headers.get('content-type')?.split(';')[0]!==STUDIO_OPENING_TYPE||!response.body){void response.body?.cancel().catch(()=>{});throw Error('Saved design could not be loaded');}
    reader=response.body.getReader();const decoder=new TextDecoder('utf-8',{fatal:true});let fragments:string[]=[],frameBytes=0,bytes=0,count=0,initial:StudioOpeningBinding|null=null,tail:StudioOpeningPriceResult|undefined;
    for(;;){
     const next=await reader.read();controller.signal.throwIfAborted();
     if(next.done){decoder.decode();if(frameBytes||count!==2)throw Error('Incomplete opening');break;}
     bytes+=next.value.byteLength;if(bytes>STUDIO_OPENING_TOTAL_BYTES)throw Error('Opening too large');
     let start=0;
     for(let end=0;end<=next.value.length;end++){
      if(end!==next.value.length&&next.value[end]!==10)continue;
      const piece=next.value.subarray(start,end);start=end+1;frameBytes+=piece.byteLength;
      if(frameBytes>STUDIO_OPENING_FRAME_BYTES)throw Error('Opening frame too large');
      fragments.push(decoder.decode(piece,{stream:true}));if(end===next.value.length)break;
      fragments.push(decoder.decode());const line=fragments.join('');fragments=[];frameBytes=0;
      if(++count>2)throw Error('Invalid opening frame');
      const frame:unknown=JSON.parse(line);
      if(count===1){
       if(!exact(frame,['kind','scope','authoring','binding',...(object(frame)&&Object.hasOwn(frame,'presentation')?['presentation']:[])])||frame.kind!=='authoring'||!exact(frame.scope,['actorId','role','projectId','estimateId'])||typeof frame.scope.actorId!=='string'||!frame.scope.actorId||!['staff','admin'].includes(String(frame.scope.role))||(expected.actorId!==undefined&&frame.scope.actorId!==expected.actorId)||frame.scope.projectId!==expected.projectId||frame.scope.estimateId!==expected.estimateId||!object(frame.authoring)||!object(frame.authoring.estimate)||frame.authoring.estimate.id!==expected.estimateId||frame.authoring.estimate.projectId!==expected.projectId||!['ready','unavailable','needs-import'].includes(String(frame.authoring.state)))throw Error('Wrong opening source');
       const source=frame.scope;
       if(frame.binding!==null){
        const scopedBinding=frame.binding;
        if(!studioOpeningBinding(scopedBinding)||Object.entries(source).some(([k,v])=>scopedBinding[k as keyof StudioOpeningBinding]!==v)||!object(frame.authoring.view)||scopedBinding.designId!==frame.authoring.view.designId||scopedBinding.revision!==frame.authoring.view.revision||frame.authoring.nextAction!=='edit'||frame.authoring.estimate.requiresNewRevision!==false)throw Error('Wrong opening identity');
        initial=scopedBinding;
       }
       const appearance=frame.presentation?studioOpeningPresentation(frame.presentation):undefined;
       const result=new Promise<StudioOpeningPriceResult>(done=>{settlePrice=done;});first=true;deadline(STUDIO_OPENING_PRICE_MS);
       const priceRoleMatches=expected.role===undefined||source.role===expected.role;
       resolve({authoring:frame.authoring as StudioAuthoringResponse,scope:source as StudioOpeningScope,...(appearance?{presentation:appearance}:{}),...(initial&&priceRoleMatches?{openingPrice:studioOpeningPrice(initial,result,abort)}:{})});
       // Both fresh staff/admin roles can read this same public DTO. A stale
       // client role retires only the optional price, never design access.
       if(!priceRoleMatches){abort();return;}
      }else{
       if(!exact(frame,['kind','binding','result'])||frame.kind!=='price'||JSON.stringify(frame.binding)!==JSON.stringify(initial))throw Error('Wrong price source');
       tail=initial?studioOpeningPriceResult(frame.result,initial):errorResult();
      }
     }
    }
    completed=true;
    settlePrice?.(tail??errorResult());
   }catch(error){if(first)settlePrice?.(errorResult());else reject(error instanceof StudioOpeningAccessError?error:Error('The saved design could not be loaded.'));}
   finally{clearTimeout(timer);outer.removeEventListener('abort',abort);if(!completed)abort();reader?.releaseLock();}
  })();
 });
}
