'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './QuotesTab.module.css';

type PdfJsModule = typeof import('pdfjs-dist/legacy/build/pdf.mjs');
type PdfDocumentProxy = import('pdfjs-dist/legacy/build/pdf.mjs').PDFDocumentProxy;
type PdfLoadingTask = ReturnType<PdfJsModule['getDocument']>;
type PdfRenderTask = import('pdfjs-dist/legacy/build/pdf.mjs').RenderTask;

const PDF_WORKER_SRC = new URL('pdfjs-dist/legacy/build/pdf.worker.min.mjs', import.meta.url).toString();

type PromiseWithResolversCtor = PromiseConstructor & {
  withResolvers?: unknown;
};

function isCancellationError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return error.name === 'AbortException' || error.name === 'RenderingCancelledException' || message.includes('cancel');
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message.trim();
    if (message) return message;
    return error.name || 'Unknown error';
  }
  if (typeof error === 'string' && error.trim()) return error.trim();
  return 'Unknown error';
}

function previewDiagnostics() {
  const promiseCtor = Promise as PromiseWithResolversCtor;
  return {
    promiseWithResolvers: typeof promiseCtor.withResolvers === 'function',
    offscreenCanvas: typeof window !== 'undefined' && typeof window.OffscreenCanvas === 'function',
    imageDecoder: typeof window !== 'undefined' && 'ImageDecoder' in window,
  };
}

function formatPhaseError(phase: string, error: unknown): string {
  return `Quote preview failed during ${phase}: ${errorMessage(error)}`;
}

async function destroyLoadingTask(task: PdfLoadingTask | null): Promise<void> {
  if (!task) return;
  try {
    await task.destroy();
  } catch {
    // Ignore teardown failures while replacing the loading task.
  }
}

export default function QuotePdfInlinePreview({ data }: { data: Uint8Array }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pdfRef = useRef<PdfDocumentProxy | null>(null);
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  const [pageCount, setPageCount] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
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
    setStatusMessage(data.byteLength ? 'Loading quote preview...' : null);
    canvasRefs.current = [];

    const previousPdf = pdfRef.current;
    pdfRef.current = null;
    if (previousPdf) {
      void previousPdf.destroy();
    }

    const run = async () => {
      if (!data.byteLength) {
        setStatusMessage(null);
        return;
      }

      try {
        const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');

        const loadPdf = async (mode: 'auto' | 'fake'): Promise<PdfDocumentProxy> => {
          if (pdfjs.GlobalWorkerOptions.workerSrc !== PDF_WORKER_SRC) {
            pdfjs.GlobalWorkerOptions.workerSrc = PDF_WORKER_SRC;
          }
          if (mode === 'fake') {
            await pdfjs.PDFWorker._setupFakeWorkerGlobal;
          }

          const task = pdfjs.getDocument({
            data: new Uint8Array(data),
          });
          loadingTask = task;

          try {
            return await task.promise;
          } catch (error) {
            await destroyLoadingTask(task);
            throw error;
          } finally {
            if (loadingTask === task) {
              loadingTask = null;
            }
          }
        };

        let pdf: PdfDocumentProxy;
        try {
          pdf = await loadPdf('auto');
        } catch (workerError) {
          if (cancelled || isCancellationError(workerError)) return;
          console.warn('[quote_preview] worker load failed, retrying with fake worker', {
            error: workerError,
            diagnostics: previewDiagnostics(),
            byteLength: data.byteLength,
          });
          setStatusMessage('Retrying quote preview with fallback renderer...');
          pdf = await loadPdf('fake');
        }

        if (cancelled) {
          void pdf.destroy();
          return;
        }

        pdfRef.current = pdf;
        canvasRefs.current = new Array(pdf.numPages).fill(null);
        setPageCount(pdf.numPages);
        setStatusMessage('Rendering quote preview...');
      } catch (error) {
        if (cancelled || isCancellationError(error)) return;
        console.error('[quote_preview] document load failed', {
          error,
          diagnostics: previewDiagnostics(),
          byteLength: data.byteLength,
        });
        setRenderError(formatPhaseError('PDF load', error));
        setStatusMessage(null);
      }
    };

    void run();

    return () => {
      cancelled = true;
      if (loadingTask) {
        void destroyLoadingTask(loadingTask);
      }
      const activePdf = pdfRef.current;
      pdfRef.current = null;
      if (activePdf) {
        void activePdf.destroy();
      }
    };
  }, [data]);

  useEffect(() => {
    const pdf = pdfRef.current;
    if (!pdf || !pageCount || containerWidth <= 0) return;

    let cancelled = false;
    const renderTasks: PdfRenderTask[] = [];
    setRenderError(null);
    setStatusMessage('Rendering quote preview...');

    const run = async () => {
      try {
        const outputScale = window.devicePixelRatio || 1;

        for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
          const page = await pdf.getPage(pageIndex + 1);
          if (cancelled) return;

          const canvas = canvasRefs.current[pageIndex];
          if (!canvas) {
            throw new Error(`Canvas missing for page ${pageIndex + 1}`);
          }

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
          setStatusMessage(null);
        }
      } catch (error) {
        if (cancelled || isCancellationError(error)) return;
        console.error('[quote_preview] page render failed', {
          error,
          diagnostics: previewDiagnostics(),
          pageCount,
          containerWidth,
        });
        setRenderError(formatPhaseError('page rendering', error));
        setStatusMessage(null);
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
  }, [containerWidth, pageCount, data]);

  return (
    <div ref={containerRef} className={styles.quotePreviewDocument}>
      {renderError ? <p className={styles.quotePreviewRenderState}>{renderError}</p> : null}
      {!renderError && statusMessage ? <p className={styles.quotePreviewRenderState}>{statusMessage}</p> : null}
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
