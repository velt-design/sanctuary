import {solvePergolaPreview} from '@sp/configurator/geometry';
import type {StudioAuthoringEdit} from '@/lib/designStudio/authoringView';
import {websiteComposition,transformWebsitePoint,websitePosition} from '@/lib/designStudio/websiteComposition';
import {parseStudioWebsiteDesign,resolveStudioWebsiteDesign,type StudioWebsiteDesign} from '@/lib/designStudio/websiteDesign';
import {studioHouseScene} from '@/lib/designStudio/studioHouseScene';
import {applyResolvedStudioAttachment,applyResolvedStudioDetachment,detachStudioPergola,independentStudioDatum} from '@/lib/designStudio/studioHouseCommands';
import {websiteProductPhysical,type WebsitePhysicalProduct} from '@/lib/designStudio/websiteProductPhysical';
import {websiteConnectionEdge} from '@/lib/designStudio/websiteConnectionEdge';
import {parseWebsiteJoins} from '@/lib/designStudio/websiteJoinIntent';
import {contactWebsiteEdges} from '@/lib/designStudio/websiteJoinGeometry';
import {prepareGesture,type GestureCache,type DemoMethod} from './gesturePreview';
import {physicalFootprint} from './finitePlacement';

type Row=ReturnType<typeof websiteComposition>[number];
type Variant={hull:{x:number;y:number}[];physical:WebsitePhysicalProduct;outline:{x:number;y:number}[];connection:ReturnType<typeof websiteConnectionEdge>};
type Target=GestureCache['candidates'][number];
export type GestureTemplatePack={version:'demo.gesture.v1';fingerprint:string;variants:Record<string,Variant>;methods:Record<string,{targets:GestureCache['targets'];unavailable:string|null;candidates:Pick<Target,'key'|'target'|'choice'|'tangent'|'travel'|'pose'|'height'>[]}>};
const methods:DemoMethod[]=['facade','fascia','soffit'];
export function templateFingerprint(edit:StudioAuthoringEdit){
 return JSON.stringify({houses:studioHouseScene(edit.site,edit.spatial)?.houses,objects:edit.objectOptions.map(r=>{const p=parseStudioWebsiteDesign(r.values.websiteDesign,r.objectId);if(!p.ok)throw Error(p.message);const selection=structuredClone(p.value.selection);delete (selection.input as Partial<typeof selection.input>).connection;delete selection.roof.attachmentIntent;return {id:r.objectId,selection,rawDimensions:p.value.rawDimensions,rawGaps:p.value.rawGaps,supportDatumMm:p.value.supportDatumMm,roofDatumBasis:p.value.roofDatumBasis};})});
}
// Raw edits are resolved into actual geometry before the last valid selection
// fields are replaced. Both worker identity and variants must retain that input.
function key(id:string,value:StudioWebsiteDesign,options:Row['geometryOptions']){return JSON.stringify({id,selection:value.selection,rawDimensions:value.rawDimensions,rawGaps:value.rawGaps,options});}
/** Worker-only preparation. Each reachable local variant is built once, not per pointer or current world pose. */
export function prepareGestureTemplates(edit:StudioAuthoringEdit):GestureTemplatePack{
 const pack:GestureTemplatePack={version:'demo.gesture.v1',fingerprint:templateFingerprint(edit),variants:{},methods:{}};
 const add=(row:Row)=>{if(!row.value||!row.design||!row.position||row.error)throw Error(row.error??'Invalid product');const k=key(row.object.id,row.value,row.geometryOptions);if(pack.variants[k])return;const geometry=solvePergolaPreview(row.design.input,row.design.roof,row.geometryOptions).geometry;if(!geometry)throw Error('Geometry unavailable');const physical=websiteProductPhysical(row);pack.variants[k]={physical,hull:physicalFootprint(physical.points),outline:geometry.plan.outline,connection:websiteConnectionEdge(geometry.assembly)};};
 for(const row of websiteComposition(edit)){
  add(row);if(row.studioAttachment)add(websiteComposition(detachStudioPergola(edit,row.object.id)).find(r=>r.object.id===row.object.id)!);
  for(const method of methods){const cache=prepareGesture(edit,row.object.id,method);pack.methods[`${row.object.id}:${method}`]={targets:cache.targets,unavailable:cache.unavailable,candidates:cache.candidates.map(c=>{
   add(websiteComposition(c.edit).find(r=>r.object.id===row.object.id)!);
   add(websiteComposition(detachStudioPergola(c.edit,row.object.id)).find(r=>r.object.id===row.object.id)!);
   const {key,target,choice,tangent,travel,pose,height}=c;return {key,target,choice,tangent,travel,pose,height};
  })};}
 }
 return pack;
}
function cachedRows(edit:StudioAuthoringEdit):Row[]{return websiteComposition(edit);}
function variant(pack:GestureTemplatePack,row:Row){const v=row.value&&pack.variants[key(row.object.id,row.value,row.geometryOptions)];if(!v)throw Error('This geometry has not been prepared.');return v;}
function joins(edit:StudioAuthoringEdit,rows:Row[],pack:GestureTemplatePack){const intent=edit.site.websiteJoins?parseWebsiteJoins(edit.site.websiteJoins).joins:[];return intent.map(join=>{
 const a=rows.find(r=>r.object.id===join.a.objectId),b=rows.find(r=>r.object.id===join.b.objectId),label=`${a?.object.label??'Removed pergola'} · ${join.a.edge} to ${b?.object.label??'Removed pergola'} · ${join.b.edge}`;
 try{if(!a?.position||!b?.position)throw Error('A joined object is unavailable.');contactWebsiteEdges(variant(pack,a).physical,join.a.edge,a.position,variant(pack,b).physical,join.b.edge,b.position);return {join,label,error:null};}catch(e){return {join,label,error:(e as Error).message};}
 });}
/** Only current scene intent is authored. Cached full edits are never reused. */
export function rebaseGestureTemplates(edit:StudioAuthoringEdit,pack:GestureTemplatePack):Map<string,GestureCache>{
 if(pack.version!=='demo.gesture.v1'||pack.fingerprint!==templateFingerprint(edit))throw Error('The geometry preparation belongs to another design.');
 const rows=cachedRows(edit),states=joins(edit,rows,pack),bank=new Map<string,GestureCache>();
 for(const row of rows){if(!row.position)throw Error('Invalid position');const local=variant(pack,row),bound=!!row.studioAttachment;
  const freeEdit=bound?applyResolvedStudioDetachment(edit,row.object.id,row.studioAttachment!.reference):edit;
  const free=cachedRows(freeEdit).find(r=>r.object.id===row.object.id)!,freeLocal=variant(pack,free);
  const original=local.hull.map(p=>transformWebsitePoint(p,row.position!)),freeOutline=freeLocal.hull.map(p=>transformWebsitePoint(p,free.position!));
  const face=[local.connection.start,local.connection.end].map(p=>transformWebsitePoint(p,row.position!));
  const lines=rows.filter(r=>r.object.id!==row.object.id).flatMap(r=>{const pts=variant(pack,r).outline.map(p=>transformWebsitePoint(p,r.position!));return pts.map((start,i)=>({id:`align:${r.object.id}:${i}`,sourceObjectId:r.object.id,edgeKind:'pergola_outline',label:r.object.label,start,end:pts[(i+1)%pts.length]}));});
  for(const method of methods){const source=pack.methods[`${row.object.id}:${method}`];const candidates=source.candidates.map(c=>{
   const next=applyResolvedStudioAttachment(edit,c.choice,{position:c.pose,supportDatumMm:c.height!}),nextRows=cachedRows(next),attached=nextRows.find(r=>r.object.id===row.object.id)!;
   return {...c,edit:next,points:variant(pack,attached).hull.map(p=>transformWebsitePoint(p,c.pose)),incidentJoins:states.filter(s=>s.join.a.objectId===row.object.id||s.join.b.objectId===row.object.id).map(s=>s.label),consequences:joins(next,nextRows,pack).filter(s=>s.error).map(s=>s.label+': needs repair')};
  });bank.set(`${row.object.id}:${method}`,{edit,id:row.object.id,method,row,bound,freeEdit,original,freeOutline,face,targets:source.targets,candidates,lines,unavailable:source.unavailable});}
 }
 return bank;
}
