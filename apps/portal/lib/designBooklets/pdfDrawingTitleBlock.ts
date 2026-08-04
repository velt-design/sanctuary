import type { PDFPage } from "pdf-lib";
import {
  DESIGN_BOOKLET_DRAWING_STATUS,
  formatDesignBookletIssueDate,
  normalizeDesignBookletSheetTitle,
} from "./pageModel";
import {
  DESIGN_BOOKLET_PDF_COLORS,
  DESIGN_BOOKLET_PDF_PAGE_SIZE,
  drawDesignBookletEyebrow as drawEyebrow,
  drawDesignBookletRule as drawRule,
  drawDesignBookletTrackedText as drawTrackedText,
  drawDesignBookletWrappedText as drawWrappedText,
  designBookletPdfTextWidth,
  safeDesignBookletPdfText as safePdfText,
  type DesignBookletPdfFonts as Fonts,
} from "./pdfLayout";
import { DESIGN_BOOKLET_PRESENTATION } from "./presentation";
import type {
  DesignBookletContentCatalog,
  DesignBookletDraft,
  DesignBookletDrawingPage,
} from "./types";

type ResolvedDrawingPage = {
  pageNumber: number;
  pageCount: number;
  sheetNumber: string;
  page: DesignBookletDrawingPage;
};

type DrawingTitleBlockContext = {
  draft: DesignBookletDraft;
  content: DesignBookletContentCatalog;
  fonts: Fonts;
};

const colors = DESIGN_BOOKLET_PDF_COLORS;
const { height: PAGE_HEIGHT } = DESIGN_BOOKLET_PDF_PAGE_SIZE;
const block = DESIGN_BOOKLET_PRESENTATION.drawing.titleBlock;

function pdfYFromTopBaseline(topBaseline: number): number {
  return PAGE_HEIGHT - topBaseline;
}

export function drawDesignBookletDrawingTitleBlock(
  context: DrawingTitleBlockContext,
  pdfPage: PDFPage,
  resolvedPage: ResolvedDrawingPage,
) {
  const { draft, content, fonts } = context;
  const top = PAGE_HEIGHT - block.top;
  const bottom = top - block.height;
  const columns = [
    block.titleColumnWidth,
    block.projectColumnWidth,
    block.designColumnWidth,
    block.metaColumnWidth,
  ];

  pdfPage.drawRectangle({
    x: block.x,
    y: bottom,
    width: block.width,
    height: block.height,
    color: colors.canvas,
  });
  drawRule(
    pdfPage,
    block.x,
    top,
    block.width,
    colors.ink,
    block.outerRuleWidth,
  );
  drawRule(
    pdfPage,
    block.x,
    bottom,
    block.width,
    colors.ink,
    block.outerRuleWidth,
  );

  let dividerX = block.x;
  for (const width of columns.slice(0, -1)) {
    dividerX += width;
    pdfPage.drawLine({
      start: { x: dividerX, y: bottom },
      end: { x: dividerX, y: top },
      thickness: block.ruleWidth,
      color: colors.ruleStrong,
    });
  }

  const titleX = block.x + block.paddingX;
  const brand = "SANCTUARY";
  drawTrackedText(pdfPage, brand, {
    x: titleX,
    y: pdfYFromTopBaseline(block.top + 15),
    font: fonts.brand,
    size: block.brandSize,
    color: colors.accent,
    tracking: 0.08,
  });
  drawTrackedText(pdfPage, "PERGOLAS / ARCHITECTURAL CONCEPT", {
    x:
      titleX +
      designBookletPdfTextWidth(brand, fonts.brand, block.brandSize, 0.08) +
      7,
    y: pdfYFromTopBaseline(block.top + 15),
    font: fonts.semibold,
    size: block.brandDescriptorSize,
    color: colors.muted,
    tracking: 0.12,
  });
  drawWrappedText(
    pdfPage,
    normalizeDesignBookletSheetTitle(resolvedPage.page.pageTitle),
    {
      x: titleX,
      y: pdfYFromTopBaseline(block.top + 45),
      width: block.titleColumnWidth - block.paddingX * 2,
      font: fonts.display,
      size: block.titleSize,
      lineHeight: block.titleLineHeight,
      maxLines: 2,
      color: colors.ink,
      tracking: -0.025,
    },
  );
  drawTrackedText(pdfPage, DESIGN_BOOKLET_DRAWING_STATUS.toUpperCase(), {
    x: titleX,
    y: pdfYFromTopBaseline(block.top + 84),
    font: fonts.semibold,
    size: block.statusSize,
    color: colors.muted,
    tracking: 0.08,
  });

  function detailColumn(
    x: number,
    first: { label: string; value: string },
    second: { label: string; value: string },
    width: number,
  ) {
    for (const [index, detail] of [first, second].entries()) {
      const rowTop = block.top + 15 + index * 43;
      drawEyebrow(
        pdfPage,
        detail.label,
        x,
        pdfYFromTopBaseline(rowTop),
        fonts,
        colors.muted,
        block.labelSize,
        0.12,
      );
      drawWrappedText(pdfPage, detail.value, {
        x,
        y: pdfYFromTopBaseline(rowTop + 13),
        width,
        font: fonts.semibold,
        size: block.valueSize,
        lineHeight: block.valueLineHeight,
        maxLines: 2,
        color: colors.ink,
      });
    }
  }

  const projectX = block.x + block.titleColumnWidth + block.paddingX;
  detailColumn(
    projectX,
    { label: "Project", value: draft.projectTitle },
    { label: "Prepared for", value: draft.customerName },
    block.projectColumnWidth - block.paddingX * 2,
  );
  const designX =
    block.x +
    block.titleColumnWidth +
    block.projectColumnWidth +
    block.paddingX;
  detailColumn(
    designX,
    {
      label: "Roof form",
      value: content.roofForms[draft.roofFormId].name,
    },
    {
      label: "Roofing",
      value: content.materials[draft.materialId].label,
    },
    block.designColumnWidth - block.paddingX * 2,
  );

  const metaX =
    block.x +
    block.titleColumnWidth +
    block.projectColumnWidth +
    block.designColumnWidth +
    block.paddingX;
  const metaWidth = block.metaColumnWidth - block.paddingX * 2;
  drawEyebrow(
    pdfPage,
    "Sheet",
    metaX,
    pdfYFromTopBaseline(block.top + 14),
    fonts,
    colors.muted,
    block.labelSize,
    0.12,
  );
  drawTrackedText(pdfPage, resolvedPage.sheetNumber, {
    x: metaX,
    y: pdfYFromTopBaseline(block.top + 39),
    font: fonts.display,
    size: block.sheetSize,
    color: colors.ink,
    tracking: -0.04,
  });

  const metadata = [
    ["REV", resolvedPage.page.revision],
    ["ISSUED", formatDesignBookletIssueDate(resolvedPage.page.issueDate)],
    [
      "BOOKLET",
      `${String(resolvedPage.pageNumber).padStart(2, "0")} / ${String(
        resolvedPage.pageCount,
      ).padStart(2, "0")}`,
    ],
  ] as const;
  metadata.forEach(([label, value], index) => {
    const baseline = block.top + 61 + index * 11;
    drawEyebrow(
      pdfPage,
      label,
      metaX,
      pdfYFromTopBaseline(baseline),
      fonts,
      colors.muted,
      block.labelSize,
      0.08,
    );
    const safeValue = safePdfText(value);
    drawTrackedText(pdfPage, safeValue, {
      x:
        metaX +
        metaWidth -
        designBookletPdfTextWidth(safeValue, fonts.semibold, block.statusSize),
      y: pdfYFromTopBaseline(baseline),
      font: fonts.semibold,
      size: block.statusSize,
      color: colors.ink,
    });
  });
}
