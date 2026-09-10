import type {Assembly3D,Point3,AssemblyMember3D} from './contracts';
import type {RoofFinishGeometry} from './representativeRoofFinishTypes';
import {roofCoordinates,dotRoof} from './representativeRoofFinishMesh';
export type LightLayout='even'|'perimeter'|'central';
export type RafterLightAmount='off'|'low'|'medium'|'high';
export type PergolaLighting={rafterAmount?:RafterLightAmount;rafterCount:number;cedarCount:number;rafterLayout:LightLayout;cedarLayout:LightLayout;strips:string[]};
export type LightSite={id:string;point:Point3;normal:Point3;diameter:number};
export type StripSite={id:string;label:string;start:Point3;end:Point3;normal:Point3;perimeter:boolean;rafter:boolean};
const add=(p:Point3,n:Point3,k:number)=>({x:p.x+n.x*k,y:p.y+n.y*k,z:p.z+n.z*k});
const within=(p:Point3,points:Point3[],margin=0)=>p.x>=Math.min(...points.map(v=>v.x))+margin&&p.x<=Math.max(...points.map(v=>v.x))-margin&&p.y>=Math.min(...points.map(v=>v.y))+margin&&p.y<=Math.max(...points.map(v=>v.y))-margin;
function under(m:AssemblyMember3D,p:Point3){return add(p,m.localFrame.zAxis,-m.profile.depthMm/2);}
export function pergolaLightSites(assembly:Assembly3D,covering?:RoofFinishGeometry){
 const strips:StripSite[]=[],rafters:LightSite[]=[],cedar:LightSite[]=[];
 const eligible=assembly.members.filter(m=>['rafter','beam','gutter','ledger','ridge'].includes(m.role));
 const outline=assembly.outline,w=Math.max(...outline.map(p=>p.x)),d=Math.max(...outline.map(p=>p.y));
 const roofSolid=(p:Point3)=>covering?.regions.some(r=>r.material==='solid'&&within(p,r.boundary,-1));
 const timber=(p:Point3)=>covering?.battenBoundaries?.some(b=>within(p,b,-25));
 let r=0,b=0;
 for(const m of eligible){
  const start=under(m,m.centerline.start),end=under(m,m.centerline.end),mid={x:(start.x+end.x)/2,y:(start.y+end.y)/2,z:(start.z+end.z)/2};
  // Concealed frame behind a cedar ceiling is not an available mounting face.
  if(['rafter','ridge'].includes(m.role)&&roofSolid(mid))continue;
  const hasOuterGutter=m.role==='beam'&&assembly.members.some(g=>g.role==='gutter'&&Math.abs(g.centerline.start.y-start.y)<180&&g.centerline.start.y>start.y&&Math.abs(g.centerline.end.y-g.centerline.start.y)<1);
  const perimeter=!hasOuterGutter&&m.role!=='ledger'&&((Math.abs(start.x-end.x)<1&&(start.x<120||start.x>w-120))||(Math.abs(start.y-end.y)<1&&start.y>d-180));
  if(!(m.role==='rafter'&&covering?.battenBoundaries?.length))strips.push({id:m.id,label:m.role==='rafter'?'Rafter '+(++r):'Beam '+(++b),start,end,normal:m.localFrame.zAxis,perimeter,rafter:m.role==='rafter'});
  if(m.role==='rafter')for(const i of [25,50,75]){
   const t=i/100,p={x:start.x+(end.x-start.x)*t,y:start.y+(end.y-start.y)*t,z:start.z+(end.z-start.z)*t};
   if(!roofSolid(p)&&!timber(p))rafters.push({id:m.id+'-'+i,point:add(p,m.localFrame.zAxis,-2),normal:m.localFrame.zAxis,diameter:40});
  }
 }
 for(const [i,roof] of assembly.roofPlanes.entries()){
  const f=roofCoordinates(roof),datum=dotRoof(roof.boundary[0],f.n);
  const regions=covering?.regions.filter(r=>r.material==='solid'&&r.boundary.every(p=>Math.abs(dotRoof(p,f.n)-datum)<1))??[];
  for(const [j,region] of regions.entries()){
   const us=region.boundary.map(p=>dotRoof(p,f.u)),vs=region.boundary.map(p=>dotRoof(p,f.v));
   const a=Math.min(...us),b=Math.max(...us),c=Math.min(...vs),d=Math.max(...vs);
   if(b-a<220||d-c<220)continue;
   const nx=Math.max(1,Math.floor((b-a)/400)),ny=Math.max(1,Math.floor((d-c)/500));
   for(let x=0;x<nx;x++)for(let y=0;y<ny;y++){
    let p=f.point(a+(b-a)*(x+.5)/nx,c+(d-c)*(y+.5)/ny,-189),normal=f.n;
    if(assembly.family==='box'){const mesh=covering?.meshes.find(m=>m.kind==='cedar');if(mesh){p={...p,z:Math.min(...mesh.positions.filter((_,k)=>k%3===2))-2};normal={x:0,y:0,z:1};}}
    cedar.push({id:'cedar-'+i+'-'+j+'-'+x+'-'+y,point:p,normal,diameter:110});
   }
  }
 }
 return {strips,rafters,cedar};
}
export function layoutLights(sites:LightSite[],count:number,layout:LightLayout):LightSite[]{
 if(!sites.length||!count)return [];
 const xs=sites.map(s=>s.point.x),ys=sites.map(s=>s.point.y),left=Math.min(...xs),right=Math.max(...xs),near=Math.min(...ys),far=Math.max(...ys);
 const width=Math.max(1,right-left),depth=Math.max(1,far-near),n=Math.min(count,sites.length),cols=Math.max(1,Math.round(Math.sqrt(n*width/depth))),rows=Math.ceil(n/cols),remaining=[...sites],result:LightSite[]=[];
 for(let i=0;i<n;i++){
  let x:number,y:number;
  if(layout==='perimeter'){
   const t=(i+.5)*(2*width+2*depth)/n;
   if(t<width){x=left+t;y=near;}else if(t<width+depth){x=right;y=near+t-width;}else if(t<2*width+depth){x=right-(t-width-depth);y=far;}else{x=left;y=far-(t-2*width-depth);}
  }else{
   const row=Math.floor(i/cols),inRow=Math.min(cols,n-row*cols),scale=layout==='central'?.45:1;
   x=(left+right)/2+((i%cols+.5)/inRow-.5)*width*scale;y=(near+far)/2+((row+.5)/rows-.5)*depth*scale;
  }
  remaining.sort((a,b)=>((a.point.x-x)**2+(a.point.y-y)**2)-((b.point.x-x)**2+(b.point.y-y)**2));result.push(remaining.shift()!);
 }
 return result;
}

/** One or two fixed positions per member; mirrored alternate pattern across the roof. */
export function layoutRafterLights(sites:LightSite[],amount:RafterLightAmount):LightSite[]{
 if(amount==='off')return [];
 const groups=new Map<string,LightSite[]>();
 for(const site of sites){const id=site.id.slice(0,site.id.lastIndexOf('-'));groups.set(id,[...(groups.get(id)??[]),site]);}
 const members=[...groups.values()];
 return members.flatMap((group,i)=>{
  if(amount!=='high'&&Math.min(i,members.length-1-i)%2!==0)return [];
  const wanted=amount==='low'?['50']:['25','75'];
  const result=group.filter(s=>wanted.includes(s.id.slice(s.id.lastIndexOf('-')+1)));
  return result.length===wanted.length?result:[];
 });
}
