import type {StudioPriceAssumptions} from './studioPriceAssumptions';
import type {StudioInternalCostSummary} from './studioInternalCostSummary.server';
import type {StudioAuthoringEdit} from './authoringView';
import type {StudioWebsiteDesign} from './websiteDesign';

export const STUDIO_PRICE_REQUEST_BYTES=2*1024*1024,STUDIO_PRICE_KEY_CHARACTERS=1_000_000;
export const STUDIO_OPENING_TYPE='application/x-sanctuary-studio-opening+ndjson';
export const STUDIO_OPENING_FIRST_MS=15_000, STUDIO_OPENING_PRICE_MS=15_000;
export const STUDIO_OPENING_FRAME_BYTES=6*1024*1024, STUDIO_OPENING_TOTAL_BYTES=8*1024*1024;
export type WebsitePrice={installationEstimate?:import('./studioInstallationEstimate').StudioInstallationEstimate;siteAssumptions?:StudioPriceAssumptions;status:'priced'|'unavailable';amount:number|null;reason?:string;basis?:string;versionNumber?:number;selectionDigest?:string;publicationId?:string;requestKey:string;breakdown?:{label:string;amount:number;detail:string;provisional:boolean}[];internalCosts?:StudioInternalCostSummary};
export type StudioOpeningBinding={actorId:string;role:'staff'|'admin';projectId:string;estimateId:string;designId:string;revision:number;requestKey:string};
export type StudioOpeningScope=Pick<StudioOpeningBinding,'actorId'|'role'|'projectId'|'estimateId'>;
export type StudioOpeningPresentation={theme:Record<string,string>};
export type StudioOpeningPriceResult={ok:true;price:WebsitePrice}|{ok:false;error:string};
export function studioWebsitePricePayload(args:{designId:string;revision:number;composition?:StudioAuthoringEdit|null;design:StudioWebsiteDesign|null}) {
 const payload={designId:args.designId,revision:args.revision,...(args.composition?{composition:args.composition}:{design:args.design})};
 return {payload,requestKey:JSON.stringify(payload)};
}

/** One opening read, one editing-hook owner. The same effect can reacquire during
 * StrictMode cleanup, but another edit, Retry or owner permanently retires it. */
export function studioOpeningPrice(binding:StudioOpeningBinding,result:Promise<StudioOpeningPriceResult>,cancel:()=>void) {
 let owner:object|null=null, retired=false, lease=0;
 return {binding,result,
  acquire(token:object,current:Omit<StudioOpeningBinding,'role'>) {
   if(retired)return null;
   if((owner&&owner!==token)||Object.entries(current).some(([key,value])=>binding[key as keyof StudioOpeningBinding]!==value)){retired=true;cancel();return null;}
   owner=token;return{result,lease:++lease};
  },
  release(token:object,serial:number){queueMicrotask(()=>{if(!retired&&owner===token&&lease===serial){retired=true;cancel();}});},
  retire(){if(!retired){retired=true;cancel();}},
 };
}
export type StudioOpeningPrice=ReturnType<typeof studioOpeningPrice>;
