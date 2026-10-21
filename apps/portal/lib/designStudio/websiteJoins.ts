import type {StudioAuthoringEdit} from './authoringView';
import type {StudioJsonObject} from './contracts';
import {websiteComposition} from './websiteComposition';
import {parseWebsiteJoins,type WebsiteJoin,type WebsiteJoins} from './websiteJoinIntent';
import {websiteProductPhysical} from './websiteProductPhysical';
import {alignWebsiteEdges,contactWebsiteEdges,joinEdge} from './websiteJoinGeometry';
export function websiteJoinStates(edit:Pick<StudioAuthoringEdit,'site'|'spatial'|'objectOptions'>){
 const joins=edit.site.websiteJoins?parseWebsiteJoins(edit.site.websiteJoins).joins:[],rows=websiteComposition(edit);
 return joins.map(join=>{
  const a=rows.find(r=>r.object.id===join.a.objectId),b=rows.find(r=>r.object.id===join.b.objectId);
  const label=`${a?.object.label??'Removed pergola'} · ${join.a.edge} to ${b?.object.label??'Removed pergola'} · ${join.b.edge}`;
  try{if(!a?.position||!b?.position)throw Error('A joined object is unavailable.');const witness=contactWebsiteEdges(websiteProductPhysical(a),join.a.edge,a.position,websiteProductPhysical(b),join.b.edge,b.position);return {join,label,error:null,witness};}
  catch(e){return {join,label,error:e instanceof Error?e.message:'Join unavailable.',witness:null};}
 });
}
/** Pure preview: original authored choices and all prior poses remain untouched. */
export function previewWebsiteJoin(edit:StudioAuthoringEdit,join:WebsiteJoin){
 const rows=websiteComposition(edit),a=rows.find(r=>r.object.id===join.a.objectId),b=rows.find(r=>r.object.id===join.b.objectId);
 if(!a?.position||!b?.position)throw Error('Choose two available pergolas.');
 if(a.object.attachment?.host||a.studioAttachment)throw Error(`${a.object.label} is attached to the house. Select the free pergola to move.`);
 const aligned=alignWebsiteEdges(websiteProductPhysical(a),join.a.edge,a.position,websiteProductPhysical(b),join.b.edge,b.position,join.alignment);
 const next=structuredClone(edit),object=next.spatial.pergolas.find(p=>p.id===a.object.id)!;
 object.position={originXMm:String(aligned.pose.x),originYMm:String(aligned.pose.y),rotationDeg:String(aligned.pose.rotation)};
 const existing=next.site.websiteJoins?parseWebsiteJoins(next.site.websiteJoins).joins:[];
 const value:WebsiteJoins={schemaVersion:'studio_website_joins.v1',joins:[...existing.filter(j=>j.id!==join.id),join]};
 parseWebsiteJoins(value,new Set(rows.map(r=>r.object.id)));next.site.websiteJoins=value as unknown as StudioJsonObject;
 const bad=websiteJoinStates(next).find(s=>s.error);if(bad)throw Error(`${bad.label}: ${bad.error}`);
 return {edit:next,pose:aligned.pose,witness:aligned.witness};
}
export function removeWebsiteJoin(edit:StudioAuthoringEdit,id:string){const next=structuredClone(edit);const value=parseWebsiteJoins(next.site.websiteJoins);value.joins=value.joins.filter(j=>j.id!==id);next.site.websiteJoins=value as unknown as StudioJsonObject;return next;}

/** Named physical member/roof faces, shared by Studio Plan callers. No house renderer dependency. */
export function websiteJoinTargets(edit:StudioAuthoringEdit,movingId:string){
 return websiteComposition(edit).filter(r=>r.object.id!==movingId&&!r.error&&r.position).flatMap(r=>{
  try{const physical=websiteProductPhysical(r);return physical.edges.flatMap(edge=>{try{const face=joinEdge(physical,edge.id,r.position!),n=face.normal,t=face.tangent;return [{id:r.object.id,edge:edge.id,label:`${r.object.label} · ${edge.id}`,start:{x:n.x*face.plane+t.x*face.start,y:n.y*face.plane+t.y*face.start},end:{x:n.x*face.plane+t.x*face.end,y:n.y*face.plane+t.y*face.end}}];}catch{return [];}});}catch{return [];}
 });
}
