import type {Point3} from './contracts';
const dot=(a:Point3,b:Point3)=>a.x*b.x+a.y*b.y+a.z*b.z;
const sub=(a:Point3,b:Point3)=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z});
const unit=(p:Point3)=>{const l=Math.hypot(p.x,p.y,p.z);return {x:p.x/l,y:p.y/l,z:p.z/l};};

/** Fit the full 40 mm fitting in a gap, measured in the roof plane, not its plan projection. */
export function clearRafterLightPoint(start:Point3,end:Point3,normal:Point3,battens:Point3[][],target:number):Point3|null {
 const direction=sub(end,start),length=Math.hypot(direction.x,direction.y,direction.z),radius=20.1;
 if(length<=radius*2)return null;
 const blocked:Array<[number,number]>=[];
 for(const boundary of battens){
  if(boundary.length<4)continue;
  const origin=boundary[0],u=unit(sub(boundary[1],origin)),v=unit(sub(boundary[boundary.length-1],origin));
  const n={x:u.y*v.z-u.z*v.y,y:u.z*v.x-u.x*v.z,z:u.x*v.y-u.y*v.x};
  // Other roof slopes must not obscure this member in plan projection.
  if(Math.abs(dot(n,normal))<.999||Math.abs(dot(sub(start,origin),n))>5)continue;
  let low=0,high=1;
  for(const axis of [u,v]){
   const coords=boundary.map(p=>dot(sub(p,origin),axis)),min=Math.min(...coords)-radius,max=Math.max(...coords)+radius;
   const a=dot(sub(start,origin),axis),delta=dot(direction,axis);
   if(Math.abs(delta)<1e-8){if(a<min||a>max){low=1;high=0;break;}}
   else {const t1=(min-a)/delta,t2=(max-a)/delta;low=Math.max(low,Math.min(t1,t2));high=Math.min(high,Math.max(t1,t2));}
  }
  if(low<=high)blocked.push([low,high]);
 }
 // Keep a two-light layout on opposite halves of the member.
 const min=target===.75?.5+radius/length:radius/length;
 const max=target===.25?.5-radius/length:1-radius/length;
 let gaps:Array<[number,number]>=[[min,max]];
 for(const [lo,hi] of blocked)gaps=gaps.flatMap(([a,b])=>hi<a||lo>b?[[a,b]]:[[a,Math.min(b,lo)],[Math.max(a,hi),b]].filter(([x,y])=>y-x>1e-7) as Array<[number,number]>);
 const candidates=gaps.map(([a,b])=>Math.max(a,Math.min(b,target)));
 candidates.sort((a,b)=>Math.abs(Math.abs(a-target)-Math.abs(b-target))<1e-7?(start.z<=end.z?a-b:b-a):Math.abs(a-target)-Math.abs(b-target));
 if(!candidates.length)return null;
 const t=candidates[0];return {x:start.x+direction.x*t,y:start.y+direction.y*t,z:start.z+direction.z*t};
}
