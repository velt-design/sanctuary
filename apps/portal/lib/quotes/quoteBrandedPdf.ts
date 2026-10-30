import "server-only";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "./fontkit";
import { buildPdfQuoteViewModel } from "./quotePdfViewModel";
import {
  QUOTE_PDF_FONT_FILES,
  QUOTE_PDF_WORDMARK_FILE,
  readQuotePdfFont,
  readQuotePdfImage,
} from "./quotePdfAssets";
import { wrapText } from "./pdfText";
import type { QuoteVersionDetail } from "./types";
import type { QuotePdfLayout, QuotePdfLayoutPage } from "./quotePdfLayoutTypes";

const W = 595.28,
  H = 841.89,
  X = 49,
  RIGHT = W - 49,
  WIDTH = RIGHT - X,
  BOTTOM = 76;
const INK = rgb(0.125, 0.133, 0.122),
  MUTED = rgb(0.38, 0.4, 0.36),
  RULE = rgb(0.82, 0.82, 0.78),
  PAPER = rgb(0.984, 0.98, 0.969);
const BODY = 9.6,
  LEADING = 12.8,
  DESC_WIDTH = 291,
  QTY_RIGHT = X + 335,
  UNIT_RIGHT = X + 415;
type Fonts = { regular: PDFFont; medium: PDFFont; semibold: PDFFont };
type Options = {
  collectLayout?: boolean;
  onTiming?: (stage: string, durationMs: number) => void;
};
const clientText = (text: string) =>
  text
    .replace(/\u2014/g, ", ")
    .replace(/\s+/g, " ")
    .trim();

/** New, explicitly frozen Sanctuary quote presentation. No pricing, mutable
 * lookup, model capture, external asset or delivery policy belongs here. */
export async function generateBrandedQuotePdf(
  quote: QuoteVersionDetail,
  options: Options = {},
) {
  let phaseStart = performance.now();
  const phase = (stage: string) => {
    const now = performance.now();
    options.onTiming?.(stage, Number((now - phaseStart).toFixed(1)));
    phaseStart = now;
  };
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  pdf.setTitle(
    `${quote.quoteRef} v${quote.versionNumber} - Sanctuary Pergolas`,
  );
  pdf.setAuthor("Sanctuary Pergolas");
  pdf.setSubject("Customer quote");
  pdf.setCreator("Sanctuary Pergolas");
  const issued = new Date(quote.createdAt);
  if (Number.isFinite(issued.getTime())) {
    pdf.setCreationDate(issued);
    pdf.setModificationDate(issued);
  }
  phase("document");
  const [regular, medium, semibold, wordmark] = await Promise.all([
    readQuotePdfFont(QUOTE_PDF_FONT_FILES.regular),
    readQuotePdfFont(QUOTE_PDF_FONT_FILES.medium),
    readQuotePdfFont(QUOTE_PDF_FONT_FILES.semibold),
    readQuotePdfImage(QUOTE_PDF_WORDMARK_FILE),
  ]);
  phase("assets");
  const f: Fonts = {
    regular: await pdf.embedFont(regular, { subset: true }),
    medium: await pdf.embedFont(medium, { subset: true }),
    semibold: await pdf.embedFont(semibold, { subset: true }),
  };
  phase("fonts");
  if (!wordmark) throw Error("The Sanctuary quote wordmark is unavailable.");
  const logo = await pdf.embedPng(wordmark);
  phase("logo");
  const vm = buildPdfQuoteViewModel(quote),
    layout: QuotePdfLayout = { pages: [] };
  let page: PDFPage;
  let y = 0;
  let entry!: QuotePdfLayoutPage;
  const lines = (value: string, width: number, size = BODY, font = f.regular) =>
    wrapText(font, clientText(value), size, width);
  const draw = (
    value: string,
    x: number,
    baseline: number,
    size = BODY,
    font = f.regular,
    colour = INK,
  ) =>
    page.drawText(clientText(value), {
      x,
      y: baseline,
      size,
      font,
      color: colour,
    });
  const right = (
    value: string,
    x: number,
    baseline: number,
    size = BODY,
    font = f.regular,
    colour = INK,
  ) =>
    draw(
      value,
      x - font.widthOfTextAtSize(clientText(value), size),
      baseline,
      size,
      font,
      colour,
    );
  const rule = (baseline: number, x = X, x2 = RIGHT, width = 0.5) =>
    page.drawLine({
      start: { x, y: baseline },
      end: { x: x2, y: baseline },
      thickness: width,
      color: RULE,
    });
  const record = () => {
    entry.contentBottomY = Math.min(entry.contentBottomY ?? y, y);
  };
  const paragraph = (
    value: string,
    x = X,
    width = WIDTH,
    size = BODY,
    font = f.regular,
    colour = INK,
    leading = LEADING,
  ) => {
    for (const valueLine of lines(value, width, size, font)) {
      draw(valueLine, x, y, size, font, colour);
      y -= leading;
    }
    record();
  };
  function addPage(first = false) {
    page = pdf.addPage([W, H]);
    page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: PAPER });
    entry = {
      hasPageBackground: true,
      hasLeftRail: false,
      pageNumber: pdf.getPageCount(),
      rules: [],
    };
    layout.pages.push(entry);
    const logoWidth = first ? 204 : 148,
      logoHeight = (logoWidth * logo.height) / logo.width;
    page.drawImage(logo, {
      x: X,
      y: H - 42 - logoHeight,
      width: logoWidth,
      height: logoHeight,
    });
    draw("QUOTE", RIGHT - 34, H - 47, 7.8, f.medium, MUTED);
    right(
      `${vm.header.quoteNumber} / V${vm.header.versionNumber}`,
      RIGHT,
      H - 65,
      11.5,
      f.semibold,
    );
    const headingRule = H - (first ? 91 : 79);
    rule(headingRule);
    y = headingRule - (first ? 28 : 20);
    if (!first) {
      paragraph(vm.header.projectName, X, WIDTH, 10.5, f.medium, INK, 14);
      y -= 13;
      return;
    }
    paragraph(vm.header.projectName, X, WIDTH, 20, f.medium, INK, 25);
    y -= 8;
    const metaTop = y;
    draw("PREPARED FOR", X, y, 7.8, f.medium, MUTED);
    draw("QUOTE DETAILS", X + 330, y, 7.8, f.medium, MUTED);
    y -= 18;
    const clientTop = y;
    if (vm.client.name) {
      entry.headerClientName = { text: vm.client.name, xRight: X + 300, y };
      paragraph(vm.client.name, X, 300, 10.2, f.medium, INK, 13.5);
    }
    const addressY = y;
    for (const address of vm.client.addressLines)
      paragraph(address, X, 300, BODY, f.regular, MUTED);
    if (vm.client.addressLines.length)
      entry.headerClientAddress = {
        lines: vm.client.addressLines,
        xRight: X + 300,
        y: addressY,
      };
    const leftBottom = y;
    let dateY = clientTop;
    for (const value of [
      vm.issueDate ? `Issued ${vm.issueDate}` : null,
      vm.expiryDate ? `Valid until ${vm.expiryDate}` : null,
      "Currency NZD",
    ].filter(Boolean) as string[]) {
      for (const textLine of lines(value, WIDTH - 330)) {
        draw(textLine, X + 330, dateY, BODY, f.regular, MUTED);
        dateY -= LEADING;
      }
    }
    y = Math.min(leftBottom, dateY, metaTop - 45) - 8;
    if (vm.intro) {
      paragraph(vm.intro, X, WIDTH, BODY, f.regular, MUTED);
      y -= 8;
    }
    record();
  }
  function ensure(height: number) {
    if (y - height < BOTTOM) {
      addPage();
      return true;
    }
    return false;
  }
  function tableHeading(continued = false) {
    ensure(58);
    draw(
      continued ? "SCOPE OF WORK / CONTINUED" : "SCOPE OF WORK",
      X,
      y,
      8,
      f.medium,
      MUTED,
    );
    right(
      "Unit prices and amounts include GST",
      RIGHT,
      y,
      8.3,
      f.regular,
      MUTED,
    );
    y -= 22;
    draw("Description", X, y, 8.8, f.medium, MUTED);
    right("Qty", QTY_RIGHT, y, 8.8, f.medium, MUTED);
    right("Unit price", UNIT_RIGHT, y, 8.8, f.medium, MUTED);
    right("Amount NZD", RIGHT, y, 8.8, f.medium, MUTED);
    const baseline = y;
    y -= 8;
    rule(y, X, RIGHT, 0.65);
    entry.tableBounds = {
      x0: X,
      x1: RIGHT,
      headerBaselineY: baseline,
      headerRuleY: y,
      rowRuleYs: [],
      topY: baseline + 25,
      bottomY: y,
    };
    y -= 17;
  }
  addPage(true);
  tableHeading();
  for (const item of vm.items) {
    const rows: {
      text: string;
      font: PDFFont;
      size: number;
      indent: number;
      leading: number;
    }[] = [];
    for (const value of lines(item.heading, DESC_WIDTH, 10.1, f.medium))
      rows.push({
        text: value,
        font: f.medium,
        size: 10.1,
        indent: 0,
        leading: 13.2,
      });
    for (const detail of item.entries) {
      const font = detail.kind === "section" ? f.medium : f.regular;
      for (const [index, value] of lines(
        detail.text,
        DESC_WIDTH - 10,
        BODY,
        font,
      ).entries())
        rows.push({
          text: detail.kind === "bullet" && index === 0 ? "- " + value : value,
          font,
          size: BODY,
          indent: 10,
          leading: LEADING,
        });
    }
    const height = rows.reduce((sum, row) => sum + row.leading, 0) + 10;
    if (height < H - 180 && y - height < BOTTOM) {
      addPage();
      tableHeading(true);
    }
    let first = true;
    for (const row of rows) {
      if (y - row.leading < BOTTOM) {
        addPage();
        tableHeading(true);
      }
      draw(
        row.text,
        X + row.indent,
        y,
        row.size,
        row.font,
        row.indent ? MUTED : INK,
      );
      if (first) {
        (entry.rowHeadingBounds ??= []).push({
          baselineY: y,
          topY: y + row.font.heightAtSize(row.size, { descender: false }),
          precedingRuleY:
            entry.tableBounds?.rowRuleYs.at(-1) ??
            entry.tableBounds!.headerRuleY,
        });
        right(item.qtyText, QTY_RIGHT, y, BODY);
        right(item.unitPrice, UNIT_RIGHT, y, BODY);
        right(item.amount, RIGHT, y, BODY, f.medium);
        first = false;
      }
      y -= row.leading;
      record();
    }
    // Balance the separator between the previous descender and next heading.
    const separatorY = y + 5;
    rule(separatorY);
    entry.tableBounds?.rowRuleYs.push(separatorY);
    if (entry.tableBounds) entry.tableBounds.bottomY = separatorY;
    y -= 10;
    record();
  }
  const paymentLines = lines(vm.deposit.nextStep, WIDTH),
    paymentHeight = 19 + paymentLines.length * LEADING;
  // Price summary and actual first-payment wording remain one coherent group.
  ensure(106 + paymentHeight);
  rule(y);
  const summaryTop = y;
  y -= 20;
  draw("PRICE SUMMARY", X, y, 8, f.medium, MUTED);
  const subtotalY = y;
  draw("Subtotal excl. GST", X + 270, y, 9, f.regular, MUTED);
  right(vm.totals.ex, RIGHT, y, 10.5);
  y -= 18;
  const gstY = y;
  draw("GST 15%", X + 270, y, 9, f.regular, MUTED);
  right(vm.totals.gst, RIGHT, y, 10.5);
  y -= 13;
  rule(y, X + 270, RIGHT);
  const above = y;
  y -= 23;
  const totalY = y;
  draw("Total incl. GST", X + 270, y + 2, 10, f.medium);
  right(vm.totals.inc, RIGHT, y, 17, f.semibold);
  y -= 12;
  rule(y, X + 270, RIGHT);
  const below = y;
  y -= 20;
  entry.totalsBounds = {
    x0: X + 270,
    x1: RIGHT,
    headerBaselineY: subtotalY,
    ceilingRuleY: summaryTop,
    subtotalBaselineY: subtotalY,
    gstBaselineY: gstY,
    totalBaselineY: totalY,
    aboveTotalRuleY: above,
    belowTotalRuleY: below,
  };
  const paymentTop = y;
  draw("PAYMENT AFTER ACCEPTANCE", X, y, 8, f.medium, MUTED);
  y -= 18;
  for (const value of paymentLines) {
    draw(value, X, y, BODY, f.regular);
    y -= LEADING;
  }
  entry.paymentBlock = {
    topY: paymentTop,
    bottomY: y,
    lineCount: paymentLines.length,
  };
  y -= 17;
  record();
  if (vm.terms.length) {
    const prepared = vm.terms.map((value) => lines(value, WIDTH - 12, 9.2)),
      height =
        18 +
        prepared.reduce(
          (sum, value, index) => sum + value.length * 12.3 + (index ? 3 : 0),
          0,
        );
    ensure((height < 120 ? height : 48) + 5);
    y -= 5;
    entry.termsHeadingY = y;
    draw("TERMS", X, y, 8, f.medium, MUTED);
    y -= 18;
    for (const term of prepared) {
      if (term.length * 12.3 < 120 && y - term.length * 12.3 < BOTTOM) {
        addPage();
        draw("TERMS / CONTINUED", X, y, 8, f.medium, MUTED);
        y -= 18;
      }
      for (const [index, value] of term.entries()) {
        if (y - 12.3 < BOTTOM) {
          addPage();
          draw("TERMS / CONTINUED", X, y, 8, f.medium, MUTED);
          y -= 18;
        }
        if (index === 0) draw("-", X, y, 9.2, f.regular, MUTED);
        draw(value, X + 12, y, 9.2);
        y -= 12.3;
        entry.termLineCount = (entry.termLineCount ?? 0) + 1;
        record();
      }
      y -= 3;
    }
  }
  pdf.getPages().forEach((value, index) => {
    page = value;
    rule(44);
    draw(
      `${vm.footer.website} / ${vm.footer.email}`,
      X,
      27,
      7.8,
      f.regular,
      MUTED,
    );
    right(
      `${index + 1} / ${pdf.getPageCount()}`,
      RIGHT,
      27,
      7.8,
      f.regular,
      MUTED,
    );
  });
  phase("layout");
  const bytes = await pdf.save();
  phase("serialization");
  return { bytes, layout: options.collectLayout ? layout : null };
}
