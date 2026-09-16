import type { Assembly3D, Point3, RoofPlane3D } from './contracts';
import { parseAssemblyMemberProfile } from './profiles';
import { boxMember } from './representativeBoxMembers';
import type { RepresentativeBoxRules } from './representativeBoxRules';
import { sizeRepresentativeGableFlashing } from './representativeGableFlashing';

/** Framing, acrylic and optional internal ridge are shared by Plan and 3D. */
export function addRepresentativeBoxRoof(assembly: Assembly3D, width: number, projection: number, rules: RepresentativeBoxRules) {
  const joiner = parseAssemblyMemberProfile('sp_joiners')!;
  const xs = Array.from({length:rules.rafterCount},(_,i)=>75+(width-150)*i/(rules.rafterCount-1));
  const mid = projection/2;
  const ends = rules.roofMode === 'pitched' ? [[50,rules.peakZ,projection-150,rules.eaveZ]]
    : [[mid,rules.peakZ,150,rules.eaveZ],[mid,rules.peakZ,projection-150,rules.eaveZ]];
  for (const [index, [y1,z1,y2,z2]] of ends.entries()) {
    const length = Math.hypot(y2-y1,z2-z1), direction = Math.sign(y2-y1);
    const fall = {x:0,y:(y2-y1)/length,z:(z2-z1)/length};
    const normal = {x:0,y:-(z2-z1)/length*direction,z:Math.abs(y2-y1)/length};
    const point = (x:number,y:number,z:number,offset=0):Point3=>({x,y:y+normal.y*offset,z:z+normal.z*offset});
    const boundary = [point(50,y1,z1),point(width-50,y1,z1),point(width-50,y2,z2),point(50,y2,z2)];
    const plane:RoofPlane3D = {id:`box-roof-${index}`,boundary,plane:{origin:boundary[0],xAxis:{x:1,y:0,z:0},yAxis:fall,normal},fallVector:fall,
      metadata:{roofMode:rules.roofMode,pitchDeg:rules.pitchDeg}};
    assembly.roofPlanes.push(plane);
    const ridgeInset = rules.roofMode === 'gable' ? 25 : 0;
    const rafterY = y1 + direction*ridgeInset, rafterZ = z1 + (z2-z1)*ridgeInset/Math.abs(y2-y1);
    for (const [i,x] of xs.entries()) {
      assembly.members.push(boxMember(`box-rafter-${index}-${i}`,'rafter',point(x,rafterY,rafterZ,-40),point(x,y2,z2,-40),'80x50',normal));
      assembly.members.push(boxMember(`box-joiner-${index}-${i}`,'joiner',point(x,rafterY,rafterZ,joiner.depthMm/2),point(x,y2,z2,joiner.depthMm/2),joiner,normal));
    }
    for (let i=0;i<xs.length-1;i++) {
      const a=xs[i]+joiner.widthMm/2+.5,b=xs[i+1]-joiner.widthMm/2-.5;
      const panelBoundary=[point(a,rafterY,rafterZ,joiner.depthMm/2),point(b,rafterY,rafterZ,joiner.depthMm/2),
        point(b,y2,z2,joiner.depthMm/2),point(a,y2,z2,joiner.depthMm/2)];
      assembly.roofCladdingPanels.push({id:`box-acrylic-${index}-${i}`,material:'acrylic',thicknessMm:6,boundary:panelBoundary,
        plane:{...plane.plane,origin:panelBoundary[0]}});
    }
  }
  if (rules.roofMode !== 'gable') return;
  const ridgeProfile=parseAssemblyMemberProfile(rules.ridgeProfile)!;
  assembly.members.push(boxMember('ridge','ridge',{x:50,y:mid,z:rules.peakZ-ridgeProfile.depthMm/2},
    {x:width-50,y:mid,z:rules.peakZ-ridgeProfile.depthMm/2},ridgeProfile));
  const a={x:50,y:mid,z:rules.peakZ},b={...a,x:width-50};
  assembly.roofFlashings=[{id:'box-ridge-flashing',thicknessMm:1,metadata:{wingLengthMm:150},wings:assembly.roofPlanes.map((roof,i)=>{
    const down=(p:Point3)=>({x:p.x,y:p.y+roof.fallVector.y*150,z:p.z+roof.fallVector.z*150});
    return {id:`box-ridge-wing-${i}`,boundary:[a,b,down(b),down(a)],plane:{...roof.plane,origin:a}};
  })}];
  sizeRepresentativeGableFlashing(assembly,150);
}
