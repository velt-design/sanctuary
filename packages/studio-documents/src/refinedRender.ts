import { PDFDocument, rgb, type PDFPage } from "pdf-lib";
import {
  studioDocumentPages,
  type StudioClientDocumentSource,
  type StudioDocumentProduct,
} from "./contract";
import { fonts as documentFonts } from "./assets";
import {
  PAPER,
  box,
  INK,
  MUTED,
  line,
  text,
  wrapped,
  boundedText,
  drawingHeading,
  titleBar,
  drawSelectionSupplement,
  type Fonts,
} from "./layout";
import { documentTextLines } from "./textLayout";
import { refinedDrawingFrame } from "./refinedLayout";
import { refinedCoverLayout } from "./refinedCover";
import { drawRefinedPlan, technicalLeader } from "./refinedPlan";
import { refinedSpecificationRows, refinedExtras } from "./refinedFacts";
import { polygon } from "./plan";
import { studioDocumentTriangles, type DocumentTriangle } from "./mesh";
import {
  trueIsometric,
  documentIsometricFrame,
  renderDocumentIsometric,
} from "./isometric";

function technicalColour(triangle: DocumentTriangle): DocumentTriangle {
  const c = triangle.colour,
    equals = (a: number, b: number, d: number) =>
      c[0] === a && c[1] === b && c[2] === d;
  return {
    ...triangle,
    colour: equals(46, 54, 47)
      ? [93, 105, 96]
      : equals(220, 224, 218)
        ? [235, 238, 232]
        : equals(139, 149, 137)
          ? [181, 188, 178]
          : equals(174, 133, 91)
            ? [181, 146, 107]
            : c,
  };
}
export function drawOverview(
  page: PDFPage,
  source: StudioClientDocumentSource,
  fonts: Fonts,
  area: { x: number; y: number; width: number; height: number },
  compactLabels = false,
) {
  const world = (
    product: StudioDocumentProduct,
    p: { x: number; y: number },
  ) => {
    const r = (product.pose.rotation * Math.PI) / 180;
    return {
      x: product.pose.x + p.x * Math.cos(r) - p.y * Math.sin(r),
      y: product.pose.y + p.x * Math.sin(r) + p.y * Math.cos(r),
    };
  };
  const outlines = [
      ...source.houses.map((h) => h.footprint),
      ...source.products.map((p) => p.plan.outline.map((v) => world(p, v))),
    ],
    points = outlines.flat(),
    xs = points.map((p) => p.x),
    ys = points.map((p) => p.y),
    loX = points.length ? Math.min(...xs) : 0,
    hiX = points.length ? Math.max(...xs) : 1,
    loY = points.length ? Math.min(...ys) : 0,
    hiY = points.length ? Math.max(...ys) : 1,
    scale = Math.min(
      (area.width - 30) / Math.max(hiX - loX, 1),
      (area.height - 58) / Math.max(hiY - loY, 1),
    );
  const map = (p: { x: number; y: number }) => ({
    x: area.x + (area.width - (hiX - loX) * scale) / 2 + (p.x - loX) * scale,
    y:
      area.y +
      (area.height - 58 - (hiY - loY) * scale) / 2 +
      (p.y - loY) * scale,
  });
  for (const house of source.houses) {
    polygon(
      page,
      house.footprint.map(map),
      rgb(0.975, 0.962, 0.95),
      rgb(0.72, 0.67, 0.64),
      0.5,
    );
    for (const plane of house.roof)
      polygon(
        page,
        plane.map(map),
        rgb(0.975, 0.962, 0.95),
        rgb(0.82, 0.78, 0.75),
        0.4,
      );
    const hx = house.footprint.map((p) => map(p).x),
      hy = house.footprint.map((p) => map(p).y),
      label = "HOUSE / SAVED CONTEXT";
    text(
      page,
      label,
      (Math.min(...hx) + Math.max(...hx)) / 2 -
        fonts.medium.widthOfTextAtSize(label, 9) / 2,
      Math.min(...hy) + 12,
      9,
      fonts.medium,
      MUTED,
    );
  }
  for (const product of source.products) {
    const local = (p: { x: number; y: number }) => map(world(product, p));
    polygon(
      page,
      product.plan.outline.map(local),
      rgb(0.96, 0.98, 0.965),
      rgb(0.43, 0.49, 0.44),
      0.7,
    );
    for (const region of product.covering?.regions ?? [])
      polygon(
        page,
        region.boundary.map(local),
        region.material === "solid"
          ? rgb(0.93, 0.945, 0.92)
          : rgb(0.97, 0.985, 0.98),
        rgb(0.74, 0.78, 0.73),
        0.35,
      );
    for (const member of [
      ...product.plan.members.rafters,
      ...product.plan.members.beams,
      ...product.plan.members.ledgers,
      ...product.plan.members.gutters,
      ...product.plan.members.ridge,
    ]) {
      const a = local(member.centerline.start),
        b = local(member.centerline.end);
      line(
        page,
        a.x,
        a.y,
        b.x,
        b.y,
        Math.max(0.35, member.profile.widthMm * scale),
        member.role === "rafter"
          ? rgb(0.67, 0.72, 0.67)
          : rgb(0.38, 0.44, 0.39),
      );
    }
    const outline = product.plan.outline.map(local),
      left = Math.min(...outline.map((p) => p.x)),
      right = Math.max(...outline.map((p) => p.x)),
      bottom = Math.max(...outline.map((p) => p.y)),
      top = Math.min(...outline.map((p) => p.y)),
      label = compactLabels
        ? product.code
        : `${product.code} / ${product.roofLabel}`,
      size = compactLabels ? 8.8 : 10,
      labelWidth = fonts.medium.widthOfTextAtSize(label, size),
      labelX = (left + right) / 2 - labelWidth / 2,
      labelY = compactLabels ? (top + bottom) / 2 - 4 : bottom + 13;
    if (compactLabels)
      box(page, labelX - 2, labelY - 1, labelWidth + 4, 11, rgb(1, 1, 1));
    text(page, label, labelX, labelY, size, fonts.medium);
  }
}
export function drawCover(
  page: PDFPage,
  source: StudioClientDocumentSource,
  fonts: Fonts,
  override?:ReturnType<typeof refinedCoverLayout>,
) {
  const sheets = studioDocumentPages(source),
    layout = override??refinedCoverLayout(source, sheets, fonts.regular, fonts.semibold);
  boundedText(
    page,
    source.projectName,
    42,
    36,
    1108,
    layout.documentTitleY - 47,
    28,
    fonts.semibold,
    INK,
    32,
  );
  text(page, "Design booklet", 42, layout.documentTitleY, 16, fonts.medium);
  line(page, 42, layout.ruleY, 1150, layout.ruleY);
  text(
    page,
    `SAVED DESIGN / ${source.designVersionLabel}`,
    42,
    layout.ruleY + 27,
    9,
    fonts.medium,
    MUTED,
  );
  text(page, "Overall arrangement", 42, layout.ruleY + 58, 16, fonts.medium);
  const end = wrapped(
      page,
      source.siteAddress,
      42,
      layout.ruleY + 83,
      700,
      10.5,
      fonts.regular,
      MUTED,
      14,
    ),
    area = { ...layout.overview, y: Math.max(layout.overview.y, end + 18) };
  area.height = Math.max(160, 690 - area.y);
  drawOverview(page, source, fonts, area, !layout.ordinary);
  line(page, 793, layout.ruleY + 56, 793, 714, 0.5);
  text(
    page,
    "DRAWING REGISTER",
    824,
    layout.ruleY + 68,
    9.5,
    fonts.medium,
    MUTED,
  );
  for (const item of layout.register) {
    text(
      page,
      item.sheet.code,
      item.x,
      item.y,
      layout.ordinary ? 12 : 8.8,
      fonts.semibold,
    );
    boundedText(
      page,
      item.label,
      item.x + (layout.ordinary ? 62 : 27),
      item.y,
      item.width,
      layout.ordinary ? 34 : 12,
      item.size,
      fonts.medium,
      INK,
      13,
    );
    if (layout.ordinary)
      line(page, item.x, item.y + 36, 1148, item.y + 36, 0.45);
  }
  if (layout.ordinary) {
    const y = Math.max(604, layout.registerBottom + 16);
    text(page, "DRAWING BASIS", 824, y, 8.5, fonts.medium, MUTED);
    wrapped(
      page,
      "Saved concept geometry and selected options. Model sections and heights are concept information.",
      824,
      y + 22,
      300,
      9.5,
      fonts.regular,
      MUTED,
      13,
    );
  } else
    text(
      page,
      "Full product names appear on individual sheets.",
      824,
      719,
      7.7,
      fonts.regular,
      MUTED,
    );
  text(
    page,
    "Each pergola has a dimensioned Plan, selected specification, head-height profile and matching isometric.",
    42,
    720,
    9,
    fonts.regular,
    MUTED,
  );
}
async function drawIso(
  page: PDFPage,
  source: StudioClientDocumentSource,
  product: StudioDocumentProduct,
  fonts: Fonts,
  signal: AbortSignal | undefined,
  bottom = 675,
  completeSchedule = false,
) {
  const heading = drawingHeading(
      page,
      product,
      "ISOMETRIC / ORTHOGRAPHIC / NTS",
      fonts,
    ),
    triangles = studioDocumentTriangles(product, source.joins).map(
      technicalColour,
    ),
    png = await renderDocumentIsometric(triangles, { signal, technical: true });
  signal?.throwIfAborted();
  const pdfImage = await page.doc.embedPng(png),
    top = Math.max(152, heading + 20),
    height = Math.min(490, bottom - top),
    width = 760,
    ratio = Math.min(width / pdfImage.width, height / pdfImage.height),
    imageX = 330 + (width - pdfImage.width * ratio) / 2;
  page.drawImage(pdfImage, {
    x: imageX,
    y: PAPER.height - top - pdfImage.height * ratio,
    width: pdfImage.width * ratio,
    height: pdfImage.height * ratio,
  });
  const frame = documentIsometricFrame(triangles),
    map = (point: { x: number; y: number; z: number }) => {
      const p = trueIsometric(point);
      return {
        x: imageX + (frame.ox + (p.x - frame.loX) * frame.scale) * ratio,
        y: top + (frame.oy + (p.y - frame.loY) * frame.scale) * ratio,
      };
    };
  const posts = product.assembly.members.filter(
      (member) => member.role === "post",
    ),
    post = posts.sort(
      (a, b) =>
        trueIsometric(a.centerline.start).x -
        trueIsometric(b.centerline.start).x,
    )[0];
  if (post) {
    const center = {
      x: post.centerline.start.x,
      y: post.centerline.start.y,
      z: (post.centerline.start.z + post.centerline.end.z) / 2,
    };
    const corners = [-1, 1].flatMap((y) =>
      [-1, 1].map((z) => ({
        x:
          center.x +
          post.localFrame.yAxis.x * post.profile.widthMm * 0.35 * y +
          post.localFrame.zAxis.x * post.profile.depthMm * 0.35 * z,
        y:
          center.y +
          post.localFrame.yAxis.y * post.profile.widthMm * 0.35 * y +
          post.localFrame.zAxis.y * post.profile.depthMm * 0.35 * z,
        z: center.z,
      })),
    );
    const p = map(
      corners.sort((a, b) => trueIsometric(a).x - trueIsometric(b).x)[0],
    );
    technicalLeader(
      page,
      fonts,
      p,
      { x: 280, y: Math.min(bottom - 65, p.y + 35), width: 115 },
      [
        "POSTS",
        `${post.profile.depthMm} x ${post.profile.widthMm} mm`,
        `${posts.length} positions`,
      ],
    );
  }
  const roofPoints = product.assembly.roofPlanes.flatMap(
      (plane) => plane.boundary,
    ),
    roofPoint = [...roofPoints].sort(
      (a, b) => trueIsometric(b).x - trueIsometric(a).x,
    )[0],
    specs = refinedSpecificationRows(product);
  if (roofPoint) {
    const p = map(roofPoint);
    technicalLeader(
      page,
      fonts,
      p,
      { x: 990, y: Math.max(top - 5, p.y - 85), width: 150 },
      [
        specs.find(([label]) => label === "ROOF")?.[1].toUpperCase() ??
          product.roofLabel,
        specs.find(([label]) => label === "CEILING")?.[1] ??
          product.frameFinish + " aluminium frame",
        ...(specs.find(([label]) => label === "SKYLIGHT")
          ? [specs.find(([label]) => label === "SKYLIGHT")![1]]
          : []),
      ],
    );
  }
  const flashing = product.assembly.roofFlashings?.find(
    (value) => value.metadata?.representativeGableRidge,
  );
  if (flashing?.wings[0]) {
    const p = map(
      [...flashing.wings[0].boundary].sort(
        (a, b) => trueIsometric(b).x - trueIsometric(a).x,
      )[0],
    );
    technicalLeader(
      page,
      fonts,
      p,
      { x: 990, y: Math.min(bottom - 75, p.y + 60), width: 150 },
      ["RIDGE FLASHING", "Over roof junction"],
    );
  }
  const infill = refinedExtras(product).find((row) => row.key === "infills");
  if (infill?.selected) {
    text(
      page,
      "SELECTED INFILL / LIGHTING",
      280,
      bottom + 14,
      8.5,
      fonts.medium,
      MUTED,
    );
    wrapped(
      page,
      completeSchedule
        ? "Complete selected-options schedule below."
        : [
            infill.value,
            refinedExtras(product).find((row) => row.key === "lights")?.selected
              ? refinedExtras(product).find((row) => row.key === "lights")!
                  .value
              : "",
          ]
            .filter(Boolean)
            .join("; "),
      280,
      bottom + 29,
      850,
      8.2,
      fonts.regular,
      MUTED,
      11,
    );
  } else {
    text(
      page,
      "TRUE ISOMETRIC / ORTHOGRAPHIC",
      280,
      bottom + 14,
      9,
      fonts.medium,
      MUTED,
    );
    text(
      page,
      "Same pergola and selected geometry as the corresponding Plan sheet.",
      280,
      bottom + 31,
      8,
      fonts.regular,
      MUTED,
    );
  }
}
/** The layout selector is frozen inside the complete source. Legacy pages and
 * restart checkpoints never enter this renderer. */
export async function renderRefinedStudioDocumentPage(
  source: StudioClientDocumentSource,
  index: number,
  signal?: AbortSignal,
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
  if (sheet.kind === "cover") drawCover(page, source, fonts);
  else {
    const product = source.products.find((p) => p.id === sheet.objectId);
    if (!product) throw Error("Frozen pergola unavailable");
    const supplement = refinedDrawingFrame(page, source, product, fonts);
    if (sheet.kind === "plan")
      scale = drawRefinedPlan(
        page,
        source,
        product,
        fonts,
        supplement ? supplement.top - 18 : 690,
      );
    else
      await drawIso(
        page,
        source,
        product,
        fonts,
        signal,
        supplement ? supplement.top - 48 : 650,
        !!supplement,
      );
    if (supplement) drawSelectionSupplement(page, supplement, fonts);
  }
  titleBar(page, source, sheet, sheets.length, fonts, scale);
  signal?.throwIfAborted();
  return pdf.save();
}
