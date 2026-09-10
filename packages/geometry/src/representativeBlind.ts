import type { Point3 } from './contracts';
import type { BlindOpening } from './representativeBlindOpenings';
export type BlindMesh = {id:string;kind:'frame'|'fabric'|'infill';positions:number[];indices:number[]};
export function buildRepresentativeBlind(opening:BlindOpening, options:{cover:'NONE'|'FLASHING'|'PELMET';lowered:number;infill:boolean}):BlindMesh[] {
  const {start,end,width,top,side}=opening;
  const u={x:(end.x-start.x)/width,y:(end.y-start.y)/width};
  const n=side==='front'?{x:0,y:1}:side==='left'?{x:-1,y:0}:{x:1,y:0};
  const point=(x:number,y:number,z:number):Point3=>({x:start.x+u.x*x+n.x*y,y:start.y+u.y*x+n.y*y,z});
  const meshes:BlindMesh[]=[];
  const mesh=(id:string,kind:BlindMesh['kind'])=>{const m={id:opening.id+'-'+id,kind,positions:[] as number[],indices:[] as number[]};meshes.push(m);return m;};
  const quad=(m:BlindMesh,p:Point3[])=>{const i=m.positions.length/3;p.forEach(v=>m.positions.push(v.x,v.y,v.z));m.indices.push(i,i+1,i+2,i,i+2,i+3);};
  function box(m:BlindMesh,x1:number,x2:number,y1:number,y2:number,z1:number,z2:number) {
    const p=[point(x1,y1,z1),point(x2,y1,z1),point(x2,y2,z1),point(x1,y2,z1),point(x1,y1,z2),point(x2,y1,z2),point(x2,y2,z2),point(x1,y2,z2)];
    for(const face of [[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]]) quad(m,face.map(i=>p[i]));
  }
  const frame=mesh('hardware','frame');
  const pelmet=top>2800?165:135;
  const blindTop=top-pelmet, bottom=30+(blindTop-82)*(1-options.lowered/100);
  box(frame,0,30,-12,12,0,top-40);box(frame,width-30,width,-12,12,0,top-40);
  box(frame,25,width-25,-25,25,bottom,bottom+52);
  // The uncovered roll stays visible; covered versions have the same underlying roll.
  const radius=options.lowered===100?34:50;
  for(let i=0;i<24;i++) {
    const a=i*Math.PI/12,b=(i+1)*Math.PI/12;
    quad(frame,[point(20,Math.cos(a)*radius,top-65+Math.sin(a)*radius),point(width-20,Math.cos(a)*radius,top-65+Math.sin(a)*radius),point(width-20,Math.cos(b)*radius,top-65+Math.sin(b)*radius),point(20,Math.cos(b)*radius,top-65+Math.sin(b)*radius)]);
  }
  if(options.cover!=='NONE') box(frame,0,width,65,68,top-pelmet,top);
  if(options.cover==='PELMET') {
    box(frame,0,width,-68,68,top-3,top);
    box(frame,0,width,-68,-65,top-pelmet,top);
    box(frame,0,3,-68,68,top-pelmet,top);box(frame,width-3,width,-68,68,top-pelmet,top);
  }
  if(options.lowered>0) quad(mesh('screen','fabric'),[point(30,0,blindTop),point(width-30,0,blindTop),point(width-30,0,bottom+52),point(30,0,bottom+52)]);
  if(opening.headerDepth) {
    box(frame,0,width,-25,25,top,top+opening.headerDepth);
    if(options.infill) {
      const m=mesh('triangle','infill');
      for(let i=1;i<opening.roofLine.length;i++) {
        const a=opening.roofLine[i-1],b=opening.roofLine[i];
        quad(m,[{...a,z:top+opening.headerDepth+2},{...b,z:top+opening.headerDepth+2},{...b,z:Math.max(b.z,top+opening.headerDepth+2)},{...a,z:Math.max(a.z,top+opening.headerDepth+2)}]);
      }
    }
  }
  if(opening.needsJamb) box(frame,-50,0,-25,25,0,top+opening.headerDepth);
  return meshes;
}
