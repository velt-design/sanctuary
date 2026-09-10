import type {Assembly3D} from './contracts';
import {resolveAssemblyMemberProfileAnchors} from './profiles';
import {buildPlanViewModel} from './plan';
import {buildViewerSceneModel} from './viewer';

/** Marketing pitched roof: match ledger section to rafters, preserving its top datum. */
export function matchRepresentativePitchedLedger(source:Assembly3D){
  const rafter=source.members.find(m=>m.role==='rafter');
  if(!rafter)return null;
  const assembly={...source,members:source.members.map(m=>{
    if(m.role!=='ledger')return m;
    const dz=resolveAssemblyMemberProfileAnchors(m.profile).topsideZ-resolveAssemblyMemberProfileAnchors(rafter.profile).topsideZ;
    return {...m,profile:{...rafter.profile},centerline:{start:{...m.centerline.start,z:m.centerline.start.z+dz},end:{...m.centerline.end,z:m.centerline.end.z+dz}},localFrame:{...m.localFrame,origin:{...m.localFrame.origin,z:m.localFrame.origin.z+dz}}};
  })};
  return {assembly,plan:buildPlanViewModel(assembly),viewerScene:buildViewerSceneModel(assembly)};
}
