'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './QuotesTab.module.css';
import compactStyles from './QuotePdfCompact.module.css';
import type { ProjectPdfStream } from './overview/ProjectPdfStream';

type PdfJsModule = typeof import('pdfjs-dist/legacy/build/pdf.mjs');
type PdfDocumentProxy = import('pdfjs-dist/legacy/build/pdf.mjs').PDFDocumentProxy;
type PdfLoadingTask = ReturnType<PdfJsModule['getDocument']>;
type PdfRenderTask = import('pdfjs-dist/legacy/build/pdf.mjs').RenderTask;

const PDF_MODULE_SRC = new URL('pdfjs-dist/legacy/build/pdf.mjs', import.meta.url).toString();
const PDF_WORKER_SRC = new URL('pdfjs-dist/legacy/build/pdf.worker.min.mjs', import.meta.url).toString();
const LEGACY_VIEW_WORKER_SRC = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();

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
  return `PDF preview failed during ${phase}: ${errorMessage(error)}`;
}

async function destroyLoadingTask(task: PdfLoadingTask | null): Promise<void> {
  if (!task) return;
  try {
    await task.destroy();
  } catch {
    // Ignore teardown failures while replacing the loading task.
  }
}

export async function preloadQuotePdfPreview() { await import('pdfjs-dist/legacy/build/pdf.mjs'); }

export function compactPdfFitScale(bounds: Pick<HTMLElement, 'clientWidth' | 'clientHeight'>, pageWidth: number, pageHeight: number): number {
  return Math.min((bounds.clientWidth - 32) / pageWidth, (bounds.clientHeight - 32) / pageHeight);
}
export function compactPdfViewportHeight(bounds: Pick<HTMLElement, 'clientWidth' | 'clientHeight'>, pageWidth: number, pageHeight: number): number {
  return Math.min(bounds.clientHeight, Math.floor(pageHeight * compactPdfFitScale(bounds, pageWidth, pageHeight)) + 32);
}

export default function QuotePdfInlinePreview({ data = null, source, pending = !data && !source, readError, onRetry, compact = false }: { data?: Uint8Array | null; source?: ProjectPdfStream; pending?: boolean; readError?: string; onRetry?: () => void; compact?: boolean }) {
  const sourceIdentity = source ?? data;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const pdfRef = useRef<PdfDocumentProxy | null>(null);
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  const [pageCount, setPageCount] = useState(0);
  const [documentSource, setDocumentSource] = useState<Uint8Array | ProjectPdfStream | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [pageSize, setPageSize] = useState<{ identity: typeof sourceIdentity; index: number; width: number; height: number } | null>(null);
  const [activePage,setActivePage]=useState(0),[zoom,setZoom]=useState(1),[expanded,setExpanded]=useState(false),[availableHeight,setAvailableHeight]=useState(500);
  useEffect(()=>{if(!expanded)return;const key=(event:KeyboardEvent)=>{if(event.key==='Escape')setExpanded(false);if(event.key==='Tab'){const controls=Array.from(containerRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')??[]),first=controls[0],last=controls.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[expanded]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateWidth = () => {
      const measured = compact ? viewportRef.current : container;
      if (!measured) return;
      const computed = window.getComputedStyle(measured);
      const paddingX = Number.parseFloat(computed.paddingLeft) + Number.parseFloat(computed.paddingRight);
      const nextWidth = Math.max(0, Math.floor(measured.clientWidth - paddingX));
      setContainerWidth((prev) => (prev === nextWidth ? prev : nextWidth));
      if(compact)setAvailableHeight(Math.max(240,window.innerHeight-container.getBoundingClientRect().top-92));
    };

    updateWidth();

    const observer = new ResizeObserver(() => updateWidth());
    observer.observe(container);
    if(compact&&viewportRef.current)observer.observe(viewportRef.current);
    window.addEventListener('resize',updateWidth);
    return () => {observer.disconnect();window.removeEventListener('resize',updateWidth);};
  }, [compact,expanded]);

  useEffect(() => {
    let cancelled = false;
    let loadingTask: PdfLoadingTask | null = null;
    let releaseStream: (() => void) | undefined;

    setDocumentSource(source ?? data);
    setPageCount(0);
    setPageSize(null);setActivePage(0);setZoom(1);
    setRenderError(null);
    const byteLength = source?.length ?? data?.byteLength ?? 0;
    setStatusMessage(byteLength ? 'Loading PDF preview...' : null);
    canvasRefs.current = [];

    const previousPdf = pdfRef.current;
    pdfRef.current = null;
    if (previousPdf) {
      void previousPdf.destroy();
    }

    const run = async () => {
      if (!byteLength) {
        setStatusMessage(null);
        return;
      }

      try {
        // Preserve main's progressive-stream loader. Studio retains the qualified
        // prebuilt module path that avoids the older Next export-wrapper clash.
        const pdfjs = compact
          ? await import(/* webpackIgnore: true */ /* @vite-ignore */ PDF_MODULE_SRC) as PdfJsModule
          : await import('pdfjs-dist/legacy/build/pdf.mjs');
        const workerSrc = compact ? PDF_WORKER_SRC : LEGACY_VIEW_WORKER_SRC;

        const loadPdf = async (mode: 'auto' | 'fake'): Promise<PdfDocumentProxy> => {
          if (pdfjs.GlobalWorkerOptions.workerSrc !== workerSrc) {
            pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
          }
          if (mode === 'fake') {
            await pdfjs.PDFWorker._setupFakeWorkerGlobal;
          }

          releaseStream?.();
          const transport = source ? new pdfjs.PDFDataRangeTransport(source.length, new Uint8Array(), false) : null;
          const task = transport ? pdfjs.getDocument({ range: transport, disableRange: true }) : pdfjs.getDocument({ data: new Uint8Array(data!) });
          // PDF.js receives copies because worker transfer detaches TypedArrays.
          // No custom range callback is installed: the single stream is authoritative.
          if (source && transport) releaseStream = source.subscribe(bytes => transport.onDataProgressiveRead(bytes), () => transport.onDataProgressiveDone());
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
            byteLength,
          });
          setStatusMessage('Retrying PDF preview with fallback renderer...');
          pdf = await loadPdf('fake');
        }

        if (cancelled) {
          void pdf.destroy();
          return;
        }

        pdfRef.current = pdf;
        canvasRefs.current = new Array(pdf.numPages).fill(null);
        setPageCount(pdf.numPages);
        setStatusMessage('Rendering PDF preview...');
      } catch (error) {
        if (cancelled || isCancellationError(error)) return;
        console.error('[quote_preview] document load failed', {
          error,
          diagnostics: previewDiagnostics(),
          byteLength,
        });
        setRenderError(formatPhaseError('PDF load', error));
        setStatusMessage(null);
      }
    };

    void run();

    return () => {
      cancelled = true;
      releaseStream?.();
      if (loadingTask) {
        void destroyLoadingTask(loadingTask);
      }
      const activePdf = pdfRef.current;
      pdfRef.current = null;
      if (activePdf) {
        void activePdf.destroy();
      }
    };
  }, [data, source, compact]);

  useEffect(() => {
    const pdf = pdfRef.current;
    if (!pdf || !pageCount || containerWidth <= 0) return;

    let cancelled = false;
    const renderTasks: PdfRenderTask[] = [];
    setRenderError(null);
    setStatusMessage('Rendering PDF preview...');

    const run = async () => {
      try {
        const outputScale = window.devicePixelRatio || 1;

        for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
          if(compact&&pageIndex!==activePage)continue;
          const page = await pdf.getPage(pageIndex + 1);
          if (cancelled) return;

          const canvas = canvasRefs.current[pageIndex];
          if (!canvas) {
            throw new Error(`Canvas missing for page ${pageIndex + 1}`);
          }

          const context = canvas.getContext('2d', { alpha: false });
          if (!context) throw new Error('Canvas unavailable');

          const baseViewport = page.getViewport({ scale: 1 });
          if(compact)setPageSize(previous=>previous?.identity===sourceIdentity&&previous.index===pageIndex&&previous.width===baseViewport.width&&previous.height===baseViewport.height?previous:{identity:sourceIdentity,index:pageIndex,width:baseViewport.width,height:baseViewport.height});
          const scale = compact?compactPdfFitScale({clientWidth:containerWidth,clientHeight:availableHeight},baseViewport.width,baseViewport.height)*zoom:containerWidth/baseViewport.width;
          const viewport = page.getViewport({ scale });

          canvas.width = Math.ceil(viewport.width * outputScale);
          canvas.height = Math.ceil(viewport.height * outputScale);
          canvas.style.width = `${compact?Math.floor(viewport.width):Math.ceil(viewport.width)}px`;
          canvas.style.height = `${compact?Math.floor(viewport.height):Math.ceil(viewport.height)}px`;

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
  }, [containerWidth, pageCount, data, source, sourceIdentity,compact,activePage,zoom,availableHeight]);

  const current = documentSource === sourceIdentity;
  const visibleError = readError ?? (current ? renderError : null);
  const status = pending ? "Reading PDF…" : current ? statusMessage : "Loading PDF preview…";
  const compactHeight=pageSize?.identity===sourceIdentity&&pageSize.index===activePage&&containerWidth>32
    ?compactPdfViewportHeight({clientWidth:containerWidth,clientHeight:availableHeight},pageSize.width,pageSize.height)
    :Math.min(availableHeight,500);
  const content=<>
      {visibleError ? <p className={styles.quotePreviewRenderState}>{visibleError} {onRetry ? <button type="button" onClick={onRetry}>Retry PDF</button> : null}</p> : null}
      {!visibleError && status ? <p role="status" className={styles.quotePreviewRenderState}>{status}</p> : null}
      {Array.from({ length: current && sourceIdentity && !readError ? pageCount : 0 }, (_, pageIndex) => (
        (!compact||pageIndex===activePage)&&<div key={pageIndex} className={compact?compactStyles.page:styles.quotePreviewPage}>
          <canvas
            ref={(node) => {
              canvasRefs.current[pageIndex] = node;
            }}
            className={compact?compactStyles.canvas:styles.quotePreviewCanvas}
          />
        </div>
      ))}
  </>;

  return (
    <div ref={containerRef} className={compact?`${compactStyles.root} ${expanded?compactStyles.expanded:''}`:styles.quotePreviewDocument} aria-busy={pending || Boolean(!visibleError && status)} role={expanded?'dialog':undefined} aria-modal={expanded||undefined} aria-label={expanded?'Enlarged document':undefined}>
      {compact&&<div className={compactStyles.tools} aria-label="Document controls"><button aria-label="Previous page" disabled={activePage===0} onClick={()=>{setActivePage(n=>n-1);setZoom(1);}}>‹</button><span aria-live="polite">{current&&pageCount?`${activePage+1} / ${pageCount}`:'Opening…'}</span><button aria-label="Next page" disabled={!current||!pageCount||activePage>=pageCount-1} onClick={()=>{setActivePage(n=>n+1);setZoom(1);}}>›</button><button onClick={()=>setZoom(1)} aria-pressed={zoom===1}>Fit page</button><button aria-label="Zoom out" disabled={zoom<=1} onClick={()=>setZoom(n=>Math.max(1,n-.25))}>−</button><button aria-label="Zoom in" disabled={zoom>=3} onClick={()=>setZoom(n=>Math.min(3,n+.25))}>+</button><button onClick={()=>setExpanded(n=>!n)}>{expanded?'Close enlarged':'Enlarge'}</button></div>}
      {compact?<div ref={viewportRef} className={compactStyles.viewport} style={{height:compactHeight}}>{content}</div>:content}
    </div>
  );
}
