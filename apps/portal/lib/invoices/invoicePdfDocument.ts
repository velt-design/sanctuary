import "server-only";

import { PDFDocument, type PDFImage, type PDFPage } from "pdf-lib";
import { paymentDetailsLines } from "../payments/paymentDetails";
import {
  buildDepositInvoiceArtifactViewModel,
  type DepositInvoiceArtifactInput,
} from "./invoiceArtifactViewModel";
import {
  INVOICE_PDF_FONT_FILES,
  INVOICE_PDF_LOGO_FILE,
  readInvoicePdfFont,
  readInvoicePdfImage,
} from "./invoicePdfAssets";
import fontkit from "./invoicePdfFontkit";
import {
  brandColors,
  buildPaymentFlow,
  CONTENT_BOTTOM_Y,
  CONTENT_W,
  CONTENT_X0,
  CONTENT_X1,
  drawContinuationHeader,
  drawFirstPageHeader,
  drawPageFooter,
  drawRightAligned,
  drawText,
  fitTextSize,
  FONT_SIZES,
  LINE_HEIGHTS,
  PAGE_HEIGHT,
  PAGE_WIDTH,
  prepareMetaLines,
  RAIL_WIDTH,
  wrapText,
  type DepositInvoicePdfLayout,
  type PaymentFlowItem,
  type PdfFonts,
} from "./invoicePdfLayout";

type GeneratePdfOptions = {
  collectLayout?: boolean;
  paymentLines?: readonly string[];
};

export async function renderDepositInvoicePdfDocument(
  data: DepositInvoiceArtifactInput,
  options: GeneratePdfOptions = {},
): Promise<{ bytes: Uint8Array; layout: DepositInvoicePdfLayout }> {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const documentLabel = data.paymentTermLabel ? 'Invoice' : 'Deposit invoice';
  pdf.setTitle(`${data.invoiceRef} - ${documentLabel} - Sanctuary Pergolas`);
  pdf.setAuthor("Sanctuary Pergolas");
  pdf.setSubject(
    `${documentLabel} for quote ${data.quoteRef} v${data.quoteVersionNumber}`,
  );
  pdf.setCreator("Sanctuary Pergolas");
  pdf.setKeywords([
    "Sanctuary Pergolas",
    "invoice",
    data.invoiceRef,
    data.quoteRef,
  ]);

  const [regularData, mediumData, semiboldData, logoBytes] = await Promise.all([
    readInvoicePdfFont(INVOICE_PDF_FONT_FILES.regular),
    readInvoicePdfFont(INVOICE_PDF_FONT_FILES.medium),
    readInvoicePdfFont(INVOICE_PDF_FONT_FILES.semibold),
    readInvoicePdfImage(INVOICE_PDF_LOGO_FILE),
  ]);

  const fonts: PdfFonts = {
    regular: await pdf.embedFont(regularData, { subset: true }),
    medium: await pdf.embedFont(mediumData, { subset: true }),
    semibold: await pdf.embedFont(semiboldData, { subset: true }),
  };

  let logo: PDFImage | null = null;
  if (logoBytes) {
    try {
      logo = await pdf.embedPng(logoBytes);
    } catch {
      logo = null;
    }
  }

  const vm = buildDepositInvoiceArtifactViewModel(
    data,
    options.paymentLines ?? paymentDetailsLines("invoice"),
  );
  const layout: DepositInvoicePdfLayout = { pages: [] };

  let page!: PDFPage;
  let pageIndex = -1;
  let cursorY = 0;

  const currentLayoutPage = () => layout.pages[pageIndex]!;

  const recordBottom = (value: number) => {
    const layoutPage = currentLayoutPage();
    layoutPage.contentBottomY =
      typeof layoutPage.contentBottomY === "number"
        ? Math.min(layoutPage.contentBottomY, value)
        : value;
  };

  const addPage = (first: boolean) => {
    page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    pageIndex += 1;
    layout.pages.push({
      pageNumber: pageIndex + 1,
      hasPageBackground: true,
      hasLeftRail: true,
      paymentSegmentCount: 0,
    });

    page.drawRectangle({
      x: 0,
      y: 0,
      width: PAGE_WIDTH,
      height: PAGE_HEIGHT,
      color: brandColors.paper,
    });
    page.drawRectangle({
      x: 0,
      y: 0,
      width: RAIL_WIDTH,
      height: PAGE_HEIGHT,
      color: brandColors.accent,
    });

    cursorY = first
      ? drawFirstPageHeader(page, vm, fonts, logo)
      : drawContinuationHeader(page, vm, fonts, logo);
  };

  const ensureSpace = (height: number) => {
    if (cursorY - height >= CONTENT_BOTTOM_Y) return;
    addPage(false);
  };

  const drawSectionLabel = (label: string) => {
    drawText(page, label.toUpperCase(), {
      x: CONTENT_X0,
      y: cursorY,
      size: FONT_SIZES.eyebrow,
      font: fonts.medium,
      color: brandColors.accent,
    });
    cursorY -= 20;
  };

  addPage(true);

  const summaryReferenceLines = wrapText(
    fonts.medium,
    vm.payment.reference,
    FONT_SIZES.summaryValue,
    184,
  );
  const summaryHeight = Math.max(
    112,
    70 + summaryReferenceLines.length * LINE_HEIGHTS.summary,
  );
  ensureSpace(summaryHeight + 24);
  const summaryTopY = cursorY;
  const summaryBottomY = summaryTopY - summaryHeight;
  page.drawRectangle({
    x: CONTENT_X0,
    y: summaryBottomY,
    width: CONTENT_W,
    height: summaryHeight,
    color: brandColors.canvas,
    borderColor: brandColors.rule,
    borderWidth: 0.6,
  });
  page.drawRectangle({
    x: CONTENT_X0,
    y: summaryBottomY,
    width: 4,
    height: summaryHeight,
    color: brandColors.accent,
  });

  const summaryLeftX = CONTENT_X0 + 20;
  const summaryDividerX = CONTENT_X0 + 288;
  drawText(page, "AMOUNT DUE (INCL. GST)", {
    x: summaryLeftX,
    y: summaryTopY - 26,
    size: FONT_SIZES.amountLabel,
    font: fonts.medium,
    color: brandColors.accent,
  });
  const amountSize = fitTextSize(
    fonts.semibold,
    vm.totals.totalIncGst,
    FONT_SIZES.amount,
    18,
    summaryDividerX - summaryLeftX - 24,
  );
  drawText(page, vm.totals.totalIncGst, {
    x: summaryLeftX,
    y: summaryTopY - 66,
    size: amountSize,
    font: fonts.semibold,
  });
  drawText(page, vm.deposit.label, {
    x: summaryLeftX,
    y: summaryTopY - 91,
    size: FONT_SIZES.bodySmall,
    font: fonts.regular,
    color: brandColors.muted,
  });

  page.drawLine({
    start: { x: summaryDividerX, y: summaryBottomY + 17 },
    end: { x: summaryDividerX, y: summaryTopY - 17 },
    thickness: 0.5,
    color: brandColors.rule,
  });
  const summaryRightX = summaryDividerX + 20;
  drawText(page, "DUE DATE", {
    x: summaryRightX,
    y: summaryTopY - 25,
    size: FONT_SIZES.amountLabel,
    font: fonts.medium,
    color: brandColors.accent,
  });
  drawText(page, vm.dates.due, {
    x: summaryRightX,
    y: summaryTopY - 43,
    size: FONT_SIZES.summaryValue,
    font: fonts.medium,
  });
  drawText(page, "PAYMENT REFERENCE", {
    x: summaryRightX,
    y: summaryTopY - 67,
    size: FONT_SIZES.amountLabel,
    font: fonts.medium,
    color: brandColors.accent,
  });
  let summaryReferenceY = summaryTopY - 85;
  for (const line of summaryReferenceLines) {
    drawText(page, line, {
      x: summaryRightX,
      y: summaryReferenceY,
      size: FONT_SIZES.summaryValue,
      font: fonts.medium,
    });
    summaryReferenceY -= LINE_HEIGHTS.summary;
  }
  currentLayoutPage().hasPaymentSummary = true;
  recordBottom(summaryBottomY);
  cursorY = summaryBottomY - 24;

  const columnGap = 24;
  const columnWidths = [
    144,
    164,
    CONTENT_W - 144 - 164 - columnGap * 2,
  ] as const;
  const columnXs = [
    CONTENT_X0,
    CONTENT_X0 + columnWidths[0] + columnGap,
    CONTENT_X0 + columnWidths[0] + columnGap + columnWidths[1] + columnGap,
  ] as const;
  const metaColumns = prepareMetaLines(vm, fonts, columnWidths);
  const metaLineCount = Math.max(
    ...metaColumns.map((column) => column.lines.length),
  );
  const metaHeight = 35 + metaLineCount * LINE_HEIGHTS.meta;
  ensureSpace(metaHeight + 24);
  const metaTopY = cursorY;
  page.drawLine({
    start: { x: CONTENT_X0, y: metaTopY },
    end: { x: CONTENT_X1, y: metaTopY },
    thickness: 0.6,
    color: brandColors.ruleStrong,
  });
  metaColumns.forEach((column, index) => {
    const x = columnXs[index]!;
    drawText(page, column.label.toUpperCase(), {
      x,
      y: metaTopY - 17,
      size: FONT_SIZES.eyebrow,
      font: fonts.medium,
      color: brandColors.accent,
    });
    let lineY = metaTopY - 36;
    for (const line of column.lines) {
      drawText(page, line.text, {
        x,
        y: lineY,
        size:
          line.font === fonts.regular
            ? FONT_SIZES.bodySmall
            : FONT_SIZES.metaValue,
        font: line.font,
        color: line.color,
      });
      lineY -= LINE_HEIGHTS.meta;
    }
  });
  const metaBottomY = metaTopY - metaHeight;
  page.drawLine({
    start: { x: CONTENT_X0, y: metaBottomY },
    end: { x: CONTENT_X1, y: metaBottomY },
    thickness: 0.5,
    color: brandColors.rule,
  });
  recordBottom(metaBottomY);
  cursorY = metaBottomY - 24;

  const explanationLines = wrapText(
    fonts.regular,
    vm.deposit.explanation,
    FONT_SIZES.body,
    CONTENT_W,
  );
  const explanationHeight = 20 + explanationLines.length * LINE_HEIGHTS.body;
  ensureSpace(explanationHeight + 18);
  drawSectionLabel("Payment request");
  for (const line of explanationLines) {
    drawText(page, line, {
      x: CONTENT_X0,
      y: cursorY,
      size: FONT_SIZES.body,
      font: fonts.regular,
      color: brandColors.muted,
    });
    cursorY -= LINE_HEIGHTS.body;
  }
  recordBottom(cursorY);
  cursorY -= 18;

  const calculationRows = [
    ["Source quote total (incl. GST)", vm.totals.quoteTotalIncGst],
    [vm.deposit.label, vm.deposit.basis],
    ["Subtotal (excl. GST)", vm.totals.totalExGst],
    ["GST (15%)", vm.totals.gst],
  ] as const;
  const calculationHeight = 20 + calculationRows.length * 22 + 40;
  ensureSpace(calculationHeight + 22);
  drawSectionLabel("Calculation");
  const calculationTopY = cursorY;
  page.drawLine({
    start: { x: CONTENT_X0, y: calculationTopY },
    end: { x: CONTENT_X1, y: calculationTopY },
    thickness: 0.8,
    color: brandColors.ruleStrong,
  });
  cursorY -= 18;
  for (const [label, value] of calculationRows) {
    drawText(page, label, {
      x: CONTENT_X0,
      y: cursorY,
      size: FONT_SIZES.tableLabel,
      font: fonts.regular,
      color: brandColors.muted,
    });
    const valueSize = fitTextSize(
      fonts.medium,
      value,
      FONT_SIZES.tableValue,
      7,
      160,
    );
    drawRightAligned(page, value, CONTENT_X1, cursorY, valueSize, fonts.medium);
    cursorY -= 22;
  }
  page.drawLine({
    start: { x: CONTENT_X0, y: cursorY + 7 },
    end: { x: CONTENT_X1, y: cursorY + 7 },
    thickness: 0.7,
    color: brandColors.ruleStrong,
  });
  drawText(page, "AMOUNT DUE (INCL. GST)", {
    x: CONTENT_X0,
    y: cursorY - 18,
    size: FONT_SIZES.totalLabel,
    font: fonts.semibold,
  });
  const totalSize = fitTextSize(
    fonts.semibold,
    vm.totals.totalIncGst,
    FONT_SIZES.totalValue,
    10,
    190,
  );
  drawRightAligned(
    page,
    vm.totals.totalIncGst,
    CONTENT_X1,
    cursorY - 20,
    totalSize,
    fonts.semibold,
  );
  cursorY -= 35;
  page.drawLine({
    start: { x: CONTENT_X0, y: cursorY },
    end: { x: CONTENT_X1, y: cursorY },
    thickness: 0.5,
    color: brandColors.rule,
  });
  currentLayoutPage().hasCalculation = true;
  recordBottom(cursorY);
  cursorY -= 22;

  const paymentItems = buildPaymentFlow(vm, fonts);
  let paymentIndex = 0;
  let paymentSegmentIndex = 0;
  while (paymentIndex < paymentItems.length) {
    if (cursorY - 86 < CONTENT_BOTTOM_Y) addPage(false);

    const segmentLabel =
      paymentSegmentIndex === 0
        ? "Payment instructions"
        : "Payment instructions / continued";
    drawSectionLabel(segmentLabel);

    const availableBoxHeight = cursorY - CONTENT_BOTTOM_Y;
    const segmentItems: PaymentFlowItem[] = [];
    let contentHeight = 0;
    while (paymentIndex < paymentItems.length) {
      const item = paymentItems[paymentIndex]!;
      if (
        segmentItems.length > 0 &&
        contentHeight + item.height + 20 > availableBoxHeight
      ) {
        break;
      }
      segmentItems.push(item);
      contentHeight += item.height;
      paymentIndex += 1;
    }

    if (!segmentItems.length) {
      addPage(false);
      continue;
    }

    const boxHeight = contentHeight + 20;
    const boxTopY = cursorY;
    const boxBottomY = boxTopY - boxHeight;
    page.drawRectangle({
      x: CONTENT_X0,
      y: boxBottomY,
      width: CONTENT_W,
      height: boxHeight,
      color: brandColors.canvas,
      borderColor: brandColors.rule,
      borderWidth: 0.6,
    });
    page.drawRectangle({
      x: CONTENT_X0,
      y: boxBottomY,
      width: 4,
      height: boxHeight,
      color: brandColors.accent,
    });

    const innerX = CONTENT_X0 + 18;
    let itemY = boxTopY - 14;
    for (const item of segmentItems) {
      if (item.kind === "spacer") {
        itemY -= item.height;
        continue;
      }
      drawText(page, item.text, {
        x: innerX,
        y: itemY,
        size: item.kind === "note" ? FONT_SIZES.bodySmall : FONT_SIZES.body,
        font: fonts.regular,
        color: item.kind === "note" ? brandColors.muted : brandColors.ink,
      });
      itemY -= item.height;
    }

    currentLayoutPage().paymentSegmentCount += 1;
    recordBottom(boxBottomY);
    cursorY = boxBottomY - 20;
    paymentSegmentIndex += 1;
  }

  const pageCount = pdf.getPageCount();
  pdf.getPages().forEach((pdfPage, index) => {
    drawPageFooter(pdfPage, vm, fonts, index + 1, pageCount);
  });

  return {
    bytes: await pdf.save(),
    layout,
  };
}
