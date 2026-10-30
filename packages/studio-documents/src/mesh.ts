import * as THREE from 'three';
import type {Point3,ViewerSceneMemberPrismObject} from '@sp/geometry';
import {buildClippedBoxGeometry,buildClippedProfileExtrusionGeometry,buildProfileExtrusionGeometry,buildPolygonSlabGeometry} from '@sp/geometry-viewer/three/solids';
import type {StudioDocumentProduct,StudioClientDocumentSource} from './contract';
export type DocumentTriangle={points:[Point3,Point3,Point3];colour:[number,number,number];glass:boolean};
const frameColour=(product:StudioDocumentProduct):[number,number,number]=>product.frameFinish==='White'?[220,224,218]:[46,54,47];

/** Reads canonical clipped viewer primitives. It never substitutes unclipped
 * boxes when the shared member renderer has supplied profile/cut geometry. */
export function studioDocumentTriangles(product:StudioDocumentProduct,joins:StudioClientDocumentSource['joins']=[]):DocumentTriangle[]{
 const result:DocumentTriangle[]=[],frame=frameColour(product);
 function collect(g:THREE.BufferGeometry,colour:[number,number,number],glass=false,transform=(p:Point3)=>p){
  try{const a=g.getAttribute('position'),index=g.getIndex(),count=index?.count??a.count;
   const point=(i:number)=>{const n=index?index.getX(i):i;return transform({x:a.getX(n),y:a.getY(n),z:a.getZ(n)});};
   for(let i=0;i<count;i+=3)result.push({points:[point(i),point(i+1),point(i+2)],colour,glass});
  }finally{g.dispose();}
 }
 const members=product.viewerScene.layers.flatMap(l=>l.objects).filter((o):o is ViewerSceneMemberPrismObject=>o.type==='member_prism');
 for(const m of members){
  const midpoint={x:(m.centerline.start.x+m.centerline.end.x)/2,y:(m.centerline.start.y+m.centerline.end.y)/2,z:(m.centerline.start.z+m.centerline.end.z)/2};
  const x=new THREE.Vector3().subVectors(new THREE.Vector3(m.centerline.end.x,m.centerline.end.y,m.centerline.end.z),new THREE.Vector3(m.centerline.start.x,m.centerline.start.y,m.centerline.start.z)).normalize();
  const y=new THREE.Vector3(m.localFrame.yAxis.x,m.localFrame.yAxis.y,m.localFrame.yAxis.z).normalize(),z=new THREE.Vector3(m.localFrame.zAxis.x,m.localFrame.zAxis.y,m.localFrame.zAxis.z).normalize();
  const transform=(p:Point3)=>({x:midpoint.x+x.x*p.x+y.x*p.y+z.x*p.z,y:midpoint.y+x.y*p.x+y.y*p.y+z.y*p.z,z:midpoint.z+x.z*p.x+y.z*p.y+z.z*p.z});
  collect(m.renderMode==='outline_extrusion'?(buildClippedProfileExtrusionGeometry(m,midpoint)??buildProfileExtrusionGeometry(m.profile,m.lengthMm)):(buildClippedBoxGeometry(m,midpoint)??new THREE.BoxGeometry(m.lengthMm,m.profile.widthMm,m.profile.depthMm)),frame,false,transform);
 }
 for(const p of product.assembly.roofCladdingPanels)collect(buildPolygonSlabGeometry(p.boundary,p.plane,p.thicknessMm),[211,223,218],true);
 for(const flashing of product.assembly.roofFlashings??[])for(const w of flashing.wings)collect(buildPolygonSlabGeometry(w.boundary,w.plane,flashing.thicknessMm),[167,177,166]);
 for(const m of product.covering?.meshes??[]){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(m.positions,3));g.setIndex(m.indices);collect(g,m.kind==='cedar'?[174,133,91]:m.kind==='flashing'?[165,175,165]:[139,149,137]);}
 for(const join of joins.filter(j=>j.objectIds.includes(product.id)))for(const boundary of join.polygons){
  const r=-product.pose.rotation*Math.PI/180,local=boundary.map(p=>{const x=p.x-product.pose.x,y=p.y-product.pose.y;return{x:x*Math.cos(r)-y*Math.sin(r),y:x*Math.sin(r)+y*Math.cos(r),z:p.z};});
  for(let i=1;i<local.length-1;i++)result.push({points:[local[0],local[i],local[i+1]],colour:[125,111,87],glass:false});
 }
 for(const m of product.accessories){if(!m.indices.length){
  if(m.kind==='light'&&m.positions.length===6){const a=new THREE.Vector3(...m.positions.slice(0,3) as [number,number,number]),b=new THREE.Vector3(...m.positions.slice(3) as [number,number,number]);const g=new THREE.CylinderGeometry(4,4,a.distanceTo(b),6);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),b.clone().sub(a).normalize()));g.translate((a.x+b.x)/2,(a.y+b.y)/2,(a.z+b.z)/2);collect(g,[244,224,174]);}
  continue;
 }const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(m.positions,3));g.setIndex(m.indices);collect(g,m.kind==='acrylic'?[211,223,218]:m.kind==='timber'?[174,133,91]:m.kind==='fabric'?[119,124,111]:m.kind==='light'?[244,224,174]:frame,m.kind==='acrylic');}
 return result;
}
