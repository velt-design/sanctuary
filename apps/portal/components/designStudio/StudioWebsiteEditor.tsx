'use client';
import { useMemo, useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { LightingProvider, PreviewBlindProvider, useLighting, usePreviewBlinds } from '@sp/configurator/react/controls';
import { parseStudioWebsiteDesign, resolveStudioWebsiteDesign, type StudioWebsiteDesign } from '@/lib/designStudio/websiteDesign';
import type { StudioAuthoringView } from '@/lib/designStudio/authoringView';
import type { StudioSaveScope } from '@/lib/designStudio/saveTransport';
import type { StudioJsonObject } from '@/lib/designStudio/contracts';
import { useStudioEditingSession } from './useStudioEditingSession';
import { useStudioWebsitePrice } from './useStudioWebsitePrice';
import StudioHouseWorkspace from './StudioHouseWorkspace';
import StudioWebsiteControls from './StudioWebsiteControls';
import StudioWebsiteRecovery from './StudioWebsiteRecovery';
import css from './StudioWebsite.module.css';
import {attachWebsitePergola,detachWebsitePergola} from '@/lib/designStudio/websiteAttachment';
import {websiteComposition,addWebsitePergola,positionWebsitePergola} from '@/lib/designStudio/websiteComposition';
import {applyStudioPergolaEdit} from '@/lib/designStudio/pergolaEditing';
import {applyStudioHouseEdit} from '@/lib/designStudio/houseEditing';
import StudioWebsiteObjectNavigator from './StudioWebsiteObjectNavigator';
import StudioWebsiteHouseControls from './StudioWebsiteHouseControls';
import {readHouseDrafts,type HouseDrafts} from '@/lib/designStudio/websiteHouseForm';
import StudioWebsitePlacementControls from './StudioWebsitePlacementControls';
import StudioWebsiteJoinControls,{JoinPriceRecovery} from './StudioWebsiteJoinControls';
import type {WebsiteJoin} from '@/lib/designStudio/websiteJoinIntent';
import {previewWebsiteJoin,removeWebsiteJoin,websiteJoinStates} from '@/lib/designStudio/websiteJoins';
import {websiteCompositionPriceEligibility} from '@/lib/designStudio/websiteCompositionEligibility';
const CompositionScene=dynamic(()=>import('./StudioWebsiteCompositionScene'),{ssr:false,loading:()=> <p>Preparing your design...</p>});
import { studioViewContextKey, readWebsiteViewContext, type WebsiteViewContext } from './studioViewContext';
const Scene = dynamic(()=>import('./StudioWebsiteScene'),{ssr:false,loading:()=> <p>Preparing your design…</p>});
export default function StudioWebsiteEditor({ scope, view, updatedAt, editable, versionLabel }: { scope:StudioSaveScope;view:StudioAuthoringView;updatedAt:string|null;editable:boolean;versionLabel:string }) {
 const controller=useStudioEditingSession({scope,view,updatedAt,editable});
 const [section,choose]=useState<'Shape'|'Roof'|'Sides'|'Lighting'>('Shape');
 const edit=controller.edit;
 const houseDraftKey=`${studioViewContextKey(scope)}:house-fields:${view.revision}`;
 const [houseDrafts,setHouseDrafts]=useState<HouseDrafts>({}),[houseDraftReady,setHouseDraftReady]=useState<string|null>(null);
 useEffect(()=>{if(!edit||houseDraftReady===houseDraftKey)return;try{setHouseDrafts(readHouseDrafts(sessionStorage.getItem(houseDraftKey),new Set(edit.spatial.houseAssembly?.houseForms.map(h=>h.id)??[])));}catch{}setHouseDraftReady(houseDraftKey);},[houseDraftKey,houseDraftReady,edit]);
 useEffect(()=>{if(houseDraftReady===houseDraftKey)try{sessionStorage.setItem(houseDraftKey,JSON.stringify(houseDrafts));}catch{}},[houseDraftKey,houseDraftReady,houseDrafts]);
 const pendingHouseId=Object.keys(houseDrafts).find(id=>Object.keys(houseDrafts[id]).length&&Boolean((edit??view).spatial.houseAssembly?.houseForms.some(h=>h.id===id)));

 const [pickHouseEdge,setPickHouseEdge]=useState(false);
 const [joinRecovery,setJoinRecovery]=useState(false);
 const invalidJoin=useMemo(()=>edit?websiteJoinStates(edit).find(s=>s.error):undefined,[edit]);
 const [joinDraft,setJoinDraft]=useState<WebsiteJoin|null>(null);
 const joinPreview=useMemo(()=>{if(!edit||!joinDraft?.b.objectId)return null;try{const preview=previewWebsiteJoin(edit,joinDraft);const error=websiteCompositionPriceEligibility(websiteComposition(preview.edit),preview.edit.site.websiteJoins);return error?{error,edit:null}:{error:null,edit:preview.edit};}catch(e){return {error:e instanceof Error?e.message:'Join unavailable.',edit:null};}},[edit,joinDraft]);
 const [attachmentKind,setAttachmentKind]=useState<'wall'|'roof_eave'>('roof_eave');
 const [selectedId,select]=useState<string|null>(null),[placement,setPlacement]=useState(false),[commandError,setCommandError]=useState<string|null>(null);
 const composition=useMemo(()=>websiteComposition(edit??view),[edit,view]);
 const selectedHouse=(edit??view).spatial.houseAssembly?.houseForms.find(h=>h.id===selectedId);
 const invalidAttachment=composition.find(p=>p.error&&p.object.attachment?.host);
 const selected=composition.find(p=>p.object.id===selectedId)??composition[0];
 const row=(edit?.objectOptions??view.objectOptions).find(row=>row.objectId===selected?.object.id);
 const compositionMode=composition.length>1||Boolean((edit??view).spatial.houseAssembly)||composition.some(p=>p.value?.supportDatumMm!==undefined||p.object.attachment?.host);
 useEffect(()=>{try{const id=sessionStorage.getItem(`${studioViewContextKey(scope)}:selected`);if(id)select(id);}catch{}},[scope.actorId,scope.projectId,scope.estimateId,scope.designId]);
 const [placementRestored,setPlacementRestored]=useState(false);
 useEffect(()=>{try{setPlacement(sessionStorage.getItem(`${studioViewContextKey(scope)}:placement`)==='true');}catch{}setPlacementRestored(true);},[]);
 useEffect(()=>{if(!placementRestored)return;try{sessionStorage.setItem(`${studioViewContextKey(scope)}:placement`,String(placement));}catch{}},[placement,placementRestored]);
 function pick(id:string){setJoinRecovery(false);setJoinDraft(null);select(id);try{sessionStorage.setItem(`${studioViewContextKey(scope)}:selected`,id);}catch{}}
 function command(action:()=>void){try{setCommandError(null);action();}catch(error){setCommandError(error instanceof Error?error.message:'The design could not be changed.');}}
 function add(){if(!edit||!controller.canEdit)return;command(()=>{const id=`${view.designId}:pergola:${crypto.randomUUID()}`;controller.change(addWebsitePergola(edit,id));pick(id);setPlacement(false);choose('Shape');});}
 function copy(){if(!edit||!selected||!controller.canEdit)return;command(()=>{const result=applyStudioPergolaEdit(edit,{kind:'duplicate',pergolaId:selected.object.id,id:`${view.designId}:pergola:${crypto.randomUUID()}`,rowIds:{flashings:{},infills:{}}},{persistedObjectIds:controller.session?.baselinePergolaIds??[],baselineObjectOptions:controller.session?.baselineObjectOptions,savePending:Boolean(controller.session?.pending)});if(!result.ok)throw Error(result.message);controller.change(result.edit);if(result.selectedObjectId)pick(result.selectedObjectId);setPlacement(true);});}
 function remove(){if(!edit||!selected||!controller.canEdit)return;command(()=>{const result=applyStudioPergolaEdit(edit,{kind:'remove',pergolaId:selected.object.id},{persistedObjectIds:controller.session?.baselinePergolaIds??[]});if(!result.ok)throw Error(result.message);controller.change(result.edit);select(result.selectedObjectId);setPlacement(false);});}
 function house(){if(!edit||!controller.canEdit)return;const existing=edit.spatial.houseAssembly?.houseForms[0];if(existing){pick(existing.id);return;}command(()=>{const result=applyStudioHouseEdit(edit.spatial,{kind:'add',id:`${view.designId}:house:${crypto.randomUUID()}`,label:'House'});if(!result.ok)throw Error(result.message);controller.change({...edit,spatial:result.spatial});if(result.houseFormId)pick(result.houseFormId);});}
 function move(patch:Partial<{originXMm:string;originYMm:string;rotationDeg:string}>){if(edit&&selected)command(()=>controller.change(positionWebsitePergola(edit,selected.object.id,patch)));}

 const parsed=useMemo(()=>parseStudioWebsiteDesign(row?.values.websiteDesign,row?.objectId),[row]);
 const value=parsed.ok?parsed.value:null;
 const resolved=useMemo(()=>value?resolveStudioWebsiteDesign(value,value.objectId):null,[value]);
 const price=useStudioWebsitePrice({actorId:scope.actorId,projectId:scope.projectId,estimateId:scope.estimateId,designId:view.designId,revision:edit?.revision??view.revision,design:resolved?.ok&&!compositionMode?value:null,composition:compositionMode&&edit&&composition.length&&composition.every(p=>!p.error)?edit:null});
 function change(next:StudioWebsiteDesign){
  if(!edit||!controller.canEdit)return;
  const source=structuredClone(edit); const option=source.objectOptions.find(o=>o.objectId===next.objectId)!;
  if(next.rawGaps)next={...next,rawGaps:Object.fromEntries(Object.entries(next.rawGaps).filter(([key])=>key==='roof'||next.selection.roof.sidePanels?.some(p=>p.opening===key)))};
  const valid=resolveStudioWebsiteDesign(next,next.objectId);
  if(valid.ok)next={...next,selection:{...valid.value,roof:{...valid.value.roof,...(next.selection.roof.finish?.material==='solid'&&next.selection.roof.roofBattens?{roofBattens:next.selection.roof.roofBattens}:{})}}};
  option.values.websiteDesign=next as unknown as StudioJsonObject;
  source.spatial.pergolas=source.spatial.pergolas.map(p=>p.id===next.objectId?{...p,family:next.selection.roof.family}:p);
  controller.change(source);
 }
 const selection=resolved?.ok?resolved.value:value?.selection;
 if(controller.edit)return <StudioHouseWorkspace controller={controller} scope={scope} versionLabel={versionLabel}/>;
 const workspace=(
 <main className={`${css.page} ${css.editorPage}`}>
  <header className={css.header}><div><Link className={css.back} href={`/staff/projects/${scope.projectId}?tab=estimates`}>← Project</Link><h1>Pergola design</h1><p>{versionLabel} · {controller.session?.dirty?'Changes kept on this device':'Saved design'}</p><StudioWebsiteRecovery controller={controller}/></div>
   <div className={css.price} aria-live="polite"><span>Design subtotal · including GST</span><strong>{pendingHouseId?'Apply house changes':!value?'Not calculated':composition.some(p=>p.error)?'Check design':price.price?.status==='priced'?new Intl.NumberFormat('en-NZ',{style:'currency',currency:'NZD',maximumFractionDigits:0}).format(price.price.amount!):resolved&&!resolved.ok?'Check design':price.error||price.price?.status==='unavailable'?'Unavailable':'Calculating…'}</strong><small>{pendingHouseId?'The model shows the last applied house.':!value?'Add a pergola to calculate the design.':composition.find(p=>p.error)?.error||(resolved&&!resolved.ok?resolved.message:null)||price.error||price.price?.reason|| (price.price?.versionNumber?`Current Pricebook ${price.price.versionNumber}`:' ')}{resolved&&!resolved.ok&&<FixInput issue={resolved} choose={choose}/>}{invalidAttachment&&<button onClick={()=>{pick(invalidAttachment.object.id);setPlacement(true);}}>Check attachment</button>}{pendingHouseId&&<button onClick={()=>pick(pendingHouseId)}>Edit house</button>}<JoinPriceRecovery invalidLabel={invalidJoin?.label} onCheck={()=>{if(invalidJoin){pick(invalidJoin.join.a.objectId);setPlacement(true);setPickHouseEdge(false);setJoinRecovery(true);}}} error={price.error} onRetry={price.retry}/></small></div>
   <div className={css.actions}><button disabled={!controller.canSave||Boolean(pendingHouseId)||composition.some(p=>p.error)} onClick={()=>controller.save()}>Save design</button><Link href={`/staff/design-studio/${scope.projectId}/${scope.estimateId}`}>Review →</Link></div>

  </header>

  {commandError&&<p className={css.commandError} role="alert">{commandError}</p>}
  <div className={css.workspace}><section className={css.visual} aria-label="Whole design model">
   <StudioWebsiteObjectNavigator objects={[...composition.map(p=>({id:p.object.id,label:p.object.label})),...((edit??view).spatial.houseAssembly?.houseForms??[]).map(h=>({id:h.id,label:h.label}))]} selected={selectedHouse?.id??selected?.object.id??null} onSelect={pick} onAdd={add} onHouse={house} disabled={!controller.canEdit}/>
   {(compositionMode||!value)&&edit?<CompositionScene edit={edit} previewEdit={joinPreview?.edit??null} joinDraft={joinDraft} onJoinTarget={(objectId,edge)=>joinDraft&&setJoinDraft({...joinDraft,b:{objectId,edge}})} pickHouseEdge={pickHouseEdge} attachmentKind={attachmentKind} onHouseEdge={(houseId,edgeId,kind)=>{if(!selected)return;command(()=>controller.change(attachWebsitePergola(edit,selected.object.id,edgeId,houseId,kind==='wall'?'facade_ledger':selected.design?.roof.family==='gable'&&selected.design.roof.orientation==='away'?'fascia_under_gutter':selected.design?.input.connection==='soffit'?'direct_to_soffit':'fascia_under_gutter')));setPickHouseEdge(false);}} selected={selectedHouse?.id??value?.objectId??''} section={section} placement={placement} onSelect={pick} onMove={(id,x,y)=>command(()=>{const h=edit.spatial.houseAssembly?.houseForms.find(h=>h.id===id);if(h){if(Object.keys(houseDrafts[id]??{}).length)throw Error('Apply or discard the pending house changes before dragging.');const result=applyStudioHouseEdit(edit.spatial,{kind:'move',houseFormId:id,position:{originXMm:String(x),originYMm:String(y),rotationDeg:h.position?.rotationDeg??String(h.transform.rotationQuarterTurns*90)}});if(!result.ok)throw Error(result.message);controller.change({...edit,spatial:result.spatial});}else controller.change(positionWebsitePergola(edit,id,{originXMm:String(x),originYMm:String(y)}));})} onDimension={axis=>{setPlacement(false);choose('Shape');requestAnimationFrame(()=>document.querySelector<HTMLInputElement>(`input[aria-label="${axis==='width'?'Width':'Projection'} in millimetres"]`)?.focus());}}/>:resolved?.ok&&selection?<Scene design={selection} section={section} onDimension={axis=>{choose('Shape');requestAnimationFrame(()=>document.querySelector<HTMLInputElement>(`input[aria-label="${axis==='width'?'Width':'Projection'} in millimetres"]`)?.focus());}}/>:<div className={css.sceneError}>{resolved?.ok===false?resolved.message:'Add a pergola to begin.'}</div>}
   {!compositionMode&&selection&&<WebsiteDimensions design={selection}/>}</section>
   <fieldset className={css.controls} disabled={!controller.canEdit}>
    <div className={css.objectHeading}><strong>{selectedHouse?.label??selected?.object.label}</strong>{!selectedHouse&&selected&&<div><button onClick={()=>setPlacement(!placement)} aria-pressed={placement}>Position</button><button onClick={copy}>Duplicate</button><button onClick={remove}>Remove</button></div>}</div>
    {!edit?<div className={css.inspectorBody} role="status">Opening your saved choices…</div>:selectedHouse?<StudioWebsiteHouseControls key={selectedHouse.id} edit={edit} house={selectedHouse} draft={houseDrafts[selectedHouse.id]??{}} onDraft={draft=>setHouseDrafts(prev=>({...prev,[selectedHouse.id]:draft}))} onChange={controller.change}/>:selected&&value?placement?<div className={css.positionBody}>{!joinDraft&&!joinRecovery&&<StudioWebsitePlacementControls label={selected.object.label} attachmentKind={attachmentKind} onAttachmentKind={setAttachmentKind} onPickEdge={()=>setPickHouseEdge(v=>!v)} pickingEdge={pickHouseEdge} edit={edit!} row={selected} onAttach={(houseId,edgeId,method)=>command(()=>controller.change(attachWebsitePergola(edit!,selected.object.id,edgeId,houseId,method)))} onDetach={()=>command(()=>controller.change(detachWebsitePergola(edit!,selected.object.id)))} onHeight={raw=>change({...value,supportDatumMm:raw})} onHouse={id=>pick(id)} position={selected.object.position} onChange={move} onBack={()=>{setJoinDraft(null);setPlacement(false);}}/>}<StudioWebsiteJoinControls focused={joinRecovery} onBack={()=>{setJoinRecovery(false);setJoinDraft(null);}} edit={edit} objectId={selected.object.id} draft={joinDraft} onDraft={setJoinDraft} error={joinPreview?.error??null} onCommit={()=>{if(joinPreview?.edit){controller.change(joinPreview.edit);setJoinDraft(null);}}} onRemove={id=>controller.change(removeWebsiteJoin(edit,id))}/></div>:<StudioWebsiteControls bookmarkKey={`${studioViewContextKey(scope)}:sides:${encodeURIComponent(value.objectId)}`} value={value} onChange={change} section={section} choose={choose}/>:<div className={css.inspectorBody}><h2>Add a pergola</h2><p>Your house and other saved choices are kept.</p><button className={css.quietButton} onClick={add}>Add pergola</button></div>}</fieldset>
  </div>
 </main>
 );
 if(!value||!selection)return workspace;
 return <LightingProvider input={selection.input} roof={selection.roof} geometryOptions={selected?.geometryOptions} onChange={roof=>change({...value,selection:{...selection,roof:{...value.selection.roof,...roof}}})}><PreviewBlindProvider input={selection.input} roof={selection.roof} geometryOptions={selected?.geometryOptions} onChange={roof=>change({...value,selection:{...selection,roof:{...value.selection.roof,...roof}}})} onChooseSides={()=>choose('Sides')}><WebsiteNavigation storageKey={`${studioViewContextKey(scope)}:website:v1:${value.objectId}`} globalKey={`${studioViewContextKey(scope)}:composition-view`} section={section} choose={choose}/>{workspace}</PreviewBlindProvider></LightingProvider>;
}

function WebsiteNavigation({storageKey,globalKey,section,choose}:{storageKey:string;globalKey:string;section:WebsiteViewContext['section'];choose:(section:WebsiteViewContext['section'])=>void}) {
 const light=useLighting()!,blinds=usePreviewBlinds()!;
 const [restored,setRestored]=useState<string|null>(null);
 const [globalRestored,setGlobalRestored]=useState(false);
 useEffect(()=>{try{const context=JSON.parse(sessionStorage.getItem(globalKey)??'null');if(context){if(context.view==='Plan'||context.view==='3D')light.setView(context.view);if(typeof context.night==='boolean')light.setNight(context.night);}}catch{}setGlobalRestored(true);},[globalKey]);
 useEffect(()=>{if(globalRestored)try{sessionStorage.setItem(globalKey,JSON.stringify({view:light.view,night:light.night}));}catch{}},[globalKey,globalRestored,light.view,light.night]);
 useEffect(()=>{
  try {const context=readWebsiteViewContext(sessionStorage.getItem(storageKey),blinds.openings.map(o=>o.id));
   if(context){choose(context.section);if(context.section==='Lighting')light.open();if(context.opening)blinds.select(context.opening);light.setTool(context.tool??null);}
  }catch{/* Optional navigation state must not block design editing. */}
  setRestored(storageKey);
 },[storageKey]);
 useEffect(()=>{if(restored!==storageKey)return;try{sessionStorage.setItem(storageKey,JSON.stringify({section,night:light.night,opening:blinds.selected,view:light.view,tool:light.tool}));}catch{/* Keep current work usable without navigation storage. */}},[storageKey,restored,section,light.night,blinds.selected,light.view,light.tool]);
 return null;
}

function WebsiteDimensions({design}:{design:StudioWebsiteDesign['selection']}) {
 const lighting=useLighting();
 return <div className={css.dimensions} data-night={lighting?.night||undefined}>{design.input.widthMm/1000} × {design.input.projectionMm/1000} m<span>{design.roof.family==='mono'?'Pitched':design.roof.family==='gable'?'Gable':'Box perimeter'}</span></div>;
}

function FixInput({issue,choose}:{issue:{message:string;field?:string;gapKey?:string};choose:(s:WebsiteViewContext['section'])=>void}){const blinds=usePreviewBlinds()!;return <button onClick={()=>{const section=issue.field==='gap'?(issue.gapKey==='roof'?'Roof':'Sides'):'Shape';choose(section);if(section==='Sides'&&issue.gapKey)blinds.select(issue.gapKey);}}>Fix {issue.field==='gap'?'gap':'input'}</button>;}
