import {resolveAssemblyMemberProfileAnchors} from '@sp/geometry';
import type {StudioDocumentProduct} from './contract';
/** Named drawing facts from the frozen structural assembly. End-frame ties are
 * not main eaves; a generic min/max over every beam would mislabel a gable. */
export function studioDocumentHeightFacts(product:StudioDocumentProduct,options:{bearingScope?:'main_horizontal_beams'}={}){
 const main=product.assembly.members.filter(m=>(m.role==='beam'||m.role==='ledger')&&!m.metadata?.frameRole);
 const bearings=options.bearingScope==='main_horizontal_beams'?main.filter(m=>Math.abs(m.centerline.start.z-m.centerline.end.z)<.01):product.assembly.family==='gable'?main:[...main,...product.assembly.members.filter(m=>m.role==='gutter')];
 const underside=bearings.flatMap(m=>[m.centerline.start.z,m.centerline.end.z].map(z=>z+resolveAssemblyMemberProfileAnchors(m.profile).undersideZ));
 const eaves=[...new Set(underside.map(z=>Math.round(z)))].sort((a,b)=>a-b);
 const ridge=product.assembly.members.filter(m=>m.role==='ridge').flatMap(m=>[m.centerline.start.z,m.centerline.end.z].map(z=>z+resolveAssemblyMemberProfileAnchors(m.profile).topsideZ));
 const normal=product.assembly.roofPlanes[0]?.plane.normal;
 return{eaves,ridgeTop:ridge.length?Math.max(...ridge):null,pitchDeg:normal?Math.atan2(Math.hypot(normal.x,normal.y),Math.abs(normal.z))*180/Math.PI:null};
}
