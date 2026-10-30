'use client';
import { useContext, useEffect, useLayoutEffect } from 'react';
import { StudioDocumentContext } from './StudioDocumentContext';
import { StudioDocumentInstallation } from './StudioDocumentSlot';
import StudioDocument from './StudioDocument';
import StudioNativeEntry from './StudioNativeEntry';
import SavedStudioReviewLoader from './SavedStudioReviewLoader';
import { loadSavedStudioReview, loadStudioWebsiteReview } from './studioLeafLoading';
import css from './SavedStudioReview.module.css';

/** Public routing props only. The retained existing frame owns fresh admission. */
export default function StudioReviewDocumentPage({ callback, projectId, estimateId, quoteVersionId }: {
  callback: string; projectId: string; estimateId: string; quoteVersionId?: string;
}) {
  const frame = useContext(StudioDocumentContext), installation = useContext(StudioDocumentInstallation);
  useLayoutEffect(() => { if (installation?.callback === callback) installation.install(StudioDocument); }, [callback, installation?.callback, installation?.install]);
  useEffect(() => {
    const issued = frame?.requestIssued; if (!issued || issued.signal.aborted) return;
    // Existing optional leaf owners, after the frame has invoked its fresh GET.
    void loadSavedStudioReview(); if (!quoteVersionId) void loadStudioWebsiteReview();
  }, [frame?.requestIssued?.turn, frame?.requestIssued?.signal, quoteVersionId]);
  if (!frame || frame.callback !== callback) return installation?.callback === callback
    ? <main className={css.review}><h1>Review your design</h1><p role="status">Opening saved design…</p></main>
    : <StudioNativeEntry callback={callback} />;
  const admission = frame.admission?.kind === 'review' ? frame.admission : null;
  return <>
    {!frame.visible && <main className={css.review}><h1>Review your design</h1><p role="status">Opening saved design…</p>
      {frame.error && <div role="alert"><p>{frame.error}</p><button onClick={frame.retry}>Try again</button></div>}
      {frame.leaving && <button onClick={frame.retry}>Continue if navigation was cancelled</button>}
    </main>}
    {frame.visible && admission && <div ref={frame.frame} style={admission.theme}>
      <SavedStudioReviewLoader key={admission.turn} projectId={projectId} estimateId={estimateId} quoteVersionId={admission.response.quoteDocument?.id??quoteVersionId} />
    </div>}
  </>;
}
