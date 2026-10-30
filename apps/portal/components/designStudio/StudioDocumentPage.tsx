'use client';
import {useContext,useEffect,useLayoutEffect,useState,type CSSProperties} from 'react';
import {StudioDocumentContext} from './StudioDocumentContext';
import {StudioDocumentInstallation} from './StudioDocumentSlot';
import StudioDocument from './StudioDocument';
import StudioNativeEntry from './StudioNativeEntry';
import {StudioAuthoringContent} from './StudioAuthoringLoader';
import {loadStudioEditor} from './studioLeafLoading';

/** Route-local editor graph. The root frame imports no editor or 3D loader. */
export default function StudioDocumentPage({callback}:{callback:string}) {
 const frame=useContext(StudioDocumentContext),installation=useContext(StudioDocumentInstallation);
 useLayoutEffect(()=>{if(installation?.callback===callback)installation.install(StudioDocument);},[callback,installation?.callback,installation?.install]);
 const [leaf,setLeaf]=useState<{Editor:Awaited<ReturnType<typeof loadStudioEditor>>}|null>(null);
 useEffect(()=>{
  const issued=frame?.requestIssued;
  if(!issued||issued.signal.aborted)return;
  let live=true;
  // The existing request owner releases public code only after invoking fetch.
  // Download still overlaps the response; no scene or actor runtime mounts.
  void loadStudioEditor().then(Editor=>{if(live&&!issued.signal.aborted)setLeaf({Editor});});
  return()=>{live=false;};
 },[frame?.requestIssued?.turn,frame?.requestIssued?.signal]);
 if(!frame||frame.callback!==callback)return installation?.callback===callback?<main><h1>Design Studio</h1><p role="status">Opening saved design…</p></main>:<StudioNativeEntry callback={callback}/>;
 const {visible,error,leaving,retry}=frame,admission=frame.admission?.kind==='edit'?frame.admission:null,parts=callback.split('?')[0].split('/'),projectId=parts[3],estimateId=parts[4];
 const authoring=admission?.authoring;
 const needsEditor=authoring?.state==='ready'&&authoring.view&&!authoring.estimate.requiresNewRevision&&authoring.nextAction==='edit';
 const loaded=admission&&(!needsEditor||leaf)?{authoring:admission.authoring,Editor:leaf?.Editor,leafFailed:Boolean(needsEditor&&!leaf?.Editor),openingPrice:admission.openingPrice}:null;
 const loading=<StudioAuthoringContent projectId={projectId} estimateId={estimateId} loaded={null} retry={retry}/>;
 return <>
  {!visible&&<div style={{position:'fixed',inset:0,zIndex:100,background:'var(--ui-canvas)'}}>{loading}{error&&<div role="alert"><p>{error}</p><button onClick={retry}>Try again</button></div>}{leaving&&<button onClick={retry}>Continue editing if navigation was cancelled</button>}</div>}
  {admission&&<div ref={frame.frame} style={{visibility:visible?'visible':'hidden',...admission.theme} as CSSProperties} inert={!visible}>
   <StudioAuthoringContent key={admission.turn} projectId={projectId} estimateId={estimateId} actorId={admission.scope.actorId} role={admission.scope.role} loaded={loaded} retry={retry}/>
  </div>}
 </>;
}
