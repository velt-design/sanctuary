"use client";

import { useEffect, useRef, useState } from "react";
import type { DesignBookletPdfArtifactState } from "./useDesignBookletPdfArtifact";
import styles from "./designBookletPdfPreview.module.css";

type PdfJsModule = typeof import("pdfjs-dist/legacy/build/pdf.mjs");
type PdfLoadingTask = ReturnType<PdfJsModule["getDocument"]>;
type PdfRenderTask = import("pdfjs-dist/legacy/build/pdf.mjs").RenderTask;

const PDF_WORKER_SRC = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

function isCancellationError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === "AbortException" ||
      error.name === "RenderingCancelledException" ||
      error.message.toLowerCase().includes("cancel"))
  );
}

export default function DesignBookletDrawingPdfPreview({
  bytes,
  pageNumber,
  pageCount,
  state,
  error,
  onRetry,
}: {
  bytes: Uint8Array | null;
  pageNumber: number;
  pageCount: number;
  state: DesignBookletPdfArtifactState;
  error: string;
  onRetry: () => void;
}) {
  const containerRef = useRef<HTMLElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [width, setWidth] = useState(0);
  const [renderState, setRenderState] = useState<
    "idle" | "rendering" | "ready" | "error"
  >("idle");
  const [renderError, setRenderError] = useState("");

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const update = () =>
      setWidth(Math.max(0, Math.floor(container.clientWidth)));
    update();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(update);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!bytes || state !== "ready" || width <= 0) {
      setRenderState("idle");
      return;
    }

    let cancelled = false;
    let loadingTask: PdfLoadingTask | null = null;
    let renderTask: PdfRenderTask | null = null;
    setRenderState("rendering");
    setRenderError("");

    const run = async () => {
      try {
        const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
        if (pdfjs.GlobalWorkerOptions.workerSrc !== PDF_WORKER_SRC) {
          pdfjs.GlobalWorkerOptions.workerSrc = PDF_WORKER_SRC;
        }
        loadingTask = pdfjs.getDocument({ data: new Uint8Array(bytes) });
        const pdf = await loadingTask.promise;
        if (cancelled) {
          await pdf.destroy();
          return;
        }
        const pdfPage = await pdf.getPage(pageNumber);
        const canvas = canvasRef.current;
        const context = canvas?.getContext("2d", { alpha: false });
        if (!canvas || !context) throw new Error("Preview canvas unavailable.");
        const baseViewport = pdfPage.getViewport({ scale: 1 });
        const viewport = pdfPage.getViewport({
          scale: width / baseViewport.width,
        });
        const outputScale = window.devicePixelRatio || 1;
        canvas.width = Math.ceil(viewport.width * outputScale);
        canvas.height = Math.ceil(viewport.height * outputScale);
        canvas.style.width = `${Math.ceil(viewport.width)}px`;
        canvas.style.height = `${Math.ceil(viewport.height)}px`;
        renderTask = pdfPage.render({
          canvas,
          canvasContext: context,
          viewport,
          transform:
            outputScale === 1
              ? undefined
              : [outputScale, 0, 0, outputScale, 0, 0],
        });
        await renderTask.promise;
        await pdf.destroy();
        if (!cancelled) setRenderState("ready");
      } catch (caught) {
        if (cancelled || isCancellationError(caught)) return;
        setRenderState("error");
        setRenderError(
          caught instanceof Error
            ? caught.message
            : "The drawing preview could not be rendered.",
        );
      }
    };
    void run();

    return () => {
      cancelled = true;
      try {
        renderTask?.cancel();
      } catch {
        // PDF.js can report an already-completed render as non-cancellable.
      }
      void loadingTask?.destroy().catch(() => undefined);
    };
  }, [bytes, pageNumber, state, width]);

  const visibleError = state === "error" ? error : renderError;
  const isBusy =
    state === "idle" ||
    state === "preparing" ||
    (state === "ready" && renderState !== "ready" && !visibleError);

  return (
    <article
      ref={containerRef}
      className={styles.page}
      data-booklet-page={pageNumber}
      data-page-kind="drawings"
      data-pdf-preview-state={
        visibleError ? "error" : isBusy ? "loading" : "ready"
      }
      aria-label={`PDF drawing page ${pageNumber} of ${pageCount}`}
    >
      <canvas ref={canvasRef} className={styles.canvas} />
      {isBusy ? (
        <div className={styles.state} role="status">
          <span className={styles.spinner} aria-hidden="true" />
          <strong>Updating exact PDF preview</strong>
          <span>
            The drawing sheet and download are being prepared together.
          </span>
        </div>
      ) : null}
      {visibleError ? (
        <div className={styles.state} role="alert">
          <strong>Drawing preview needs attention</strong>
          <span>{visibleError}</span>
          <button type="button" onClick={onRetry}>
            Retry preview
          </button>
        </div>
      ) : null}
    </article>
  );
}
