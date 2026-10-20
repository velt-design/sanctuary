import {buildStudioHouseGeometryRegistry} from './canonicalHouseGeometry';
import { previewSupportDatum, solvePergolaPreview, type PreviewGeometryOptions } from '@sp/configurator/geometry';
import { resolveAssemblyMemberProfileAnchors, type Assembly3D } from '@sp/geometry';
import { buildWorkbenchProjectModelFromObjectFirstDraft } from '../drawings/state/objectFirstWorkbenchModel';
import { buildProjectHouseGeometryRegistry } from '../drawings/state/projectHouseGeometryRegistry';
import { buildHouseSnapTargets } from '../drawings/state/houseSnapTargets';
import { parseStudioAuthoringEdit, type StudioAuthoringEdit } from './authoringView';
import { parseStudioWebsiteDesign, resolveStudioWebsiteDesign, type StudioWebsiteDesign } from './websiteDesign';
import type { StudioJsonObject } from './contracts';

type Spatial = StudioAuthoringEdit['spatial'];
type Pergola = Spatial['pergolas'][number];
export function websiteHouseTargets(spatial:Spatial) {
  return buildStudioHouseGeometryRegistry(spatial).flatMap(entry => {
    const form=spatial.houseAssembly!.houseForms.find(h=>h.id===entry.houseFormId)!;
    // The canonical house adapter accepts historical numeric prefixes. New attachment
    // resolution must not replace malformed authored heights with its automatic defaults.
    const invalid=[form.wallHeightM,form.eaveHeightM].some(raw=>raw!=null&&raw.trim()!==''&&(!Number.isFinite(Number(raw))||Number(raw)<=0));
    return buildHouseSnapTargets({houseModel:entry.model,houseObjectId:entry.houseFormId}).map((edge,index)=>{
      const wall=entry.model.wallSegments.find(w=>`wall-${w.id}`===edge.id);
      const eave=entry.model.roofEaves?.find(e=>e.id===edge.id);
      const points=wall?.boundary??(eave?[eave.eaveLine.start,eave.eaveLine.end]:[]);
      const zs=points.map(p=>p.z), heightMm=wall?Math.max(...zs):zs[0];
      const flat=wall?wall.boundary.length===4&&Math.abs(wall.boundary[2].z-wall.boundary[3].z)<1e-6:zs.every(z=>Math.abs(z-heightMm)<1e-6);
      const all=entry.model.wallSegments.flatMap(w=>[w.line.start,w.line.end]);
      const centre={x:all.reduce((n,p)=>n+p.x,0)/all.length,y:all.reduce((n,p)=>n+p.y,0)/all.length};
      return {...edge,label:`${form.label} · ${edge.edgeKind==='wall'?'Wall':'Roof edge'} ${index+1}`,heightMm,centre,
        error:invalid?'Enter a valid house height.':!flat?'Choose a level house edge.':!Number.isFinite(heightMm)?'House edge height unavailable.':null};
    });
  });
}
/** Actual house-facing bottom edge, in the solved assembly frame. */
export function websiteConnectionEdge(assembly:Assembly3D){
  const member=assembly.members.find(m=>m.role==='ledger'||m.id==='house-beam');
  if(!member)throw Error('This roof has no supported house connection datum. Change edge or detach.');
  const frame=member.localFrame,anchors=resolveAssemblyMemberProfileAnchors(member.profile);
  const centre=assembly.outline.reduce((p,v)=>({x:p.x+v.x/assembly.outline.length,y:p.y+v.y/assembly.outline.length}),{x:0,y:0});
  const mid={x:(member.centerline.start.x+member.centerline.end.x)/2,y:(member.centerline.start.y+member.centerline.end.y)/2};
  const towardInterior=(centre.x-mid.x)*frame.yAxis.x+(centre.y-mid.y)*frame.yAxis.y;
  const face=towardInterior>=0?anchors.backFaceY:anchors.frontFaceY;
  const points=[member.centerline.start,member.centerline.end].map(p=>({
    x:p.x+frame.yAxis.x*face+frame.zAxis.x*anchors.undersideZ,
    y:p.y+frame.yAxis.y*face+frame.zAxis.y*anchors.undersideZ,
    z:p.z+frame.yAxis.z*face+frame.zAxis.z*anchors.undersideZ,
  }));
  let [start,end]=points;
  if((end.x-start.x)*(centre.y-start.y)-(end.y-start.y)*(centre.x-start.x)<0)[start,end]=[end,start];
  if(Math.abs(start.z-end.z)>1e-6)throw Error('This connection edge is not level. Choose another roof or connection.');
  return {memberId:member.id,start,end};
}
export function resolveWebsiteAttachment(spatial:Spatial, object:Pergola, value:StudioWebsiteDesign, design:StudioWebsiteDesign['selection']) {
  const fail=(error:string)=>({error,geometryOptions:undefined as PreviewGeometryOptions|undefined,attachmentHeightMm:null as number|null,target:null as ReturnType<typeof websiteHouseTargets>[number]|null,position:null as {x:number;y:number;rotation:number}|null});
  const host=object.attachment?.host;
  try {
    if(!host){
      const raw=value.supportDatumMm;
      if(raw!==undefined&&!/^\d+$/.test(raw.trim()))return fail('Enter a whole support datum in millimetres. Your input is kept.');
      const supportDatumMm=previewSupportDatum(raw===undefined?undefined:{supportDatumMm:Number(raw)});
      return {...fail(''),error:null,geometryOptions:raw===undefined?undefined:{supportDatumMm}};
    }
    if(host.objectFamily!=='house_forms')return fail('This attachment needs a house edge. Change edge or detach.');
    const target=websiteHouseTargets(spatial).find(t=>t.sourceObjectId===host.objectId&&t.id===host.edgeId&&t.edgeKind===host.edgeKind);
    if(!target)return fail('The attached house edge is unavailable. Change edge or detach.');
    if(target.error)return fail(`${target.label}: ${target.error}`);
    if(design.roof.attachmentIntent==='freestanding')return fail('Detach from the house before choosing freestanding.');
    const connection=object.attachment?.method==='facade_ledger'?'facade':object.attachment?.method==='fascia_under_gutter'?'fascia':'soffit';
    if(design.input.connection!==connection)return fail('The connection no longer matches this house edge. Change edge or detach.');
    if(design.roof.family==='gable'&&design.roof.orientation==='away'&&connection!=='fascia')return fail('This ridge direction uses a fascia connection. Choose a roof edge with Fascia.');
    const geometry=solvePergolaPreview(design.input,design.roof).geometry;
    if(!geometry)return fail('This roof has no supported house connection datum. Change edge or detach.');
    const contact=websiteConnectionEdge(geometry.assembly);
    const supportDatumMm=previewSupportDatum({supportDatumMm:2400+target.heightMm-contact.start.z});
    let start=target.start,end=target.end;
    const dx=end.x-start.x,dy=end.y-start.y,len=Math.hypot(dx,dy);
    const connectionLength=Math.hypot(contact.end.x-contact.start.x,contact.end.y-contact.start.y);
    if(len<connectionLength)return fail(`${target.label}: the edge is shorter than this pergola connection. Choose another edge.`);
    if((-dy)*(target.centre.x-(start.x+end.x)/2)+dx*(target.centre.y-(start.y+end.y)/2)>0){start=target.end;end=target.start;}
    const angle=Math.atan2(end.y-start.y,end.x-start.x)-Math.atan2(contact.end.y-contact.start.y,contact.end.x-contact.start.x);
    const c=Math.cos(angle),s=Math.sin(angle);
    return {error:null,geometryOptions:{supportDatumMm},attachmentHeightMm:target.heightMm,target,
      position:{x:start.x-contact.start.x*c+contact.start.y*s,y:start.y-contact.start.x*s-contact.start.y*c,rotation:angle*180/Math.PI}};

  }catch(error){return fail(error instanceof Error?error.message:'Attachment height unavailable.');}
}

export function attachWebsitePergola(edit:StudioAuthoringEdit,objectId:string,targetId:string,houseId:string,method:'facade_ledger'|'fascia_under_gutter'|'direct_to_soffit'){
  const next=structuredClone(edit),object=next.spatial.pergolas.find(p=>p.id===objectId),row=next.objectOptions.find(o=>o.objectId===objectId);
  if(!object||!row)throw Error('The selected pergola is no longer available.');
  const target=websiteHouseTargets(next.spatial).find(t=>t.id===targetId&&t.sourceObjectId===houseId);
  if(!target||target.error)throw Error(target?.error??'Choose an available house edge.');
  if((target.edgeKind==='wall')!==(method==='facade_ledger'))throw Error('Choose a connection that matches the house edge.');
  const parsed=parseStudioWebsiteDesign(row.values.websiteDesign,objectId);if(!parsed.ok)throw Error(parsed.message);
  const value=parsed.value;delete value.selection.roof.attachmentIntent;
  value.selection.input.connection=method==='facade_ledger'?'facade':method==='fascia_under_gutter'?'fascia':'soffit';
  object.attachment={host:{objectFamily:'house_forms',objectId:houseId,edgeKind:target.edgeKind as 'wall'|'roof_eave',edgeId:targetId,myEdgeIndex:0},spatialKind:target.edgeKind==='wall'?'wall':'roof_edge',method};
  row.values.websiteDesign=value as unknown as StudioJsonObject;
  const result=parseStudioAuthoringEdit(next);if(!result.ok)throw Error(result.message);return result.value;
}

export function detachWebsitePergola(edit:StudioAuthoringEdit,objectId:string){
  const next=structuredClone(edit),object=next.spatial.pergolas.find(p=>p.id===objectId),row=next.objectOptions.find(o=>o.objectId===objectId);
  if(!object||!row)throw Error('The selected pergola is no longer available.');
  const parsed=parseStudioWebsiteDesign(row.values.websiteDesign,objectId);if(!parsed.ok)throw Error(parsed.message);
  const value=parsed.value,resolved=resolveStudioWebsiteDesign(value,objectId);
  const current=resolved.ok?resolveWebsiteAttachment(next.spatial,object,value,resolved.value):null;
  if(value.supportDatumMm===undefined){
    if(!current?.geometryOptions)throw Error('Choose a manual support datum before detaching this unresolved attachment.');
    value.supportDatumMm=String(current.geometryOptions.supportDatumMm);
  }
  if(current?.position)object.position={originXMm:String(current.position.x),originYMm:String(current.position.y),rotationDeg:String(current.position.rotation)};
  object.attachment={host:null,spatialKind:'freestanding',method:'none'};
  value.selection.roof.attachmentIntent='freestanding';
  row.values.websiteDesign=value as unknown as StudioJsonObject;
  const result=parseStudioAuthoringEdit(next);if(!result.ok)throw Error(result.message);return result.value;
}
