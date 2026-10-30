import { rgb, type PDFPage } from "pdf-lib";
import { documentTextLines, documentTextFits, documentProjectLabel } from "./textLayout";
import {
  box,
  line,
  text,
  wrapped,
  boundedText,
  type Fonts,
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

/** Measure the existing fixed specification column without changing its font. */
export function approvedSpecificationLayout(
  product: StudioDocumentProduct,
  fonts: Fonts,
) {
  const finish = product.drawingDetails!.finish;
  const rows = refinedSpecificationRows(product);
  const keyHeight =
    finish.material === "combination"
      ? 40 +
        Math.max(
          32,
          18 +
            documentTextLines(
              rows.find(([label]) => label === "SKYLIGHT")?.[1] ??
                "Selected acrylic region",
              153,
              8.2,
              fonts.regular,
            ).length *
              12.2,
        )
      : finish.material !== "acrylic" && finish.ceiling
        ? 40
        : 34;
  let y = 255 + keyHeight;
  const measured = rows
    .filter(
      ([label]) => !["ROOF", "CEILING", "SKYLIGHT", "TINT"].includes(label),
    )
    .map(([label, value]) => {
      const lines = documentTextLines(value, 123, 9, fonts.regular);
      const row = {
        label,
        value,
        lines,
        y,
        height: Math.max(17, lines.length * 10.8 + 3),
      };
      y += row.height;
      return row;
    });
  return { rows: measured, bottom: y };
}
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
export function approvedDrawingFrame(
  page: PDFPage,
  source: StudioClientDocumentSource,
  product: StudioDocumentProduct,
  fonts: Fonts,
) {
  box(page, 28, 28, 1134, 706, undefined, EDGE);
  line(page, 255, 28, 255, 734, 0.45, EDGE);
  block(page, 38, 95, "PROPERTY / DESIGN", fonts);
  boundedText(
    page,
    documentProjectLabel(source, 188, 31, 10, fonts.medium, 13),
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
  let y = drawApprovedSpecifications(page, product, fonts);
  text(page, "Concept model sections", 46, 404, 7.8, fonts.regular, MUTED);
  block(page, 428, 170, "HEAD HEIGHTS", fonts);
  text(page, "Roof profile / NTS", 46, 455, 8.3, fonts.regular, MUTED);
  drawApprovedProfile(page, product, fonts);
  block(page, 608, 116, "EXTRAS", fonts);
  y = 638;
  for (const row of approvedExtras(product)) {
    const complete = row.selected ? row.value : "None selected",
      value =
        documentTextLines(complete, 110, 8.3, fonts.regular).length > 3
          ? "Selected"
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
}
export function drawApprovedProfile(
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
    const byRun = new Map<number, number>();
    for (const vertex of vertices) {
      const run = axis(vertex);
      byRun.set(run, Math.max(vertex.z, byRun.get(run) ?? -Infinity));
    }
    const profile = [...byRun]
      .sort((a, b) => a[0] - b[0])
      .map(([run, z]) => ({
        x: 66 + ((run - min) / Math.max(1, max - min)) * 145,
        y: 498 - ((z - low) / Math.max(1, high - low)) * 14,
      }));
    for (let index = 1; index < profile.length; index++)
      line(
        page,
        profile[index - 1].x,
        profile[index - 1].y,
        profile[index].x,
        profile[index].y,
        1,
        INK,
      );

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

function materialKey(page: PDFPage, kind: string, x: number, y: number) {
  box(
    page,
    x,
    y,
    26,
    24,
    kind === "acrylic" ? rgb(0.982, 0.993, 0.998) : rgb(0.965, 0.965, 0.965),
    EDGE,
  );
  if (kind === "acrylic")
    for (const yy of [y + 6, y + 16])
      for (const shift of [0, 3])
        line(
          page,
          x + 5 + shift,
          yy,
          x + 11 + shift,
          yy + 6,
          0.22,
          rgb(0.74, 0.8, 0.8),
        );
  else
    for (let xx = x + 4; xx < x + 25; xx += kind === "tray" ? 8 : 4)
      line(page, xx, y, xx, y + 24, 0.18, rgb(0.63, 0.65, 0.65));
}
function drawApprovedSpecifications(
  page: PDFPage,
  product: StudioDocumentProduct,
  fonts: Fonts,
) {
  const finish = product.drawingDetails!.finish,
    solid = finish.material !== "acrylic",
    mixed = finish.material === "combination";
  let y = 255;
  materialKey(page, solid ? (finish.profile ?? "solid") : "acrylic", 46, y);
  const name = solid
    ? finish.profile === "tray"
      ? `TRAY ${finish.trayWidth} COLORSTEEL`
      : `${finish.profile?.toUpperCase() ?? "SOLID"} COLORSTEEL`
    : "ACRYLIC ROOF";
  text(page, name, 81, y - 1, 8.3, fonts.medium);
  if (solid && finish.ceiling) {
    const ceiling = finish.ceiling;
    text(
      page,
      `${ceiling.startsWith("thermopine") ? "ThermoPine" : "Cedar"} ceiling below`,
      81,
      y + 12,
      8.2,
      fonts.regular,
    );
    text(
      page,
      `${ceiling.split("-")[1]} mm boards`,
      81,
      y + 24,
      8.2,
      fonts.regular,
    );
    y += 40;
  } else {
    const tint = refinedSpecificationRows(product).find(
      ([label]) => label === "TINT",
    );
    if (tint)
      wrapped(page, tint[1], 81, y + 12, 153, 8.2, fonts.regular, MUTED, 10.2);
    y += 34;
  }
  if (mixed) {
    materialKey(page, "acrylic", 46, y);
    text(page, "ACRYLIC SKYLIGHT", 81, y - 1, 8.4, fonts.medium);
    const skylight = refinedSpecificationRows(product).find(
      ([label]) => label === "SKYLIGHT",
    );
    const bottom = wrapped(
      page,
      skylight?.[1] ?? "Selected acrylic region",
      81,
      y + 12,
      153,
      8.2,
      fonts.regular,
    );
    y = Math.max(y + 32, bottom + 6);
  }
  for (const row of approvedSpecificationLayout(product, fonts).rows) {
    const { label, lines: values, height } = row;
    y = row.y;
    if (row.y + height > 402) {
      break;
    }
    text(page, label, 46, y + 1, 7.5, fonts.medium);
    values.forEach((v, i) =>
      text(page, v, 114, y + i * 10.8, 9, fonts.regular),
    );
    y += height;
  }
  return y;
}

function approvedExtras(product: StudioDocumentProduct) {
  const details = product.drawingDetails!;
  return refinedExtras(product).map((row) =>
    row.key === "blinds" && details.blinds.length
      ? { ...row, value: `${details.blinds.length} selected / Blind sheets` }
      : row.key === "lights" &&
          details.lights.rafters.length +
            details.lights.cedar.length +
            details.lights.strips.length
        ? {
            ...row,
            value: `${details.lights.rafters.length} spots / ${details.lights.cedar.length} downlights; ${details.lights.strips.length} LED channels`,
          }
        : row,
  );
}
