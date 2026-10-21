import { parseStudioAuthoringEdit, type StudioAuthoringEdit } from './authoringView';
import { parseStudioWebsiteDesign, resolveStudioWebsiteDesign, newStudioWebsiteDesign } from './websiteDesign';
import type { StudioJsonObject } from './contracts';
import {resolveWebsiteAttachment} from './websiteAttachment';
import {studioHouseScene} from './studioHouseScene';
import {resolveStudioAttachment,independentStudioDatum} from './studioHouseCommands';
/** Website geometry stays local. These are the canonical world-placement values. */
export function websitePosition(position: StudioAuthoringEdit['spatial']['pergolas'][number]['position']) {
 const raw=position??{originXMm:'0',originYMm:'0',rotationDeg:'0'};
 const values=[raw.originXMm,raw.originYMm,raw.rotationDeg].map(v=>v.trim()===''?NaN:Number(v));
 if(values.some(v=>!Number.isFinite(v)))return null;
 return {x:values[0],y:values[1],rotation:values[2]};
}
export function websiteComposition(edit: Pick<StudioAuthoringEdit,'spatial'|'objectOptions'> & Partial<Pick<StudioAuthoringEdit,'site'>>) {
 const houseScene=studioHouseScene(edit.site,edit.spatial);
 return edit.spatial.pergolas.map(object=>{
  const row=edit.objectOptions.find(row=>row.objectId===object.id);
  const parsed=parseStudioWebsiteDesign(row?.values.websiteDesign,object.id);
  const resolved=parsed.ok?resolveStudioWebsiteDesign(parsed.value,object.id):parsed;
  const position=websitePosition(object.position);
  const binding=houseScene?.attachments.find(a=>a.objectId===object.id);
  const attachment=parsed.ok&&resolved.ok?(binding&&houseScene?resolveStudioAttachment(houseScene,binding,parsed.value):resolveWebsiteAttachment(edit.spatial,object,parsed.value,resolved.value)):null;
  let geometryOptions=attachment?.geometryOptions,datumError:string|null=null;
  if(houseScene&&!binding&&!object.attachment?.host&&parsed.ok)try{geometryOptions=independentStudioDatum(parsed.value);}catch(e){datumError=e instanceof Error?e.message:'Invalid pergola height.';}
  return {object,value:parsed.ok?parsed.value:null,design:resolved.ok?resolved.value:null,position:attachment?.position??position,geometryOptions,attachment,studioAttachment:binding??null,reference:binding?.reference??null,error:!resolved.ok?resolved.message:attachment?.error??datumError??(!position?'Enter valid position values. Your input is kept.':null)};
 });
}
export function addWebsitePergola(edit:StudioAuthoringEdit,id:string) {
 const next=structuredClone(edit);
 next.spatial.pergolas.push({id,label:`Pergola ${next.spatial.pergolas.length+1}`,family:'mono',attachmentEdgeId:null,attachmentZoneId:null,side:'rear',strategy:null,
  position:{originXMm:String(next.spatial.pergolas.length*7000),originYMm:'0',rotationDeg:'0'}});
 next.objectOptions.push({objectId:id,values:{websiteDesign:newStudioWebsiteDesign(id) as unknown as StudioJsonObject}});
 const parsed=parseStudioAuthoringEdit(next);if(!parsed.ok)throw Error(parsed.message);return parsed.value;
}
export function positionWebsitePergola(edit:StudioAuthoringEdit,id:string,patch:Partial<{originXMm:string;originYMm:string;rotationDeg:string}>) {
 const next=structuredClone(edit),object=next.spatial.pergolas.find(p=>p.id===id);if(!object)throw Error('The selected pergola is no longer available.');
 if(object.attachment?.host||studioHouseScene(edit.site,edit.spatial)?.attachments.some(a=>a.objectId===id))throw Error('This pergola follows the house. Move the house or detach first.');
 object.position={originXMm:'0',originYMm:'0',rotationDeg:'0',...object.position,...patch};
 const parsed=parseStudioAuthoringEdit(next);if(!parsed.ok)throw Error(parsed.message);return parsed.value;
}
export function transformWebsitePoint(point:{x:number;y:number;z?:number},position:{x:number;y:number;rotation:number}) {
 const rad=position.rotation*Math.PI/180,c=Math.cos(rad),s=Math.sin(rad);
 return {x:position.x+point.x*c-point.y*s,y:position.y+point.x*s+point.y*c,z:point.z??0};
}
/** Translation-only Plan snap: parallel edges with projected overlap, no join or member merge. */
export function snapWebsiteEdges(outline:{x:number;y:number}[],targets:{id:string;label:string;start:{x:number;y:number};end:{x:number;y:number}}[],toleranceMm=150){
 let best:{dx:number;dy:number;targetId:string;label:string;distance:number}|null=null;
 for(let i=0;i<outline.length;i++){const a=outline[i],b=outline[(i+1)%outline.length],len=Math.hypot(b.x-a.x,b.y-a.y);if(len<1)continue;const ux=(b.x-a.x)/len,uy=(b.y-a.y)/len;
  for(const t of targets){const tx=t.end.x-t.start.x,ty=t.end.y-t.start.y,tl=Math.hypot(tx,ty);if(tl<1||Math.abs(ux*ty/tl-uy*tx/tl)>.0001)continue;
   const d=(t.start.x-a.x)*(-uy)+(t.start.y-a.y)*ux;if(Math.abs(d)>toleranceMm)continue;
   const from=(t.start.x-a.x)*ux+(t.start.y-a.y)*uy,to=(t.end.x-a.x)*ux+(t.end.y-a.y)*uy;
   if(Math.min(len,Math.max(from,to))-Math.max(0,Math.min(from,to))<=1)continue;
   if(!best||Math.abs(d)<best.distance)best={dx:-uy*d,dy:ux*d,targetId:t.id,label:t.label,distance:Math.abs(d)};
  }
 }
 return best;
}
