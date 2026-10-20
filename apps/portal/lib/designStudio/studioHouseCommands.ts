import {demoContact,fitDemoContact,validateDemoContact} from './demoHouseClearance';
import {applyStudioHouseEdit} from './houseEditing';
import {websiteHouseTargets} from './websiteAttachment';
import {websiteSoffitTarget} from './studioHouseWebsiteContact';
import {previewSupportDatum,solvePergolaPreview} from '@sp/configurator/geometry';
import {parseStudioAuthoringEdit,type StudioAuthoringEdit} from './authoringView';
import {parseStudioWebsiteDesign,resolveStudioWebsiteDesign,type StudioWebsiteDesign} from './websiteDesign';
import {websiteConnectionEdge} from './websiteConnectionEdge';
import {studioWebsiteBrackets} from './studioHouseWebsiteBrackets';
import {studioHouseScene,type StudioHouseScene,type StudioHouseAttachment,type HouseReference,type StudioHouse} from './studioHouseScene';
import {studioHouseTargets,houseNumber,solveStudioHouse} from './studioHouseGeometry';
import type {StudioJsonObject} from './contracts';

export function resolveStudioAttachment(scene:StudioHouseScene,binding:StudioHouseAttachment,value:StudioWebsiteDesign){
  const fail=(error:string)=>({error,position:null as HouseReference['position']|null,geometryOptions:undefined as {supportDatumMm:number}|undefined,attachmentHeightMm:null as number|null,target:null as ReturnType<typeof studioHouseTargets>[number]|null,reference:binding.reference});
  try{
    const h=scene.houses.find(h=>h.id===binding.houseId);if(!h)return fail('The attached house is missing. Change the connection or detach using the retained reference.');
    let target=(binding.method==='soffit')?websiteSoffitTarget(h,binding.edge):studioHouseTargets(h,binding.method).find(t=>t.side===binding.edge&&t.kind===binding.kind);
    if(!target||target.error)return fail(target?.error??'The selected house edge is unavailable. Change the connection.');
    const resolved=resolveStudioWebsiteDesign(value,value.objectId);if(!resolved.ok)return fail(resolved.message);
    const d=resolved.value;if(d.roof.attachmentIntent==='freestanding'||d.input.connection!==binding.method)return fail('The pergola connection and house relationship disagree. Change the connection or detach.');
    const assembly=solvePergolaPreview(d.input,d.roof).geometry?.assembly;if(!assembly)return fail('This pergola cannot use the selected connection.');
    const demo=binding.contactBasis==='canonical-house.v1'?demoContact(h,binding.edge,d,target):null;if(demo)target=demo.target;const edge=demo?.edge??websiteConnectionEdge(assembly,binding.method==='soffit'?'top':'underside'),length=Math.hypot(edge.end.x-edge.start.x,edge.end.y-edge.start.y);
    let {start,end}=target;
    if(Math.hypot(end.x-start.x,end.y-start.y)+1e-6<length)return fail('The house edge is shorter than this pergola. Choose another edge or resize the house.');
    const dx=end.x-start.x,dy=end.y-start.y;if(-dy*(target.centre.x-(start.x+end.x)/2)+dx*(target.centre.y-(start.y+end.y)/2)>0)[start,end]=[end,start];
    const a=Math.atan2(end.y-start.y,end.x-start.x)-Math.atan2(edge.end.y-edge.start.y,edge.end.x-edge.start.x),c=Math.cos(a),s=Math.sin(a);
    const supportedDatum=(datum:number)=>{try{return previewSupportDatum({supportDatumMm:datum});}catch{throw Error(`This ${binding.method==='facade'?'wall':'roof edge'} places the pergola support at ${Math.round(datum)} mm. The current product supports 2000–5000 mm. Check the actual house height or choose another connection.`);}};
    let supportDatumMm=supportedDatum(2400+target.heightMm-edge.start.z);
    const targetLength=Math.hypot(end.x-start.x,end.y-start.y),along=binding.alongEdgeMm??0;
    if(!Number.isFinite(along)||along<0||along>targetLength-length+1e-6||along!==0&&binding.contactBasis!=='canonical-house.v1')return fail('This placement extends beyond the selected house edge.');
    const position={x:start.x-edge.start.x*c+edge.start.y*s+(end.x-start.x)/targetLength*along,y:start.y-edge.start.x*s-edge.start.y*c+(end.y-start.y)/targetLength*along,rotation:a*180/Math.PI};if(demo){const fitted=supportedDatum(fitDemoContact(h,binding.edge,d,position,supportDatumMm));const delta=fitted-supportDatumMm;supportDatumMm=fitted;target={...target,heightMm:target.heightMm+delta,start:{...target.start,z:target.start.z+delta},end:{...target.end,z:target.end.z+delta}};validateDemoContact(h,binding.edge,d,position,supportDatumMm,target);}
    if(binding.method==='soffit'){
      const resolvedAssembly=solvePergolaPreview(d.input,d.roof,{supportDatumMm}).geometry?.assembly;
      if(!resolvedAssembly)return fail('The connected product cannot be resolved.');
      studioWebsiteBrackets(h,binding.edge,resolvedAssembly,position,d.input.widthMm);
    }
    return {error:null,position,geometryOptions:{supportDatumMm},attachmentHeightMm:target.heightMm,target,reference:binding.reference};
  }catch(e){return fail(e instanceof Error?e.message:'The house connection is unavailable.');}
}
function valueFor(edit:StudioAuthoringEdit,id:string){const row=edit.objectOptions.find(r=>r.objectId===id);const parsed=parseStudioWebsiteDesign(row?.values.websiteDesign,id);if(!row||!parsed.ok)throw Error('Select a current website pergola.');return {row,value:parsed.value};}
function checked(edit:StudioAuthoringEdit){const p=parseStudioAuthoringEdit(edit);if(!p.ok)throw Error(p.message);return p.value;}
export function writeStudioHouseScene(edit:StudioAuthoringEdit,scene:StudioHouseScene){
 const next=structuredClone(edit);
 next.site.websiteAttachments={schemaVersion:'website_attachments.v1',attachments:scene.attachments} as unknown as StudioJsonObject;
 for(const binding of scene.attachments){const object=next.spatial.pergolas.find(p=>p.id===binding.objectId);if(!object)throw Error('The attached pergola is missing.');
 const target=studioHouseTargets(scene.houses.find(h=>h.id===binding.houseId)!,binding.method).find(t=>t.side===binding.edge&&t.kind===binding.kind);
 if(!target)throw Error('The canonical house edge is unavailable.');
 const dx=target.end.x-target.start.x,dy=target.end.y-target.start.y,len=Math.hypot(dx,dy);
 const edge=websiteHouseTargets(next.spatial).find(t=>t.sourceObjectId===binding.houseId&&t.edgeKind===(binding.kind==='wall'?'wall':'roof_eave')&&Math.abs(dx*(t.start.y-target.start.y)-dy*(t.start.x-target.start.x))/len<.01&&Math.abs(dx*(t.end.y-target.start.y)-dy*(t.end.x-target.start.x))/len<.01);
 if(!edge)throw Error('The selected surface has no canonical house edge.');
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
function studioAttachmentIntent(edit:StudioAuthoringEdit,choice:Omit<StudioHouseAttachment,'reference'>){
  const next=structuredClone(edit),scene=studioHouseScene(next.site,next.spatial);if(!scene)throw Error('Add a house first.');const {row,value}=valueFor(next,choice.objectId);
  if(value.priorManualSupportDatumMm===undefined&&value.supportDatumMm!==undefined)value.priorManualSupportDatumMm=value.supportDatumMm;
  value.selection.input.connection=choice.method;delete value.selection.roof.attachmentIntent;row.values.websiteDesign=value as unknown as StudioJsonObject;
  return {next,scene,value};
}
/** Pure intent application for an already validated geometry result. Does not establish pricing eligibility. */
export function applyResolvedStudioAttachment(edit:StudioAuthoringEdit,choice:Omit<StudioHouseAttachment,'reference'>,reference:HouseReference){
  choice={...choice,contactBasis:'canonical-house.v1'};
  const {next,scene}=studioAttachmentIntent(edit,choice);
  scene.attachments=scene.attachments.filter(a=>a.objectId!==choice.objectId);scene.attachments.push({...choice,reference:structuredClone(reference)});
  return writeStudioHouseScene(next,scene);
}
export function previewStudioAttachment(edit:StudioAuthoringEdit,choice:Omit<StudioHouseAttachment,'reference'>){
  choice={...choice,contactBasis:'canonical-house.v1'};
  const {scene,value}=studioAttachmentIntent(edit,choice);
  const binding={...choice,reference:{position:{x:0,y:0,rotation:0},supportDatumMm:2400}},r=resolveStudioAttachment(scene,binding,value);
  if(r.error||!r.position||!r.geometryOptions)throw Error(r.error??'This connection cannot be resolved.');
  return applyResolvedStudioAttachment(edit,choice,{position:r.position,supportDatumMm:r.geometryOptions.supportDatumMm});
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
  return refreshHouseReferences(checked(next));
}
export function independentStudioDatum(value:StudioWebsiteDesign){return value.supportDatumMm===undefined&&value.roofDatumBasis===undefined?undefined:{...(value.supportDatumMm!==undefined?{supportDatumMm:previewSupportDatum({supportDatumMm:houseNumber(value.supportDatumMm,'pergola height',1)})}:{}),...(value.roofDatumBasis?{roofDatumBasis:value.roofDatumBasis}:{})};}
