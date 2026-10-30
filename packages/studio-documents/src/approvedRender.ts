import { PDFDocument, type PDFPage } from "pdf-lib";
import {
  studioDocumentPages,
  type StudioClientDocumentSource,
  type StudioDocumentProduct,
} from "./contract";
import { fonts as documentFonts } from "./assets";
import {
  PAPER,
  titleBar,
  drawingHeading,
  text,
  line,
  wrapped,
  boundedText,
  INK,
  MUTED,
  type Fonts,
} from "./layout";
import { approvedDrawingFrame } from "./approvedLayout";
import { centredDrawingGroup } from "./approvedDrawingGroup";
import {
  approvedRoofPlan,
  approvedIsometric,
  approvedElevation,
  approvedLighting,
  approvedBlindPlan,
  approvedBlindElevations,
} from "./approvedSheets";
import { drawCover, drawOverview } from "./refinedRender";
import { compactDocumentSheetTitle, documentTextLines } from "./textLayout";
import { refinedCoverLayout } from "./refinedCover";
import { approvedRoofSurfaces } from "./approvedRoofSurfaces";

function approvedCover(
  page: PDFPage,
  source: StudioClientDocumentSource,
  fonts: Fonts,
) {
  const sheets = studioDocumentPages(source);
  if (sheets.length <= 65) {
    const layout = refinedCoverLayout(
      source,
      sheets,
      fonts.regular,
      fonts.semibold,
    );
    if (layout.ordinary) {
      drawCover(page, source, fonts, layout);
      return;
    }
    const top = layout.registerTop + 20,
      rows = Math.floor((700 - top) / 12.5),
      columns = Math.ceil((sheets.length - 1) / rows);
    if (rows > 0 && columns <= 3) {
      const width = 324 / Math.max(1, columns);
      layout.register = [
        {
          sheet: sheets[0],
          x: 824,
          y: layout.registerTop,
          label: sheets[0].label,
          width: 297,
          size: 8.8,
        },
        ...sheets.slice(1).map((sheet, index) => ({
          sheet,
          x: 824 + Math.floor(index / rows) * width,
          y: top + (index % rows) * 12.5,
          label: compactDocumentSheetTitle(source, sheet),
          width: width - 28,
          size: 8.8,
        })),
      ];
      drawCover(page, source, fonts, layout);
      return;
    }
  }
  // Exceptional complete jobs use the whole page for their register. Full
  // product names stay on the individual sheets rather than being truncated.
  const titleSize =
    documentTextLines(source.projectName, 1108, 28, fonts.semibold).length > 4
      ? 20
      : 28;
  const titleLeading = titleSize + 4;
  const titleRows = documentTextLines(
      source.projectName,
      1108,
      titleSize,
      fonts.semibold,
    ),
    titleBottom = 36 + titleRows.length * titleLeading;
  boundedText(
    page,
    source.projectName,
    42,
    36,
    1108,
    titleRows.length * titleLeading,
    titleSize,
    fonts.semibold,
    INK,
    titleLeading,
  );
  text(page, "Design booklet", 42, titleBottom + 8, 16, fonts.medium);
  line(page, 42, titleBottom + 42, 1150, titleBottom + 42);
  drawOverview(
    page,
    source,
    fonts,
    { x: 65, y: titleBottom + 60, width: 1060, height: 128 },
    true,
  );
  const top = titleBottom + 230,
    rows = Math.max(1, Math.floor((710 - top) / 14)),
    columns = Math.ceil((sheets.length - 1) / rows),
    width = 1108 / columns;
  if (width < 100)
    throw Error("The complete drawing register exceeds A3 capacity");
  text(page, "DRAWING REGISTER", 42, top - 45, 10, fonts.medium, MUTED);
  text(page, sheets[0].code, 42, top - 20, 8.8, fonts.semibold);
  text(page, sheets[0].label, 71, top - 20, 8.1, fonts.medium);
  sheets.slice(1).forEach((sheet, index) => {
    const x = 42 + Math.floor(index / rows) * width,
      y = top + (index % rows) * 14;
    text(page, sheet.code, x, y, 8.8, fonts.semibold);
    boundedText(
      page,
      compactDocumentSheetTitle(source, sheet),
      x + 29,
      y,
      width - 34,
      12,
      8.1,
      fonts.medium,
      INK,
      12,
    );
  });
}
export function approvedDrawingNote(
  kind: string,
  product: StudioDocumentProduct,
) {
  const surfaces = approvedRoofSurfaces(product);
  if (kind === "plan")
    return surfaces.hasOpaqueRoof
      ? "Opaque roof conceals framing. Profile pattern is indicative, not sheet joints. Dimensions in mm."
      : "Acrylic drawn clear to show framing. Glazing marks are diagrammatic. Dimensions in mm.";
  if (kind === "lighting") {
    const basis = surfaces.hasContinuousCeiling
      ? `Reflected ceiling plan. Actual ceiling${product.drawingDetails!.finish.material === "combination" ? " and skylight" : ""} shown in plan coordinates.`
      : surfaces.hasOpenBattens
        ? "Reflected lighting plan. Actual exposed frame, spaced under-rafter timber battens and acrylic roof shown in plan coordinates."
        : "Reflected lighting plan. Actual exposed frame and acrylic roof shown in plan coordinates.";
    return `${basis} S = rafter spot, D = ceiling downlight, LED = full-length channel. No circuit or wiring design.`;
  }
  if (kind === "blind-plan")
    return "Blind layout / roof covering and overhead frame omitted. Dashed roof outline is a reference. See corresponding blind elevations.";
  if (kind === "blind-elevation")
    return "Actual selected blind hardware and lowered states. Dimensions are clear openings, not fabrication cut sizes. Model base is a concept datum.";
  if (kind === "elevation")
    return "Orthographic projection of the same canonical assembly. Heights are above the model base.";
  return "True parallel isometric projection of the same pergola and its selected options.";
}
export async function renderApprovedStudioDocumentPage(
  source: StudioClientDocumentSource,
  index: number,
  signal?: AbortSignal,
  totalPages?: number,
) {
  const sheets = studioDocumentPages(source),
    sheet = sheets[index];
  if (!sheet) throw Error("Invalid document page");
  signal?.throwIfAborted();
  const pdf = await PDFDocument.create(),
    page = pdf.addPage([PAPER.width, PAPER.height]),
    fonts = await documentFonts(pdf);
  pdf.setTitle(`${source.projectName} - ${sheet.label}`);
  pdf.setAuthor("Sanctuary Pergolas");
  pdf.setSubject("Concept design / Not for construction");
  pdf.setCreationDate(new Date(source.issuedAt));
  pdf.setModificationDate(new Date(source.issuedAt));
  let scale = "NTS @ A3";
  if (sheet.kind === "cover") approvedCover(page, source, fonts);
  else {
    const product = source.products.find((p) => p.id === sheet.objectId);
    if (!product) throw Error("Frozen pergola unavailable");
    approvedDrawingFrame(page, source, product, fonts);
    const headingBottom = drawingHeading(
      page,
      product,
      sheet.kind === "plan"
        ? "ROOF PLAN / ORTHOGRAPHIC"
        : sheet.kind.toUpperCase().replaceAll("-", " "),
      fonts,
    );
    let top = Math.max(120, headingBottom + 23);
    if (sheet.kind === "lighting") {
      const lights = product.drawingDetails!.lights;
      text(
        page,
        `${lights.rafters.length} rafter spots, ${lights.cedar.length} ceiling downlights, ${lights.strips.length} full-length LED channels.`,
        280,
        top,
        8.8,
        fonts.regular,
        MUTED,
      );
      top += 28;
    }
    const historicalBlindFacts = product.drawingDetails!.blinds.some(
      (blind) => blind.cover === undefined,
    );
    if (
      (sheet.kind === "blind-plan" || sheet.kind === "blind-elevation") &&
      historicalBlindFacts
    ) {
      for (const [index, blind] of product.drawingDetails!.blinds.entries()) {
        top =
          wrapped(
            page,
            `B${index + 1} / ${blind.description} / ${blind.lowered}% lowered`,
            280,
            top,
            850,
            8.5,
            fonts.regular,
            MUTED,
            12,
          ) + 2;
      }
      top += 14;
    }
    const bottom = 700;
    const availableHeight = undefined;
    await centredDrawingGroup(
      pdf,
      page,
      { x: 276, y: top, width: 872, height: bottom - top },
      async (scratch) => {
        if (sheet.kind === "plan")
          scale = `1:${await approvedRoofPlan(pdf, scratch, source, product, fonts, signal, availableHeight)} @ A3`;
        else if (sheet.kind === "iso")
          await approvedIsometric(
            pdf,
            scratch,
            product,
            fonts,
            signal,
            source.joins,
            availableHeight,
          );
        else if (sheet.kind === "elevation")
          scale = `1:${await approvedElevation(pdf, scratch, product, fonts, signal, source.joins, availableHeight)} @ A3`;
        else if (sheet.kind === "lighting")
          scale = `1:${await approvedLighting(pdf, scratch, product, fonts, signal, source.joins, availableHeight)} @ A3`;
        else if (sheet.kind === "blind-plan")
          scale = `1:${await approvedBlindPlan(pdf, scratch, product, fonts, signal, source.joins, availableHeight)} @ A3`;
        else {
          await approvedBlindElevations(
            pdf,
            scratch,
            product,
            fonts,
            signal,
            source.joins,
            availableHeight,
          );
          scale = "AS SHOWN";
        }
      },
    );
    wrapped(
      page,
      approvedDrawingNote(sheet.kind, product),
      280,
      714,
      850,
      7.6,
      fonts.regular,
      MUTED,
      10,
    );
  }
  titleBar(page, source, sheet, totalPages ?? sheets.length, fonts, scale);
  signal?.throwIfAborted();
  return pdf.save();
}
