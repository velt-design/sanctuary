import type { AssemblyMember3D, AssemblyMemberProfile, Point3 } from './contracts';
import { parseAssemblyMemberProfile } from './profiles';

/** Explicit member frame; roof members accept their slope normal as depth axis. */
export function boxMember(id: string, role: AssemblyMember3D['role'], start: Point3, end: Point3,
  profile: string | AssemblyMemberProfile, normal: Point3 = { x: 0, y: 0, z: 1 }): AssemblyMember3D {
  const length = Math.hypot(end.x-start.x,end.y-start.y,end.z-start.z);
  const x = { x:(end.x-start.x)/length,y:(end.y-start.y)/length,z:(end.z-start.z)/length };
  const y = { x:normal.y*x.z-normal.z*x.y,y:normal.z*x.x-normal.x*x.z,z:normal.x*x.y-normal.y*x.x };
  return { id, role, centerline:{start,end}, profile:typeof profile === 'string' ? parseAssemblyMemberProfile(profile)! : profile,
    localFrame:{origin:start,xAxis:x,yAxis:y,zAxis:normal} };
}

export function boxGutterProfile(): AssemblyMemberProfile {
  return { shape:'custom',widthMm:100,depthMm:100,
    sectionOutline:[{x:-50,y:50},{x:-50,y:-50},{x:50,y:-50},{x:50,y:50},
      {x:47,y:50},{x:47,y:-47},{x:-47,y:-47},{x:-47,y:50}],sectionVoids:[] };
}
