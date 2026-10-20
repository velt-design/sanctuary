export type Point={x:number;y:number};
export type Segment={start:Point;end:Point};
/** Outer footprint of the actual solved members, roof and supplied accessories. */
export function physicalFootprint(points:Point[]):Point[]{
 const sorted=[...new Map(points.map(p=>[`${p.x},${p.y}`,{x:p.x,y:p.y}])).values()].sort((a,b)=>a.x-b.x||a.y-b.y);
 if(sorted.length<3)return sorted;
 const cross=(o:Point,a:Point,b:Point)=>(a.x-o.x)*(b.y-o.y)-(a.y-o.y)*(b.x-o.x);
 const half=(rows:Point[])=>{const out:Point[]=[];for(const p of rows){while(out.length>1&&cross(out[out.length-2],out[out.length-1],p)<=0)out.pop();out.push(p);}return out;};
 const lower=half(sorted),upper=half([...sorted].reverse());return [...lower.slice(0,-1),...upper.slice(0,-1)];
}
export const dot=(a:Point,b:Point)=>a.x*b.x+a.y*b.y;
const subtract=(a:Point,b:Point)=>({x:a.x-b.x,y:a.y-b.y});
export function segmentAxis(edge:Segment){const d=subtract(edge.end,edge.start),length=Math.hypot(d.x,d.y);return {length,u:{x:d.x/length,y:d.y/length}};}
export function polygonEdges(points:Point[]):Segment[]{return points.map((start,i)=>({start,end:points[(i+1)%points.length]}));}
function pointDistance(p:Point,e:Segment){const {length,u}=segmentAxis(e);if(!length)return Math.hypot(p.x-e.start.x,p.y-e.start.y);const t=Math.max(0,Math.min(length,dot(subtract(p,e.start),u)));return Math.hypot(p.x-e.start.x-u.x*t,p.y-e.start.y-u.y*t);}
/** Finite edges, including endpoint/corner approaches; never an infinite axis. */
export function segmentDistance(a:Segment,b:Segment):number{
 const r=subtract(a.end,a.start),s=subtract(b.end,b.start),q=subtract(b.start,a.start),cross=(v:Point,w:Point)=>v.x*w.y-v.y*w.x,den=cross(r,s);
 if(Math.abs(den)>1e-9){const t=cross(q,s)/den,u=cross(q,r)/den;if(t>=0&&t<=1&&u>=0&&u<=1)return 0;}
 return Math.min(pointDistance(a.start,b),pointDistance(a.end,b),pointDistance(b.start,a),pointDistance(b.end,a));
}
export function footprintDistance(points:Point[],target:Segment){return Math.min(...polygonEdges(points).map(edge=>segmentDistance(edge,target)));}
/** Each finite edge supplies its NORMAL constraint only. Endpoint proximity is
 * eligibility, never an implicit second-axis translation. */
export function finiteAxisAlignments(points:Point[],target:Segment,tolerance:number){
 const {u,length}=segmentAxis(target);if(!length)return [];
 const axis=Math.abs(u.x)>.999?'y':Math.abs(u.y)>.999?'x':null;
 if(!axis)return [];
 const n={x:-u.y,y:u.x};
 return polygonEdges(points).flatMap((edge,movingEdge)=>{
  const moving=segmentAxis(edge);if(!moving.length||Math.abs(dot(moving.u,u))<.999)return [];
  const a=dot(subtract(edge.start,target.start),u),b=dot(subtract(edge.end,target.start),u);
  const gap=Math.max(0,-Math.max(a,b),Math.min(a,b)-length);
  const normal=dot(subtract(edge.start,target.start),n),distance=Math.hypot(gap,normal);
  if(distance>tolerance)return [];
  return [{axis:axis as 'x'|'y',movingEdge,moving:edge,target,correction:axis==='x'?-normal*n.x:-normal*n.y,distance,gap,normal}];
 });
}
export function finiteEdgeAlignment(points:Point[],target:Segment,tolerance:number){
 const best=finiteAxisAlignments(points,target,tolerance).sort((a,b)=>a.distance-b.distance)[0];
 return best?{...best,dx:best.axis==='x'?best.correction:0,dy:best.axis==='y'?best.correction:0}:null;
}
