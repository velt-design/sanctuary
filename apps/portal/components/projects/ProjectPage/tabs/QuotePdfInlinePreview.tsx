'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './QuotesTab.module.css';

type PdfJsModule = typeof import('pdfjs-dist');
type PdfDocumentProxy = import('pdfjs-dist').PDFDocumentProxy;
type PdfLoadingTask = ReturnType<PdfJsModule['getDocument']>;
type PdfRenderTask = import('pdfjs-dist').RenderTask;

const PDF_WORKER_SRC = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();

function isCancellationError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return error.name === 'AbortException' || error.name === 'RenderingCancelledException' || message.includes('cancel');
}

export default function QuotePdfInlinePreview({ src }: { src: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pdfRef = useRef<PdfDocumentProxy | null>(null);
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  const [pageCount, setPageCount] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);
  const [rendering, setRendering] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateWidth = () => {
      const computed = window.getComputedStyle(container);
      const paddingX = Number.parseFloat(computed.paddingLeft) + Number.parseFloat(computed.paddingRight);
      const nextWidth = Math.max(0, Math.floor(container.clientWidth - paddingX));
      setContainerWidth((prev) => (prev === nextWidth ? prev : nextWidth));
    };

    updateWidth();

    const observer = new ResizeObserver(() => updateWidth());
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    let loadingTask: PdfLoadingTask | null = null;

    setPageCount(0);
    setRenderError(null);
    setRendering(Boolean(src));
    canvasRefs.current = [];

    const previousPdf = pdfRef.current;
    pdfRef.current = null;
    if (previousPdf) {
      void previousPdf.destroy();
    }

    const run = async () => {
      if (!src) {
        setRendering(false);
        return;
      }

      try {
        const pdfjs = await import('pdfjs-dist');
        if (pdfjs.GlobalWorkerOptions.workerSrc !== PDF_WORKER_SRC) {
          pdfjs.GlobalWorkerOptions.workerSrc = PDF_WORKER_SRC;
        }

        loadingTask = pdfjs.getDocument(src);
        const pdf = await loadingTask.promise;
        if (cancelled) {
          void pdf.destroy();
          return;
        }

        pdfRef.current = pdf;
        canvasRefs.current = new Array(pdf.numPages).fill(null);
        setPageCount(pdf.numPages);
      } catch (error) {
        if (cancelled || isCancellationError(error)) return;
        setRenderError('Failed to render quote preview.');
        setRendering(false);
      }
    };

    void run();

    return () => {
      cancelled = true;
      if (loadingTask) {
        void loadingTask.destroy();
      }
      const activePdf = pdfRef.current;
      pdfRef.current = null;
      if (activePdf) {
        void activePdf.destroy();
      }
    };
  }, [src]);

  useEffect(() => {
    const pdf = pdfRef.current;
    if (!pdf || !pageCount || containerWidth <= 0) return;

    let cancelled = false;
    const renderTasks: PdfRenderTask[] = [];
    setRenderError(null);
    setRendering(true);

    const run = async () => {
      try {
        const outputScale = window.devicePixelRatio || 1;

        for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
          const page = await pdf.getPage(pageIndex + 1);
          if (cancelled) return;

          const canvas = canvasRefs.current[pageIndex];
          if (!canvas) continue;

          const context = canvas.getContext('2d', { alpha: false });
          if (!context) throw new Error('Canvas unavailable');

          const baseViewport = page.getViewport({ scale: 1 });
          const scale = containerWidth / baseViewport.width;
          const viewport = page.getViewport({ scale });

          canvas.width = Math.ceil(viewport.width * outputScale);
          canvas.height = Math.ceil(viewport.height * outputScale);
          canvas.style.width = `${Math.ceil(viewport.width)}px`;
          canvas.style.height = `${Math.ceil(viewport.height)}px`;

          const renderTask = page.render({
            canvas,
            canvasContext: context,
            viewport,
            transform: outputScale === 1 ? undefined : [outputScale, 0, 0, outputScale, 0, 0],
          });

          renderTasks.push(renderTask);
          await renderTask.promise;
        }

        if (!cancelled) {
          setRendering(false);
        }
      } catch (error) {
        if (cancelled || isCancellationError(error)) return;
        setRenderError('Failed to render quote preview.');
        setRendering(false);
      }
    };

    void run();

    return () => {
      cancelled = true;
      for (const task of renderTasks) {
        try {
          task.cancel();
        } catch {
          // Ignore cancellation failures during teardown.
        }
      }
    };
  }, [containerWidth, pageCount, src]);

  return (
    <div ref={containerRef} className={styles.quotePreviewDocument}>
      {renderError ? <p className={styles.quotePreviewRenderState}>{renderError}</p> : null}
      {!renderError && rendering ? <p className={styles.quotePreviewRenderState}>Rendering preview...</p> : null}
      {Array.from({ length: pageCount }, (_, pageIndex) => (
        <div key={pageIndex} className={styles.quotePreviewPage}>
          <canvas
            ref={(node) => {
              canvasRefs.current[pageIndex] = node;
            }}
            className={styles.quotePreviewCanvas}
          />
        </div>
      ))}
    </div>
  );
}
