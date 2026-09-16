import type {Assembly3D} from './contracts';
import {resolveAssemblyMemberProfileAnchors} from './profiles';
import {buildPlanViewModel} from './plan';
import {buildViewerSceneModel} from './viewer';

/** Marketing pitched roof: match ledger section to rafters, preserving its top datum and finishing at the end-rafter outside faces. */
export function matchRepresentativePitchedLedger(source:Assembly3D){
  const rafters=source.members.filter(m=>m.role==='rafter');
  const rafter=rafters[0];
  if(!rafter)return null;
  const faces=rafters.map(m=>{
    const half=(Math.abs(m.localFrame.yAxis.x)*m.profile.widthMm+Math.abs(m.localFrame.zAxis.x)*m.profile.depthMm)/2;
    return {left:Math.min(m.centerline.start.x,m.centerline.end.x)-half,right:Math.max(m.centerline.start.x,m.centerline.end.x)+half};
  });
  const left=Math.min(...faces.map(f=>f.left)),right=Math.max(...faces.map(f=>f.right));
  const assembly={...source,members:source.members.map(m=>{
    if(m.role!=='ledger')return m;
    const dz=resolveAssemblyMemberProfileAnchors(m.profile).topsideZ-resolveAssemblyMemberProfileAnchors(rafter.profile).topsideZ;
    const startX=m.centerline.start.x<=m.centerline.end.x?left:right;
    const endX=m.centerline.start.x<=m.centerline.end.x?right:left;
    return {...m,profile:{...rafter.profile},centerline:{start:{...m.centerline.start,x:startX,z:m.centerline.start.z+dz},end:{...m.centerline.end,x:endX,z:m.centerline.end.z+dz}},localFrame:{...m.localFrame,origin:{...m.localFrame.origin,x:m.localFrame.origin.x+startX-m.centerline.start.x,z:m.localFrame.origin.z+dz}}};
  })};
  return {assembly,plan:buildPlanViewModel(assembly),viewerScene:buildViewerSceneModel(assembly)};
}
