import {technicalFaceShade,drawIsometricGroundCue} from './technicalIsometric';
import type {Point3} from '@sp/geometry';
import type {DocumentTriangle} from './mesh';
import {encodeRgbPng} from './png';
const yieldTurn=()=>new Promise<void>(resolve=>setImmediate(resolve));
/** Equal X/Y/Z foreshortening with parallel projection. Depth is interpolated
 * for every pixel, including crossing members; no painter ordering heuristic. */
export function trueIsometric(p:Point3){return{x:(p.x-p.y)*Math.sqrt(3)/2,y:(p.x+p.y)/2-p.z,depth:p.x+p.y+p.z};}
export function documentIsometricFrame(triangles:readonly DocumentTriangle[],width=2000,height=1500){
 let loX=Infinity,hiX=-Infinity,loY=Infinity,hiY=-Infinity;
 for(const triangle of triangles)for(const original of triangle.points){const p=trueIsometric(original);loX=Math.min(loX,p.x);hiX=Math.max(hiX,p.x);loY=Math.min(loY,p.y);hiY=Math.max(hiY,p.y);}
 const scale=Math.min((width-60)/Math.max(hiX-loX,1),(height-60)/Math.max(hiY-loY,1));return{loX,loY,scale,ox:(width-(hiX-loX)*scale)/2,oy:(height-(hiY-loY)*scale)/2};
}
export async function renderDocumentIsometric(triangles:readonly DocumentTriangle[],options:{width?:number;height?:number;signal?:AbortSignal;technical?:boolean}={}){
 const width=options.width??2000,height=options.height??1500;
 if(!triangles.length||width>3000||height>2200)throw Error('Document geometry unavailable');
 const projected=triangles.map(t=>({...t,worldPoints:t.points,points:t.points.map(trueIsometric)}));
 const {loX,loY,scale,ox,oy}=documentIsometricFrame(triangles,width,height);
 const rgb=new Uint8Array(width*height*3);rgb.fill(255);const depth=new Float64Array(width*height);depth.fill(-Infinity);
 if(options.technical)await drawIsometricGroundCue({triangles,width,height,rgb,signal:options.signal,project:point=>{const p=trueIsometric(point);return{x:ox+(p.x-loX)*scale,y:oy+(p.y-loY)*scale};}});
 let work=0;
 for(const glass of [false,true])for(const t of projected){
  if(t.glass!==glass)continue;
  if(options.signal?.aborted)throw options.signal.reason;
  const [a,b,c]=t.points.map(p=>({x:ox+(p.x-loX)*scale,y:oy+(p.y-loY)*scale,z:p.depth}));
  const determinant=(b.y-c.y)*(a.x-c.x)+(c.x-b.x)*(a.y-c.y);if(Math.abs(determinant)<1e-8)continue;
  const left=Math.max(0,Math.floor(Math.min(a.x,b.x,c.x))),right=Math.min(width-1,Math.ceil(Math.max(a.x,b.x,c.x))),top=Math.max(0,Math.floor(Math.min(a.y,b.y,c.y))),bottom=Math.min(height-1,Math.ceil(Math.max(a.y,b.y,c.y)));
  const original=t.points,du={x:original[1].x-original[0].x,y:original[1].y-original[0].y,z:original[1].depth-original[0].depth},dv={x:original[2].x-original[0].x,y:original[2].y-original[0].y,z:original[2].depth-original[0].depth};
  let shade=.73+.25*Math.abs(du.x*dv.y-du.y*dv.x)/Math.max(1,Math.hypot(du.y*dv.z-du.z*dv.y,du.z*dv.x-du.x*dv.z,du.x*dv.y-du.y*dv.x));
  if(options.technical)shade=technicalFaceShade(t.worldPoints);
  for(let y=top;y<=bottom;y++){
   for(let x=left;x<=right;x++){const px=x+.5,py=y+.5,u=((b.y-c.y)*(px-c.x)+(c.x-b.x)*(py-c.y))/determinant,v=((c.y-a.y)*(px-c.x)+(a.x-c.x)*(py-c.y))/determinant,w=1-u-v;if(u<0||v<0||w<0)continue;
    const z=u*a.z+v*b.z+w*c.z,index=y*width+x;if(z<depth[index]-1e-5)continue;
    if(!glass)depth[index]=z;
    for(let k=0;k<3;k++)rgb[index*3+k]=glass?Math.round(rgb[index*3+k]*.86+t.colour[k]*.14):Math.round(t.colour[k]*shade);
   }
   if(++work%48===0){await yieldTurn();if(options.signal?.aborted)throw options.signal.reason;}
  }
 }
 return encodeRgbPng(width,height,rgb);
}
