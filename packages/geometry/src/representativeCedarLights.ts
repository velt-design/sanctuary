import type {Assembly3D} from './contracts';
import type {RoofFinishGeometry} from './representativeRoofFinishTypes';
import type {LightSite} from './representativePergolaLighting';
import {roofCoordinates,dotRoof} from './representativeRoofFinishMesh';

/** Complete grids only: bay-centred across rafters, regular rows down each slope. */
export function cedarGridSites(assembly:Assembly3D,covering?:RoofFinishGeometry):LightSite[]{
 const result:LightSite[]=[];
 const slopes=assembly.roofPlanes.length;
 for(const count of [2,4,6,9])for(const pattern of ['rows2','rows3'] as const){
  if(pattern==='rows3'&&count!==6&&count!==9)continue;
  if(pattern==='rows2'&&count===9)continue;
  const cols=pattern==='rows3'?3:2,rows=count/cols;
  const grid:LightSite[]=[];
  for(const [planeIndex,roof] of assembly.roofPlanes.entries()){
   const f=roofCoordinates(roof),datum=dotRoof(roof.boundary[0],f.n);
   const regions=covering?.regions.filter(r=>r.material==='solid'&&r.boundary.every(p=>Math.abs(dotRoof(p,f.n)-datum)<1)).map(r=>{
    const us=r.boundary.map(p=>dotRoof(p,f.u)),vs=r.boundary.map(p=>dotRoof(p,f.v));
    return {a:Math.min(...us),b:Math.max(...us),c:Math.min(...vs),d:Math.max(...vs)};
   }).sort((a,b)=>a.a-b.a||a.c-b.c)??[];
   if(!regions.length)continue;
   for(const [sectionIndex,region] of regions.entries()){
   if(count===2&&pattern==='rows2')result.push({id:`cedar-section-${planeIndex}-${sectionIndex}`,cedarSection:`section-${sectionIndex+1}`,cedarSlopes:slopes,cedarGrid:'section-marker',point:f.point((region.a+region.b)/2,(region.c+region.d)/2,-189),normal:f.n,diameter:110});
   const stations=[...new Set(assembly.members.filter(m=>m.role==='rafter').map(m=>Math.round(dotRoof(m.centerline.start,f.u))))].sort((a,b)=>a-b);
   const bays=stations.slice(1).flatMap((end,i)=>{const start=stations[i],centre=(start+end)/2;return end-start>=220&&centre>=region.a+110&&centre<=region.b-110?[centre]:[];});
   if(bays.length<cols)continue;
   const {a,b,c,d}=region;
   const minimumSpacing=count===9?1000:600;
   // Choose a complete spaced set, rather than rejecting a close snap when another bay fits.
   let chosen:number[]=[];let bestScore=Infinity;
   const choose=(from:number,values:number[])=>{
    if(values.length===cols){
     const score=values.reduce((sum,u,x)=>sum+(u-(a+(b-a)*(x+.5)/cols))**2,0)+((values[0]-a)-(b-values[values.length-1]))**2;
     if(score<bestScore){chosen=[...values];bestScore=score;}return;
    }
    for(let k=from;k<=bays.length-(cols-values.length);k++)if(!values.length||bays[k]-values[values.length-1]>=minimumSpacing)choose(k+1,[...values,bays[k]]);
   };
   choose(0,[]);
   if(chosen.length!==cols||(rows>1&&(d-c)/rows<minimumSpacing))continue;
   for(const [x,u] of chosen.entries())for(let y=0;y<rows;y++){
    const v=c+(d-c)*(y+.5)/rows;
    if(!(u>=a+110&&u<=b-110&&v>=c+110&&v<=d-110))continue;
    let point=f.point(u,v,-189),normal=f.n;
    if(assembly.family==='box'){const mesh=covering?.meshes.find(m=>m.kind==='cedar');if(mesh){point={...point,z:Math.min(...mesh.positions.filter((_,k)=>k%3===2))-2};normal={x:0,y:0,z:1};}}
    grid.push({id:`cedar-${count}-${pattern}-${planeIndex}-${sectionIndex}-${x}-${y}`,cedarSection:`section-${sectionIndex+1}`,cedarSlopes:slopes,cedarGrid:`${count}-${pattern}`,point,normal,diameter:110});
   }
   }
  }
  for(const section of new Set(grid.map(s=>s.cedarSection))){const complete=grid.filter(s=>s.cedarSection===section);if(complete.length===count*slopes)result.push(...complete);}
 }
 return result;
}
export function layoutCedarLights(sites:LightSite[],count:number,pattern:'rows2'|'rows3'='rows2'){
 return sites.filter(s=>s.cedarGrid===`${count}-${pattern}`);
}
