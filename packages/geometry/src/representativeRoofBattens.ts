import type {Assembly3D} from './contracts';
import {dotRoof,roofCoordinates,roofMesh,roofSlab,roofRectangleBoundary} from './representativeRoofFinishMesh';
import type {RoofFinishGeometry} from './representativeRoofFinishTypes';
export type RepresentativeRoofBattens={profile:'39x39'|'65x39'|'90x39';edge:boolean;gap:number;customGap:boolean};
/** Visual roof battens only: no structural sizing or costing takeoff. */
export function addRepresentativeRoofBattens(assembly:Assembly3D,battens:RepresentativeRoofBattens,covering?:RoofFinishGeometry):RoofFinishGeometry{
  const result:RoofFinishGeometry={meshes:[...(covering?.meshes??[])],regions:covering?.regions??[],acrylicBays:covering?.acrylicBays??0,maxAcrylicBays:covering?.maxAcrylicBays??0,battenBoundaries:[]};
  const [wide,narrow]=battens.profile.split('x').map(Number),face=battens.edge?narrow:wide,depth=battens.edge?wide:narrow;
  for(const [index,roof] of assembly.roofPlanes.entries()){
    const f=roofCoordinates(roof),datum=dotRoof(roof.boundary[0],f.n);
    const rafters=assembly.members.filter(m=>m.role==='rafter'&&Math.abs(dotRoof(m.localFrame.xAxis,f.v))>.99&&Math.abs(dotRoof(m.centerline.start,f.n)-datum)<250);
    if(!rafters.length)continue;
    const bottom=Math.min(...rafters.map(m=>dotRoof(m.centerline.start,f.n)-datum-(Math.abs(dotRoof(m.localFrame.yAxis,f.n))*m.profile.widthMm+Math.abs(dotRoof(m.localFrame.zAxis,f.n))*m.profile.depthMm)/2));
    const extents=rafters.map(m=>{const a=dotRoof(m.centerline.start,f.u),half=(Math.abs(dotRoof(m.localFrame.yAxis,f.u))*m.profile.widthMm+Math.abs(dotRoof(m.localFrame.zAxis,f.u))*m.profile.depthMm)/2;return [a-half,a+half];});
    const bands=covering?covering.regions.filter(r=>r.material==='acrylic'&&r.boundary.every(p=>Math.abs(dotRoof(p,f.n)-datum)<1)).map(r=>({a:Math.min(...r.boundary.map(p=>dotRoof(p,f.u))),b:Math.max(...r.boundary.map(p=>dotRoof(p,f.u)))})):[{a:Math.min(...extents.map(e=>e[0])),b:Math.max(...extents.map(e=>e[1]))}];
    const mesh=roofMesh('roof-battens-'+index,'cedar');mesh.grainAlong=f.u;mesh.grainAcross=f.v;
    for(const band of bands){
      if(assembly.family==='box'){band.a=Math.max(band.a,50);band.b=Math.min(band.b,Math.max(...assembly.outline.map(p=>p.x))-50);}
      const count=Math.floor((f.far-f.near+battens.gap)/(face+battens.gap));
      const first=f.near+(f.far-f.near-(count*face+(count-1)*battens.gap))/2;
      for(let i=0;i<count;i++){
        const c=first+i*(face+battens.gap),r={...band,c,d:c+face};
        if(r.b<=r.a)continue;
        roofSlab(mesh,f,r,bottom-depth,bottom);
        result.battenBoundaries!.push(roofRectangleBoundary(f,r,bottom));
      }
    }
    if(mesh.indices.length)result.meshes.push(mesh);
  }
  return result;
}
