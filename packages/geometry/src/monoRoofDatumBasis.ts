import type {GeometryConfig} from './contracts';
import {resolveAssemblyMemberProfileAnchors} from './profiles';
/** Preserve the existing roof bearing plane when the rear ledger becomes a free beam. */
export function retainAttachedMonoRoofDatum(config:GeometryConfig):{ok:true;config:GeometryConfig}|{ok:false;code:'unsupported_variant';error:string}{
 if(config.family!=='mono'||config.connection.type!=='freestanding')return {ok:true,config};
 const free=config.structural.profiles.supportBeam,ledger=config.structural.profiles.ledger;
 const fail=()=>({ok:false as const,code:'unsupported_variant' as const,error:'This support change cannot retain the existing roof bearing plane.'});
 if(!free||!ledger)return fail();
 const f=resolveAssemblyMemberProfileAnchors(free),a=resolveAssemblyMemberProfileAnchors(ledger);
 if(Math.abs((f.roofBearingFaceY-f.backFaceY)-(a.roofBearingFaceY-a.backFaceY))>1e-7)return fail();
 const delta=(a.roofBearingFaceZ-a.undersideZ)-(f.roofBearingFaceZ-f.undersideZ),shift=(v:number|null)=>v===null?null:v+delta;
 return {ok:true,config:{...config,structural:{...config.structural,heights:{...config.structural.heights,referenceUndersideMm:shift(config.structural.heights.referenceUndersideMm),houseUndersideMm:shift(config.structural.heights.houseUndersideMm)}}}};
}
