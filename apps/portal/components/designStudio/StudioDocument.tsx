'use client';
import {useCallback,useEffect,useLayoutEffect,useRef,useState,type ReactNode} from 'react';
import {usePathname,useSearchParams} from 'next/navigation';
import PortalAuthProvider from '@/components/auth/PortalAuthProvider';
import {Providers} from '@/app/providers';
import {ToastProvider} from '@/components/ui/toast/ToastProvider';
import {buildAccessStatusHref,buildLoginHref,toAccessStatusQueryState} from '@/lib/portalAccess';
import {readStudioOpening,StudioOpeningAccessError} from '@/lib/designStudio/studioOpeningTransport';
import {STUDIO_OPENING_FIRST_MS} from '@/lib/designStudio/studioOpening';
import {prepareStudioNavigation} from '@/lib/designStudio/studioSessionLifecycle';
import {studioDocumentCallback,studioReviewCallback} from '@/lib/designStudio/studioEditRoute';
import {readStudioReviewOpening,StudioReviewProtectedFallback,studioReviewProtectedHref} from '@/lib/designStudio/studioReviewOpeningTransport';
import {StudioDocumentContext,type StudioDocumentAdmission} from './StudioDocumentContext';
import StudioNavigationCapture from './StudioNavigationCapture';
import type {QuoteVersionDetail} from '@/lib/quotes/types';
import {observeStudioDocumentAuth} from '@/components/auth/studioDocumentAuth';


/** One native document and one fresh opening authority. Old UI can be hidden
 * while its SAME storage owner drains; visibility never retires accepted work. */
export default function StudioDocument({callback,children}:{callback:string;children:ReactNode}) {
 const expected=useRef(callback),[admissionCallback,setAdmissionCallback]=useState(callback);
 const parts=callback.split('?')[0].split('/'),projectId=parts[3],estimateId=parts[4];
 const pathname=usePathname(),search=useSearchParams();
 const [admission,setAdmission]=useState<StudioDocumentAdmission|null>(null),[visible,setVisible]=useState(false),[error,setError]=useState<string|null>(null);
 const [leaving,setLeaving]=useState(false),[issuedTurn,setIssuedTurn]=useState<number|null>(null);
 const current=useRef(admission);current.current=admission;
 const frame=useRef<HTMLDivElement>(null),request=useRef<AbortController|null>(null),serial=useRef(0),inflight=useRef(false);
 const fence=useRef<ReturnType<typeof prepareStudioNavigation>|null>(null);
 const restoreTheme=useRef<()=>void>(()=>{});
 const startup=useRef<Promise<void>>(Promise.resolve()),presented=useRef(true);
 const mask=useCallback(()=>{
  if(frame.current){frame.current.style.visibility='hidden';frame.current.setAttribute('inert','');}
  restoreTheme.current();
  setVisible(false);setIssuedTurn(null);request.current?.abort();inflight.current=false;serial.current++;
  if(fence.current?.status()==='failed'){fence.current.release();fence.current=null;}
  if(current.current&&!fence.current?.fenced())fence.current=prepareStudioNavigation(current.current.scope.actorId);
 },[]);
 useLayoutEffect(()=>{
  if(!visible||!admission)return;
  const style=document.documentElement.style,previous=Object.keys(admission.theme).map(key=>[key,style.getPropertyValue(key),style.getPropertyPriority(key)]);
  for(const [key,value] of Object.entries(admission.theme))style.setProperty(key,value);
  let restored=false;
  const restore=()=>{if(restored)return;restored=true;for(const [key,value,priority] of previous)if(value)style.setProperty(key,value,priority);else style.removeProperty(key);};
  restoreTheme.current=restore;
  return restore;
 },[visible,admission?.theme]);
 const exit=useRef<()=>void>(()=>{});
 exit.current=()=>{
  mask();setError(null);
  const turn=serial.current,target=location.href;
  void (async()=>{try{await fence.current?.ready;if(turn===serial.current&&location.href===target)location.replace(target);}catch(cause){if(turn===serial.current)setError(cause instanceof Error?cause.message:'Navigation could not finish.');}})();
 };
 const reopen=useRef<(force?:boolean)=>void>(()=>{});
 reopen.current=(force=false)=>{
  if(!presented.current)return;
  if(studioDocumentCallback(location.pathname+location.search,true)!==expected.current){exit.current();return;}
  if(inflight.current&&!force)return;
  mask();setError(null);setLeaving(false);
  const controller=new AbortController(),turn=serial.current;request.current=controller;inflight.current=true;
  const live=()=>presented.current&&!controller.signal.aborted&&turn===serial.current&&studioDocumentCallback(location.pathname+location.search,true)===expected.current;
  let rejectAbort!:(reason:unknown)=>void;
  const aborted=new Promise<never>((_resolve,reject)=>{rejectAbort=reject;});
  const deadline=setTimeout(()=>{
   const current=live();controller.abort();
   if(current){inflight.current=false;setError('The saved design could not be loaded.');}
  },STUDIO_OPENING_FIRST_MS);
  const abort=()=>{clearTimeout(deadline);rejectAbort(controller.signal.reason);};
  controller.signal.addEventListener('abort',abort,{once:true});
  void(async()=>{
   try {
    // initialize is a readiness barrier, never an identity/role authority. A
    // recovered-session SIGNED_IN may retire an unsent turn during bootstrap.
    await Promise.race([startup.current,aborted]);
    if(!live())return;
    const reviewCallback=studioReviewCallback(expected.current,true),quoteVersionId=reviewCallback?new URL(reviewCallback,location.origin).searchParams.get('quoteVersionId'):null;
    const source=reviewCallback
     ?readStudioReviewOpening(`/api/projects/${encodeURIComponent(projectId)}/estimates/${encodeURIComponent(estimateId)}/studio-review${quoteVersionId?`?quoteVersionId=${encodeURIComponent(quoteVersionId)}`:''}`,{projectId,estimateId,quoteVersionId},controller.signal)
     :readStudioOpening(`/api/projects/${encodeURIComponent(projectId)}/estimates/${encodeURIComponent(estimateId)}/studio`,{projectId,estimateId},controller.signal).then(value=>({...value,kind:'edit' as const}));
    // The reader has invoked the authoritative fetch. Only then release public
    // code preloads; they must not occupy all browser slots during SDK startup.
    if(live())setIssuedTurn(turn);
    const value=await source;
    clearTimeout(deadline);
    await fence.current?.ready;
    if(!live())return;
    // A theme failure is the same existing default-token fallback. No browser
    // session/cache participates in selecting this actor or role.
    setAdmissionCallback(expected.current);
    setAdmission(value.kind==='review'?{turn,kind:'review',scope:value.scope,theme:value.presentation.theme,response:value.response,openingPrice:value.openingPrice}:{turn,kind:'edit',scope:value.scope,theme:value.presentation?.theme??{},authoring:value.authoring,openingPrice:value.openingPrice});
    setVisible(true);inflight.current=false;
   }catch(cause){
    if(!live())return;
    inflight.current=false;
    if(cause instanceof StudioReviewProtectedFallback){
     // A transport budget is not a content/permission refusal. The existing
     // protected reader supports larger valid quotes without this admission.
     const target=studioReviewProtectedHref(expected.current);
     try{await fence.current?.ready;if(live())location.replace(target);}catch(error){if(live())setError(error instanceof Error?error.message:'Navigation could not finish.');}
     return;
    }
    if(cause instanceof StudioOpeningAccessError){
     const href=cause.kind==='unauthenticated'?buildLoginHref(expected.current):buildAccessStatusHref({state:toAccessStatusQueryState(cause.kind),callbackUrl:expected.current});
     // Local accepted writes retain their old owner until their flush finishes.
     try{await fence.current?.ready;if(live())location.replace(href);}catch{}
    }
    if(live())setError(cause instanceof Error?cause.message:'The saved design could not be loaded.');
    // The retained old controller is still hidden, not admitted. Keep its
    // action fence through an error/denial until fresh commit or teardown.
   }finally{clearTimeout(deadline);controller.signal.removeEventListener('abort',abort);}
  })();
 };
 useEffect(()=>{
  if(!visible||!admission||admission.turn!==serial.current)return;
  // Passive effects run after the committed old controller's cleanup. Merely
  // queueing setAdmission is not permission to resume an old staged command.
  fence.current?.release();fence.current=null;
 },[admission,visible]);
 useEffect(()=>{
  // Observe actual transitions before the request, not an INITIAL_SESSION or
  // cached getSession actor/role hint. A transition retires old work; its values
  // never become the admission and a later fresh response can still admit A.
  let observedActor:string|null|undefined;
  let initialized!:()=>void;
  startup.current=new Promise<void>(resolve=>{initialized=resolve;});
  const stopObserving=observeStudioDocumentAuth((event,session)=>{
   if(event==='INITIAL_SESSION')return;
   const actor=event==='SIGNED_OUT'?null:session?.user?.id??null;
   // Compare actual events with each other, not only with the deliberately
   // retained hidden provider. A -> null/B -> A must retire the middle read.
   const previous=observedActor===undefined?current.current?.scope.actorId??null:observedActor;
   observedActor=actor;
   if(event==='SIGNED_OUT'||event==='USER_UPDATED'||actor!==previous)reopen.current(true);
  },initialized);
  reopen.current();
  const hide=()=>{presented.current=false;mask();};
  const leave=()=>{presented.current=false;setLeaving(true);mask();};
  const show=(event:PageTransitionEvent)=>{presented.current=true;if(event.persisted)reopen.current();};
  const pop=()=>{
   if(studioDocumentCallback(location.pathname+location.search,true)===expected.current)reopen.current();
   else exit.current();
  };
  const stay=()=>{presented.current=true;reopen.current(true);};
  window.addEventListener('pagehide',hide);window.addEventListener('pageshow',show);window.addEventListener('popstate',pop);
  window.addEventListener('studio:document-leaving',leave);window.addEventListener('studio:document-staying',stay);
  return()=>{stopObserving();request.current?.abort();serial.current++;inflight.current=false;fence.current?.release();window.removeEventListener('pagehide',hide);window.removeEventListener('pageshow',show);window.removeEventListener('popstate',pop);window.removeEventListener('studio:document-leaving',leave);window.removeEventListener('studio:document-staying',stay);};
 },[callback,mask]);
 useLayoutEffect(()=>{
  if(studioDocumentCallback(pathname+(search.size?`?${search}`:''),true)===expected.current)return;
  // RootLayout can be retained by Next soft navigation. Never mount those
  // ordinary private children in this inert root; load their normal document.
  // Fence during commit, before detached-child cleanup promises can resume HTTP.
  exit.current();
 },[callback,pathname,search,mask]);
 const adoptCommittedQuote=useCallback(({actorId,requestId,quote}:{actorId:string;requestId:string;quote:QuoteVersionDetail})=>{
  const admitted=current.current,active=request.current;
  const base=`/staff/design-studio/${projectId}/${estimateId}`;
  if(!presented.current||!active||active.signal.aborted||inflight.current||!admitted||admitted.kind!=='review'||admitted.turn!==serial.current
   ||admitted.scope.actorId!==actorId||admitted.scope.projectId!==projectId||admitted.scope.estimateId!==estimateId
   ||expected.current!==base||studioDocumentCallback(location.pathname+location.search,true)!==base
   ||quote.projectId!==projectId||quote.sourceEstimateVersionId!==estimateId||quote.studioDesign?.schemaVersion!=='studio_quote_snapshot.v2'
   ||quote.studioDesign.snapshotId!==requestId||!/^[0-9a-f]{64}$/i.test(quote.studioDesign.contentHash)
   ||!/^qv_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(quote.id))throw Error('The confirmed quote no longer belongs to this open design.');
  const target=base+'?quoteVersionId='+encodeURIComponent(quote.id);
  // This is the same completed command, not a new opening/admission. Update
  // the frame's exact URL fence before Next's native-history synchronization.
  const state={...(history.state??{})};delete state.__NA;delete state._N;
  expected.current=target;
  try{history.replaceState(state,'',target);}catch(error){expected.current=base;throw error;}
 },[projectId,estimateId]);
 const invalidate=useCallback(()=>reopen.current(true),[]);
 // A LayoutRouter element is not an immutable page snapshot. Withhold an
 // unknown soft route at render, retaining only the admitted actor providers
 // while the detached editor's accepted writes finish under that same owner.
 const exact=studioDocumentCallback(pathname+(search.size?`?${search}`:''),true)===expected.current;
 const page=exact?children:<main><h1>Design Studio</h1><p role="status">Opening saved design…</p>{error&&<div role="alert"><p>{error}</p><button onClick={()=>exit.current()}>Try again</button></div>}</main>;
 const requestIssued=issuedTurn===serial.current&&presented.current&&request.current&&!request.current.signal.aborted?{turn:issuedTurn,signal:request.current.signal}:null;
 return <StudioDocumentContext.Provider value={{callback,admissionCallback,adoptCommittedQuote,admission,visible,error,leaving,requestIssued,frame,retry:()=>{presented.current=true;reopen.current(true);}}}>
  {admission?<PortalAuthProvider key={admission.scope.actorId} requestAdmission={{state:{status:'authenticated',user:{id:admission.scope.actorId,email:null},role:admission.scope.role},invalidate}}>
   <Providers mode="storage-only"><ToastProvider><StudioNavigationCapture enabled/>{page}</ToastProvider></Providers>
  </PortalAuthProvider>:page}
 </StudioDocumentContext.Provider>;
}
