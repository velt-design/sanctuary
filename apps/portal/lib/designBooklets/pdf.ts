import "server-only";

import {
  PDFDocument,
  clip,
  endPath,
  popGraphicsState,
  pushGraphicsState,
  rectangle,
  type Color,
  type PDFEmbeddedPage,
  type PDFImage,
  type PDFPage,
} from "pdf-lib";
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
import { drawDesignBookletDrawingTitleBlock } from "./pdfDrawingTitleBlock";
import {
  visibleDesignBookletContentImages,
  type DesignBookletContentFrame,
} from "./contentLayouts";
import {
  resolveDesignBookletContentLayout,
  resolveDesignBookletContentTypography,
} from "./contentPresentation";
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
  drawDesignBookletTrackedText as drawTrackedText,
  drawDesignBookletWrappedText as drawWrappedText,
  designBookletPdfTextLines,
  designBookletPdfTextWidth,
  safeDesignBookletPdfText as safePdfText,
  type DesignBookletPdfFonts as Fonts,
} from "./pdfLayout";
import {
  DESIGN_BOOKLET_PRESENTATION,
  designBookletCssBaselineOffset,
  normalizeDesignBookletMultilinePresentationText,
} from "./presentation";
import type {
  DesignBookletContentCatalog,
  DesignBookletDraft,
  DesignBookletDrawingPage,
  DesignBookletImage,
  DesignBookletImagePage,
  DesignBookletImagePlacement,
  DesignBookletImages,
  DesignBookletPdfDocuments,
} from "./types";

export { DESIGN_BOOKLET_PDF_PAGE_SIZE } from "./pdfLayout";

const { width: PAGE_WIDTH, height: PAGE_HEIGHT } = DESIGN_BOOKLET_PDF_PAGE_SIZE;
const presentation = DESIGN_BOOKLET_PRESENTATION;
const colors = DESIGN_BOOKLET_PDF_COLORS;
const white = colors.paperStrong;

function pdfYFromTopBaseline(topBaseline: number): number {
  return PAGE_HEIGHT - topBaseline;
}

function pdfYFromTop(top: number, height: number): number {
  return PAGE_HEIGHT - top - height;
}

type PdfRenderContext = {
  pdf: PDFDocument;
  fonts: Fonts;
  draft: DesignBookletDraft;
  content: DesignBookletContentCatalog;
  images: Record<string, PDFImage>;
  drawingPdfPages: Record<string, PDFEmbeddedPage>;
  overlays: {
    imagePage: PDFImage;
    reviewEdge: PDFImage;
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

function drawingPdfPageKey(assetId: string, pageNumber: number): string {
  return `${assetId}:${pageNumber}`;
}

async function embedDrawingPdfPages(
  pdf: PDFDocument,
  draft: DesignBookletDraft,
  documents: DesignBookletPdfDocuments,
): Promise<Record<string, PDFEmbeddedPage>> {
  const requested = new Map<string, { assetId: string; pageNumber: number }>();
  for (const page of draft.contentPages) {
    if (page.kind !== "drawings") continue;
    for (const drawing of page.drawings) {
      if (!drawing.pdf) continue;
      requested.set(
        drawingPdfPageKey(drawing.pdf.assetId, drawing.pdf.pageNumber),
        drawing.pdf,
      );
    }
  }
  const entries = await Promise.all(
    [...requested.entries()].map(async ([key, source]) => {
      const document = documents[source.assetId];
      if (!document) {
        throw new Error(`Drawing PDF "${source.assetId}" is unavailable.`);
      }
      const [embedded] = await pdf.embedPdf(document.bytes, [
        source.pageNumber - 1,
      ]);
      if (!embedded)
        throw new Error("The selected drawing PDF page is unavailable.");
      return [key, embedded] as const;
    }),
  );
  return Object.fromEntries(entries);
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

function combinedOpacity(...values: number[]): number {
  return 1 - values.reduce((remaining, value) => remaining * (1 - value), 1);
}

async function createShadeOverlay(
  kind: "image-page" | "review-edge",
): Promise<Uint8Array> {
  const pixels = new Uint8Array(OVERLAY_WIDTH * OVERLAY_HEIGHT * 4);

  for (let y = 0; y < OVERLAY_HEIGHT; y += 1) {
    const yRatio = y / (OVERLAY_HEIGHT - 1);
    for (let x = 0; x < OVERLAY_WIDTH; x += 1) {
      const xRatio = x / (OVERLAY_WIDTH - 1);
      let opacity = 0;
      let red = 17;
      let green = 20;
      let blue = 17;

      if (kind === "image-page") {
        const top = yRatio <= 0.2 ? 0.38 * (1 - yRatio / 0.2) : 0;
        const bottomDistance = 1 - yRatio;
        const bottom =
          bottomDistance <= 0.18 ? 0.42 * (1 - bottomDistance / 0.18) : 0;
        opacity = combinedOpacity(top, bottom);
      } else {
        red = 30;
        green = 34;
        blue = 29;
        opacity = xRatio >= 0.72 ? 0.2 * ((xRatio - 0.72) / (1 - 0.72)) : 0;
      }

      const offset = (y * OVERLAY_WIDTH + x) * 4;
      pixels[offset] = red;
      pixels[offset + 1] = green;
      pixels[offset + 2] = blue;
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
  const [imagePageBytes, reviewEdgeBytes] = await Promise.all([
    createShadeOverlay("image-page"),
    createShadeOverlay("review-edge"),
  ]);
  return {
    imagePage: await pdf.embedPng(imagePageBytes),
    reviewEdge: await pdf.embedPng(reviewEdgeBytes),
  };
}

function optionalImage(
  images: Record<string, PDFImage>,
  assetId: string,
): PDFImage | undefined {
  return images[assetId] as PDFImage | undefined;
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
  const primarySize = presentation.chrome.header.brandPrimarySize;
  drawTrackedText(page, "SANCTUARY PERGOLAS", {
    x,
    y,
    size: primarySize,
    font: fonts.brand,
    color,
    tracking: 0.08,
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
  const size = presentation.chrome.header.labelSize;
  drawTrackedText(page, label, {
    x:
      PAGE_WIDTH -
      DESIGN_BOOKLET_PDF_RIGHT -
      designBookletPdfTextWidth(label, fonts.semibold, size, 0.12),
    y,
    size,
    font: fonts.semibold,
    color,
    tracking: 0.12,
  });
}

function drawFullBleedImage(
  page: PDFPage,
  image: PDFImage | undefined,
  placement: DesignBookletImagePlacement,
) {
  if (!image) {
    page.drawRectangle({
      x: 0,
      y: 0,
      width: PAGE_WIDTH,
      height: PAGE_HEIGHT,
      color: colors.accent,
    });
    return;
  }
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
    optionalImage(images, draft.cover.assetId),
    draft.cover,
  );

  drawBrandAt(
    page,
    fonts,
    DESIGN_BOOKLET_PDF_LEFT,
    pdfYFromTopBaseline(presentation.chrome.header.brandPrimaryBaseline),
    white,
  );
  drawRightLabel(
    page,
    fonts,
    `Concept design / ${String(pageNumber).padStart(2, "0")}`,
    pdfYFromTopBaseline(presentation.chrome.header.labelBaseline),
    white,
  );

  const cover = presentation.cover;
  const normalizedTitle = normalizeDesignBookletMultilinePresentationText(
    draft.projectTitle,
  );
  const titleLines = designBookletPdfTextLines(
    normalizedTitle,
    fonts.display,
    cover.title.size,
    cover.title.width,
    -0.045,
    true,
  ).slice(0, cover.title.maxLines);
  const direction = safePdfText(
    `${content.roofForms[draft.roofFormId].name} / ${content.materials[draft.materialId].label}`,
  );
  const directionLines = designBookletPdfTextLines(
    direction,
    fonts.medium,
    cover.details.value.size,
    cover.details.direction.width,
  ).slice(0, cover.details.direction.valueMaxLines);
  const customerLines = designBookletPdfTextLines(
    safePdfText(draft.customerName),
    fonts.medium,
    cover.details.value.size,
    cover.details.prepared.width,
  ).slice(0, cover.details.prepared.valueMaxLines);
  const detailValueLineCount = Math.max(
    1,
    directionLines.length,
    customerLines.length,
  );
  const detailsHeight =
    cover.details.paddingTop +
    cover.details.label.lineHeight +
    cover.details.value.marginTop +
    cover.details.value.lineHeight * detailValueLineCount;
  const detailsRuleTop = PAGE_HEIGHT - cover.story.bottom - detailsHeight;
  const titleTop =
    detailsRuleTop -
    cover.details.marginTop -
    cover.title.lineHeight * Math.max(1, titleLines.length);
  const eyebrowTop =
    titleTop - cover.title.marginTop - cover.eyebrow.lineHeight;
  const titleBaseline =
    titleTop +
    designBookletCssBaselineOffset(
      cover.title.size,
      cover.title.lineHeight,
      "display",
    );
  const eyebrowBaseline =
    eyebrowTop +
    designBookletCssBaselineOffset(
      cover.eyebrow.size,
      cover.eyebrow.lineHeight,
    );

  drawEyebrow(
    page,
    "Outdoor living by Sanctuary",
    cover.story.x,
    pdfYFromTopBaseline(eyebrowBaseline),
    fonts,
    white,
  );
  drawWrappedText(page, normalizedTitle, {
    x: cover.story.x,
    y: pdfYFromTopBaseline(titleBaseline),
    width: cover.title.width,
    font: fonts.display,
    size: cover.title.size,
    lineHeight: cover.title.lineHeight,
    maxLines: cover.title.maxLines,
    color: white,
    tracking: -0.045,
    preserveLineBreaks: true,
  });

  drawRule(
    page,
    cover.story.x,
    PAGE_HEIGHT - detailsRuleTop,
    cover.details.width,
    white,
  );
  const detailLabelBaseline =
    detailsRuleTop +
    cover.details.paddingTop +
    designBookletCssBaselineOffset(
      cover.details.label.size,
      cover.details.label.lineHeight,
    );
  const detailValueBaseline =
    detailsRuleTop +
    cover.details.paddingTop +
    cover.details.label.lineHeight +
    cover.details.value.marginTop +
    designBookletCssBaselineOffset(
      cover.details.value.size,
      cover.details.value.lineHeight,
    );
  drawEyebrow(
    page,
    "Prepared for",
    cover.story.x,
    pdfYFromTopBaseline(detailLabelBaseline),
    fonts,
    white,
    cover.details.label.size,
    0.09,
  );
  drawWrappedText(page, draft.customerName, {
    x: cover.story.x,
    y: pdfYFromTopBaseline(detailValueBaseline),
    width: cover.details.prepared.width,
    font: fonts.medium,
    size: cover.details.value.size,
    lineHeight: cover.details.value.lineHeight,
    maxLines: cover.details.prepared.valueMaxLines,
    color: white,
  });

  const directionX = cover.story.x + cover.details.direction.x;
  drawEyebrow(
    page,
    "Design direction",
    directionX,
    pdfYFromTopBaseline(detailLabelBaseline),
    fonts,
    white,
    cover.details.label.size,
    0.09,
  );
  drawWrappedText(page, direction, {
    x: directionX,
    y: pdfYFromTopBaseline(detailValueBaseline),
    width: cover.details.direction.width,
    font: fonts.medium,
    size: cover.details.value.size,
    lineHeight: cover.details.value.lineHeight,
    maxLines: cover.details.direction.valueMaxLines,
    color: white,
  });
  drawFooter(page, pageNumber, pageCount, draft.customerName, fonts, "light");
}

function contentFrameToPdf(frame: DesignBookletContentFrame) {
  return {
    x: frame.x,
    y: pdfYFromTop(frame.top, frame.height),
    width: frame.width,
    height: frame.height,
  };
}

function drawContentCaption(
  page: PDFPage,
  fonts: Fonts,
  value: string,
  frame: { x: number; y: number; width: number; height: number },
  light: boolean,
  size: number,
  lineHeight: number,
) {
  const caption = safePdfText(value).toUpperCase();
  if (!caption) return;
  const paddingX = 5;
  const height = lineHeight + 7.5;
  const width = Math.min(
    frame.width - 16,
    designBookletPdfTextWidth(caption, fonts.semibold, size, 0.06) +
      paddingX * 2,
  );
  const x = frame.x + 8;
  const y = frame.y + (light ? 48 : 8);
  page.drawRectangle({
    x,
    y,
    width,
    height,
    color: light ? colors.ink : colors.canvas,
    opacity: light ? 0.68 : 0.92,
  });
  drawTrackedText(page, caption, {
    x: x + paddingX,
    y: y + (height - size) / 2 + 0.9,
    size,
    font: fonts.semibold,
    color: light ? white : colors.ink,
    tracking: 0.06,
  });
}

function withPdfClip(
  page: PDFPage,
  frame: { x: number; y: number; width: number; height: number },
  draw: () => void,
) {
  page.pushOperators(
    pushGraphicsState(),
    rectangle(frame.x, frame.y, frame.width, frame.height),
    clip(),
    endPath(),
  );
  draw();
  page.pushOperators(popGraphicsState());
}

function drawContentCopy(
  page: PDFPage,
  fonts: Fonts,
  contentPage: DesignBookletImagePage,
  frame: DesignBookletContentFrame,
) {
  const { content } = contentPage;
  const typography = resolveDesignBookletContentTypography(contentPage);
  const eyebrowSize = typography.eyebrowSize;
  const eyebrowLineHeight = typography.eyebrowLineHeight;
  const eyebrowBaseline =
    frame.top + designBookletCssBaselineOffset(eyebrowSize, eyebrowLineHeight);
  if (content.eyebrow) {
    drawEyebrow(
      page,
      content.eyebrow,
      frame.x,
      pdfYFromTopBaseline(eyebrowBaseline),
      fonts,
      colors.accent,
      eyebrowSize,
      0.15,
    );
  }
  const copyTop = frame.top + (content.eyebrow ? eyebrowLineHeight + 11 : 0);

  if (contentPage.layout === "story-image-top") {
    const gap = 34;
    const headlineWidth = frame.width * 0.42 - gap / 2;
    const bodyX = frame.x + frame.width * 0.42 + gap / 2;
    const bodyWidth = frame.width * 0.58 - gap / 2;
    if (content.headline) {
      drawWrappedText(page, content.headline, {
        x: frame.x,
        y: pdfYFromTopBaseline(
          copyTop +
            designBookletCssBaselineOffset(
              typography.headlineSize,
              typography.headlineLineHeight,
              "display",
            ),
        ),
        width: headlineWidth,
        font: fonts.display,
        size: typography.headlineSize,
        lineHeight: typography.headlineLineHeight,
        maxLines: Math.max(
          1,
          Math.min(
            3,
            Math.floor(
              (frame.top + frame.height - copyTop) /
                typography.headlineLineHeight,
            ),
          ),
        ),
        tracking: -0.045,
      });
    }
    if (content.body) {
      drawWrappedText(page, content.body, {
        x: bodyX,
        y: pdfYFromTopBaseline(
          copyTop +
            designBookletCssBaselineOffset(
              typography.bodySize,
              typography.bodyLineHeight,
            ),
        ),
        width: bodyWidth,
        font: fonts.regular,
        size: typography.bodySize,
        lineHeight: typography.bodyLineHeight,
        maxLines: Math.max(
          1,
          Math.floor(frame.height / typography.bodyLineHeight),
        ),
        color: colors.muted,
      });
    }
    return;
  }

  let nextTop = copyTop;
  if (content.headline) {
    const headlineLines = designBookletPdfTextLines(
      safePdfText(content.headline),
      fonts.display,
      typography.headlineSize,
      frame.width,
      -0.045,
    ).slice(
      0,
      Math.max(
        1,
        Math.min(
          3,
          Math.floor(
            (frame.top + frame.height - nextTop) /
              typography.headlineLineHeight,
          ),
        ),
      ),
    );
    drawWrappedText(page, content.headline, {
      x: frame.x,
      y: pdfYFromTopBaseline(
        nextTop +
          designBookletCssBaselineOffset(
            typography.headlineSize,
            typography.headlineLineHeight,
            "display",
          ),
      ),
      width: frame.width,
      font: fonts.display,
      size: typography.headlineSize,
      lineHeight: typography.headlineLineHeight,
      maxLines: Math.max(1, headlineLines.length),
      tracking: -0.045,
    });
    nextTop +=
      Math.max(1, headlineLines.length) * typography.headlineLineHeight + 18;
  }
  if (content.body && nextTop < frame.top + frame.height) {
    drawWrappedText(page, content.body, {
      x: frame.x,
      y: pdfYFromTopBaseline(
        nextTop +
          designBookletCssBaselineOffset(
            typography.bodySize,
            typography.bodyLineHeight,
          ),
      ),
      width: frame.width,
      font: fonts.regular,
      size: typography.bodySize,
      lineHeight: typography.bodyLineHeight,
      maxLines: Math.max(
        1,
        Math.floor(
          (frame.top + frame.height - nextTop) / typography.bodyLineHeight,
        ),
      ),
      color: colors.muted,
    });
  }
}

function drawContentSection(
  page: PDFPage,
  fonts: Fonts,
  section: { heading: string; body: string },
  frame: DesignBookletContentFrame,
  index: number,
  bodySize: number,
  bodyLineHeight: number,
) {
  const topRuleY = PAGE_HEIGHT - frame.top;
  drawRule(page, frame.x, topRuleY, frame.width, colors.ruleStrong, 0.65);
  const top = frame.top + 11;
  const textX = frame.x + 37;
  drawEyebrow(
    page,
    String(index + 1).padStart(2, "0"),
    frame.x,
    pdfYFromTopBaseline(top + 6),
    fonts,
    colors.accent,
    6,
    0.12,
  );
  if (section.heading) {
    drawWrappedText(page, section.heading, {
      x: textX,
      y: pdfYFromTopBaseline(top + 10),
      width: frame.width - 37,
      font: fonts.display,
      size: 13,
      lineHeight: 14,
      maxLines: 2,
      tracking: -0.045,
    });
  }
  if (section.body) {
    drawWrappedText(page, section.body, {
      x: textX,
      y: pdfYFromTopBaseline(
        top + 31 + designBookletCssBaselineOffset(bodySize, bodyLineHeight),
      ),
      width: frame.width - 37,
      font: fonts.regular,
      size: bodySize,
      lineHeight: bodyLineHeight,
      maxLines: Math.max(1, Math.floor((frame.height - 42) / bodyLineHeight)),
      color: colors.muted,
    });
  }
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
  const pdfPage = addPage(pdf);
  const contentPage = resolvedPage.page;
  const layout = resolveDesignBookletContentLayout(contentPage);
  const typography = resolveDesignBookletContentTypography(contentPage);
  const isLight = layout.tone === "light";

  visibleDesignBookletContentImages(contentPage).forEach((placement, index) => {
    const frame = contentFrameToPdf(layout.imageFrames[index]);
    const image = optionalImage(images, placement.assetId);
    if (image) {
      drawImageCover(pdfPage, image, frame, placementFocus(placement));
    } else {
      pdfPage.drawRectangle({ ...frame, color: colors.accent });
    }
    if (!layout.borderless) {
      pdfPage.drawRectangle({
        ...frame,
        borderColor: colors.ruleStrong,
        borderWidth: 0.45,
      });
    }
    drawContentCaption(
      pdfPage,
      fonts,
      placement.caption,
      frame,
      isLight,
      typography.captionSize,
      typography.captionLineHeight,
    );
  });

  if (isLight) {
    pdfPage.drawImage(context.overlays.imagePage, {
      x: 0,
      y: 0,
      width: PAGE_WIDTH,
      height: PAGE_HEIGHT,
    });
  }
  if (layout.textFrame) {
    withPdfClip(pdfPage, contentFrameToPdf(layout.textFrame), () =>
      drawContentCopy(pdfPage, fonts, contentPage, layout.textFrame!),
    );
  }
  if (layout.sectionFrames) {
    contentPage.content.sections.forEach((section, index) => {
      const sectionFrame = layout.sectionFrames![index];
      withPdfClip(pdfPage, contentFrameToPdf(sectionFrame), () =>
        drawContentSection(
          pdfPage,
          fonts,
          section,
          sectionFrame,
          index,
          typography.bodySize,
          typography.bodyLineHeight,
        ),
      );
    });
  }
  drawBrandAt(
    pdfPage,
    fonts,
    DESIGN_BOOKLET_PDF_LEFT,
    pdfYFromTopBaseline(presentation.chrome.header.brandPrimaryBaseline),
    isLight ? white : colors.ink,
  );
  drawRightLabel(
    pdfPage,
    fonts,
    `${layout.category === "story" ? "Design story" : layout.category} / ${String(
      resolvedPage.pageNumber,
    ).padStart(2, "0")}`,
    pdfYFromTopBaseline(presentation.chrome.header.labelBaseline),
    isLight ? white : colors.muted,
  );
  drawFooter(
    pdfPage,
    resolvedPage.pageNumber,
    resolvedPage.pageCount,
    draft.customerName,
    fonts,
    isLight ? "light" : "dark",
  );
}

const DRAWING_AREA = {
  x: presentation.drawing.area.x,
  y: pdfYFromTop(
    presentation.drawing.area.top,
    presentation.drawing.area.height,
  ),
  width: presentation.drawing.area.width,
  height: presentation.drawing.area.height,
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

function drawPdfPageContain(
  page: PDFPage,
  embedded: PDFEmbeddedPage,
  frame: { x: number; y: number; width: number; height: number },
): void {
  page.drawRectangle({
    ...frame,
    color: white,
    borderColor: colors.ruleStrong,
    borderWidth: presentation.drawing.imageBorderWidth,
  });
  const scale = Math.min(
    frame.width / embedded.width,
    frame.height / embedded.height,
  );
  const width = embedded.width * scale;
  const height = embedded.height * scale;
  page.drawPage(embedded, {
    x: frame.x + (frame.width - width) / 2,
    y: frame.y + (frame.height - height) / 2,
    width,
    height,
  });
}

function renderDrawingPage(
  context: PdfRenderContext,
  resolvedPage: {
    pageNumber: number;
    pageCount: number;
    sheetNumber: string;
    page: DesignBookletDrawingPage;
  },
) {
  const { pdf, fonts, images, drawingPdfPages } = context;
  const page = addPage(pdf);

  const layout = DESIGN_BOOKLET_DRAWING_LAYOUTS[resolvedPage.page.layout];
  const drawings = visibleDesignBookletDrawings(resolvedPage.page);
  drawings.forEach((drawing, index) => {
    const frame = drawingSlotFrame(layout.frames[index]);
    const titleHeight = presentation.drawing.caption.reserveHeight;
    const imageFrame = {
      x: frame.x,
      y: frame.y + titleHeight,
      width: frame.width,
      height: frame.height - titleHeight,
    };
    const pdfPage = drawing.pdf
      ? drawingPdfPages[
          drawingPdfPageKey(drawing.pdf.assetId, drawing.pdf.pageNumber)
        ]
      : undefined;
    const image = optionalImage(images, drawing.image.assetId);
    if (pdfPage) {
      drawPdfPageContain(page, pdfPage, imageFrame);
    } else if (image) {
      drawImageContain(
        page,
        image,
        imageFrame,
        white,
        presentation.drawing.imageBorderWidth,
      );
    } else {
      page.drawRectangle({
        ...imageFrame,
        color: white,
        borderColor: colors.ruleStrong,
        borderWidth: presentation.drawing.imageBorderWidth,
      });
    }
    drawRule(
      page,
      frame.x,
      frame.y + titleHeight,
      frame.width,
      colors.ruleStrong,
      presentation.drawing.imageBorderWidth,
    );
    drawEyebrow(
      page,
      `${String(index + 1).padStart(2, "0")} /`,
      frame.x + presentation.drawing.caption.insetX,
      frame.y + presentation.drawing.caption.baselineFromBottom,
      fonts,
      colors.muted,
      presentation.drawing.caption.size * 0.72,
      0.12,
    );
    drawWrappedText(
      page,
      designBookletDrawingTitle(drawing.title).toUpperCase(),
      {
        x: frame.x + 27,
        y: frame.y + presentation.drawing.caption.baselineFromBottom,
        width: frame.width - 27 - presentation.drawing.caption.insetX,
        font: fonts.semibold,
        size: presentation.drawing.caption.size,
        lineHeight: presentation.drawing.caption.lineHeight,
        maxLines: presentation.drawing.caption.maxLines,
        color: colors.ink,
        tracking: 0.06,
      },
    );
  });
  drawDesignBookletDrawingTitleBlock(context, page, resolvedPage);
}

function renderReview(
  context: PdfRenderContext,
  pageNumber: number,
  pageCount: number,
) {
  const { pdf, fonts, draft, images } = context;
  const page = addPage(pdf);
  const imageFrame = presentation.review.image;
  const reviewFrame = {
    x: imageFrame.x,
    y: pdfYFromTop(imageFrame.top, imageFrame.height),
    width: imageFrame.width,
    height: imageFrame.height,
  };
  const reviewImage = optionalImage(images, draft.reviewPage.image.assetId);
  if (reviewImage) {
    drawImageCover(
      page,
      reviewImage,
      reviewFrame,
      placementFocus(draft.reviewPage.image),
    );
  } else {
    page.drawRectangle({ ...reviewFrame, color: colors.accent });
  }
  page.drawImage(context.overlays.reviewEdge, {
    x: imageFrame.x,
    y: pdfYFromTop(imageFrame.top, imageFrame.height),
    width: imageFrame.width,
    height: imageFrame.height,
  });
  page.drawRectangle({
    x: presentation.review.story.x,
    y: 0,
    width: presentation.review.story.width,
    height: PAGE_HEIGHT,
    color: colors.canvas,
  });
  const copyX = presentation.review.copy.x;
  const copyWidth = presentation.review.copy.width;
  drawBrandAt(
    page,
    fonts,
    copyX,
    pdfYFromTopBaseline(presentation.chrome.header.brandPrimaryBaseline),
  );
  drawRightLabel(
    page,
    fonts,
    `Review / ${String(pageNumber).padStart(2, "0")}`,
    pdfYFromTopBaseline(presentation.chrome.header.labelBaseline),
    colors.muted,
  );

  drawEyebrow(
    page,
    DESIGN_BOOKLET_REVIEW_COPY.eyebrow,
    copyX,
    pdfYFromTopBaseline(presentation.review.eyebrow.baseline),
    fonts,
  );
  drawWrappedText(page, DESIGN_BOOKLET_REVIEW_COPY.title, {
    x: copyX,
    y: pdfYFromTopBaseline(presentation.review.title.baseline),
    width: copyWidth,
    font: fonts.display,
    size: presentation.review.title.size,
    lineHeight: presentation.review.title.lineHeight,
    maxLines: presentation.review.title.maxLines,
    tracking: -0.045,
  });
  drawWrappedText(page, DESIGN_BOOKLET_REVIEW_COPY.introduction, {
    x: copyX,
    y: pdfYFromTopBaseline(presentation.review.introduction.baseline),
    width: copyWidth,
    font: fonts.regular,
    size: presentation.review.introduction.size,
    lineHeight: presentation.review.introduction.lineHeight,
    maxLines: presentation.review.introduction.maxLines,
    color: colors.muted,
  });

  DESIGN_BOOKLET_REVIEW_COPY.prompts.forEach((prompt, index) => {
    const promptLayout = presentation.review.prompts[index];
    drawRule(page, copyX, PAGE_HEIGHT - promptLayout.ruleTop, copyWidth);
    const promptTop = promptLayout.ruleTop + promptLayout.paddingTop;
    const promptTextX = copyX + promptLayout.numberWidth + promptLayout.gap;
    const promptTextWidth =
      copyWidth - promptLayout.numberWidth - promptLayout.gap;
    const numberBaseline =
      promptTop +
      designBookletCssBaselineOffset(
        promptLayout.numberSize,
        promptLayout.numberLineHeight,
      );
    const titleBaseline =
      promptTop +
      designBookletCssBaselineOffset(
        promptLayout.titleSize,
        promptLayout.titleLineHeight,
        "display",
      );
    const copyBaseline =
      promptTop +
      promptLayout.titleLineHeight +
      promptLayout.copyMarginTop +
      designBookletCssBaselineOffset(
        promptLayout.copySize,
        promptLayout.copyLineHeight,
      );
    page.drawText(String(index + 1).padStart(2, "0"), {
      x: copyX,
      y: pdfYFromTopBaseline(numberBaseline),
      size: promptLayout.numberSize,
      font: fonts.semibold,
      color: colors.accent,
    });
    drawTrackedText(page, safePdfText(prompt.title), {
      x: promptTextX,
      y: pdfYFromTopBaseline(titleBaseline),
      size: promptLayout.titleSize,
      font: fonts.display,
      color: colors.ink,
      tracking: -0.045,
    });
    drawWrappedText(page, prompt.copy, {
      x: promptTextX,
      y: pdfYFromTopBaseline(copyBaseline),
      width: promptTextWidth,
      font: fonts.regular,
      size: promptLayout.copySize,
      lineHeight: promptLayout.copyLineHeight,
      maxLines: promptLayout.copyMaxLines,
      color: colors.muted,
    });
  });
  drawRule(
    page,
    copyX,
    PAGE_HEIGHT - presentation.review.finalPromptRuleTop,
    copyWidth,
  );

  drawTrackedText(page, safePdfText(DESIGN_BOOKLET_REVIEW_COPY.callToAction), {
    x: copyX,
    y: pdfYFromTopBaseline(presentation.review.callToAction.baseline),
    size: presentation.review.callToAction.size,
    font: fonts.display,
    color: colors.accent,
    tracking: -0.045,
  });
  drawFooter(page, pageNumber, pageCount, draft.customerName, fonts, "split");
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
  documents?: DesignBookletPdfDocuments;
}): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  pdf.setTitle(
    `${safePdfText(input.draft.customerName)} - ${safePdfText(input.draft.projectTitle)}`,
  );
  pdf.setAuthor("Sanctuary Pergolas");
  pdf.setSubject("Landscape concept design booklet");
  pdf.setCreator("Sanctuary Pergolas");

  const [displayBytes, brandBytes, regularBytes, mediumBytes, semiboldBytes] =
    await Promise.all([
      readDesignBookletPdfFont(DESIGN_BOOKLET_PDF_FONT_FILES.display),
      readDesignBookletPdfFont(DESIGN_BOOKLET_PDF_FONT_FILES.brand),
      readDesignBookletPdfFont(DESIGN_BOOKLET_PDF_FONT_FILES.regular),
      readDesignBookletPdfFont(DESIGN_BOOKLET_PDF_FONT_FILES.medium),
      readDesignBookletPdfFont(DESIGN_BOOKLET_PDF_FONT_FILES.semibold),
    ]);
  const fonts: Fonts = {
    display: await pdf.embedFont(displayBytes, { subset: true }),
    brand: await pdf.embedFont(brandBytes, { subset: true }),
    regular: await pdf.embedFont(regularBytes, { subset: true }),
    medium: await pdf.embedFont(mediumBytes, { subset: true }),
    semibold: await pdf.embedFont(semiboldBytes, { subset: true }),
  };
  const [images, drawingPdfPages, overlays] = await Promise.all([
    embedImages(pdf, input.images),
    embedDrawingPdfPages(pdf, input.draft, input.documents ?? {}),
    embedShadeOverlays(pdf),
  ]);
  const context: PdfRenderContext = {
    pdf,
    fonts,
    draft: input.draft,
    content: input.content,
    images,
    drawingPdfPages,
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
