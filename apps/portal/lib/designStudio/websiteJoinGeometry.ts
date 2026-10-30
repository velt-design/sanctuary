import type {Point3,PergolaInteractionEdgeId} from '@sp/geometry';
import type {WebsitePhysicalProduct} from './websiteProductPhysical';
export const JOIN_TOLERANCE_MM=1;
type Pose={x:number;y:number;rotation:number};
type P2={x:number;y:number};
export function joinEdge(product:WebsitePhysicalProduct,id:PergolaInteractionEdgeId,pose:Pose){
 const edge=product.edges.find(e=>e.id===id);if(!edge)throw Error('This named edge is unavailable.');
 const angle=pose.rotation*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle);
 const world=(p:Point3)=>({x:pose.x+p.x*c-p.y*s,y:pose.y+p.x*s+p.y*c,z:p.z});
 const normal={x:edge.outwardNormal.x*c-edge.outwardNormal.y*s,y:edge.outwardNormal.x*s+edge.outwardNormal.y*c};
 const tangent={x:-normal.y,y:normal.x},dot=(p:Point3)=>p.x*normal.x+p.y*normal.y;
 const points=product.points.map(world),plane=Math.max(...points.map(dot));
 const faces=product.faces.map(f=>({id:f.id,points:f.points.map(world)})).filter(f=>f.points.every(p=>Math.abs(dot(p)-plane)<1e-3));
 if(!faces.length)throw Error('This edge has no exposed structural or roof face; an accessory or other projection prevents contact.');
 const spans=faces.flatMap(f=>f.points.map(p=>p.x*tangent.x+p.y*tangent.y));
 return {normal,tangent,plane,faces,points,start:Math.min(...spans),end:Math.max(...spans)};
}
function area(points:P2[]){return points.reduce((n,p,i)=>{const q=points[(i+1)%points.length];return n+p.x*q.y-q.x*p.y;},0)/2;}
function intersection(a:P2[],b:P2[]){
 let output=a;if(area(b)<0)b=[...b].reverse();
 for(let i=0;i<b.length;i++){
  const p=b[i],q=b[(i+1)%b.length],inside=(v:P2)=>(q.x-p.x)*(v.y-p.y)-(q.y-p.y)*(v.x-p.x);const input=output;output=[];
  for(let j=0;j<input.length;j++){const x=input[j],y=input[(j+1)%input.length],dx=inside(x),dy=inside(y);if(dx>=-1e-8)output.push(x);if((dx>=0)!==(dy>=0)){const t=dx/(dx-dy);output.push({x:x.x+(y.x-x.x)*t,y:x.y+(y.y-x.y)*t});}}
  if(output.length<3)return [];
 }return output;
}
export function contactWebsiteEdges(a:WebsitePhysicalProduct,aEdge:PergolaInteractionEdgeId,aPose:Pose,b:WebsitePhysicalProduct,bEdge:PergolaInteractionEdgeId,bPose:Pose){
 const x=joinEdge(a,aEdge,aPose),y=joinEdge(b,bEdge,bPose);
 if(x.normal.x*y.normal.x+x.normal.y*y.normal.y>-.999999)throw Error('The selected edges must face each other.');
 if(Math.abs(x.plane+y.plane)>JOIN_TOLERANCE_MM)throw Error('The named edges no longer meet. Reposition to join or remove this join.');
 // Each full physical model lies behind its support plane; the opposing
 // half-spaces prove no material interpenetration across this contact.
 const project=(p:Point3)=>({x:p.x*x.tangent.x+p.y*x.tangent.y,y:p.z});
 for(const f of x.faces)for(const g of y.faces){const polygon=intersection(f.points.map(project),g.points.map(project));if(polygon.length>=3&&Math.abs(area(polygon))>1){
  const xs=polygon.map(p=>p.x),zs=polygon.map(p=>p.y);if(Math.max(...xs)-Math.min(...xs)>1e-3&&Math.max(...zs)-Math.min(...zs)>1e-3)return {aWitness:f.id,bWitness:g.id,areaMm2:Math.abs(area(polygon)),plane:x.plane,normal:x.normal,contact:polygon};
 }}throw Error('The named faces do not share physical contact at their current heights.');
}
export function alignWebsiteEdges(a:WebsitePhysicalProduct,aEdge:PergolaInteractionEdgeId,aPose:Pose,b:WebsitePhysicalProduct,bEdge:PergolaInteractionEdgeId,bPose:Pose,alignment:'start'|'centre'|'end'){
 const local=joinEdge(a,aEdge,{x:0,y:0,rotation:0}),target=joinEdge(b,bEdge,bPose);
 const rotation=(Math.atan2(-target.normal.y,-target.normal.x)-Math.atan2(local.normal.y,local.normal.x))*180/Math.PI;
 const turned=joinEdge(a,aEdge,{x:0,y:0,rotation});
 const t=target.tangent,range=(p:ReturnType<typeof joinEdge>)=>{const values=p.faces.flatMap(f=>f.points.map(v=>v.x*t.x+v.y*t.y));return [Math.min(...values),Math.max(...values)];};
 const ar=range(turned),br=range(target),i=alignment==='start'?0:1;
 const tangentDelta=alignment==='centre'?(br[0]+br[1]-ar[0]-ar[1])/2:br[i]-ar[i];
 const normalDelta=target.plane+turned.plane;
 const pose={x:target.normal.x*normalDelta+t.x*tangentDelta,y:target.normal.y*normalDelta+t.y*tangentDelta,rotation};
 const witness=contactWebsiteEdges(a,aEdge,pose,b,bEdge,bPose);return {pose,witness};
}
