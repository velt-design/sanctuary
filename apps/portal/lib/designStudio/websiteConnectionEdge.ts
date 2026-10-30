import {resolveAssemblyMemberProfileAnchors,type Assembly3D} from '@sp/geometry';
export function websiteConnectionEdge(assembly:Assembly3D,anchor:'underside'|'top'='underside'){
  const member=assembly.members.find(m=>m.role==='ledger'||m.id==='house-beam');
  if(!member)throw Error('This roof has no supported house connection datum. Change edge or detach.');
  const frame=member.localFrame,anchors=resolveAssemblyMemberProfileAnchors(member.profile);
  const centre=assembly.outline.reduce((p,v)=>({x:p.x+v.x/assembly.outline.length,y:p.y+v.y/assembly.outline.length}),{x:0,y:0});
  const mid={x:(member.centerline.start.x+member.centerline.end.x)/2,y:(member.centerline.start.y+member.centerline.end.y)/2};
  const towardInterior=(centre.x-mid.x)*frame.yAxis.x+(centre.y-mid.y)*frame.yAxis.y;
  const face=towardInterior>=0?anchors.backFaceY:anchors.frontFaceY;
  const points=[member.centerline.start,member.centerline.end].map(p=>({
    x:p.x+frame.yAxis.x*face+frame.zAxis.x*(anchor==='top'?anchors.topsideZ:anchors.undersideZ),
    y:p.y+frame.yAxis.y*face+frame.zAxis.y*(anchor==='top'?anchors.topsideZ:anchors.undersideZ),
    z:p.z+frame.yAxis.z*face+frame.zAxis.z*(anchor==='top'?anchors.topsideZ:anchors.undersideZ),
  }));
  let [start,end]=points;
  if((end.x-start.x)*(centre.y-start.y)-(end.y-start.y)*(centre.x-start.x)<0)[start,end]=[end,start];
  if(Math.abs(start.z-end.z)>1e-6)throw Error('This connection edge is not level. Choose another roof or connection.');
  return {memberId:member.id,start,end};
}
