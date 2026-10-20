"use client";
import {useCallback,useEffect,useMemo,useState} from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {useQueryClient} from '@tanstack/react-query';
import {invalidateProjectReadCaches} from '@/lib/queries/projectCache';
import {supabaseHostFromUrl,supabaseRuntimeUrl} from '@/lib/supabase/browserClient';
import {apiJson} from '@/lib/repo/apiClient';
import type {SavedEstimateReview} from '@/lib/designStudio/savedReview';
import type {StudioAuthoringResponse} from '@/lib/designStudio/authoringRequest.server';
import {createStudioAuthoringEdit,type StudioAuthoringView} from '@/lib/designStudio/authoringView';
import {studioCanonicalJson} from '@/lib/designStudio/quoteSnapshot';
import {useStudioEditingSession} from './useStudioEditingSession';
import {useStudioWebsitePrice} from './useStudioWebsitePrice';
import StudioWebsiteRecovery from './StudioWebsiteRecovery';
import StudioCommercialFields from './StudioCommercialFields';
import StudioAdminReview from './StudioAdminReview';
import {usePortalSession} from '@/components/auth/PortalAuthProvider';
import type {CapturedStudioViews} from './StudioQuoteViews';
import css from './StudioReview.module.css';
const StudioDesignSpecification=dynamic(()=>import('./StudioDesignSpecification'),{ssr:false,loading:()=> <p>Preparing the selected specification…</p>});
const Views=dynamic(()=>import('./StudioQuoteViews'),{ssr:false,loading:()=> <p>Preparing the complete design…</p>});
const money=(n:number)=>new Intl.NumberFormat('en-NZ',{style:'currency',currency:'NZD'}).format(n);
export default function StudioWebsiteReview({review,actorId}:{review:SavedEstimateReview;actorId:string}){
 const [loaded,setLoaded]=useState<StudioAuthoringResponse|null>(null),[failure,setFailure]=useState(false),[attempt,setAttempt]=useState(0),[replacePreparation,setReplacePreparation]=useState(false);
 useEffect(()=>{const abort=new AbortController();setFailure(false);setLoaded(null);apiJson<{authoring:StudioAuthoringResponse}>(`/api/projects/${review.estimate.projectId}/estimates/${review.estimate.id}/studio`,{signal:abort.signal}).then(r=>{if(!abort.signal.aborted)setLoaded(r.authoring);}).catch(()=>{if(!abort.signal.aborted)setFailure(true);});return()=>abort.abort();},[actorId,review.estimate.id,review.estimate.projectId,attempt]);
 if(!loaded?.view)return <main className={css.page}><h1>Review your design</h1>{failure?<><p role="alert">The saved design could not be loaded. Your local work is kept.</p><button onClick={()=>setAttempt(n=>n+1)}>Retry</button></>:<p>Opening your working design…</p>}</main>;
 if(loaded.estimate.requiresNewRevision||loaded.nextAction!=='edit')return <main className={css.page}><Link href={`/staff/projects/${review.estimate.projectId}?tab=quotes`}>Back to Project quotes</Link><h1>Saved design</h1><p>This design is already used by a quote. Open the quote to see its frozen views and price.</p><Link href={`/staff/design-studio/${review.estimate.projectId}/${review.estimate.id}/edit?intent=revision`}>Create a new design revision</Link></main>;
 return <WorkingReview key={attempt} review={review} actorId={actorId} authoring={replacePreparation?{...loaded,preparedQuote:undefined}:loaded} view={loaded.view} onPrepareAgain={()=>{setReplacePreparation(true);setAttempt(n=>n+1);}}/>;
}
function WorkingReview({review,actorId,authoring,view,onPrepareAgain}:{review:SavedEstimateReview;actorId:string;authoring:StudioAuthoringResponse;view:StudioAuthoringView;onPrepareAgain:()=>void}){
 const auth=usePortalSession();
 const queryClient=useQueryClient();
 const router=useRouter(),scope=useMemo(()=>({actorId,projectId:review.estimate.projectId,estimateId:review.estimate.id,designId:view.designId}),[actorId,review.estimate.projectId,review.estimate.id,view.designId]);
 const controller=useStudioEditingSession({scope,view,updatedAt:authoring.estimate.updatedAt,editable:true});
 const edit=controller.edit??createStudioAuthoringEdit(view);
 const price=useStudioWebsitePrice({...scope,revision:edit.revision,design:null,composition:controller.edit});
 const priceIssue=price.error??(price.price?.status==='unavailable'?price.price.reason??'The current design cannot be priced.':null);
 const source=useMemo(()=>({schemaVersion:'studio_authoring_view.v1',designId:edit.designId,revision:edit.revision,spatial:edit.spatial,site:edit.site,objectOptions:edit.objectOptions,pricing:'unpriced'}),[edit]);
 const identity=studioCanonicalJson(source),[capture,setCapture]=useState<{identity:string;images:CapturedStudioViews;requestId:string}|null>(null),[busy,setBusy]=useState(false),[prepared,setPrepared]=useState<{binding:NonNullable<StudioAuthoringResponse['preparedQuote']>;identity:string}|null>(()=>authoring.preparedQuote?{binding:authoring.preparedQuote,identity:studioCanonicalJson(view)}:null),[error,setError]=useState<string|null>(null);
 const preparedRequest=prepared?.identity===identity;
 const captureViews=useCallback((images:CapturedStudioViews)=>setCapture({identity,images,requestId:crypto.randomUUID()}),[identity]);
 const images=capture?.identity===identity?capture:null;
 const ready=controller.status==='ready'&&controller.localDurable&&!controller.session?.dirty&&!controller.session?.pending&&price.price?.status==='priced'&&(preparedRequest||images);
 async function prepare(){if(!ready||!preparedRequest&&!images)return;setBusy(true);setError(null);try{
   const binding=preparedRequest?prepared!.binding:await apiJson<{snapshotId:string;contentHash:string;totalIncGstCents:number}>(`/api/projects/${scope.projectId}/estimates/${scope.estimateId}/studio-quote`,{method:'POST',body:JSON.stringify({requestId:images!.requestId,source,images:images!.images})});
   setPrepared({binding,identity});
   const result=await apiJson<{quoteVersion:{id:string}}>(`/api/projects/${scope.projectId}/quotes`,{method:'POST',body:JSON.stringify({estimateVersionId:scope.estimateId,clientIntentId:`studio:${binding.snapshotId}`,studioSnapshot:{snapshotId:binding.snapshotId,contentHash:binding.contentHash}})});
   await invalidateProjectReadCaches(queryClient,supabaseHostFromUrl(supabaseRuntimeUrl())||'unknown',scope.projectId,{includeEstimates:true,includeQuotes:true});
   router.push(`/staff/projects/${scope.projectId}?tab=quotes&quoteId=${encodeURIComponent(result.quoteVersion.id)}`);
 }catch(e){setError(e instanceof Error?e.message:'The quote could not be created. Retry the same prepared request.');}finally{setBusy(false);}}
 return <main className={css.page}><Link href={`/staff/projects/${scope.projectId}?tab=estimates`}>Back to Project</Link><header className={css.header}><div><h1>Review your design</h1><p>{review.estimate.versionLabel} · {controller.session?.dirty?'Changes kept on this device':'Saved design'}</p><StudioWebsiteRecovery controller={controller}/></div><div className={css.price}>{price.price?.status==='priced'?money(price.price.amount!):priceIssue?'Price unavailable':'Calculating…'}<small>Whole-job subtotal including GST{price.price?.versionNumber?` · Pricebook ${price.price.versionNumber}`:''}</small>{priceIssue&&<small role="alert">{priceIssue} <button onClick={price.retry}>Retry price</button></small>}</div></header>
 <div className={css.actions}><Link href={`/staff/design-studio/${scope.projectId}/${scope.estimateId}/edit`}>Return to editing</Link><button disabled={!controller.canSave||busy||preparedRequest} onClick={()=>void controller.save()}>Save design and site details</button></div>
 <div className={css.designOverview}><Views edit={edit} onCapture={captureViews} disabled={busy||preparedRequest||controller.status!=='ready'||price.price?.status!=='priced'}/><StudioDesignSpecification edit={edit}/></div>
 <details><summary>Need a specialist design?</summary><p>Custom pitch, overhangs, inverted roofs, insulated roof-above panels, wider trays and drainage variants use the specialist calculator. Your Studio design stays saved here; the specialist estimate is a separate design.</p><Link href={`/staff/projects/${scope.projectId}?tab=estimates&newDesign=1`}>Open specialist calculator</Link></details>
 <StudioCommercialFields assumptions={price.price?.status==='priced'?price.price.siteAssumptions:undefined} edit={edit} disabled={!controller.canEdit||busy||preparedRequest} onChange={controller.change}/>
 {auth.role==='admin'&&<StudioAdminReview estimateId={scope.estimateId} costs={price.price?.internalCosts}/>}
 {price.price?.breakdown&&<table className={css.breakdown}><caption>Quote price breakdown</caption><tbody>{price.price.breakdown.map((line,i)=><tr key={i}><td>{line.label}{line.provisional?' (allowance)':''}<br/><small>{line.detail}</small></td><td>{money(line.amount)}</td></tr>)}</tbody></table>}

 {images&&<div className={css.images}>{images.images.map(image=><figure key={image.kind}><img src={image.dataUrl} alt={`Captured design ${image.kind}`}/><figcaption>{image.kind==='plan'?'Plan':'3D perspective'}</figcaption></figure>)}</div>}
 <section><h2>Create the quote</h2><p>Save the complete design and site details, then capture both views. The quote keeps this exact design and these images.</p>{controller.session?.dirty&&<p>Save your current changes before creating the quote.</p>}<button disabled={!ready||busy} onClick={()=>void prepare()}>{busy?'Preparing quote…':preparedRequest?'Resume prepared quote':'Create quote from this design'}</button>{preparedRequest&&<><p>The saved design and previously captured views are prepared. Resume the same request to finish quote creation. If the pricebook changed, prepare updated views with the current price. The previous snapshot stays preserved.</p><button disabled={busy} onClick={onPrepareAgain}>Prepare updated quote views</button></>}{error&&<p className={css.message} role="alert">{error}</p>}</section></main>;
}
