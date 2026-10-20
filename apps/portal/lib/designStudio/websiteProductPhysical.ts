import * as THREE from 'three';
import {solvePergolaPreview} from '@sp/configurator/geometry';
import {sidePanelSupports,effectiveLightingLayout,DEFAULT_LIGHTING,availableRafterSpots} from '@sp/configurator/website';
import {pergolaLightSites,buildPergolaInteractionAnchors,buildRepresentativeBlind,buildRepresentativeSidePanel,representativeBlindOpenings,type Point3,type ViewerSceneMemberPrismObject} from '@sp/geometry';
import {buildClippedBoxGeometry,buildClippedProfileExtrusionGeometry,buildProfileExtrusionGeometry,buildPolygonSlabGeometry} from '@sp/geometry-viewer/three';
import type {resolveStudioWebsiteDesign} from './websiteDesign';
export type PhysicalFace={id:string;points:Point3[]};
export type WebsitePhysicalProduct={points:Point3[];faces:PhysicalFace[];edges:ReturnType<typeof buildPergolaInteractionAnchors>['edges'];collisionFaces:PhysicalFace[];collisionBounds:{id:string;points:Point3[]}[]};
/** Uses the same member/profile/end-cut and thick roof primitives as the viewer.
 * Accessories contribute exclusion bounds only; they never establish a join. */
export function websiteProductPhysical(row:{error:string|null;design:Extract<ReturnType<typeof resolveStudioWebsiteDesign>,{ok:true}>['value']|null;geometryOptions?:Parameters<typeof solvePergolaPreview>[2]},includeCollision=false):WebsitePhysicalProduct{
 if(row.error||!row.design)throw Error(row.error??'Product unavailable.');
 const geometry=solvePergolaPreview(row.design.input,row.design.roof,row.geometryOptions).geometry;
 if(!geometry)throw Error('Product geometry unavailable.');
 const points:Point3[]=[],faces:PhysicalFace[]=[],collisionFaces:PhysicalFace[]=[],collisionBounds:{id:string;points:Point3[]}[]=[];
 function buffer(id:string,g:THREE.BufferGeometry,transform?:(p:Point3)=>Point3,witness=true){
  const attribute=g.getAttribute('position'),index=g.getIndex();
  const vertex=(i:number)=>{const n=index?index.getX(i):i;const p={x:attribute.getX(n),y:attribute.getY(n),z:attribute.getZ(n)};return transform?transform(p):p;};
  if(attribute)for(let i=0;i<(index?.count??attribute.count);i+=3){const triangle=[vertex(i),vertex(i+1),vertex(i+2)];points.push(...triangle);if(includeCollision)collisionFaces.push({id,points:triangle});if(witness)faces.push({id,points:triangle});}
  g.dispose();
 }
 for(const member of geometry.viewerScene.layers.flatMap(l=>l.objects).filter((o):o is ViewerSceneMemberPrismObject=>o.type==='member_prism')){
  const midpoint={x:(member.centerline.start.x+member.centerline.end.x)/2,y:(member.centerline.start.y+member.centerline.end.y)/2,z:(member.centerline.start.z+member.centerline.end.z)/2};
  const axis=new THREE.Vector3().subVectors(new THREE.Vector3(member.centerline.end.x,member.centerline.end.y,member.centerline.end.z),new THREE.Vector3(member.centerline.start.x,member.centerline.start.y,member.centerline.start.z)).normalize();
  const y=new THREE.Vector3(member.localFrame.yAxis.x,member.localFrame.yAxis.y,member.localFrame.yAxis.z).normalize(),z=new THREE.Vector3(member.localFrame.zAxis.x,member.localFrame.zAxis.y,member.localFrame.zAxis.z).normalize();
  const transform=(p:Point3)=>({x:midpoint.x+axis.x*p.x+y.x*p.y+z.x*p.z,y:midpoint.y+axis.y*p.x+y.y*p.y+z.y*p.z,z:midpoint.z+axis.z*p.x+y.z*p.y+z.z*p.z});
  const mesh=member.renderMode==='outline_extrusion'?(buildClippedProfileExtrusionGeometry(member,midpoint)??buildProfileExtrusionGeometry(member.profile,member.lengthMm)):(buildClippedBoxGeometry(member,midpoint)??new THREE.BoxGeometry(member.lengthMm,member.profile.widthMm,member.profile.depthMm));
  buffer(member.sourceId,mesh,transform,member.role!=='post');
  // Composite post end caps can be wider than the profile body. Include their
  // explicit extents conservatively, but never offer them as connection faces.
  const meta=member.metadata;
  if(meta&&typeof meta.endCapWidthMm==='number'&&typeof meta.endCapDepthMm==='number')buffer(`${member.sourceId}:caps`,new THREE.BoxGeometry(member.lengthMm,meta.endCapWidthMm,meta.endCapDepthMm),transform,false);
 }
 for(const p of geometry.assembly.roofCladdingPanels)buffer(p.id,buildPolygonSlabGeometry(p.boundary,p.plane,p.thicknessMm));
 for(const flashing of geometry.assembly.roofFlashings??[])for(const wing of flashing.wings)buffer(`${flashing.id}:${wing.id}`,buildPolygonSlabGeometry(wing.boundary,wing.plane,flashing.thicknessMm));
 function collect(value:unknown):void{
  if(Array.isArray(value)){value.forEach(collect);return;}if(!value||typeof value!=='object')return;
  const o=value as Record<string,unknown>;const start=points.length;
  if(Array.isArray(o.positions)){const values=o.positions;if(values.length%3||values.some(v=>typeof v!=='number'||!Number.isFinite(v)))throw Error('Physical mesh unavailable.');for(let i=0;i<values.length;i+=3)points.push({x:values[i] as number,y:values[i+1] as number,z:values[i+2] as number});}
  if(Array.isArray(o.boundary))for(const p of o.boundary as Point3[])if([p.x,p.y,p.z].every(Number.isFinite))points.push(p);
  if(includeCollision&&Array.isArray(o.positions)&&Array.isArray(o.indices)){
   const vertices=points.slice(start),indices=o.indices as number[];
   if(indices.length%3||indices.some(i=>!Number.isInteger(i)||i<0||i>=vertices.length))throw Error('Physical mesh indices unavailable.');
   for(let i=0;i<indices.length;i+=3)collisionFaces.push({id:String(o.id??'cover-or-accessory'),points:[vertices[indices[i]],vertices[indices[i+1]],vertices[indices[i+2]]]});
  }
  // Covering region boundaries describe material allocation, not rendered mesh.
  // Indexed covering/blind/panel triangles above own collision coverage.
  Object.entries(o).filter(([key])=>key!=='positions'&&key!=='boundary').forEach(([,v])=>collect(v));
 }
 collect(geometry.covering);
 const sites=pergolaLightSites(geometry.assembly,geometry.covering),lighting=row.design.roof.lighting??DEFAULT_LIGHTING;
 const layout=effectiveLightingLayout({...sites,rafters:availableRafterSpots(sites.rafters,lighting.strips??[])},lighting);
 // Conservative fixture bounds include the 16mm strip body/diffuser and
 // spot diameter used by the shared PergolaLightFixtures presentation owner.
 for(const spot of [...layout.rafters,...layout.cedar]){const start=points.length;const radius=Math.max(spot.diameter/2,4);for(const x of [-radius,radius])for(const y of [-radius,radius])for(const z of [-radius,radius])points.push({x:spot.point.x+x,y:spot.point.y+y,z:spot.point.z+z});if(includeCollision)collisionBounds.push({id:'light',points:points.slice(start)});}
 for(const strip of layout.strips){const start=points.length;for(const p of [strip.start,strip.end])for(const x of [-17,17])for(const y of [-17,17])for(const z of [-17,17])points.push({x:p.x+x,y:p.y+y,z:p.z+z});if(includeCollision)collisionBounds.push({id:'light-strip',points:points.slice(start)});}
 const openings=representativeBlindOpenings(geometry.assembly);
 for(const b of row.design.roof.blinds??[]){const o=openings.find(o=>o.id===b.opening);if(!o)throw Error(`Blind ${b.opening} unavailable.`);collect(buildRepresentativeBlind(o,b));}
 for(const p of row.design.roof.sidePanels??[]){const o=openings.find(o=>o.id===p.opening);if(!o)throw Error(`Side ${p.opening} unavailable.`);collect(buildRepresentativeSidePanel(o,p,sidePanelSupports(o,p)));}
 if(!points.length||points.some(p=>![p.x,p.y,p.z].every(Number.isFinite)))throw Error('Physical bounds unavailable.');
 return {points,faces,collisionFaces,collisionBounds,edges:buildPergolaInteractionAnchors(geometry.assembly).edges};
}
