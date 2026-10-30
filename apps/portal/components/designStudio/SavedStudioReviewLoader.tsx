'use client';

import { useContext, useEffect, useState } from 'react';
import { StudioDocumentContext } from './StudioDocumentContext';
import { studioReviewCallback } from '@/lib/designStudio/studioEditRoute';
import Link from 'next/link';
import { usePortalSession } from '@/components/auth/PortalAuthProvider';
import { apiJson } from '@/lib/repo/apiClient';
import type { SavedEstimateReview } from '@/lib/designStudio/savedReview';
import { loadSavedStudioReview, loadStudioWebsiteReview } from './studioLeafLoading';
import css from './SavedStudioReview.module.css';
import dynamic from 'next/dynamic';
import type {QuoteVersionDetail} from '@/lib/quotes/types';
const QuoteDocument=dynamic(()=>import('./StudioQuoteDocument'),{ssr:false,loading:({error,retry})=>error?<div role="alert"><p>The quote document could not be opened.</p><button onClick={retry}>Retry quote document</button></div>:<p role="status">Opening the quote document…</p>});

export default function SavedStudioReviewLoader({ projectId, estimateId, quoteVersionId }: {
  projectId: string; estimateId: string; quoteVersionId?: string;
}) {
  const frame=useContext(StudioDocumentContext),callback=`/staff/design-studio/${projectId}/${estimateId}${quoteVersionId?`?quoteVersionId=${encodeURIComponent(quoteVersionId)}`:''}`;
  const admitted=frame?.visible&&(frame.admissionCallback??frame.callback)===studioReviewCallback(callback,true)&&frame.admission?.kind==='review'?frame.admission.response:null;
  const lifetime=admitted?frame?.requestIssued?.signal:undefined;
  const auth = usePortalSession();
  const actorId = ['staff', 'admin'].includes(auth.role ?? '') ? auth.user?.id : undefined;
  const identity = JSON.stringify([actorId, auth.role, projectId, estimateId, quoteVersionId]);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{
    identity: string; review: SavedEstimateReview | null; leafFailed?: boolean; quoteDocument?:QuoteVersionDetail; relatedQuotes?:{id:string;status:string;label:string}[];
    WebsiteReview?: Awaited<ReturnType<typeof loadStudioWebsiteReview>>;
    SavedReview?: Awaited<ReturnType<typeof loadSavedStudioReview>>;
  } | null>(null);
  useEffect(() => {
    const controller = new AbortController(),retire=()=>controller.abort();
    lifetime?.addEventListener('abort',retire,{once:true});if(lifetime?.aborted)retire();
    setState(null);
    if (!actorId) return () => {controller.abort();lifetime?.removeEventListener('abort',retire);};
    const savedReview = loadSavedStudioReview();
    const websiteReview = quoteVersionId ? null : loadStudioWebsiteReview();
    const response=admitted?Promise.resolve(admitted):apiJson<{ review: SavedEstimateReview; quoteDocument?:QuoteVersionDetail; relatedQuotes?:{id:string;status:string;label:string}[] }>(`/api/projects/${encodeURIComponent(projectId)}/estimates/${encodeURIComponent(estimateId)}/studio-review${quoteVersionId ? `?quoteVersionId=${encodeURIComponent(quoteVersionId)}` : ''}`, { signal: controller.signal });
    void response.then(async ({ review,quoteDocument,relatedQuotes }) => {
        if (review.estimate.id !== estimateId || review.estimate.projectId !== projectId) throw Error('Wrong saved design');
        if(quoteDocument&&(quoteDocument.id!==quoteVersionId||quoteDocument.projectId!==projectId||quoteDocument.sourceEstimateVersionId!==estimateId||review.quote?.id!==quoteDocument.id))throw Error('Wrong frozen quote');
        const needsWebsite = !quoteVersionId && (review.websiteDesign || review.websiteComposition);
        const WebsiteReview = needsWebsite ? await websiteReview : null;
        const SavedReview = needsWebsite || quoteDocument ? null : await savedReview;
        if (!controller.signal.aborted) setState({ identity, review, quoteDocument,relatedQuotes, WebsiteReview, SavedReview, leafFailed: !quoteDocument && !WebsiteReview && !SavedReview });
      }).catch(() => { if (!controller.signal.aborted) setState({ identity, review: null }); });
    return () => {controller.abort();lifetime?.removeEventListener('abort',retire);};
  }, [identity, actorId, projectId, estimateId, quoteVersionId, attempt, admitted, lifetime]);
  const current = state?.identity === identity ? state : null;
  const review = current?.review;
  const WebsiteReview = current?.WebsiteReview, SavedReview = current?.SavedReview;
  if(current?.quoteDocument&&review&&actorId&&quoteVersionId) return <QuoteDocument key={`${identity}:${attempt}`} review={review} quote={current.quoteDocument} actorId={actorId} lifetime={lifetime}/>;
  if (WebsiteReview && review && actorId && !quoteVersionId && (review.websiteDesign || review.websiteComposition)) return <WebsiteReview review={review} actorId={actorId} openingPrice={attempt===0&&admitted&&frame?.admission?.kind==='review'&&frame.admission.scope.actorId===actorId?frame.admission.openingPrice:undefined} relatedQuotes={current?.relatedQuotes} />;
  if (SavedReview && review) return <SavedReview review={review} projectId={projectId} editHref={`/staff/design-studio/${projectId}/${estimateId}/edit`} revisionHref={`/staff/design-studio/${projectId}/${estimateId}/edit?intent=revision`} />;
  return <main className={css.review}><Link href={`/staff/projects/${projectId}?tab=estimates`}>Back to project</Link><h1>Review your design</h1>
    {!current ? <p role="status">Opening saved design…</p> : <div role="alert"><p>{current.leafFailed ? 'The design review could not be opened.' : 'Your saved design could not be loaded.'}</p><button onClick={() => setAttempt(value => value + 1)}>Try again</button></div>}</main>;
}
