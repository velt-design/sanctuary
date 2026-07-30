import "server-only";

import { PDFDocument, type Color, type PDFImage, type PDFPage } from "pdf-lib";
import sharp from "sharp";
import fontkit from "@/lib/quotes/fontkit";
import {
  buildDesignBookletRenderModel,
  DESIGN_BOOKLET_DRAWING_LAYOUTS,
  DESIGN_BOOKLET_FOCAL_POINTS,
  DESIGN_BOOKLET_REVIEW_COPY,
  designBookletDrawingTitle,
  visibleDesignBookletDrawings,
} from "./pageModel";
import {
  DESIGN_BOOKLET_PDF_FONT_FILES,
  readDesignBookletPdfFont,
} from "./pdfAssets";
import {
  addDesignBookletPage as addPage,
  DESIGN_BOOKLET_PDF_COLORS,
  DESIGN_BOOKLET_PDF_LEFT,
  DESIGN_BOOKLET_PDF_PAGE_SIZE,
  DESIGN_BOOKLET_PDF_RIGHT,
  drawDesignBookletEyebrow as drawEyebrow,
  drawDesignBookletFooter as drawFooter,
  drawDesignBookletImageContain as drawImageContain,
  drawDesignBookletImageCover as drawImageCover,
  drawDesignBookletRule as drawRule,
  drawDesignBookletWrappedText as drawWrappedText,
  safeDesignBookletPdfText as safePdfText,
  type DesignBookletPdfFonts as Fonts,
} from "./pdfLayout";
import type {
  DesignBookletContentCatalog,
  DesignBookletDraft,
  DesignBookletDrawingPage,
  DesignBookletImage,
  DesignBookletImagePage,
  DesignBookletImagePlacement,
  DesignBookletImages,
} from "./types";

export { DESIGN_BOOKLET_PDF_PAGE_SIZE } from "./pdfLayout";

const { width: PAGE_WIDTH, height: PAGE_HEIGHT } = DESIGN_BOOKLET_PDF_PAGE_SIZE;
const colors = DESIGN_BOOKLET_PDF_COLORS;
const white = colors.paperStrong;

type PdfRenderContext = {
  pdf: PDFDocument;
  fonts: Fonts;
  draft: DesignBookletDraft;
  content: DesignBookletContentCatalog;
  images: Record<string, PDFImage>;
  overlays: {
    imagePage: PDFImage;
  };
};

async function embedImage(
  pdf: PDFDocument,
  image: DesignBookletImage,
): Promise<PDFImage> {
  return image.mediaType === "image/png"
    ? pdf.embedPng(image.bytes)
    : pdf.embedJpg(image.bytes);
}

async function embedImages(
  pdf: PDFDocument,
  images: DesignBookletImages,
): Promise<Record<string, PDFImage>> {
  const entries = await Promise.all(
    Object.entries(images).map(
      async ([assetId, image]) =>
        [assetId, await embedImage(pdf, image)] as const,
    ),
  );
  return Object.fromEntries(entries);
}

const OVERLAY_WIDTH = 594;
const OVERLAY_HEIGHT = 420;

async function createImagePageShadeOverlay(): Promise<Uint8Array> {
  const pixels = new Uint8Array(OVERLAY_WIDTH * OVERLAY_HEIGHT * 4);

  for (let y = 0; y < OVERLAY_HEIGHT; y += 1) {
    const yRatio = y / (OVERLAY_HEIGHT - 1);
    for (let x = 0; x < OVERLAY_WIDTH; x += 1) {
      const top = yRatio <= 0.2 ? 0.38 * (1 - yRatio / 0.2) : 0;
      const bottomDistance = 1 - yRatio;
      const bottom =
        bottomDistance <= 0.18 ? 0.42 * (1 - bottomDistance / 0.18) : 0;
      const opacity = 1 - (1 - top) * (1 - bottom);

      const offset = (y * OVERLAY_WIDTH + x) * 4;
      pixels[offset] = 17;
      pixels[offset + 1] = 20;
      pixels[offset + 2] = 17;
      pixels[offset + 3] = Math.round(opacity * 255);
    }
  }

  return sharp(pixels, {
    raw: {
      width: OVERLAY_WIDTH,
      height: OVERLAY_HEIGHT,
      channels: 4,
    },
  })
    .png()
    .toBuffer();
}

async function embedShadeOverlays(pdf: PDFDocument) {
  const imagePageBytes = await createImagePageShadeOverlay();
  return {
    imagePage: await pdf.embedPng(imagePageBytes),
  };
}

function requiredImage(
  images: Record<string, PDFImage>,
  assetId: string,
): PDFImage {
  const image = images[assetId];
  if (!image) {
    throw new Error(`Missing design booklet image ${assetId}.`);
  }
  return image;
}

function placementFocus(placement: DesignBookletImagePlacement) {
  return DESIGN_BOOKLET_FOCAL_POINTS[placement.focalPoint];
}

function drawBrandAt(
  page: PDFPage,
  fonts: Fonts,
  x: number,
  y: number,
  color: Color = colors.ink,
) {
  page.drawText("SANCTUARY", {
    x,
    y,
    size: 10,
    font: fonts.semibold,
    color,
  });
  page.drawText("PERGOLAS", {
    x,
    y: y - 11,
    size: 6.5,
    font: fonts.medium,
    color,
  });
}

function drawRightLabel(
  page: PDFPage,
  fonts: Fonts,
  text: string,
  y: number,
  color: Color = colors.ink,
) {
  const label = safePdfText(text).toUpperCase();
  const size = 7;
  page.drawText(label, {
    x:
      PAGE_WIDTH -
      DESIGN_BOOKLET_PDF_RIGHT -
      fonts.semibold.widthOfTextAtSize(label, size),
    y,
    size,
    font: fonts.semibold,
    color,
  });
}

function drawFullBleedImage(
  page: PDFPage,
  image: PDFImage,
  placement: DesignBookletImagePlacement,
) {
  drawImageCover(
    page,
    image,
    { x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT },
    placementFocus(placement),
  );
}

function renderCover(
  context: PdfRenderContext,
  pageNumber: number,
  pageCount: number,
) {
  const { pdf, fonts, draft, content, images } = context;
  const page = addPage(pdf);
  drawFullBleedImage(
    page,
    requiredImage(images, draft.cover.assetId),
    draft.cover,
  );

  drawBrandAt(page, fonts, DESIGN_BOOKLET_PDF_LEFT, 548, white);
  drawRightLabel(
    page,
    fonts,
    `Concept design / ${String(pageNumber).padStart(2, "0")}`,
    548,
    white,
  );
  drawEyebrow(
    page,
    "Outdoor living by Sanctuary",
    DESIGN_BOOKLET_PDF_LEFT,
    230,
    fonts,
    white,
  );
  drawWrappedText(page, draft.projectTitle, {
    x: DESIGN_BOOKLET_PDF_LEFT,
    y: 193,
    width: 522,
    font: fonts.semibold,
    size: 34,
    lineHeight: 35,
    maxLines: 3,
    color: white,
  });

  drawRule(page, DESIGN_BOOKLET_PDF_LEFT, 130, 488, white);
  drawEyebrow(page, "Prepared for", DESIGN_BOOKLET_PDF_LEFT, 108, fonts, white);
  page.drawText(safePdfText(draft.customerName), {
    x: DESIGN_BOOKLET_PDF_LEFT,
    y: 84,
    size: 13,
    font: fonts.medium,
    color: white,
  });

  drawEyebrow(page, "Design direction", 198, 108, fonts, white);
  drawWrappedText(
    page,
    `${content.roofForms[draft.roofFormId].name} / ${content.materials[draft.materialId].label}`,
    {
      x: 198,
      y: 84,
      width: 334,
      font: fonts.medium,
      size: 9,
      lineHeight: 12,
      maxLines: 2,
      color: white,
    },
  );
  drawFooter(page, pageNumber, pageCount, draft.customerName, fonts, "light");
}

function renderImagePage(
  context: PdfRenderContext,
  resolvedPage: {
    pageNumber: number;
    pageCount: number;
    page: DesignBookletImagePage;
  },
) {
  const { pdf, fonts, draft, images } = context;
  const page = addPage(pdf);
  const placement = resolvedPage.page.image;
  drawFullBleedImage(page, requiredImage(images, placement.assetId), placement);

  page.drawImage(context.overlays.imagePage, {
    x: 0,
    y: 0,
    width: PAGE_WIDTH,
    height: PAGE_HEIGHT,
  });
  drawBrandAt(page, fonts, DESIGN_BOOKLET_PDF_LEFT, 548, white);
  drawRightLabel(
    page,
    fonts,
    `Concept image / ${String(resolvedPage.pageNumber).padStart(2, "0")}`,
    548,
    white,
  );
  drawFooter(
    page,
    resolvedPage.pageNumber,
    resolvedPage.pageCount,
    draft.customerName,
    fonts,
    "light",
  );
}

const DRAWING_AREA = {
  x: DESIGN_BOOKLET_PDF_LEFT,
  y: 62,
  width: PAGE_WIDTH - DESIGN_BOOKLET_PDF_LEFT - DESIGN_BOOKLET_PDF_RIGHT,
  height: 458,
} as const;

function drawingSlotFrame(frame: {
  x: number;
  y: number;
  width: number;
  height: number;
}) {
  const width = DRAWING_AREA.width * frame.width;
  const height = DRAWING_AREA.height * frame.height;
  const x = DRAWING_AREA.x + DRAWING_AREA.width * frame.x;
  const top = DRAWING_AREA.y + DRAWING_AREA.height * (1 - frame.y);
  return { x, y: top - height, width, height };
}

function renderDrawingPage(
  context: PdfRenderContext,
  resolvedPage: {
    pageNumber: number;
    pageCount: number;
    page: DesignBookletDrawingPage;
  },
) {
  const { pdf, fonts, draft, images } = context;
  const page = addPage(pdf);
  drawBrandAt(page, fonts, DESIGN_BOOKLET_PDF_LEFT, 548);
  drawRightLabel(
    page,
    fonts,
    `Drawings / ${String(resolvedPage.pageNumber).padStart(2, "0")}`,
    548,
    colors.muted,
  );

  const layout = DESIGN_BOOKLET_DRAWING_LAYOUTS[resolvedPage.page.layout];
  const drawings = visibleDesignBookletDrawings(resolvedPage.page);
  drawings.forEach((drawing, index) => {
    const frame = drawingSlotFrame(layout.frames[index]);
    const titleHeight = 30;
    drawImageContain(
      page,
      requiredImage(images, drawing.image.assetId),
      {
        x: frame.x,
        y: frame.y + titleHeight,
        width: frame.width,
        height: frame.height - titleHeight,
      },
      white,
    );
    drawWrappedText(page, designBookletDrawingTitle(drawing.title), {
      x: frame.x + 2,
      y: frame.y + 17,
      width: frame.width - 4,
      font: fonts.medium,
      size: 8.4,
      lineHeight: 9.6,
      maxLines: 2,
      color: colors.ink,
    });
  });

  drawFooter(
    page,
    resolvedPage.pageNumber,
    resolvedPage.pageCount,
    draft.customerName,
    fonts,
  );
}

function renderReview(
  context: PdfRenderContext,
  pageNumber: number,
  pageCount: number,
) {
  const { pdf, fonts, draft, images } = context;
  const page = addPage(pdf);
  const imageWidth = 365;
  drawImageCover(
    page,
    requiredImage(images, draft.reviewPage.image.assetId),
    { x: 0, y: 50, width: imageWidth, height: PAGE_HEIGHT - 50 },
    placementFocus(draft.reviewPage.image),
  );
  page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - 4,
    width: PAGE_WIDTH,
    height: 4,
    color: colors.accent,
  });
  page.drawRectangle({
    x: 0,
    y: 0,
    width: PAGE_WIDTH,
    height: 50,
    color: colors.accent,
  });

  const copyX = 405;
  const copyWidth = PAGE_WIDTH - copyX - DESIGN_BOOKLET_PDF_RIGHT;
  drawBrandAt(page, fonts, copyX, 548);
  drawRightLabel(
    page,
    fonts,
    `Review / ${String(pageNumber).padStart(2, "0")}`,
    548,
    colors.muted,
  );

  drawEyebrow(page, DESIGN_BOOKLET_REVIEW_COPY.eyebrow, copyX, 500, fonts);
  drawWrappedText(page, DESIGN_BOOKLET_REVIEW_COPY.title, {
    x: copyX,
    y: 462,
    width: copyWidth,
    font: fonts.semibold,
    size: 28,
    lineHeight: 30,
    maxLines: 2,
  });
  drawWrappedText(page, DESIGN_BOOKLET_REVIEW_COPY.introduction, {
    x: copyX,
    y: 401,
    width: copyWidth,
    font: fonts.regular,
    size: 9.2,
    lineHeight: 13,
    maxLines: 3,
    color: colors.muted,
  });

  let promptY = 337;
  for (const prompt of DESIGN_BOOKLET_REVIEW_COPY.prompts) {
    drawRule(page, copyX, promptY + 21, copyWidth);
    page.drawText(safePdfText(prompt.title), {
      x: copyX,
      y: promptY,
      size: 9.5,
      font: fonts.semibold,
      color: colors.ink,
    });
    drawWrappedText(page, prompt.copy, {
      x: copyX,
      y: promptY - 20,
      width: copyWidth,
      font: fonts.regular,
      size: 8.2,
      lineHeight: 11,
      maxLines: 3,
      color: colors.muted,
    });
    promptY -= 83;
  }

  page.drawText(safePdfText(DESIGN_BOOKLET_REVIEW_COPY.callToAction), {
    x: copyX,
    y: 75,
    size: 10,
    font: fonts.semibold,
    color: colors.accent,
  });
  drawFooter(page, pageNumber, pageCount, draft.customerName, fonts, "light");
}

export function designBookletPdfFilename(customerName: string): string {
  const slug =
    safePdfText(customerName)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "customer";
  return `${slug}-design-booklet.pdf`;
}

export async function generateDesignBookletPdf(input: {
  draft: DesignBookletDraft;
  content: DesignBookletContentCatalog;
  images: DesignBookletImages;
}): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  pdf.setTitle(
    `${safePdfText(input.draft.customerName)} - ${safePdfText(input.draft.projectTitle)}`,
  );
  pdf.setAuthor("Sanctuary Pergolas");
  pdf.setSubject("Landscape concept design booklet");
  pdf.setCreator("Sanctuary Pergolas");

  const [regularBytes, mediumBytes, semiboldBytes] = await Promise.all([
      readDesignBookletPdfFont(DESIGN_BOOKLET_PDF_FONT_FILES.regular),
      readDesignBookletPdfFont(DESIGN_BOOKLET_PDF_FONT_FILES.medium),
      readDesignBookletPdfFont(DESIGN_BOOKLET_PDF_FONT_FILES.semibold),
  ]);
  const fonts: Fonts = {
    regular: await pdf.embedFont(regularBytes, { subset: true }),
    medium: await pdf.embedFont(mediumBytes, { subset: true }),
    semibold: await pdf.embedFont(semiboldBytes, { subset: true }),
  };
  const [images, overlays] = await Promise.all([
    embedImages(pdf, input.images),
    embedShadeOverlays(pdf),
  ]);
  const context: PdfRenderContext = {
    pdf,
    fonts,
    draft: input.draft,
    content: input.content,
    images,
    overlays,
  };

  for (const resolvedPage of buildDesignBookletRenderModel(input.draft)) {
    switch (resolvedPage.kind) {
      case "cover":
        renderCover(context, resolvedPage.pageNumber, resolvedPage.pageCount);
        break;
      case "image":
        renderImagePage(context, resolvedPage);
        break;
      case "drawings":
        renderDrawingPage(context, resolvedPage);
        break;
      case "review":
        renderReview(context, resolvedPage.pageNumber, resolvedPage.pageCount);
        break;
    }
  }

  return pdf.save({ useObjectStreams: false });
}
