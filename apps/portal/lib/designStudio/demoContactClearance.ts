import type {Point3} from '@sp/geometry';
import {websiteProductPhysical} from './websiteProductPhysical';
import {solveStudioHouse,houseWorld} from './studioHouseGeometry';
import {boxedHouseSoffits} from './studioHouseWebsiteContact';
import type {StudioHouse,HouseSide} from './studioHouseScene';

type Row=Parameters<typeof websiteProductPhysical>[0];
type Pose={x:number;y:number;rotation:number};
const GAP=5;
function bounds(points:Point3[]){return {x0:Math.min(...points.map(p=>p.x)),x1:Math.max(...points.map(p=>p.x)),y0:Math.min(...points.map(p=>p.y)),y1:Math.max(...points.map(p=>p.y)),z0:Math.min(...points.map(p=>p.z)),z1:Math.max(...points.map(p=>p.z))};}
function clip(points:Point3[],axis:'x'|'y',limit:number,lower:boolean){
 const out:Point3[]=[];for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length],inside=(p:Point3)=>lower?p[axis]>=limit:p[axis]<=limit;
 if(inside(a))out.push(a);if(inside(a)!==inside(b)){const t=(limit-a[axis])/(b[axis]-a[axis]);out.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t});}}
 return out;
}
/** Conservative local separation, not a general intersection solver. Each actual
 * obstruction is bounded in its house-side frame and expanded 5 mm for gutters. Other surfaces require nonpenetration; the
 * actual fascia outer face permits intended contact. The returned gap is
 * clearance above each requirement plus 5 mm (5 means every requirement met).
 * Collision-only accessory bounds and posts never become join witnesses. */
export function localDemoClearance(h:StudioHouse,side:HouseSide,row:Row,pose:Pose){
 const geometry=solveStudioHouse(h),angle=(Number(h.position.rotationDeg)+(side==='rear'?0:side==='front'?180:side==='right'?-90:90))*Math.PI/180;
 const frame=(p:Point3)=>({x:p.x*Math.cos(angle)+p.y*Math.sin(angle),y:-p.x*Math.sin(angle)+p.y*Math.cos(angle),z:p.z});
 const physical=websiteProductPhysical(row,true),rotation=pose.rotation*Math.PI/180;
 const world=(p:Point3)=>frame({x:pose.x+p.x*Math.cos(rotation)-p.y*Math.sin(rotation),y:pose.y+p.x*Math.sin(rotation)+p.y*Math.cos(rotation),z:p.z});
 const solids=geometry.model.solids!;
 const obstacles=[...solids.linearSolids,...solids.surfaceSolids].filter(s=>s.kind!=='wall'&&s.renderMesh?.vertices.length).map(s=>({id:s.id,margin:s.kind==='fascia'?0:GAP,box:bounds(s.renderMesh!.vertices.map(p=>frame(houseWorld(h,p))))}));
 obstacles.push(...boxedHouseSoffits(geometry).map(s=>({id:`boxed-soffit-${s.side}`,margin:GAP,box:bounds(s.world.map(frame))})));
 let gap=Infinity,witness:{product:string;house:string}|null=null;
 const record=(top:number,id:string,o:typeof obstacles[number])=>{const value=o.box.z0-top+GAP-o.margin;if(value<gap){gap=value;witness={product:id,house:o.id};}};
 for(const face of physical.collisionFaces){const vertices=face.points.map(world);for(const o of obstacles){const b=bounds(vertices);if(b.x1<=o.box.x0-o.margin+1e-7||b.x0>=o.box.x1+o.margin-1e-7||b.y1<=o.box.y0-o.margin+1e-7||b.y0>=o.box.y1+o.margin-1e-7)continue;let part=vertices;for(const [axis,lo,hi] of [['x',o.box.x0-o.margin,o.box.x1+o.margin],['y',o.box.y0-o.margin,o.box.y1+o.margin]] as const)part=clip(clip(part,axis,lo,true),axis,hi,false);if(part.length)record(Math.max(...part.map(p=>p.z)),face.id,o);}}
 for(const component of physical.collisionBounds){const b=bounds(component.points.map(world));for(const o of obstacles)if(b.x1>o.box.x0-o.margin+1e-7&&b.x0<o.box.x1+o.margin-1e-7&&b.y1>o.box.y0-o.margin+1e-7&&b.y0<o.box.y1+o.margin-1e-7)record(b.z1,component.id,o);}
 return {gapMm:gap,requiredDropMm:Math.max(0,GAP-gap),witness};
}
