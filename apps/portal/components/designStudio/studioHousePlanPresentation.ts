import type { Point3 } from '@sp/geometry';

type Point = {x:number;y:number};
type RoofFace = {boundary:Point3[];angle:number|null;span:number};

/** Display-only slope direction from the actual WORLD plane. Never supplies
 * geometry, drainage, roof pitch or sheet/fixing dimensions to another owner. */
function roofFace(boundary:Point3[]):RoofFace|null {
  if(boundary.length<3||boundary.some(p=>![p.x,p.y,p.z].every(Number.isFinite)))return null;
  const origin=boundary[0];
  for(let i=1;i<boundary.length-1;i++){
    const a={x:boundary[i].x-origin.x,y:boundary[i].y-origin.y,z:boundary[i].z-origin.z};
    const b={x:boundary[i+1].x-origin.x,y:boundary[i+1].y-origin.y,z:boundary[i+1].z-origin.z};
    const n={x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x};
    const length=Math.hypot(n.x,n.y,n.z);
    if(!Number.isFinite(length)||length===0)continue;
    const fall=Math.hypot(n.x,n.y);
    if(Math.abs(n.z)<=length*1e-9||fall<=length*1e-9)return {boundary,angle:null,span:0};
    const sign=Math.sign(n.z),dx=n.x*sign/fall,dy=n.y*sign/fall;
    const across=boundary.map(p=>(p.x-origin.x)*-dy+(p.y-origin.y)*dx);
    return {boundary,angle:Math.atan2(dy,dx)*180/Math.PI-90,span:Math.max(...across)-Math.min(...across)};
  }
  return {boundary,angle:null,span:0};
}

export function studioHousePlanPresentation(roof:Point3[][],unitsPerPixel:number){
  const faces=roof.flatMap(boundary=>{const face=roofFace(boundary);return face?[face]:[];});
  const units=Number.isFinite(unitsPerPixel)&&unitsPerPixel>0?unitsPerPixel:1;
  // Screen-readable illustration density, capped at80 lines per actual face.
  // This is intentionally not a construction sheet-spacing specification.
  const spacing=Math.max(18*units,...faces.map(face=>face.span/80));
  const edges=new Map<string,{start:Point;end:Point}>();
  for(const face of faces)face.boundary.forEach((start,i)=>{
    const end=face.boundary[(i+1)%face.boundary.length];
    if(start.x===end.x&&start.y===end.y)return;
    const a=`${start.x},${start.y}`,b=`${end.x},${end.y}`,key=[a,b].sort().join('|');
    if(!edges.has(key))edges.set(key,{start,end});
  });
  return {faces,spacing,units,outline:[...edges.values()].map(({start,end})=>`M ${start.x} ${start.y} L ${end.x} ${end.y}`).join(' ')};
}
