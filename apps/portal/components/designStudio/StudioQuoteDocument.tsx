"use client";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import type { QuoteVersionDetail } from "@/lib/quotes/types";
import type { SavedEstimateReview } from "@/lib/designStudio/savedReview";
import { previewQuotePdf } from "@/lib/quotes/quotesRepo";
import StudioClientPackage from './StudioClientPackage';
import StudioFlowShell from "./StudioFlowShell";
import StudioRevisionStart from "./StudioRevisionStart";
import { apiJson } from "@/lib/repo/apiClient";
import type { StudioAuthoringResponse } from "@/lib/designStudio/authoringRequest.server";
import css from "./StudioReview.module.css";
const Pdf = dynamic(
  () => import("@/components/projects/ProjectPage/tabs/QuotePdfInlinePreview"),
  {
    ssr: false,
    loading: ({error,retry}) => error?<p role="alert">The PDF viewer could not be opened. <button onClick={retry}>Retry viewer</button></p>:<p role="status">Opening the quote document…</p>,
  },
);

/** The exact server-associated frozen quote, never a price reconstructed from the live edit. */
export default function StudioQuoteDocument({
  review,
  quote,
  actorId,
  lifetime,
  initialPdf,
}: {
  review: SavedEstimateReview;
  quote: QuoteVersionDetail;
  actorId: string;
  lifetime?: AbortSignal;
  initialPdf?:import('@/lib/designStudio/clientQuotePdf').StudioInitialQuotePdf;
}) {
  const [pdf, setPdf] = useState<Uint8Array | null>(null),
    [error, setError] = useState<string | null>(null),
    [attempt, setAttempt] = useState(0),
    [revision, setRevision] = useState<StudioAuthoringResponse | null>(null),
    [sourceError, setSourceError] = useState(false),
    [sourceAttempt, setSourceAttempt] = useState(0);
  const downloadUrl=useRef<string|null>(null),downloadTimer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
  useEffect(()=>{const retire=()=>{clearTimeout(downloadTimer.current);if(downloadUrl.current)URL.revokeObjectURL(downloadUrl.current);downloadUrl.current=null;};lifetime?.addEventListener('abort',retire,{once:true});if(lifetime?.aborted)retire();return()=>{lifetime?.removeEventListener('abort',retire);retire();};},[quote.id,actorId,lifetime]);
  useEffect(() => {
    const abort = new AbortController(),retire=()=>abort.abort();
    lifetime?.addEventListener('abort',retire,{once:true});if(lifetime?.aborted)retire();
    setPdf(null);
    setError(null);
    const supplied=attempt===0&&initialPdf&&quote.studioDesign?.schemaVersion==='studio_quote_snapshot.v2'&&initialPdf?.renderHash===quote.renderHash&&typeof initialPdf.contentBase64==='string'&&initialPdf.contentBase64.length<=8*1024*1024&&/^[A-Za-z0-9+/]+=*$/.test(initialPdf.contentBase64)?initialPdf:null;
    if(!abort.signal.aborted)void (supplied?Promise.resolve(Uint8Array.from(atob(supplied.contentBase64),v=>v.charCodeAt(0))):quote.studioDesign?.schemaVersion==='studio_quote_snapshot.v2'?fetch(`/api/quotes/${encodeURIComponent(quote.id)}/pdf?disposition=inline`,{credentials:'same-origin',signal:abort.signal}).then(async response=>{if(!response.ok)throw Error('The quote PDF could not be opened.');return new Uint8Array(await response.arrayBuffer());}):previewQuotePdf(quote, { signal: abort.signal }))
      .then((bytes) => {
        if (!abort.signal.aborted) setPdf(bytes);
      })
      .catch((e) => {
        if (!abort.signal.aborted)
          setError(
            e instanceof Error
              ? e.message
              : "The document could not be opened.",
          );
      });
    return () => {abort.abort();lifetime?.removeEventListener('abort',retire);};
  }, [quote, attempt,actorId,lifetime,initialPdf]);
  useEffect(() => {
    const abort = new AbortController(),retire=()=>abort.abort();
    lifetime?.addEventListener('abort',retire,{once:true});if(lifetime?.aborted)retire();
    setSourceError(false);
    setRevision(null);
    if(!abort.signal.aborted)void apiJson<{ authoring: StudioAuthoringResponse }>(
      `/api/projects/${review.estimate.projectId}/estimates/${review.estimate.id}/studio`,
      { signal: abort.signal },
    )
      .then(({ authoring }) => {
        if (
          authoring.estimate.id !== review.estimate.id ||
          authoring.estimate.projectId !== review.estimate.projectId
        )
          throw Error("Wrong design");
        if (!authoring.view || !authoring.estimate.updatedAt)
          throw Error("Source unavailable");
        if (!abort.signal.aborted) setRevision(authoring);
      })
      .catch(() => {
        if (!abort.signal.aborted) {
          setSourceError(true);
        }
      });
    return () => {abort.abort();lifetime?.removeEventListener('abort',retire);};
  }, [review.estimate.id, review.estimate.projectId, sourceAttempt,actorId,lifetime]);
  function download() {
    if (!pdf || lifetime?.aborted) return;
    clearTimeout(downloadTimer.current);if(downloadUrl.current)URL.revokeObjectURL(downloadUrl.current);
    const url = URL.createObjectURL(
      new Blob([new Uint8Array(pdf)], { type: "application/pdf" }),
    );
    downloadUrl.current=url;
    const a = document.createElement("a");
    a.href = url;
    a.download = `${quote.quoteRef}-v${quote.versionNumber}.pdf`;
    a.click();
    downloadTimer.current=setTimeout(() => {URL.revokeObjectURL(url);if(downloadUrl.current===url)downloadUrl.current=null;}, 1000);
  }
  const amount = new Intl.NumberFormat("en-NZ", {
    style: "currency",
    currency: "NZD",
  }).format(quote.totals.totalIncGstCents / 100);
  return (
    <StudioFlowShell
      projectId={review.estimate.projectId}
      estimateId={review.estimate.id}
      identity={review.identity}
      versionLabel={review.estimate.versionLabel}
      stage="quote"
      quoteId={quote.id}
      total={
        <>
          {amount}
          <small>Frozen quote · including GST</small>
        </>
      }
      actions={
        <button className={css.primary} disabled={!pdf} onClick={download}>
          Download PDF
        </button>
      }
    >
      {quote.studioDesign?.schemaVersion==='studio_quote_snapshot.v2'?<StudioClientPackage quote={quote} actorId={actorId} pdf={pdf} pdfError={error} onRetryPdf={()=>setAttempt(n=>n+1)} lifetime={lifetime}>
        <details><summary>Design revision &amp; quote history</summary><p>{quote.quoteRef}, quote version {quote.versionNumber}. Design {review.estimate.versionLabel}.</p>
          {revision?.view&&revision.estimate.updatedAt?<StudioRevisionStart actorId={actorId} projectId={review.estimate.projectId} estimateId={review.estimate.id} revision={revision.view.revision} updatedAt={revision.estimate.updatedAt} openOnCreated/>:sourceError?<p role="alert">The source design could not be checked. <button onClick={()=>setSourceAttempt(n=>n+1)}>Retry source design</button></p>:<p role="status">Checking the source design…</p>}
          <p><Link prefetch={false} href={`/staff/projects/${review.estimate.projectId}?tab=quotes&quoteId=${encodeURIComponent(quote.id)}`}>Open quote controls</Link></p>
        </details>
      </StudioClientPackage>:<div className={css.quoteLayout}>
        <section className={css.document} aria-label="Quote document">
          {pdf ? (
            <Pdf data={pdf} />
          ) : (
            <p role="status">Preparing your quote document…</p>
          )}
          {error && (
            <div role="alert">
              <p>{error}</p>
              <button onClick={() => setAttempt((n) => n + 1)}>
                Retry document
              </button>
            </div>
          )}
        </section>
        <aside className={css.inspector}>
          <span className={css.badge}>
            {quote.status === "DRAFT" &&
            !quote.sentAt &&
            !quote.sendLogs.some((log) => log.status === "SENT")
              ? "Draft · not sent"
              : quote.status.toLowerCase()}
          </span>
          <h2>{quote.quoteRef}</h2>
          <p>
            Quote version {quote.versionNumber}
            <br />
            Design {review.estimate.versionLabel}
          </p>
          <p>
            This quote keeps its design, views and price. Design changes start a
            new revision.
          </p>
          {revision?.view && revision.estimate.updatedAt ? (
            <StudioRevisionStart
              actorId={actorId}
              projectId={review.estimate.projectId}
              estimateId={review.estimate.id}
              revision={revision.view.revision}
              updatedAt={revision.estimate.updatedAt}
              openOnCreated
            />
          ) : sourceError ? (
            <p role="alert">
              The source design could not be checked.{" "}
              <button onClick={() => setSourceAttempt((n) => n + 1)}>
                Retry source design
              </button>
            </p>
          ) : (
            <p role="status">Checking the source design for a new revision…</p>
          )}
          <details>
            <summary>Quote details &amp; history</summary>
            <p>
              Review wording, payment terms, version history and the separate
              send review.
            </p>
            <Link
              prefetch={false}
              href={`/staff/projects/${review.estimate.projectId}?tab=quotes&quoteId=${encodeURIComponent(quote.id)}`}
            >
              Open quote controls
            </Link>
          </details>
        </aside>
      </div>}
    </StudioFlowShell>
  );
}
