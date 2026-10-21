import { solvePergolaPreview, attachmentUnavailable } from '@sp/configurator/geometry';
import type { StudioAuthoringEdit } from '@/lib/designStudio/authoringView';
import { websiteComposition, transformWebsitePoint } from '@/lib/designStudio/websiteComposition';
import { studioHouseScene, type StudioHouseAttachment } from '@/lib/designStudio/studioHouseScene';
import { studioWebsiteBrackets } from '@/lib/designStudio/studioHouseWebsiteBrackets';
import { websiteSoffitTarget } from '@/lib/designStudio/studioHouseWebsiteContact';
import { studioHouseTargets } from '@/lib/designStudio/studioHouseGeometry';
import { previewStudioAttachment, detachStudioPergola } from '@/lib/designStudio/studioHouseCommands';
import {websiteProductPhysical} from '@/lib/designStudio/websiteProductPhysical';
import { websiteConnectionEdge } from '@/lib/designStudio/websiteConnectionEdge';
import { websiteJoinStates } from '@/lib/designStudio/websiteJoins';
import {physicalFootprint,footprintDistance,segmentAxis,dot} from './finitePlacement';

import {axisChoices,composeAxisAlignment,validAxisGuide,type AxisGuide} from './axisAlignment';

export type DemoMethod = 'facade' | 'fascia' | 'soffit';
export type Point = { x: number; y: number };
const footprintCentre=(points:Point[])=>({x:(Math.min(...points.map(p=>p.x))+Math.max(...points.map(p=>p.x)))/2,y:(Math.min(...points.map(p=>p.y))+Math.max(...points.map(p=>p.y)))/2});
export function prepareGesture(edit: StudioAuthoringEdit, id: string, method: DemoMethod, candidateSide?:string|false) {
  const rows = websiteComposition(edit), row = rows.find(r => r.object.id === id)!;
  if (!row.design || !row.position || row.error) throw Error(row.error ?? 'Select a valid product.');
  const scene = studioHouseScene(edit.site,edit.spatial)!, bound = scene.attachments.some(a => a.objectId === id);
  const freeEdit = bound ? detachStudioPergola(edit, id) : edit;
  const free = websiteComposition(freeEdit).find(r => r.object.id === id)!;

  const original = physicalFootprint(websiteProductPhysical(row).points.map(p=>transformWebsitePoint(p,row.position!)));
  const freeOutline = physicalFootprint(websiteProductPhysical(free).points.map(p=>transformWebsitePoint(p,free.position!)));
  const targets=scene.houses.flatMap(h=>studioHouseTargets(h,method).filter(t=>t.kind===(method==='facade'?'wall':'eave')).map(t=>{if(method!=='soffit')return t;try{return websiteSoffitTarget(h,t.side);}catch(e){return {...t,error:(e as Error).message};}}));
  const unavailable = attachmentUnavailable(row.design.input, row.design.roof, method);
  const candidates = targets.flatMap(target => {
    if(candidateSide===false||typeof candidateSide==='string'&&target.side!==candidateSide)return [];
    if (unavailable) { target.error = unavailable; return []; }
    if (target.error) return [];
    try {
      const choice:Omit<StudioHouseAttachment,'reference'> = { objectId: id, houseId: target.houseId, edge: target.side, kind: target.kind, method, contactBasis:'canonical-house.v1' as const };
      const next = previewStudioAttachment(edit, choice), product = websiteComposition(next).find(r => r.object.id === id)!;
      const solved = solvePergolaPreview(product.design!.input, product.design!.roof, product.geometryOptions).geometry!;
      const attachedFace=websiteConnectionEdge(solved.assembly),faceWorld=[attachedFace.start,attachedFace.end].map(p=>transformWebsitePoint(p,product.position!));
      const faceAxis=segmentAxis({start:faceWorld[0],end:faceWorld[1]}).u,targetAxis=segmentAxis(target).u,sign=dot(faceAxis,targetAxis)<0?-1:1;
      const tangent={x:targetAxis.x*sign,y:targetAxis.y*sign};
      return [{ key: `connect:${target.houseId}:${target.side}:${method}`, target, choice, edit: next, tangent, travel:Math.max(0,Math.hypot(target.end.x-target.start.x,target.end.y-target.start.y)-Math.hypot(attachedFace.end.x-attachedFace.start.x,attachedFace.end.y-attachedFace.start.y)),
        points: physicalFootprint(websiteProductPhysical(product).points.map(p=>transformWebsitePoint(p,product.position!))),
        pose: product.position!, height: product.geometryOptions?.supportDatumMm,
        incidentJoins:websiteJoinStates(edit).filter(s=>s.join.a.objectId===id||s.join.b.objectId===id).map(s=>s.label),
        consequences: websiteJoinStates(next).filter(s => s.error).map(s => s.label + ': needs repair') }];
    } catch (error) { target.error = (error as Error).message; return []; }
  });
  const lines = rows.filter(r => r.object.id !== id && r.design && r.position && !r.error).flatMap(r => {
    const solved = solvePergolaPreview(r.design!.input, r.design!.roof, r.geometryOptions).geometry!;
    const points = solved.plan.outline.map(p => transformWebsitePoint(p, r.position!));
    return points.map((start, i) => ({ id: `align:${r.object.id}:${i}`, sourceObjectId: r.object.id, edgeKind: 'pergola_outline', label: r.object.label, start, end: points[(i + 1) % points.length] }));
  });
  return { edit, id, method, row, bound, freeEdit, original, freeOutline, targets, candidates, lines, unavailable };
}
export type GestureCache = ReturnType<typeof prepareGesture>;
export type GesturePreview = {
  key: string; points: Point[]; x: number; y: number; message: string;
  raw?:{x:number;y:number;rotation:number};guides?:AxisGuide[];
  candidate?: GestureCache['candidates'][number]; target?: { start: Point; end: Point };
};

/** Translate a cached solved candidate without solving during pointer movement. */
export function alongCandidate(candidate:GestureCache['candidates'][number],along:number){
  if(along===0)return candidate;
  const delta={x:candidate.tangent.x*along,y:candidate.tangent.y*along};
  const pose={...candidate.pose,x:candidate.pose.x+delta.x,y:candidate.pose.y+delta.y};
  const edit=structuredClone(candidate.edit);
  // This namespace is already validated in prepareGesture; do not resolve geometry here.
  const scene=edit.site.websiteAttachments as unknown as import('@/lib/designStudio/studioHouseScene').WebsiteAttachments;
  const binding=scene.attachments.find(a=>a.objectId===candidate.choice.objectId)!;
  scene.attachments[scene.attachments.indexOf(binding)]={...candidate.choice,alongEdgeMm:along,reference:{...binding.reference,position:pose}};
  const object=edit.spatial.pergolas.find(p=>p.id===candidate.choice.objectId)!;object.position={originXMm:String(pose.x),originYMm:String(pose.y),rotationDeg:String(pose.rotation)};
  return {...candidate,choice:{...candidate.choice,alongEdgeMm:along},edit,pose,consequences:[...new Set([...candidate.consequences,...candidate.incidentJoins.map(label=>label+': may need repair after moving')])],points:candidate.points.map(p=>({...p,x:p.x+delta.x,y:p.y+delta.y}))};
}
/** Pointer hot path: complete cached footprint, finite segments, no solve or authored mutation. */
export function previewGesture(cache: GestureCache, x: number, y: number, units: number, held?: string, departingKey?:string): GesturePreview {
  const dx=x-cache.row.position!.x,dy=y-cache.row.position!.y;
  const points=cache.freeOutline.map(p=>({x:p.x+dx,y:p.y+dy}));
  const centre=footprintCentre(points);
  const ranked=cache.candidates.flatMap(candidate=>{
    if(candidate.key===departingKey)return [];
    const tolerance=(candidate.key===held?.split('|')[0]?18:14)*units;
    const distance=footprintDistance(points,candidate.target);
    if(distance>tolerance)return [];
    const c=footprintCentre(candidate.points);
    const natural=dot({x:centre.x-c.x,y:centre.y-c.y},candidate.tangent);
    // A local endpoint can acquire; a distant extension cannot teleport into range.
    if(natural < -tolerance || natural > candidate.travel+tolerance)return [];
    const along=Math.max(0,Math.min(candidate.travel,natural));
    return [{candidate,along,distance,displacement:Math.hypot(c.x+candidate.tangent.x*along-centre.x,c.y+candidate.tangent.y*along-centre.y)}];
  }).sort((a,b)=>(a.distance-(a.candidate.key===held?.split('|')[0]?3*units:0))-(b.distance-(b.candidate.key===held?.split('|')[0]?3*units:0))||a.displacement-b.displacement||a.candidate.key.localeCompare(b.candidate.key));
  const alignmentLines=[...cache.lines,...cache.targets.filter(t=>!t.error&&`connect:${t.houseId}:${t.side}:${cache.method}`!==departingKey).map(t=>({...t,id:`align:${t.houseId}:${t.side}`,label:`House ${t.side}`}))];
  const peerChoices=axisChoices(points,alignmentLines,units,held);
  const best=ranked[0];
  const houseAxis=best?(Math.abs(best.candidate.tangent.x)>.999?'y':Math.abs(best.candidate.tangent.y)>.999?'x':null):null;
  const houseScore=best?best.distance-(best.candidate.key===held?.split('|')[0]?3*units:0):Infinity;
  const sameAxisPeer=peerChoices.find(c=>c.axis===houseAxis);
  if(best&&houseScore<=(sameAxisPeer?.score??Infinity)){
    let along=best.along,candidate=alongCandidate(best.candidate,along);
    const guides:AxisGuide[]=[];
    // The one structural binding owns its normal and rotation. A second finite
    // witness can constrain only legal travel along that same house edge.
    const secondary=axisChoices(candidate.points,alignmentLines.filter(l=>l.id!==`align:${candidate.choice.houseId}:${candidate.choice.edge}`),units,held).find(c=>c.axis!==houseAxis);
    if(secondary){
      const component=secondary.axis==='x'?candidate.tangent.x:candidate.tangent.y;
      if(Math.abs(component)>.999){
        const nextAlong=along+secondary.correction/component;
        if(nextAlong>=0&&nextAlong<=candidate.travel){
          const next=alongCandidate(best.candidate,nextAlong);
          if(validAxisGuide(next.points,secondary,units)){candidate=next;along=nextAlong;guides.push(secondary);}
        }
      }
    }
    if(houseAxis)guides.unshift({key:candidate.key,axis:houseAxis,movingEdge:-1,moving:candidate.target,target:candidate.target,label:`House ${candidate.target.side}`,correction:houseAxis==='x'?candidate.pose.x-x:candidate.pose.y-y,score:houseScore});
    return {raw:{x,y,rotation:cache.row.position!.rotation},key:[candidate.key,...guides.filter(g=>g.key!==candidate.key).map(g=>g.key)].join('|'),points:candidate.points,x:candidate.pose.x,y:candidate.pose.y,candidate,target:candidate.target,guides,
      message:`Release to connect · ${cache.method==='facade'?'Wall':cache.method} · ${candidate.target.side}${guides.length>1?' · '+guides[1].axis.toUpperCase()+' aligned with '+guides[1].label:''}${candidate.consequences.length?' · '+candidate.consequences.join('; '):''}`};
  }
  const aligned=composeAxisAlignment(points,peerChoices,units);
  return {raw:{x,y,rotation:cache.row.position!.rotation},key:aligned.guides.map(g=>g.key).join('|')||'free',points:aligned.points,x:x+aligned.dx,y:y+aligned.dy,target:aligned.guides[0]?.target,guides:aligned.guides,
    message:`${cache.bound?'Release to detach and move':'Release to place'}${aligned.guides.length?' · '+aligned.guides.map(g=>`${g.axis.toUpperCase()} aligned with ${g.label}`).join(' · ')+' (not connected)':''}${cache.bound?' · Existing joins may need repair':''}`};
}

export function initialGesturePreview(cache:GestureCache):GesturePreview {
 return {key:'free',points:cache.freeOutline,x:cache.row.position!.x,y:cache.row.position!.y,message:'Move to place; compatible nearby edges can connect or align.'};
}
/** Prepared for every object/method when the authored edit changes, never on selection. */
export function prepareGestureBank(edit:StudioAuthoringEdit){
 const bank=new Map<string,GestureCache>();
 for(const row of websiteComposition(edit))for(const method of ['facade','fascia','soffit'] as const)
  if(row.design&&row.position&&!row.error)bank.set(`${row.object.id}:${method}`,prepareGesture(edit,row.object.id,method,false));
 return bank;
}

/** A starting connection must not capture an intentional outward departure.
 * Only that target is suppressed; a four-screen-pixel return (the existing
 * gesture intent distance) rearms it. Other incoming targets are unchanged. */
export function connectionDeparture(cache:GestureCache){
 const binding=studioHouseScene(cache.edit.site,cache.edit.spatial)?.attachments.find(a=>a.objectId===cache.id);
 const candidate=binding&&cache.candidates.find(c=>c.choice.houseId===binding.houseId&&c.choice.edge===binding.edge);
 if(!candidate)return null;
 const t=candidate.target,mid={x:(t.start.x+t.end.x)/2,y:(t.start.y+t.end.y)/2};
 const length=Math.hypot(mid.x-t.centre.x,mid.y-t.centre.y);
 return {key:candidate.key,n:{x:(mid.x-t.centre.x)/length,y:(mid.y-t.centre.y)/length},start:cache.row.position!,previous:0,peak:0,blocked:false};
}
export function updateConnectionDeparture(state:ReturnType<typeof connectionDeparture>,x:number,y:number,units:number){
 if(!state)return undefined;
 const outward=(x-state.start.x)*state.n.x+(y-state.start.y)*state.n.y;
 if(outward>state.previous+1e-6&&outward>1e-6){state.blocked=true;state.peak=Math.max(outward,state.peak);}
 if(state.blocked&&state.peak-outward>=4*units){state.blocked=false;state.peak=outward;}
 state.previous=outward;return state.blocked?state.key:undefined;
}