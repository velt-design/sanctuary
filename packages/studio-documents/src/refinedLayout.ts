import { rgb, type PDFPage } from "pdf-lib";
import { documentTextLines, documentTextFits } from "./textLayout";
import {
  box,
  line,
  text,
  wrapped,
  boundedText,
  type Fonts,
  type SelectionSupplement,
  INK,
  MUTED,
} from "./layout";
import { polygon } from "./plan";
import {
  refinedSpecificationRows,
  refinedExtras,
  refinedHeightFacts,
} from "./refinedFacts";
import type {
  StudioClientDocumentSource,
  StudioDocumentProduct,
} from "./contract";
const EDGE = rgb(0.48, 0.52, 0.49),
  FILL = rgb(0.824, 0.843, 0.824);
function block(
  page: PDFPage,
  y: number,
  height: number,
  label: string,
  fonts: Fonts,
) {
  box(page, 38, y, 205, height, undefined, EDGE);
  line(page, 38, y + 20, 243, y + 20, 0.45, EDGE);
  text(page, label, 46, y + 6, 9, fonts.medium);
}
export function refinedSupplement(
  product: StudioDocumentProduct,
  fonts: Fonts,
): SelectionSupplement | null {
  const extraHeight = refinedExtras(product).reduce(
    (sum, row) =>
      sum +
      Math.max(
        16,
        documentTextLines(
          row.selected ? row.value : "None selected",
          110,
          8.3,
          fonts.regular,
        ).length * 10.3,
      ) +
      3,
    0,
  );
  const specHeight = refinedSpecificationRows(product).reduce(
    (sum, [, value]) =>
      sum +
      Math.max(
        17,
        documentTextLines(value, 120, 9, fonts.regular).length * 10.8 + 3,
      ),
    0,
  );
  if (extraHeight <= 93 && specHeight <= 151) return null;
  const rows = [
    ...new Set(
      [
        ...refinedSpecificationRows(product).map(
          ([label, value]) => `${label}: ${value}`,
        ),
        ...product.extras.infills,
        ...product.extras.blinds,
        ...product.extras.lights,
      ].filter(Boolean),
    ),
  ];
  const height =
    37 +
    rows.reduce(
      (sum, row) =>
        sum + documentTextLines(row, 850, 8.5, fonts.regular).length * 11 + 5,
      0,
    );
  if (height > 400)
    throw Error(
      "The complete selected options exceed the supported drawing schedule",
    );
  return { top: 714 - height, height, rows };
}
export function refinedDrawingFrame(
  page: PDFPage,
  source: StudioClientDocumentSource,
  product: StudioDocumentProduct,
  fonts: Fonts,
) {
  const supplement = refinedSupplement(product, fonts);
  box(page, 28, 28, 1134, 706, undefined, EDGE);
  line(page, 255, 28, 255, 734, 0.45, EDGE);
  block(page, 38, 95, "PROPERTY / DESIGN", fonts);
  boundedText(
    page,
    documentTextFits(source.projectName, 188, 31, 10, fonts.medium)
      ? source.projectName
      : "Project details: A00",
    46,
    64,
    188,
    31,
    10,
    fonts.medium,
    INK,
    13,
  );
  const name = `${product.code} / ${product.label}`;
  boundedText(
    page,
    documentTextFits(name, 188, 13, 10, fonts.medium)
      ? name
      : `${product.code} / See drawing heading`,
    46,
    100,
    188,
    25,
    9.3,
    fonts.medium,
    INK,
    11,
  );
  text(
    page,
    `Roof outline: ${((product.widthMm * product.projectionMm) / 1e6).toFixed(1)} m²`,
    46,
    119,
    8,
    fonts.regular,
  );
  block(page, 143, 75, "COLOUR / FINISH", fonts);
  box(
    page,
    50,
    174,
    30,
    28,
    product.frameFinish === "Black" ? INK : rgb(0.96, 0.965, 0.95),
    EDGE,
  );
  text(page, product.frameFinish.toUpperCase(), 92, 174, 11, fonts.medium);
  text(page, "Aluminium frame", 92, 194, 9, fonts.regular);
  block(page, 228, 190, "SPECIFICATIONS", fonts);
  let y = 255;
  for (const [label, value] of refinedSpecificationRows(product)) {
    const valueLines = documentTextLines(value, 120, 9, fonts.regular),
      height = Math.max(17, valueLines.length * 10.8 + 3);
    if (y + height > 402) {
      text(
        page,
        "Full specification: schedule below",
        46,
        y,
        8.5,
        fonts.regular,
      );
      break;
    }
    text(page, label, 46, y + 1, 7.5, fonts.medium, MUTED);
    for (const [index, valueLine] of valueLines.entries())
      text(page, valueLine, 114, y + index * 10.8, 9, fonts.regular);
    y += height;
  }
  text(page, "Concept model sections", 46, 404, 7.8, fonts.regular, MUTED);
  block(page, 428, 170, "HEAD HEIGHTS", fonts);
  text(page, "Roof profile / NTS", 46, 455, 8.3, fonts.regular, MUTED);
  drawRefinedProfile(page, product, fonts);
  block(page, 608, 126, "EXTRAS", fonts);
  y = 638;
  for (const row of refinedExtras(product)) {
    const complete = row.selected ? row.value : "None selected",
      value =
        supplement &&
        documentTextLines(complete, 110, 8.3, fonts.regular).length > 3
          ? "Selected: complete schedule"
          : complete,
      values = documentTextLines(value, 110, 8.3, fonts.regular);
    text(page, row.label, 46, y, 8.3, fonts.medium);
    for (const [index, valueLine] of values.entries())
      text(page, valueLine, 110, y + index * 10.3, 8.3, fonts.regular, MUTED);
    box(page, 226, y + 1, 9, 9, undefined, EDGE);
    if (row.selected) {
      line(page, 227.5, y + 5.4, 230, y + 8, 0.65, INK);
      line(page, 230, y + 8, 234, y + 2.5, 0.65, INK);
    } else {
      line(page, 228, y + 3, 233, y + 8, 0.45, EDGE);
      line(page, 228, y + 8, 233, y + 3, 0.45, EDGE);
    }
    y += Math.max(16, values.length * 10.3) + 3;
  }
  return supplement;
}
export function drawRefinedProfile(
  page: PDFPage,
  product: StudioDocumentProduct,
  fonts: Fonts,
) {
  const facts = refinedHeightFacts(product),
    fall = product.assembly.roofPlanes[0]?.fallVector ?? { x: 0, y: 1 },
    length = Math.hypot(fall.x, fall.y) || 1,
    axis = (p: { x: number; y: number }) =>
      (p.x * fall.x + p.y * fall.y) / length;
  const vertices = product.assembly.roofPlanes.flatMap((p) => p.boundary),
    min = Math.min(...vertices.map(axis)),
    max = Math.max(...vertices.map(axis)),
    high = Math.max(...vertices.map((p) => p.z)),
    low = Math.min(...vertices.map((p) => p.z));
  const depth = Math.max(
      ...product.assembly.members
        .filter((m) => m.role === "rafter")
        .map((m) => m.profile.depthMm),
      50,
    ),
    scale = Math.min(
      161 / Math.max(max - min, 1),
      45 / Math.max(high - low + depth, 1),
    ),
    offset = 58 + (161 - (max - min) * scale) / 2;
  if (product.assembly.family === "box") {
    polygon(
      page,
      [
        { x: 58, y: 480 },
        { x: 219, y: 480 },
        { x: 219, y: 502 },
        { x: 58, y: 502 },
      ],
      rgb(0.94, 0.95, 0.93),
      EDGE,
      0.5,
    );
    line(page, 66, 484, 211, 498, 1, INK);
    text(
      page,
      `${Math.round(facts.pitch * 10) / 10}°`,
      119,
      467,
      9.3,
      fonts.medium,
    );
    text(
      page,
      "Level frame / internal roof fall",
      46,
      516,
      8,
      fonts.regular,
      MUTED,
    );
  } else {
    const byRun = new Map<number, number>();
    for (const v of vertices) {
      const run = axis(v);
      byRun.set(run, Math.max(v.z, byRun.get(run) ?? -Infinity));
    }
    const top = [...byRun]
        .sort((a, b) => a[0] - b[0])
        .map(([run, z]) => ({
          x: offset + (run - min) * scale,
          y: 481 + (high - z) * scale,
        })),
      band = Math.max(5, depth * scale);
    polygon(
      page,
      [...top, ...[...top].reverse().map((p) => ({ x: p.x, y: p.y + band }))],
      FILL,
      EDGE,
      0.55,
    );
    for (const p of [top[0], top.at(-1)!])
      line(page, p.x, p.y + band, p.x, 532, 0.45, EDGE);
    text(
      page,
      `${Math.round(facts.pitch * 10) / 10}°`,
      product.assembly.family === "gable" ? 103 : 127,
      467,
      9.3,
      fonts.medium,
    );
  }
  const equal = Math.abs(facts.high - facts.low) < 1,
    level = equal
      ? `${(facts.low / 1000).toFixed(3)} m`
      : `High ${(facts.high / 1000).toFixed(3)} m / Low ${(facts.low / 1000).toFixed(3)} m`;
  if (product.assembly.family === "gable") {
    text(
      page,
      `Eave beam underside ${(facts.low / 1000).toFixed(3)} m`,
      46,
      541,
      8.8,
      fonts.regular,
    );
    if (facts.ridgeTop !== null)
      text(
        page,
        `Ridge beam top ${(facts.ridgeTop / 1000).toFixed(3)} m`,
        46,
        557,
        8.8,
        fonts.regular,
      );
  } else {
    text(
      page,
      product.assembly.family === "box"
        ? "MAIN FRAME UNDERSIDE"
        : "MAIN BEAM UNDERSIDE",
      46,
      541,
      7.7,
      fonts.medium,
      MUTED,
    );
    text(page, level, 46, 556, 8.8, fonts.regular);
  }
  text(
    page,
    "Above model base / Concept datum",
    46,
    581,
    7.8,
    fonts.regular,
    MUTED,
  );
}
