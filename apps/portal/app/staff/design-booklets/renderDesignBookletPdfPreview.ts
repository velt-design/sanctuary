"use client";

import {
  DESIGN_BOOKLET_MAX_PDF_BYTES,
  DESIGN_BOOKLET_MAX_PDF_PAGES,
} from "@/lib/designBooklets/pageModel";

type PdfJsModule = typeof import("pdfjs-dist/legacy/build/pdf.mjs");

const PDF_WORKER_SRC = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();
const PREVIEW_MAX_WIDTH = 1800;

async function sourceBytes(source: File | string): Promise<Uint8Array> {
  if (source instanceof File) {
    if (source.size <= 0 || source.size > DESIGN_BOOKLET_MAX_PDF_BYTES) {
      throw new Error("Choose a PDF no larger than 20 MB.");
    }
    return new Uint8Array(await source.arrayBuffer());
  }
  const response = await fetch(source, {
    cache: "no-store",
    credentials: "omit",
  });
  if (!response.ok)
    throw new Error("The saved drawing PDF could not be opened.");
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (
    bytes.byteLength <= 0 ||
    bytes.byteLength > DESIGN_BOOKLET_MAX_PDF_BYTES
  ) {
    throw new Error("The saved drawing PDF is empty or too large.");
  }
  return bytes;
}

function canvasJpeg(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob
          ? resolve(blob)
          : reject(new Error("The drawing preview could not be prepared.")),
      "image/jpeg",
      0.9,
    );
  });
}

function previewFileName(fileName: string, pageNumber: number): string {
  const stem = fileName.replace(/\.pdf$/i, "").replace(/[^a-z0-9._-]+/gi, "-");
  return `${stem || "drawing"}-page-${pageNumber}.jpg`;
}

type DesignBookletPdfPreview = {
  file: File;
  pageCount: number;
  width: number;
  height: number;
};

export async function renderDesignBookletPdfPreview(
  source: File | string,
  fileName: string,
  pageNumber: number,
): Promise<DesignBookletPdfPreview> {
  const bytes = await sourceBytes(source);
  let loadingTask: ReturnType<PdfJsModule["getDocument"]> | null = null;
  try {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    if (pdfjs.GlobalWorkerOptions.workerSrc !== PDF_WORKER_SRC) {
      pdfjs.GlobalWorkerOptions.workerSrc = PDF_WORKER_SRC;
    }
    loadingTask = pdfjs.getDocument({ data: bytes });
    const pdf = await loadingTask.promise;
    const pageCount = pdf.numPages;
    if (pageCount < 1 || pageCount > DESIGN_BOOKLET_MAX_PDF_PAGES) {
      await pdf.destroy();
      throw new Error(
        `Choose a PDF with no more than ${DESIGN_BOOKLET_MAX_PDF_PAGES} pages.`,
      );
    }
    if (
      !Number.isSafeInteger(pageNumber) ||
      pageNumber < 1 ||
      pageNumber > pageCount
    ) {
      await pdf.destroy();
      throw new Error("Choose a valid PDF page.");
    }
    const page = await pdf.getPage(pageNumber);
    const baseViewport = page.getViewport({ scale: 1 });
    const scale = Math.min(2.5, PREVIEW_MAX_WIDTH / baseViewport.width);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.ceil(viewport.width));
    canvas.height = Math.max(1, Math.ceil(viewport.height));
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) {
      await pdf.destroy();
      throw new Error("The drawing preview canvas is unavailable.");
    }
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvas, canvasContext: context, viewport }).promise;
    const blob = await canvasJpeg(canvas);
    await pdf.destroy();
    return {
      file: new File([blob], previewFileName(fileName, pageNumber), {
        type: "image/jpeg",
        lastModified: Date.now(),
      }),
      pageCount,
      width: canvas.width,
      height: canvas.height,
    };
  } catch (error) {
    await loadingTask?.destroy().catch(() => undefined);
    if (error instanceof Error) throw error;
    throw new Error("The PDF is encrypted, damaged, or could not be read.");
  }
}
