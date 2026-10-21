'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePortalSession } from '@/components/auth/PortalAuthProvider';
import { apiJson } from '@/lib/repo/apiClient';
import type { SavedEstimateReview } from '@/lib/designStudio/savedReview';
import { loadSavedStudioReview, loadStudioWebsiteReview } from './studioLeafLoading';
import css from './SavedStudioReview.module.css';

export default function SavedStudioReviewLoader({ projectId, estimateId, quoteVersionId }: {
  projectId: string; estimateId: string; quoteVersionId?: string;
}) {
  const auth = usePortalSession();
  const actorId = ['staff', 'admin'].includes(auth.role ?? '') ? auth.user?.id : undefined;
  const identity = JSON.stringify([actorId, auth.role, projectId, estimateId, quoteVersionId]);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{
    identity: string; review: SavedEstimateReview | null; leafFailed?: boolean;
    WebsiteReview?: Awaited<ReturnType<typeof loadStudioWebsiteReview>>;
    SavedReview?: Awaited<ReturnType<typeof loadSavedStudioReview>>;
  } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    setState(null);
    if (!actorId) return () => controller.abort();
    const savedReview = loadSavedStudioReview();
    const websiteReview = quoteVersionId ? null : loadStudioWebsiteReview();
    void apiJson<{ review: SavedEstimateReview }>(`/api/projects/${encodeURIComponent(projectId)}/estimates/${encodeURIComponent(estimateId)}/studio-review${quoteVersionId ? `?quoteVersionId=${encodeURIComponent(quoteVersionId)}` : ''}`, { signal: controller.signal })
      .then(async ({ review }) => {
        if (review.estimate.id !== estimateId || review.estimate.projectId !== projectId) throw Error('Wrong saved design');
        const needsWebsite = !quoteVersionId && (review.websiteDesign || review.websiteComposition);
        const WebsiteReview = needsWebsite ? await websiteReview : null;
        const SavedReview = needsWebsite ? null : await savedReview;
        if (!controller.signal.aborted) setState({ identity, review, WebsiteReview, SavedReview, leafFailed: !WebsiteReview && !SavedReview });
      }).catch(() => { if (!controller.signal.aborted) setState({ identity, review: null }); });
    return () => controller.abort();
  }, [identity, actorId, projectId, estimateId, quoteVersionId, attempt]);
  const current = state?.identity === identity ? state : null;
  const review = current?.review;
  const WebsiteReview = current?.WebsiteReview, SavedReview = current?.SavedReview;
  if (WebsiteReview && review && actorId && !quoteVersionId && (review.websiteDesign || review.websiteComposition)) return <WebsiteReview review={review} actorId={actorId} />;
  if (SavedReview && review) return <SavedReview review={review} projectId={projectId} editHref={`/staff/design-studio/${projectId}/${estimateId}/edit`} revisionHref={`/staff/design-studio/${projectId}/${estimateId}/edit?intent=revision`} />;
  return <main className={css.review}><Link href={`/staff/projects/${projectId}?tab=estimates`}>Back to project</Link><h1>Review your design</h1>
    {!current ? <p role="status">Opening saved design…</p> : <div role="alert"><p>{current.leafFailed ? 'The design review could not be opened.' : 'Your saved design could not be loaded.'}</p><button onClick={() => setAttempt(value => value + 1)}>Try again</button></div>}</main>;
}
