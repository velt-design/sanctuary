import {act,useState} from 'react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {renderIntoDocument} from '../../../../test/reactHarness';
import {EMPTY_OBJECT_FIRST_WORKBENCH_DRAFT} from '@/lib/drawings/state/objectFirstWorkbenchModel';
import {parseStudioAuthoringEdit,type StudioAuthoringEdit} from '@/lib/designStudio/authoringView';
import {addWebsitePergola,positionWebsitePergola,websiteComposition} from '@/lib/designStudio/websiteComposition';
import {applyStudioHouseEdit} from '@/lib/designStudio/houseEditing';
import {changeStudioProduct,previewStudioAttachment,updateStudioHouse} from '@/lib/designStudio/studioHouseCommands';
import {studioHouseScene} from '@/lib/designStudio/studioHouseScene';
import {solvePergolaPreview} from '@sp/configurator/geometry';
import {websiteConnectionEdge} from '@/lib/designStudio/websiteConnectionEdge';
import {prepareGestureTemplates,rebaseGestureTemplates} from './directDemo/gestureTemplates';
import {useStudioDirectPlacement} from './useStudioDirectPlacement';

type Request={requestId:number;edit:StudioAuthoringEdit};
let worker:TestWorker,api:ReturnType<typeof useStudioDirectPlacement>,current:StudioAuthoringEdit,replace:(e:StudioAuthoringEdit)=>void,undo:()=>void;
let mount:ReturnType<typeof renderIntoDocument>|undefined;
class TestWorker {
 onmessage:((e:MessageEvent)=>void)|null=null;requests:Request[]=[];
 constructor(){worker=this;}postMessage(r:Request){this.requests.push(structuredClone(r));}terminate(){}
 reply(r=this.requests.at(-1)!){try{this.onmessage?.({data:{requestId:r.requestId,pack:prepareGestureTemplates(r.edit)}} as MessageEvent);}catch(e){this.onmessage?.({data:{requestId:r.requestId,error:(e as Error).message}} as MessageEvent);}}
}
function mixed(){
 let e:StudioAuthoringEdit={schemaVersion:'studio_authoring_edit.v1',designId:'mixed-placement-variants',revision:1,spatial:structuredClone(EMPTY_OBJECT_FIRST_WORKBENCH_DRAFT),site:{},objectOptions:[],deletions:[]};
 const h=applyStudioHouseEdit(e.spatial,{kind:'add',id:'house'});if(!h.ok)throw Error(h.message);e.spatial=h.spatial;
 const house=studioHouseScene(e.site,e.spatial)!.houses[0];e=updateStudioHouse(e,{...house,widthMm:'8000',wallHeightMm:'3200',eaveHeightMm:'3200',roof:{...house.roof,fasciaHeightMm:'350'}});
 for(const [id,family,intent,width,projection,x,y,rotation,finish,datum] of [
  ['box','box','freestanding','6000','3000','3706.4','4120.9','0','black','2838'],
  ['pitched','mono','attached','6500','3200','11000','0','-360','white','2400'],
  ['gable','gable','attached','6000','3000','13072.7','4114.9','0','black','2400'],
 ] as const){
  e=addWebsitePergola(e,id);const v=websiteComposition(e).find(r=>r.object.id===id)!.value!;
  const roof={...v.selection.roof,family,orientation:'parallel' as const,frameFinish:finish};if(intent==='freestanding')roof.attachmentIntent='freestanding';
  e=changeStudioProduct(e,{...v,supportDatumMm:datum,rawDimensions:{widthMm:width,projectionMm:projection},selection:{...v.selection,roof}});
  e=positionWebsitePergola(e,id,{originXMm:x,originYMm:y,rotationDeg:rotation});
 }
 return e;
}
function intent(e:StudioAuthoringEdit,id:string,free:boolean){const v=websiteComposition(e).find(r=>r.object.id===id)!.value!,roof={...v.selection.roof};if(free)roof.attachmentIntent='freestanding';else delete roof.attachmentIntent;return changeStudioProduct(e,{...v,selection:{...v.selection,roof}});}
function open(initial:StudioAuthoringEdit){
 function Harness(){const[e,set]=useState(initial),[previous,keep]=useState<StudioAuthoringEdit|null>(null);current=e;replace=set;undo=()=>{if(previous)set(previous);};api=useStudioDirectPlacement(e,next=>{keep(e);set(next);},false);return null;}
 mount=renderIntoDocument(<Harness/>);act(()=>worker.reply());
}
beforeEach(()=>vi.stubGlobal('Worker',TestWorker));
afterEach(()=>{mount?.unmount();mount=undefined;vi.unstubAllGlobals();});

it('moves every valid mixed-design product when the freestanding Box has no house datum, retaining cancel, reload and Undo',()=>{
 const e=mixed(),box=websiteComposition(e)[0];expect(box.error).toBeNull();
 expect(()=>websiteConnectionEdge(solvePergolaPreview(box.design!.input,box.design!.roof,box.geometryOptions).geometry!.assembly)).toThrow('no supported house connection datum');
 open(e);for(const id of ['box','pitched','gable'])expect(api.directDrag.canDrag!(id)).toBe(true);
 expect(api.message).toBeNull();
 for(const id of ['box','pitched','gable']){const p=websiteComposition(current).find(r=>r.object.id===id)!.position!;act(()=>api.directDrag.begin!(id));act(()=>api.directDrag.move(id,p.x+600,p.y+10000,{x:0,y:0},1));expect(api.proposal).toBeTruthy();act(()=>api.directDrag.finish(false));expect(current).toEqual(e);}
 const p=box.position!;act(()=>api.directDrag.begin!('box'));act(()=>api.directDrag.move('box',p.x+600,p.y+10000,{x:0,y:0},1));const shown=api.proposal!;act(()=>api.directDrag.finish(true));
 const moved=websiteComposition(current)[0];expect(moved.position).toMatchObject({x:shown.x,y:shown.y});expect(moved.studioAttachment).toBeNull();expect(moved.value).toEqual(box.value);
 const loaded=parseStudioAuthoringEdit(JSON.parse(JSON.stringify(current)));expect(loaded.ok).toBe(true);if(loaded.ok)expect(websiteComposition(loaded.value)[0].position).toEqual(moved.position);
 act(undo);expect(current).toEqual(e);
},20000);

it('retains real Box and peer attachment candidates, with unsupported methods still refused by the physical owner',()=>{
 const e=mixed(),pack=prepareGestureTemplates(e),bank=rebaseGestureTemplates(e,pack);
 for(const id of ['box','pitched','gable']){
  const candidates=[...bank.values()].filter(c=>c.id===id).flatMap(c=>c.candidates);expect(candidates.length).toBeGreaterThan(0);
  for(const candidate of candidates)expect(previewStudioAttachment(e,candidate.choice)).toEqual(candidate.edit);
 }
 expect(bank.get('box:fascia')!.candidates).toEqual([]);expect(bank.get('box:fascia')!.unavailable).toContain('unavailable');
 expect(()=>previewStudioAttachment(e,{objectId:'box',houseId:'house',edge:'rear',kind:'eave',method:'fascia'})).toThrow();
},20000);

it('rebuilds after support intent changes, ignores old replies, and preserves pending readiness until the current pack arrives',()=>{
 // This two-product shape mirrors the normal Gable free -> house-supported transition.
 let e=mixed();e={...e,spatial:{...e.spatial,pergolas:e.spatial.pergolas.filter(p=>p.id!=='box')},objectOptions:e.objectOptions.filter(p=>p.objectId!=='box')};
 e=intent(e,'gable',true);open(e);expect(api.directDrag.canDrag!('gable')).toBe(true);
 const oldRequest=worker.requests.at(-1)!,count=worker.requests.length;
 act(()=>replace(intent(current,'gable',false)));expect(worker.requests).toHaveLength(count+1);expect(api.directDrag.canDrag!('gable')).toBe(false);expect(api.message).toBe('Preparing placement…');
 const requested=worker.requests.at(-1)!;act(()=>worker.reply(oldRequest));expect(api.directDrag.canDrag!('gable')).toBe(false);
 act(()=>worker.reply(requested));expect(api.directDrag.canDrag!('gable')).toBe(true);expect(api.directDrag.canDrag!('pitched')).toBe(true);expect(api.message).toBeNull();
 act(()=>worker.reply(oldRequest));expect(api.directDrag.canDrag!('gable')).toBe(true);
},20000);

it.each(['freestanding','soffit'] as const)('rebuilds the current %s variant without invalidating the other product',variant=>{
 let e=mixed();e={...e,spatial:{...e.spatial,pergolas:e.spatial.pergolas.filter(p=>p.id!=='box')},objectOptions:e.objectOptions.filter(p=>p.objectId!=='box')};
 open(e);const count=worker.requests.length,v=websiteComposition(current).find(r=>r.object.id==='gable')!.value!;
 const next=variant==='freestanding'?intent(current,'gable',true):changeStudioProduct(current,{...v,selection:{...v.selection,input:{...v.selection.input,connection:'soffit'}}});
 act(()=>replace(next));expect(worker.requests).toHaveLength(count+1);expect(api.directDrag.canDrag!('gable')).toBe(false);
 act(()=>worker.reply());expect(api.directDrag.canDrag!('gable')).toBe(true);expect(api.directDrag.canDrag!('pitched')).toBe(true);
},20000);

it('shows current preparation and invalid-input failure instead of a stale successful placement message',()=>{
 let e=mixed();e={...e,spatial:{...e.spatial,pergolas:e.spatial.pergolas.filter(p=>p.id==='pitched')},objectOptions:e.objectOptions.filter(p=>p.objectId==='pitched')};
 open(e);act(()=>api.directDrag.begin!('pitched'));act(()=>api.directDrag.move('pitched',20000,20000,{x:0,y:0},1));act(()=>api.directDrag.finish(true));expect(api.message).toBe('Placement applied.');
 const v=websiteComposition(current)[0].value!;act(()=>replace(changeStudioProduct(current,{...v,rawDimensions:{...v.rawDimensions,widthMm:'bad'}})));
 expect(api.message).toBe('Preparing placement…');act(()=>worker.reply());expect(api.message).toContain('positive whole millimetre');expect(api.directDrag.canDrag!('pitched')).toBe(false);
 act(()=>replace(changeStudioProduct(current,{...v,rawDimensions:{...v.rawDimensions,widthMm:'6500'}})));act(()=>worker.reply());expect(api.message).toBeNull();expect(api.directDrag.canDrag!('pitched')).toBe(true);
},20000);
