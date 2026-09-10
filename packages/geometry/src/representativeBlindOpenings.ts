import type { Assembly3D, Point3 } from './contracts';
export type BlindOpening = { id:string; label:string; side:'front'|'left'|'right'; start:Point3; end:Point3; width:number; top:number; roofLine:Point3[]; headerDepth:number; needsJamb:boolean };
export const blindHeaderDepth = (span:number) => span <= 2000 ? 50 : span <= 4000 ? 100 : 150;

/** Exterior openings follow solved posts. IDs include bay count so topology changes cannot move a blind silently. */
export function representativeBlindOpenings(assembly:Assembly3D):BlindOpening[] {
  const w=Math.max(...assembly.outline.map(p=>p.x)), d=Math.max(...assembly.outline.map(p=>p.y));
  const posts=assembly.members.filter(m=>m.role==='post');
  const postPoint=(m:typeof posts[number],axis:'x'|'y')=>({p:m.centerline.start,
    half:Number(m.metadata?.[axis==='x'?'footprintWidthMm':'footprintProjectionMm']??Math.max(m.profile.widthMm,m.profile.depthMm))/2});
  const xPosts=posts.map(m=>postPoint(m,'x')),yPosts=posts.map(m=>postPoint(m,'y'));
  const left=Math.min(...xPosts.map(m=>m.p.x-m.half)),right=Math.max(...xPosts.map(m=>m.p.x+m.half));
  const front=Math.max(...yPosts.map(m=>m.p.y+m.half));
  // Anchor to actual exterior post faces, including the existing frame inset.
  // The housing extends 68mm outward, leaving a 5mm setback.
  const point=(side:string,t:number):Point3=>side==='front'?{x:t,y:front-73,z:0}:{x:side==='left'?left+73:right-73,y:t,z:0};
  function roofZ(p:Point3) {
    const values=assembly.roofPlanes.filter(r=>p.x>=Math.min(...r.boundary.map(v=>v.x))-100 && p.x<=Math.max(...r.boundary.map(v=>v.x))+100 && p.y>=Math.min(...r.boundary.map(v=>v.y))-100 && p.y<=Math.max(...r.boundary.map(v=>v.y))+100)
      .map(r=>{const n=r.plane.normal,o=r.plane.origin;return o.z-(n.x*(p.x-o.x)+n.y*(p.y-o.y))/n.z-150;});
    return assembly.family==='box'?2400:values.some(Number.isFinite)?Math.max(...values.filter(Number.isFinite)):2400;
  }
  const result:BlindOpening[]=[];
  for(const side of ['front','left','right'] as const) {
    const axis=side==='front'?'x':'y';
    const edgePosts=posts.filter(m=>side==='front'?m.centerline.start.y>d-220:side==='left'?m.centerline.start.x<220:m.centerline.start.x>w-220).map(m=>postPoint(m,axis)).sort((a,b)=>a.p[axis]-b.p[axis]);
    if(side!=='front' && (!edgePosts.length || edgePosts[0].p.y>200)) edgePosts.unshift({p:point(side,25),half:25});
    if(edgePosts.length<2) continue;
    for(let i=1;i<edgePosts.length;i++) {
      const a=edgePosts[i-1].p[axis]+edgePosts[i-1].half,b=edgePosts[i].p[axis]-edgePosts[i].half;
      if(b-a<650) continue;
      const start=point(side,a),end=point(side,b),mid=point(side,(a+b)/2);
      const line=[start,mid,end].map(p=>({...p,z:roofZ(p)}));
      const level=Math.min(...line.map(p=>p.z));
      const sloped=Math.max(...line.map(p=>p.z))-level>30;
      // Actual horizontal boundary beams take precedence over roof-plane depth.
      const beams=assembly.members.filter(m=>['beam','gutter','ledger'].includes(m.role) && Math.abs(m.centerline.start.z-m.centerline.end.z)<1 && (side==='front'?Math.abs(m.centerline.start.y-start.y)<150 && Math.abs(m.centerline.end.y-start.y)<150:Math.abs(m.centerline.start.x-start.x)<150 && Math.abs(m.centerline.end.x-start.x)<150));
      const underside=beams.length?Math.min(...beams.map(m=>m.centerline.start.z-m.profile.depthMm/2)):level;
      const headerDepth=sloped && !beams.length?blindHeaderDepth(b-a):0;
      result.push({id:side+'-'+i+'of'+(edgePosts.length-1),label:(side==='front'?'Front':side==='left'?'Left':'Right')+' '+i,side,start,end,width:b-a,top:headerDepth?level-headerDepth:underside,roofLine:line,headerDepth,needsJamb:side!=='front' && i===1});
    }
  }
  return result;
}
