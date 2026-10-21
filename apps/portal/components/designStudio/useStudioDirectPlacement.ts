'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import type {StudioAuthoringEdit} from '@/lib/designStudio/authoringView';
import {positionWebsitePergola} from '@/lib/designStudio/websiteComposition';
import {studioHouseScene,type StudioHouse} from '@/lib/designStudio/studioHouseScene';
import type {StudioAttachmentChoice} from '@/lib/designStudio/studioAttachmentPreview';
import {solveStudioHouse} from '@/lib/designStudio/studioHouseGeometry';
import {updateStudioHouse,previewStudioAttachment,detachStudioPergola} from '@/lib/designStudio/studioHouseCommands';
import {preparationFingerprint,rebaseGestureTemplates,type GestureTemplatePack} from './directDemo/gestureTemplates';
import {connectionDeparture,updateConnectionDeparture,initialGesturePreview,previewGesture,type GestureCache,type GesturePreview} from './directDemo/gesturePreview';
import type {StudioDirectDrag} from './StudioHouseCanvas';

export type StudioPendingAttachment={edit:StudioAuthoringEdit;choice:StudioAttachmentChoice};
/** Approved gesture mechanics, controlled by the saved editing session. Pending
 * geometry is a gesture basis only; the original authored edit owns commit/Undo. */
export function useStudioDirectPlacement(edit:StudioAuthoringEdit,change:(next:StudioAuthoringEdit)=>void,locked:boolean,pending:StudioPendingAttachment|null=null,onApplied?:()=>void){
 const [prepared,setPrepared]=useState<{pack:GestureTemplatePack;fingerprint:string}|null>(null),[message,setMessage]=useState<string|null>(null),[preparationError,setPreparationError]=useState<string|null>(null),[proposal,setProposal]=useState<GesturePreview|null>(null);
 const [workerReady,setWorkerReady]=useState(0),worker=useRef<Worker|null>(null),request=useRef(0);
 let fingerprint='';try{fingerprint=preparationFingerprint(edit);}catch{}
 useEffect(()=>{const w=new Worker(new URL('./studioPlacement.worker.ts',import.meta.url));worker.current=w;
  w.onmessage=(e:MessageEvent<{requestId:number;pack?:GestureTemplatePack;error?:string}>)=>{if(e.data.requestId!==request.current)return;if(e.data.pack){setPrepared({pack:e.data.pack,fingerprint:e.data.pack.requestFingerprint});setPreparationError(null);setMessage(null);}else setPreparationError(e.data.error??'Placement unavailable.');};
  w.onerror=()=>setPreparationError('Placement could not be prepared. Your saved design is kept.');setWorkerReady(n=>n+1);return()=>{request.current++;w.terminate();worker.current=null;};},[]);
 useEffect(()=>{if(!worker.current||!fingerprint)return;const requestId=++request.current;setPrepared(null);setPreparationError(null);worker.current.postMessage({requestId,edit});},[fingerprint,workerReady]);
 const banks=useMemo(()=>{
  if(!prepared||prepared.fingerprint!==fingerprint)return null;
  try{return {committed:rebaseGestureTemplates(edit,prepared.pack),pending:pending?rebaseGestureTemplates(pending.edit,prepared.pack):null,error:null};}
  catch(e){return {committed:null,pending:null,error:(e as Error).message};}
 },[edit,prepared,fingerprint,pending?.edit]);
 const houseMove=useRef<{house:StudioHouse;original:{x:number;y:number}[];x:number;y:number;authored:StudioAuthoringEdit}|null>(null);
 const active=useRef<{cache:GestureCache;preview:GesturePreview;original:GestureCache['original'];authored:StudioAuthoringEdit;pending:StudioPendingAttachment|null;departure:ReturnType<typeof connectionDeparture>}|null>(null);
 function clear(){houseMove.current=null;active.current=null;setProposal(null);}
 const cacheFor=(id:string)=>{
  const proposalForObject=pending?.choice.objectId===id?pending:null;
  const row=[...(proposalForObject?banks?.pending:banks?.committed)?.values()??[]].find(c=>c.id===id)?.row;
  const method=proposalForObject?.choice.method??row?.studioAttachment?.method??row?.design?.input.connection??'facade';
  return {pending:proposalForObject,cache:(proposalForObject?banks?.pending:banks?.committed)?.get(`${id}:${method}`),original:banks?.committed?.get(`${id}:${method}`)?.original};
 };
 const directDrag:StudioDirectDrag={
  canDrag:id=>!locked&&(!pending||pending.choice.objectId===id)&&(!!studioHouseScene(edit.site,edit.spatial)?.houses.some(h=>h.id===id)||!!cacheFor(id).cache),
  begin:id=>{
   if(locked)return;
   const house=!pending&&studioHouseScene(edit.site,edit.spatial)?.houses.find(h=>h.id===id);
   if(house){const points=solveStudioHouse(house).footprint;houseMove.current={house,original:points,x:Number(house.position.xMm),y:Number(house.position.yMm),authored:edit};setProposal({key:'house',points,x:Number(house.position.xMm),y:Number(house.position.yMm),message:'Move house. Release to apply or Escape to cancel.'});return;}
   const ready=cacheFor(id);if(!ready.cache||!ready.original)return;
   const first=initialGesturePreview(ready.cache);if(ready.pending)first.points=ready.cache.original;
   active.current={cache:ready.cache,preview:first,original:ready.original,authored:edit,pending:ready.pending,departure:connectionDeparture(ready.cache)};setProposal(first);
  },
  move:(id,x,y,_cursor,units)=>{
   const h=houseMove.current;if(h){if(h.authored!==edit){clear();return;}h.x=x;h.y=y;setProposal({key:'house',points:h.original.map(p=>({x:p.x+x-Number(h.house.position.xMm),y:p.y+y-Number(h.house.position.yMm)})),x,y,message:'House position preview. Release to apply or Escape to cancel.'});return;}
   const a=active.current;if(!a)return;if(a.authored!==edit){clear();setMessage('Design changed. Start the move again.');return;}
   const next=previewGesture(a.cache,x,y,units,a.preview.key,updateConnectionDeparture(a.departure,x,y,units));a.preview=next;setProposal(next);
  },
  finish:apply=>{
   const h=houseMove.current;if(h){try{if(apply&&h.authored===edit)change(updateStudioHouse(edit,{...h.house,position:{...h.house.position,xMm:String(h.x),yMm:String(h.y)}}));}catch(e){setMessage((e as Error).message);}clear();return;}
   const a=active.current;if(!a)return;
   try{if(apply){
    if(a.authored!==edit)throw Error('Design changed. Start the move again.');
    let next:StudioAuthoringEdit;
    if(a.preview.candidate){next=previewStudioAttachment(edit,a.preview.candidate.choice);if(JSON.stringify(next)!==JSON.stringify(a.preview.candidate.edit))throw Error('The connection changed. Preview it again.');}
    else{
     let freeEdit=a.cache.freeEdit;
     if(a.pending){const temporary=previewStudioAttachment(edit,a.pending.choice);if(JSON.stringify(temporary)!==JSON.stringify(a.pending.edit))throw Error('The connection proposal changed. Preview it again.');freeEdit=detachStudioPergola(temporary,a.cache.id);}
     next=positionWebsitePergola(freeEdit,a.cache.id,{originXMm:String(a.preview.x),originYMm:String(a.preview.y)});
    }
    change(next);onApplied?.();setMessage(a.preview.candidate?'Connected to house.':'Placement applied.');
   }else if(a.pending)setMessage('Move cancelled. Connection proposal restored; current design is unchanged.');}
   catch(e){setMessage((e as Error).message);}clear();
  }
 };
 return {directDrag,proposal,footprint:proposal&&houseMove.current?{points:proposal.points,original:houseMove.current.original}:proposal&&active.current?{points:proposal.points,original:active.current.original,target:proposal.target,guides:proposal.guides}:undefined,message:preparationError??banks?.error??(!banks?'Preparing placement…':message),busy:!!proposal};
}
