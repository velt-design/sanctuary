import "server-only";

import { PDFDocument, type Color, type PDFImage, type PDFPage } from "pdf-lib";
import fontkit from "@/lib/quotes/fontkit";
import { DESIGN_BOOKLET_REFERENCE_ASSETS } from "./defaults";
import {
  DESIGN_BOOKLET_PDF_FONT_FILES,
  readDesignBookletDefaultImage,
  readDesignBookletPdfFont,
} from "./pdfAssets";
import {
  addDesignBookletPage as addPage,
  DESIGN_BOOKLET_PDF_BOTTOM,
  DESIGN_BOOKLET_PDF_COLORS,
  DESIGN_BOOKLET_PDF_CONTENT_WIDTH,
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
  DesignBookletImage,
  DesignBookletImages,
} from "./types";

export { DESIGN_BOOKLET_PDF_PAGE_SIZE } from "./pdfLayout";

const { width: PAGE_WIDTH, height: PAGE_HEIGHT } = DESIGN_BOOKLET_PDF_PAGE_SIZE;
const LEFT = DESIGN_BOOKLET_PDF_LEFT;
const RIGHT = DESIGN_BOOKLET_PDF_RIGHT;
const BOTTOM = DESIGN_BOOKLET_PDF_BOTTOM;
const CONTENT_WIDTH = DESIGN_BOOKLET_PDF_CONTENT_WIDTH;
const colors = DESIGN_BOOKLET_PDF_COLORS;

async function embedImage(
  pdf: PDFDocument,
  image: DesignBookletImage,
): Promise<PDFImage> {
  return image.mediaType === "image/png"
    ? pdf.embedPng(image.bytes)
    : pdf.embedJpg(image.bytes);
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

function drawLightFooter(
  page: PDFPage,
  pageNumber: number,
  customerName: string,
  fonts: Fonts,
) {
  drawRule(page, LEFT, 40, CONTENT_WIDTH, colors.paperStrong);
  page.drawText(
    `SANCTUARY / DESIGN BOOKLET / ${safePdfText(customerName).toUpperCase()}`,
    {
      x: LEFT,
      y: BOTTOM,
      size: 6.8,
      font: fonts.medium,
      color: colors.paperStrong,
    },
  );
  const pageText = `${String(pageNumber).padStart(2, "0")} / 06`;
  page.drawText(pageText, {
    x: PAGE_WIDTH - RIGHT - fonts.medium.widthOfTextAtSize(pageText, 7.2),
    y: BOTTOM,
    size: 7.2,
    font: fonts.medium,
    color: colors.paperStrong,
  });
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

  const embedded = {
    "render-1": await embedImage(pdf, input.images["render-1"]),
    "render-2": await embedImage(pdf, input.images["render-2"]),
    "render-3": await embedImage(pdf, input.images["render-3"]),
    plan: await embedImage(pdf, input.images.plan),
  };
  const [coverImage, overviewImage, featureImage] = input.draft.renderOrder.map(
    (id) => embedded[id],
  );
  const roofForm = input.content.roofForms[input.draft.roofFormId];
  const material = input.content.materials[input.draft.materialId];
  const [roofFormReferenceBytes, acrylicReferenceBytes, solidReferenceBytes] =
    await Promise.all([
      readDesignBookletDefaultImage(
        DESIGN_BOOKLET_REFERENCE_ASSETS.roofForms[input.draft.roofFormId]
          .filename,
      ),
      readDesignBookletDefaultImage(
        DESIGN_BOOKLET_REFERENCE_ASSETS.roofing.acrylic.filename,
      ),
      readDesignBookletDefaultImage(
        DESIGN_BOOKLET_REFERENCE_ASSETS.roofing["solid-lined"].filename,
      ),
    ]);
  const roofFormReference = await pdf.embedJpg(roofFormReferenceBytes);
  const roofingReferences = {
    acrylic: await pdf.embedJpg(acrylicReferenceBytes),
    "solid-lined": await pdf.embedJpg(solidReferenceBytes),
  };
  const pageCount = 6;

  // 01 / Full-bleed website-style cover
  {
    const page = addPage(pdf);
    drawImageCover(page, coverImage, {
      x: 0,
      y: 0,
      width: PAGE_WIDTH,
      height: PAGE_HEIGHT,
    });
    drawBrandAt(page, fonts, LEFT, 548, colors.paperStrong);
    page.drawText("CONCEPT DESIGN / 01", {
      x: PAGE_WIDTH - RIGHT - 89,
      y: 548,
      size: 7,
      font: fonts.semibold,
      color: colors.paperStrong,
    });
    drawEyebrow(
      page,
      "Outdoor living by Sanctuary",
      LEFT,
      445,
      fonts,
      colors.ink,
    );
    drawWrappedText(page, input.draft.projectTitle, {
      x: LEFT,
      y: 402,
      width: 290,
      font: fonts.semibold,
      size: 32,
      lineHeight: 34,
      maxLines: 3,
      color: colors.paperStrong,
    });
    drawRule(page, LEFT, 188, 290, colors.paperStrong);
    drawEyebrow(page, "Prepared for", LEFT, 162, fonts, colors.paperStrong);
    page.drawText(safePdfText(input.draft.customerName), {
      x: LEFT,
      y: 138,
      size: 13,
      font: fonts.medium,
      color: colors.paperStrong,
    });
    drawEyebrow(page, "Design direction", 170, 162, fonts, colors.paperStrong);
    drawWrappedText(page, `${roofForm.name} / ${material.label}`, {
      x: 170,
      y: 138,
      width: 164,
      font: fonts.medium,
      size: 9,
      lineHeight: 12,
      maxLines: 2,
      color: colors.paperStrong,
    });
    drawLightFooter(page, 1, input.draft.customerName, fonts);
  }

  // 02 / Split editorial overview
  {
    const page = addPage(pdf);
    page.drawRectangle({
      x: 0,
      y: 0,
      width: PAGE_WIDTH,
      height: 50,
      color: colors.paper,
    });
    drawImageCover(page, overviewImage, {
      x: 0,
      y: 50,
      width: 515,
      height: PAGE_HEIGHT - 50,
    });
    page.drawText("RENDER 02 / CURRENT CONCEPT", {
      x: LEFT,
      y: 67,
      size: 6.8,
      font: fonts.medium,
      color: colors.paperStrong,
    });
    drawBrandAt(page, fonts, 552, 548);
    drawEyebrow(page, "Your design", 552, 458, fonts);
    drawWrappedText(page, "The design, at a glance.", {
      x: 552,
      y: 420,
      width: 240,
      font: fonts.semibold,
      size: 25,
      lineHeight: 27,
      maxLines: 2,
    });

    drawRule(page, 552, 337, 240);
    drawEyebrow(page, "01 / Roof form", 552, 316, fonts, colors.muted);
    page.drawText(safePdfText(roofForm.name), {
      x: 552,
      y: 289,
      size: 13,
      font: fonts.semibold,
      color: colors.ink,
    });
    drawWrappedText(page, roofForm.proposition, {
      x: 552,
      y: 267,
      width: 240,
      font: fonts.regular,
      size: 8.6,
      lineHeight: 12,
      maxLines: 5,
      color: colors.muted,
    });

    drawRule(page, 552, 187, 240);
    drawEyebrow(page, "02 / Roofing choice", 552, 166, fonts, colors.muted);
    page.drawText(safePdfText(material.label), {
      x: 552,
      y: 139,
      size: 13,
      font: fonts.semibold,
      color: colors.ink,
    });
    drawWrappedText(page, material.summary, {
      x: 552,
      y: 117,
      width: 240,
      font: fonts.regular,
      size: 8.6,
      lineHeight: 12,
      maxLines: 4,
      color: colors.muted,
    });
    drawFooter(page, 2, pageCount, input.draft.customerName, fonts);
  }

  // 03 / Full-bleed design view
  {
    const page = addPage(pdf);
    drawImageCover(page, featureImage, {
      x: 0,
      y: 0,
      width: PAGE_WIDTH,
      height: PAGE_HEIGHT,
    });
    page.drawRectangle({
      x: 0,
      y: 0,
      width: PAGE_WIDTH,
      height: 180,
      color: colors.accent,
      opacity: 0.92,
    });
    drawBrandAt(page, fonts, LEFT, 548, colors.paperStrong);
    page.drawText("DESIGN VIEW / 03", {
      x: PAGE_WIDTH - RIGHT - 76,
      y: 548,
      size: 7,
      font: fonts.semibold,
      color: colors.paperStrong,
    });
    drawEyebrow(page, "Design view", LEFT, 145, fonts, colors.paperStrong);
    drawWrappedText(page, "The outdoor room, seen as a whole.", {
      x: LEFT,
      y: 112,
      width: 600,
      font: fonts.semibold,
      size: 27,
      lineHeight: 30,
      maxLines: 2,
      color: colors.paperStrong,
    });
    page.drawText("RENDER 03 / CURRENT CONCEPT", {
      x: PAGE_WIDTH - RIGHT - 129,
      y: 90,
      size: 7,
      font: fonts.medium,
      color: colors.paperStrong,
    });
    drawLightFooter(page, 3, input.draft.customerName, fonts);
  }

  // 04 / Plan-led split
  {
    const page = addPage(pdf);
    page.drawRectangle({
      x: 0,
      y: 0,
      width: 178,
      height: PAGE_HEIGHT,
      color: colors.canvas,
    });
    drawBrandAt(page, fonts, LEFT, 548);
    drawEyebrow(page, "Concept plan", LEFT, 420, fonts);
    drawWrappedText(page, "The design from above.", {
      x: LEFT,
      y: 383,
      width: 108,
      font: fonts.semibold,
      size: 22,
      lineHeight: 24,
      maxLines: 4,
    });
    drawRule(page, LEFT, 145, 108);
    page.drawText("PLAN 01 / CURRENT CONCEPT", {
      x: LEFT,
      y: 122,
      size: 6.4,
      font: fonts.medium,
      color: colors.muted,
    });
    page.drawRectangle({
      x: 190,
      y: 58,
      width: 606,
      height: 489,
      borderColor: colors.rule,
      borderWidth: 0.7,
    });
    drawImageContain(page, embedded.plan, {
      x: 196,
      y: 64,
      width: 594,
      height: 477,
    });
    drawFooter(page, 4, pageCount, input.draft.customerName, fonts);
  }

  // 05 / Marketing-style roof-form feature
  {
    const page = addPage(pdf);
    drawImageCover(page, roofFormReference, {
      x: 0,
      y: 50,
      width: 515,
      height: PAGE_HEIGHT - 50,
    });
    page.drawText(
      `BUILT REFERENCE / ${safePdfText(roofForm.shortName).toUpperCase()}`,
      {
        x: LEFT,
        y: 68,
        size: 6.8,
        font: fonts.medium,
        color: colors.paperStrong,
      },
    );
    page.drawRectangle({
      x: 515,
      y: 50,
      width: PAGE_WIDTH - 515,
      height: PAGE_HEIGHT - 50,
      color: colors.accent,
    });
    drawBrandAt(page, fonts, 552, 548, colors.paperStrong);
    drawEyebrow(page, "Roof form", 552, 456, fonts, colors.paperStrong);
    drawWrappedText(page, roofForm.name, {
      x: 552,
      y: 419,
      width: 244,
      font: fonts.semibold,
      size: 29,
      lineHeight: 30,
      maxLines: 3,
      color: colors.paperStrong,
    });
    drawWrappedText(page, roofForm.outcomeHeading, {
      x: 552,
      y: 330,
      width: 244,
      font: fonts.medium,
      size: 11.5,
      lineHeight: 15.5,
      maxLines: 3,
      color: colors.paperStrong,
    });
    drawWrappedText(page, roofForm.outcomeCopy, {
      x: 552,
      y: 272,
      width: 244,
      font: fonts.regular,
      size: 8.1,
      lineHeight: 11.3,
      maxLines: 6,
      color: colors.paperStrong,
    });
    drawRule(page, 552, 165, 112, colors.paperStrong);
    drawEyebrow(page, "Useful when", 552, 145, fonts, colors.paperStrong);
    drawWrappedText(page, roofForm.worksWhen[0], {
      x: 552,
      y: 124,
      width: 112,
      font: fonts.regular,
      size: 7.1,
      lineHeight: 9.5,
      maxLines: 6,
      color: colors.paperStrong,
    });
    drawRule(page, 684, 165, 112, colors.paperStrong);
    drawEyebrow(page, "Confirm", 684, 145, fonts, colors.paperStrong);
    drawWrappedText(page, roofForm.resolve[0], {
      x: 684,
      y: 124,
      width: 112,
      font: fonts.regular,
      size: 7.1,
      lineHeight: 9.5,
      maxLines: 6,
      color: colors.paperStrong,
    });
    drawFooter(page, 5, pageCount, input.draft.customerName, fonts);
  }

  // 06 / Two-zone roofing story
  {
    const page = addPage(pdf);
    page.drawRectangle({
      x: 0,
      y: 50,
      width: 228,
      height: PAGE_HEIGHT - 50,
      color: colors.accent,
    });
    drawBrandAt(page, fonts, LEFT, 548, colors.paperStrong);
    drawEyebrow(page, "Roofing choice", LEFT, 430, fonts, colors.paperStrong);
    drawWrappedText(
      page,
      material.sections.length === 2 ? "Two roofing zones." : material.label,
      {
        x: LEFT,
        y: 392,
        width: 142,
        font: fonts.semibold,
        size: 27,
        lineHeight: 28,
        maxLines: 4,
        color: colors.paperStrong,
      },
    );
    drawWrappedText(
      page,
      `${input.draft.projectTitle} / prepared for ${input.draft.customerName}`,
      {
        x: LEFT,
        y: 88,
        width: 142,
        font: fonts.medium,
        size: 7,
        lineHeight: 10,
        maxLines: 3,
        color: colors.paperStrong,
      },
    );

    const sectionWidth = (PAGE_WIDTH - 228) / material.sections.length;
    material.sections.forEach((section, index) => {
      const x = 228 + index * sectionWidth;
      drawImageCover(page, roofingReferences[section.id], {
        x,
        y: 278,
        width: sectionWidth,
        height: PAGE_HEIGHT - 278,
      });
      if (index > 0) {
        page.drawLine({
          start: { x, y: 50 },
          end: { x, y: PAGE_HEIGHT },
          thickness: 0.8,
          color: colors.rule,
        });
      }
      page.drawText(String(index + 1).padStart(2, "0"), {
        x: x + 24,
        y: 245,
        size: 7,
        font: fonts.medium,
        color: colors.muted,
      });
      drawWrappedText(page, section.label, {
        x: x + 24,
        y: 218,
        width: sectionWidth - 48,
        font: fonts.semibold,
        size: material.sections.length === 1 ? 21 : 16,
        lineHeight: material.sections.length === 1 ? 23 : 18,
        maxLines: 2,
      });
      drawWrappedText(page, section.summary, {
        x: x + 24,
        y: 168,
        width: sectionWidth - 48,
        font: fonts.regular,
        size: 8,
        lineHeight: 11,
        maxLines: 7,
        color: colors.muted,
      });
    });
    drawFooter(page, 6, pageCount, input.draft.customerName, fonts);
  }

  return pdf.save({ useObjectStreams: false });
}
