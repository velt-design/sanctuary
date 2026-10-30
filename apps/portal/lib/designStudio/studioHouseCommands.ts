import {previewSupportDatum} from "@sp/configurator/geometry";
import {resolveStudioAttachment} from "./studioAttachmentResolver";
import {applyStudioHouseEdit} from './houseEditing';
import {websiteHouseTargets,resolveWebsiteAttachment} from './websiteAttachment';
import {parseStudioAuthoringEdit,type StudioAuthoringEdit} from './authoringView';
import {parseStudioWebsiteDesign,resolveStudioWebsiteDesign,type StudioWebsiteDesign} from './websiteDesign';
import {studioHouseScene,type StudioHouseScene,type StudioHouseAttachment,type HouseReference,type StudioHouse,type StudioHouseConnectionChoice} from './studioHouseScene';
import {studioHouseTargets,houseNumber,solveStudioHouse} from './studioHouseGeometry';
import type {StudioJsonObject} from './contracts';
import {StudioConnectionError} from './studioConnectionDiagnostics';

export {resolveStudioAttachment} from "./studioAttachmentResolver";

function valueFor(edit:StudioAuthoringEdit,id:string){const row=edit.objectOptions.find(r=>r.objectId===id);const parsed=parseStudioWebsiteDesign(row?.values.websiteDesign,id);if(!row||!parsed.ok)throw Error('Select a current website pergola.');return {row,value:parsed.value};}
function checked(edit:StudioAuthoringEdit){const p=parseStudioAuthoringEdit(edit);if(!p.ok)throw Error(p.message);return p.value;}
/** Resolve semantic side to the existing canonical host edge. Shared by the
 * actual writer and worker descriptors; array order never establishes identity. */
export function studioAttachmentCanonicalEdge(spatial:StudioAuthoringEdit['spatial'],house:StudioHouse,binding:Omit<StudioHouseAttachment,'reference'>){
 const target=studioHouseTargets(house,binding.method).find(t=>t.side===binding.edge&&t.kind===binding.kind);
 if(!target)throw Error('The canonical house edge is unavailable.');
 const dx=target.end.x-target.start.x,dy=target.end.y-target.start.y,len=Math.hypot(dx,dy);
 const edge=websiteHouseTargets(spatial).find(t=>t.sourceObjectId===binding.houseId&&t.edgeKind===(binding.kind==='wall'?'wall':'roof_eave')&&Math.abs(dx*(t.start.y-target.start.y)-dy*(t.start.x-target.start.x))/len<.01&&Math.abs(dx*(t.end.y-target.start.y)-dy*(t.end.x-target.start.x))/len<.01);
 if(!edge)throw Error('The selected surface has no canonical house edge.');
 return edge;
}
/** A read-only identity adapter for canonical host-only history. Never writes a
 * companion on load or guesses a semantic side from target array ordering. */
export function retainedStudioCanonicalBinding(edit:StudioAuthoringEdit,objectId:string,current:{position:HouseReference['position']|null;geometryOptions?:{supportDatumMm?:number}}):StudioHouseAttachment|null {
 const object=edit.spatial.pergolas.find(p=>p.id===objectId),host=object?.attachment?.host,datum=current.geometryOptions?.supportDatumMm;
 if(!object||!host||host.objectFamily!=='house_forms'||!current.position||datum===undefined||!Number.isFinite(datum))return null;
 const method=object.attachment?.method==='facade_ledger'?'facade':object.attachment?.method==='fascia_under_gutter'?'fascia':object.attachment?.method==='direct_to_soffit'?'soffit':null;
 try {
 const house=studioHouseScene(edit.site,edit.spatial)?.houses.find(h=>h.id===host.objectId);if(!house||!method)return null;
 const matches:StudioHouseAttachment[]=[];
 for(const target of studioHouseTargets(house,method).filter(t=>t.kind===(method==='facade'?'wall':'eave'))){
  const binding:StudioHouseAttachment={objectId,houseId:house.id,edge:target.side,kind:target.kind,method,contactBasis:'canonical-house.v1',reference:{position:current.position,supportDatumMm:datum}};
  try{if(studioAttachmentCanonicalEdge(edit.spatial,house,binding).id===host.edgeId)matches.push(binding);}catch{/* Other real sides are not this exact host. */}
 }
 return matches.length===1?matches[0]:null;
 }catch{return null;}// Unsupported legacy hosts require an explicit real edge.
}
export function writeStudioHouseScene(edit:StudioAuthoringEdit,scene:StudioHouseScene){
 const next=structuredClone(edit);
 next.site.websiteAttachments={schemaVersion:'website_attachments.v1',attachments:scene.attachments} as unknown as StudioJsonObject;
 for(const binding of scene.attachments){const object=next.spatial.pergolas.find(p=>p.id===binding.objectId);if(!object)throw Error('The attached pergola is missing.');
 const edge=studioAttachmentCanonicalEdge(next.spatial,scene.houses.find(h=>h.id===binding.houseId)!,binding);
 object.attachment={host:{objectFamily:'house_forms',objectId:binding.houseId,edgeKind:binding.kind==='wall'?'wall':'roof_eave',edgeId:edge.id,myEdgeIndex:0},spatialKind:binding.kind==='wall'?'wall':'roof_edge',method:binding.method==='facade'?'facade_ledger':binding.method==='fascia'?'fascia_under_gutter':'direct_to_soffit'};
 object.attachmentEdgeId=edge.id;object.attachmentZoneId=null;
 object.position={originXMm:String(binding.reference.position.x),originYMm:String(binding.reference.position.y),rotationDeg:String(binding.reference.position.rotation)};
 }
 return checked(next);
}
/** The reference is display/recovery evidence only; every price still resolves current intent. */
export function refreshHouseReferences(edit:StudioAuthoringEdit){const scene=studioHouseScene(edit.site,edit.spatial);if(!scene)return edit;
  for(const a of scene.attachments){const {value}=valueFor(edit,a.objectId),r=resolveStudioAttachment(scene,a,value);if(!r.error&&r.position&&r.geometryOptions)a.reference={position:r.position,supportDatumMm:r.geometryOptions.supportDatumMm};}
  return writeStudioHouseScene(edit,scene);
}
export function updateStudioHouse(edit:StudioAuthoringEdit,house:StudioHouse){
 solveStudioHouse(house);let spatial=edit.spatial;
 const apply=(command:Parameters<typeof applyStudioHouseEdit>[1])=>{const r=applyStudioHouseEdit(spatial,command);if(!r.ok)throw Error(r.message);spatial=r.spatial;};
 const original=spatial.houseAssembly?.houseForms.find(h=>h.id===house.id);if(!original)throw Error('House no longer available.');
 const primitive=original.composition.primitives[0];if(primitive.kind!=='axisAlignedRectangle')throw Error('Unsupported house primitive.');const rotation=Number(house.position.rotationDeg),r=rotation*Math.PI/180;
 apply({kind:'rectangle',houseFormId:house.id,primitiveIndex:0,patch:{widthMm:Number(house.widthMm),depthMm:Number(house.depthMm)}});
 apply({kind:'details',houseFormId:house.id,patch:{...Object.fromEntries(['soffitDepthMm','fasciaHeightMm','gutterWidthMm','gutterDepthMm','gutterProjectionMm'].flatMap(key=>{const value=house.source[key as keyof typeof house.source];return value===undefined?[]:[[key,value]];})),...(house.eaveHeightMm!==undefined?{eaveHeightM:house.eaveHeightMm===''?'':String(Number(house.eaveHeightMm)/1000)}:{}),wallHeightM:String(Number(house.wallHeightMm)/1000),eaveOverhangMm:house.roof.overhangMm,...(house.roof.fasciaHeightMm!==undefined?{fasciaHeightMm:house.roof.fasciaHeightMm}:{})}});
 const fall={front:'negative_y',rear:'positive_y',left:'negative_x',right:'positive_x'} as const;
 apply({kind:'roof',houseFormId:house.id,roof:{...original.roofIntent,form:house.roof.form,primaryPitchDeg:house.roof.pitchDeg,primaryFallDirection:fall[house.roof.fall],ridgeAxis:house.roof.ridge==='width'?'x':'y'}});
 apply({kind:'move',houseFormId:house.id,position:{originXMm:String(Number(house.position.xMm)-primitive.originXMm*Math.cos(r)+primitive.originYMm*Math.sin(r)),originYMm:String(Number(house.position.yMm)-primitive.originXMm*Math.sin(r)-primitive.originYMm*Math.cos(r)),rotationDeg:house.position.rotationDeg}});
 return refreshHouseReferences({...edit,spatial});
}
function studioAttachmentIntent(edit:StudioAuthoringEdit,choice:StudioHouseConnectionChoice){
  const next=structuredClone(edit),scene=studioHouseScene(next.site,next.spatial);if(!scene)throw Error('Add a house first.');const {row,value}=valueFor(next,choice.objectId);
  if(value.priorManualSupportDatumMm===undefined&&value.supportDatumMm!==undefined)value.priorManualSupportDatumMm=value.supportDatumMm;
  value.selection.input.connection=choice.method;delete value.selection.roof.attachmentIntent;row.values.websiteDesign=value as unknown as StudioJsonObject;
  if(choice.method==='facade'&&choice.facadeClearanceMm!==undefined)value.facadeClearanceMm=choice.facadeClearanceMm;
  return {next,scene,value};
}
/** Pure intent application for an already validated geometry result. Does not establish pricing eligibility. */
export function applyResolvedStudioAttachment(edit:StudioAuthoringEdit,choice:StudioHouseConnectionChoice,reference:HouseReference){
  choice={...choice,contactBasis:'canonical-house.v1'};
  const {next,scene}=studioAttachmentIntent(edit,choice);
  const binding={...choice};delete binding.facadeClearanceMm;
  scene.attachments=scene.attachments.filter(a=>a.objectId!==choice.objectId);scene.attachments.push({...binding,reference:structuredClone(reference)});
  return writeStudioHouseScene(next,scene);
}
export function previewStudioAttachment(edit:StudioAuthoringEdit,choice:StudioHouseConnectionChoice){
  choice={...choice,contactBasis:'canonical-house.v1'};
  const {scene,value}=studioAttachmentIntent(edit,choice);
  const binding={...choice,reference:{position:{x:0,y:0,rotation:0},supportDatumMm:2400}},r=resolveStudioAttachment(scene,binding,value);
  if(r.error||!r.position||!r.geometryOptions)throw new StudioConnectionError(r.error??'This connection cannot be resolved.',r.measurements);
  return applyResolvedStudioAttachment(edit,choice,{position:r.position,supportDatumMm:r.geometryOptions.supportDatumMm});
}
/** The existing command owns tangent retention for both explicit method changes
 * and adoption of a verified canonical legacy host. Normal contact and Z remain
 * the canonical physical resolver's responsibility. */
export function previewStudioAttachmentAtAnchor(edit:StudioAuthoringEdit,choice:StudioHouseConnectionChoice,anchor:HouseReference['position']|null,projectToEdge=false){
 if(!anchor)return {edit:previewStudioAttachment(edit,choice),choice};
 const base=previewStudioAttachment(edit,{...choice,alongEdgeMm:0}),scene=studioHouseScene(base.site,base.spatial)!,binding=scene.attachments.find(a=>a.objectId===choice.objectId)!;
 const resolved=resolveStudioAttachment(scene,binding,valueFor(base,choice.objectId).value);
 if(resolved.error||!resolved.target||!resolved.position)throw Error(resolved.error??'The connection cannot be resolved.');
 let {start,end}=resolved.target;const dx=end.x-start.x,dy=end.y-start.y;
 if(-dy*(resolved.target.centre.x-(start.x+end.x)/2)+dx*(resolved.target.centre.y-(start.y+end.y)/2)>0)[start,end]=[end,start];
 const length=Math.hypot(end.x-start.x,end.y-start.y),natural=(anchor.x-resolved.position.x)*(end.x-start.x)/length+(anchor.y-resolved.position.y)*(end.y-start.y)/length;
 const along=projectToEdge?Math.max(0,Math.min(length-resolved.measurements!.requiredSpanMm,natural)):natural;
 const retained={...choice,alongEdgeMm:Math.abs(along)<1e-7?0:along};return {edit:previewStudioAttachment(edit,retained),choice:retained};
}

function adoptExplicitFacadeClearance(previousEdit:StudioAuthoringEdit,next:StudioAuthoringEdit,value:StudioWebsiteDesign){
 const previous=valueFor(previousEdit,value.objectId).value,object=previousEdit.spatial.pergolas.find(p=>p.id===value.objectId)!;
 if(value.facadeClearanceMm===undefined||value.facadeClearanceMm===previous.facadeClearanceMm||value.selection.input.connection!=='facade'||!object.attachment?.host)return next;
 const resolved=resolveStudioWebsiteDesign(previous,value.objectId);if(!resolved.ok)return next;
 const current=resolveWebsiteAttachment(previousEdit.spatial,object,previous,resolved.value),binding=retainedStudioCanonicalBinding(previousEdit,value.objectId,current);
 if(!binding||binding.method!=='facade'||!current.position)return next;
 try {
  const probe=structuredClone(next),entry=valueFor(probe,value.objectId),withoutGap={...entry.value};delete withoutGap.facadeClearanceMm;entry.row.values.websiteDesign=withoutGap as unknown as StudioJsonObject;
  const {reference,...choice}=binding,retained=previewStudioAttachmentAtAnchor(probe,choice,current.position);
  const scene=studioHouseScene(retained.edit.site,retained.edit.spatial)!,candidate=scene.attachments.find(a=>a.objectId===value.objectId)!,pose=candidate.reference.position;
  const angle=(pose.rotation-current.position.rotation)*Math.PI/180;
  if(Math.hypot(pose.x-current.position.x,pose.y-current.position.y)>1e-5||Math.abs(Math.atan2(Math.sin(angle),Math.cos(angle)))>1e-7)return next;
  return applyResolvedStudioAttachment(next,{...retained.choice,facadeClearanceMm:value.facadeClearanceMm},reference);
 }catch{return next;}// The normal fallback exposes a required real-edge choice.
}
export function detachStudioPergola(edit:StudioAuthoringEdit,objectId:string,useReference=false){
  const next=structuredClone(edit),scene=studioHouseScene(next.site,next.spatial);if(!scene)throw Error('No Studio house connection.');const binding=scene.attachments.find(a=>a.objectId===objectId);if(!binding)throw Error('This pergola is already detached.');
  const {row,value}=valueFor(next,objectId),r=resolveStudioAttachment(scene,binding,value);
  if(r.error&&!useReference)throw Error('The current connection is invalid. Explicitly detach at the retained reference, or repair it first.');
  const current=!r.error&&r.position&&r.geometryOptions?{position:r.position,supportDatumMm:r.geometryOptions.supportDatumMm}:binding.reference;
  return applyResolvedStudioDetachment(edit,objectId,current);
}
/** Shared detached intent preserves current pose, effective datum and dormant manual choice. */
export function applyResolvedStudioDetachment(edit:StudioAuthoringEdit,objectId:string,current:HouseReference){
  const next=structuredClone(edit),scene=studioHouseScene(next.site,next.spatial);if(!scene||!scene.attachments.some(a=>a.objectId===objectId))throw Error('This pergola is already detached.');
  const {row,value}=valueFor(next,objectId);
  const object=next.spatial.pergolas.find(p=>p.id===objectId)!;object.attachment={host:null,spatialKind:'freestanding',method:'none'};object.attachmentEdgeId=null;object.attachmentZoneId=null;object.position={originXMm:String(current.position.x),originYMm:String(current.position.y),rotationDeg:String(current.position.rotation)};
  if(value.priorManualSupportDatumMm===undefined&&value.supportDatumMm!==undefined)value.priorManualSupportDatumMm=value.supportDatumMm;
  value.supportDatumMm=String(current.supportDatumMm);value.roofDatumBasis='attached';value.selection.roof.attachmentIntent='freestanding';row.values.websiteDesign=value as unknown as StudioJsonObject;scene.attachments=scene.attachments.filter(a=>a.objectId!==objectId);
  return writeStudioHouseScene(next,scene);
}
/** All option edits, including ordinary Shape/Freestanding, cross the same relationship command. */
export function changeStudioProduct(edit:StudioAuthoringEdit,nextValue:StudioWebsiteDesign){
  let next=structuredClone(edit);const scene=studioHouseScene(next.site,next.spatial),bound=scene?.attachments.some(a=>a.objectId===nextValue.objectId);
  if(bound&&nextValue.selection.roof.attachmentIntent==='freestanding'){
    next=detachStudioPergola(next,nextValue.objectId);const detached=valueFor(next,nextValue.objectId).value;
    nextValue={...nextValue,supportDatumMm:detached.supportDatumMm,roofDatumBasis:detached.roofDatumBasis,...(detached.priorManualSupportDatumMm!==undefined?{priorManualSupportDatumMm:detached.priorManualSupportDatumMm}:{})};
  }
  const previous=valueFor(next,nextValue.objectId).value;
  if(!bound&&scene&&previous.selection.roof.attachmentIntent!=='freestanding'&&nextValue.selection.roof.attachmentIntent==='freestanding')nextValue={...nextValue,roofDatumBasis:'attached'};
  valueFor(next,nextValue.objectId).row.values.websiteDesign=nextValue as unknown as StudioJsonObject;
  next.spatial.pergolas=next.spatial.pergolas.map(p=>p.id===nextValue.objectId?{...p,family:nextValue.selection.roof.family}:p);
  if(!bound)next=adoptExplicitFacadeClearance(edit,next,nextValue);
  return refreshHouseReferences(checked(next));
}
export function independentStudioDatum(value:StudioWebsiteDesign){return value.supportDatumMm===undefined&&value.roofDatumBasis===undefined?undefined:{...(value.supportDatumMm!==undefined?{supportDatumMm:previewSupportDatum({supportDatumMm:houseNumber(value.supportDatumMm,'pergola height',1)})}:{}),...(value.roofDatumBasis?{roofDatumBasis:value.roofDatumBasis}:{})};}
