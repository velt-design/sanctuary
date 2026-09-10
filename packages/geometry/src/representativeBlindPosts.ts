import type { Assembly3D } from './contracts';
import { representativeBlindOpenings } from './representativeBlindOpenings';
import { parseAssemblyMemberProfile } from './profiles';
import { buildPlanViewModel } from './plan';
import { buildViewerSceneModel } from './viewer';

/** Resolve representative corner clearance before deriving either view or blind widths. */
export function fitRepresentativeBlindPosts(source:Assembly3D, blinds:readonly {opening:string;cover:string}[]) {
  const covers=representativeBlindOpenings(source).filter(o=>blinds.some(b=>b.opening===o.id && b.cover==='PELMET'))
    .map(o=>({side:o.side,minX:Math.min(o.start.x,o.end.x)-(o.side==='front'?0:68),maxX:Math.max(o.start.x,o.end.x)+(o.side==='front'?0:68),
      minY:Math.min(o.start.y,o.end.y)-(o.side==='front'?68:0),maxY:Math.max(o.start.y,o.end.y)+(o.side==='front'?68:0),
      minZ:o.top-(o.top>2800?165:135),maxZ:o.top}));
  const intersects=covers.some((a,i)=>covers.slice(i+1).some(b=>a.side!==b.side &&
    a.minX<b.maxX && b.minX<a.maxX && a.minY<b.maxY && b.minY<a.maxY && a.minZ<b.maxZ && b.minZ<a.maxZ));
  if(!intersects) return null;
  const w=Math.max(...source.outline.map(p=>p.x)),d=Math.max(...source.outline.map(p=>p.y));
  const assembly:Assembly3D={...source,members:source.members.map(m=>{
    // Preserve the rectangular king-strut post and existing larger sections.
    if(m.role!=='post' || m.profile.widthMm!==m.profile.depthMm || m.profile.widthMm>=150) return m;
    const half=m.profile.widthMm/2;
    const shift=(v:number,max:number)=>v<150?75-half:max-v<150?half-75:0;
    const dx=shift(m.centerline.start.x,w),dy=shift(m.centerline.start.y,d);
    const start={...m.centerline.start,x:m.centerline.start.x+dx,y:m.centerline.start.y+dy};
    const end={...m.centerline.end,x:m.centerline.end.x+dx,y:m.centerline.end.y+dy};
    return {...m,profile:parseAssemblyMemberProfile('150x150')!,centerline:{start,end},
      localFrame:{...m.localFrame,origin:{...m.localFrame.origin,x:m.localFrame.origin.x+dx,y:m.localFrame.origin.y+dy}},
      metadata:{...m.metadata,footprintWidthMm:150,footprintProjectionMm:150,blindPelmetClearance:true}};
  })};
  return {assembly,plan:buildPlanViewModel(assembly),viewerScene:buildViewerSceneModel(assembly)};
}
