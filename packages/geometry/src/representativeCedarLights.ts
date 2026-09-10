import type {Assembly3D} from './contracts';
import type {RoofFinishGeometry} from './representativeRoofFinishTypes';
import type {LightSite} from './representativePergolaLighting';
import {roofCoordinates,dotRoof} from './representativeRoofFinishMesh';

/** Complete grids only: bay-centred across rafters, regular rows down each slope. */
export function cedarGridSites(assembly:Assembly3D,covering?:RoofFinishGeometry):LightSite[]{
 const result:LightSite[]=[];
 const paired=assembly.roofPlanes.length===2;
 for(const count of [2,4,6,9])for(const pattern of ['rows2','rows3'] as const){
  if(paired&&(count%2||pattern==='rows3'))continue;
  if(!paired&&pattern==='rows3'&&count!==6&&count!==9)continue;
  if(!paired&&pattern==='rows2'&&count===9)continue;
  const cols=paired?count/2:pattern==='rows3'?3:2,rows=paired?1:count/cols;
  const grid:LightSite[]=[];
  for(const [planeIndex,roof] of assembly.roofPlanes.entries()){
   const f=roofCoordinates(roof),datum=dotRoof(roof.boundary[0],f.n);
   const regions=covering?.regions.filter(r=>r.material==='solid'&&r.boundary.every(p=>Math.abs(dotRoof(p,f.n)-datum)<1)).map(r=>{
    const us=r.boundary.map(p=>dotRoof(p,f.u)),vs=r.boundary.map(p=>dotRoof(p,f.v));
    return {a:Math.min(...us),b:Math.max(...us),c:Math.min(...vs),d:Math.max(...vs)};
   })??[];
   if(!regions.length)continue;
   const stations=[...new Set(assembly.members.filter(m=>m.role==='rafter').map(m=>Math.round(dotRoof(m.centerline.start,f.u))))].sort((a,b)=>a-b);
   const bays=stations.slice(1).flatMap((end,i)=>{const start=stations[i],centre=(start+end)/2;return end-start>=220&&regions.some(r=>centre>=r.a+110&&centre<=r.b-110)?[centre]:[];});
   if(bays.length<cols)continue;
   const a=Math.min(...regions.map(r=>r.a)),b=Math.max(...regions.map(r=>r.b)),c=Math.min(...regions.map(r=>r.c)),d=Math.max(...regions.map(r=>r.d));
   // Reserve enough bays for each remaining column while snapping the regular grid.
   const chosen:number[]=[];let previous=-1;
   for(let x=0;x<cols;x++){
    const target=a+(b-a)*(x+.5)/cols;
    let best=previous+1;
    for(let k=previous+1;k<=bays.length-(cols-x);k++)if(Math.abs(bays[k]-target)<Math.abs(bays[best]-target))best=k;
    chosen.push(bays[best]);previous=best;
   }
   const minimumSpacing=count===9?1000:600;
   if(chosen.some((u,x)=>x>0&&u-chosen[x-1]<minimumSpacing)||(rows>1&&(d-c)/rows<minimumSpacing))continue;
   for(const [x,u] of chosen.entries())for(let y=0;y<rows;y++){
    const v=c+(d-c)*(y+.5)/rows;
    if(!regions.some(r=>u>=r.a+110&&u<=r.b-110&&v>=r.c+110&&v<=r.d-110))continue;
    let point=f.point(u,v,-189),normal=f.n;
    if(assembly.family==='box'){const mesh=covering?.meshes.find(m=>m.kind==='cedar');if(mesh){point={...point,z:Math.min(...mesh.positions.filter((_,k)=>k%3===2))-2};normal={x:0,y:0,z:1};}}
    grid.push({id:`cedar-${count}-${pattern}-${planeIndex}-${x}-${y}`,cedarGrid:`${count}-${pattern}`,point,normal,diameter:110});
   }
  }
  if(grid.length===count)result.push(...grid);
 }
 return result;
}
export function layoutCedarLights(sites:LightSite[],count:number,pattern:'rows2'|'rows3'='rows2'){
 return sites.filter(s=>s.cedarGrid===`${count}-${pattern}`);
}
