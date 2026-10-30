import { approvedPlanMaterialTarget } from "./approvedPlanMaterialTarget";
import { rgb, type PDFDocument, type PDFPage } from "pdf-lib";
import type { Point3 } from "@sp/geometry";
import type {
  StudioClientDocumentSource,
  StudioDocumentProduct,
  StudioDocumentPage,
} from "./contract";
import { drawGeometry, actualParts } from "./approvedGeometry";
import {
  approvedLeader,
  horizontalDrawingDimension,
  verticalDrawingDimension,
} from "./approvedAnnotations";
import { line, text, wrapped, INK, MUTED, type Fonts } from "./layout";
import { refinedHeightFacts, refinedSpecificationRows } from "./refinedFacts";
import { drawRelevantHouseContext } from "./approvedContext";
import { documentTextLines } from "./textLayout";
import { approvedBlindLabel } from "./approvedBlindLabels";

const paperScale = (denominator: number) => 72 / 25.4 / denominator;
type MapPoint = (p: Pick<Point3, "x" | "y"> & Partial<Pick<Point3, "z">>) => {
  x: number;
  y: number;
  depth: number;
};
const centre = (points: Point3[]): Point3 =>
  points.reduce(
    (a, p) => ({
      x: a.x + p.x / points.length,
      y: a.y + p.y / points.length,
      z: a.z + p.z / points.length,
    }),
    { x: 0, y: 0, z: 0 },
  );
export function drawingScale(
  product: StudioDocumentProduct,
  availableHeight?: number,
) {
  return (
    [25, 40, 50, 75, 100, 150, 200].find(
      (scale) =>
        product.widthMm * paperScale(scale) <= 470 &&
        product.projectionMm * paperScale(scale) <=
          Math.min(
            380,
            availableHeight === undefined ? 380 : availableHeight - 110,
          ),
    ) ?? 250
  );
}
function planDimensions(
  page: PDFPage,
  fonts: Fonts,
  product: StudioDocumentProduct,
  map: MapPoint,
) {
  const outline = product.plan.outline.map(map),
    left = Math.min(...outline.map((p) => p.x)),
    right = Math.max(...outline.map((p) => p.x)),
    bottom = Math.max(...outline.map((p) => p.y)),
    top = Math.min(...outline.map((p) => p.y));
  const posts = product.plan.members.posts
    .filter((p) => p.centerline.start.y > product.projectionMm / 2)
    .map((p) => map(p.centerline.start))
    .sort((a, b) => a.x - b.x);
  for (let i = 1; i < posts.length; i++)
    horizontalDrawingDimension(
      page,
      fonts,
      posts[i - 1].x,
      posts[i].x,
      bottom,
      bottom + 27,
      Math.round(
        ((posts[i].x - posts[i - 1].x) / (right - left)) * product.widthMm,
      ).toLocaleString("en-NZ"),
    );
  text(
    page,
    "POST CENTRES",
    (left + right) / 2 - 31,
    bottom + 43,
    7,
    fonts.regular,
    MUTED,
  );
  horizontalDrawingDimension(
    page,
    fonts,
    left,
    right,
    bottom,
    bottom + 66,
    product.widthMm.toLocaleString("en-NZ"),
  );
  verticalDrawingDimension(
    page,
    fonts,
    top,
    bottom,
    right,
    right + 42,
    product.projectionMm.toLocaleString("en-NZ"),
  );
}
function viewMarker(
  page: PDFPage,
  fonts: Fonts,
  map: MapPoint,
  product: StudioDocumentProduct,
  label: string,
) {
  if (elevationView(product) === "front") {
    const p = map({ x: product.widthMm / 2, y: product.projectionMm, z: 0 }),
      y = p.y + 98;
    line(page, p.x, y, p.x, y - 23, 0.55, INK);
    line(page, p.x, y - 23, p.x - 3, y - 18, 0.55, INK);
    line(page, p.x, y - 23, p.x + 3, y - 18, 0.55, INK);
    text(page, label, p.x - 12, y - 12, 8, fonts.medium);
    return;
  }

  const p = map({ x: 0, y: product.projectionMm / 2, z: 0 }),
    x = p.x - 30;
  line(page, x, p.y, x + 24, p.y, 0.55, INK);
  line(page, x + 24, p.y, x + 19, p.y - 3, 0.55, INK);
  line(page, x + 24, p.y, x + 19, p.y + 3, 0.55, INK);
  text(page, label, x - 13, p.y - 13, 7.5, fonts.medium);
}
export function elevationView(
  product: StudioDocumentProduct,
): "side" | "front" {
  const ridge = product.assembly.members.find((m) => m.role === "ridge");
  return product.assembly.family === "gable" &&
    ridge &&
    Math.abs(ridge.centerline.end.y - ridge.centerline.start.y) >
      Math.abs(ridge.centerline.end.x - ridge.centerline.start.x)
    ? "front"
    : "side";
}
function gutterPoint(product: StudioDocumentProduct): Point3 | null {
  const part = actualParts(product, { roof: false, accessories: false }).find(
    (p) => p.kind === "gutter" && !p.id.includes(":cap:"),
  );
  if (!part) return null;
  const points = part.triangles.flat(),
    outer = Math.max(...points.map((p) => p.y)),
    edge = points.filter((p) => Math.abs(p.y - outer) < 0.01);
  const start = edge.reduce((a, b) => (a.x < b.x ? a : b)),
    end = edge.reduce((a, b) => (a.x > b.x ? a : b));
  return {
    x: start.x + (end.x - start.x) * 0.75,
    y: start.y + (end.y - start.y) * 0.75,
    z: start.z + (end.z - start.z) * 0.75,
  };
}
export async function approvedRoofPlan(
  pdf: PDFDocument,
  page: PDFPage,
  source: StudioClientDocumentSource,
  product: StudioDocumentProduct,
  fonts: Fonts,
  signal?: AbortSignal,
  availableHeight?: number,
) {
  const denominator = drawingScale(product, availableHeight);
  const geometry = await drawGeometry(pdf, page, product, {
      view: "plan",
      viewport: { x: 485, y: 220, w: 480, h: 410 },
      scale: paperScale(denominator),
      joins: source.joins,
      signal,
    }),
    map = geometry.map;
  drawRelevantHouseContext(page, source, product, fonts, map);
  planDimensions(page, fonts, product, map);
  viewMarker(page, fonts, map, product, "E");
  const solid = product.covering?.regions.find((r) => r.material === "solid"),
    acrylic = product.assembly.roofCladdingPanels[0];
  if (solid) {
    const heading =
      refinedSpecificationRows(product)
        .find(([label]) => label === "ROOF")?.[1]
        .toUpperCase() ?? "COLORSTEEL ROOF";
    await approvedLeader(
      page,
      fonts,
      map(
        await approvedPlanMaterialTarget(
          product,
          "solid",
          map,
          fonts,
          "left",
          heading,
        ),
      ),
      "left",
      heading,
      [
        refinedSpecificationRows(product).find(
          ([label]) => label === "CEILING",
        )?.[1] ?? "",
      ],
    );
  }
  if (acrylic && solid) {
    const target = await approvedPlanMaterialTarget(
      product,
      "acrylic",
      map,
      fonts,
      "right",
      "ACRYLIC SKYLIGHT",
      1,
    );
    await approvedLeader(
      page,
      fonts,
      map(target),
      "right",
      "ACRYLIC SKYLIGHT",
      [],
      1,
    );
  } else if (!solid) {
    const target = await approvedPlanMaterialTarget(
      product,
      "acrylic",
      map,
      fonts,
      "left",
      "ACRYLIC ROOF",
    );
    await approvedLeader(page, fonts, map(target), "left", "ACRYLIC ROOF");
  }
  const post = product.plan.members.posts.find(
    (p) => p.centerline.start.y > product.projectionMm / 2,
  );
  if (post)
    await approvedLeader(
      page,
      fonts,
      map(post.centerline.start),
      "left",
      "POSTS",
      [
        `${product.plan.members.posts.length} positions shown`,
        product.assembly.semantics.connectionType === "freestanding"
          ? "Freestanding frame"
          : "Attached frame",
      ],
    );
  if (product.assembly.family !== "box") {
    const gutter = gutterPoint(product);
    if (gutter)
      await approvedLeader(
        page,
        fonts,
        map(gutter),
        "right",
        product.assembly.family === "gable" ? "EAVE GUTTER" : "LOW-EDGE GUTTER",
        ["As shown"],
      );
  }
  const facts = refinedHeightFacts(product);
  for (const plane of product.assembly.roofPlanes) {
    const p = centre(plane.boundary),
      a = map(p),
      v = plane.fallVector,
      length = Math.hypot(v.x, v.y) || 1,
      b = { x: a.x + (v.x / length) * 31, y: a.y + (v.y / length) * 31 };
    line(page, a.x, a.y, b.x, b.y, 0.55, INK);
    const angle = Math.atan2(b.y - a.y, b.x - a.x);
    for (const offset of [-0.5, 0.5])
      line(
        page,
        b.x,
        b.y,
        b.x - 5 * Math.cos(angle + offset),
        b.y - 5 * Math.sin(angle + offset),
        0.55,
        INK,
      );
    text(
      page,
      `${facts.pitch.toFixed(1)}°`,
      a.x + 10,
      (a.y + b.y) / 2,
      8.4,
      fonts.medium,
    );
  }
  return denominator;
}
export async function approvedIsometric(
  pdf: PDFDocument,
  page: PDFPage,
  product: StudioDocumentProduct,
  fonts: Fonts,
  signal?: AbortSignal,
  joins: StudioClientDocumentSource["joins"] = [],
  availableHeight?: number,
) {
  const captionHeight =
    documentTextLines(product.roofMaterial, 560, 9, fonts.regular).length * 12;
  const viewportHeight =
    availableHeight === undefined
      ? 440
      : Math.min(440, availableHeight - captionHeight - 24);
  if (viewportHeight < 80)
    throw Error("Selected facts leave insufficient isometric drawing space");
  await drawGeometry(pdf, page, product, {
    view: "iso",
    viewport: { x: 455, y: 160, w: 570, h: viewportHeight },
    joins,
    signal,
  });
  wrapped(
    page,
    product.roofMaterial,
    455,
    availableHeight === undefined ? 625 : 160 + viewportHeight + 16,
    560,
    9,
    fonts.regular,
    MUTED,
    12,
  );
}
export async function approvedElevation(
  pdf: PDFDocument,
  page: PDFPage,
  product: StudioDocumentProduct,
  fonts: Fonts,
  signal?: AbortSignal,
  joins: StudioClientDocumentSource["joins"] = [],
  availableHeight?: number,
) {
  const points = actualParts(product).flatMap((p) => p.triangles.flat()),
    height =
      Math.max(...points.map((p) => p.z)) - Math.min(...points.map((p) => p.z));
  const view = elevationView(product),
    run = view === "front" ? product.widthMm : product.projectionMm;
  const denominator =
    [25, 40, 50, 75, 100, 150, 200].find(
      (d) =>
        run * paperScale(d) <= 545 &&
        height * paperScale(d) <=
          Math.min(
            440,
            availableHeight === undefined ? 440 : availableHeight - 80,
          ),
    ) ?? 250;
  const geometry = await drawGeometry(pdf, page, product, {
      view,
      viewport: { x: 455, y: 160, w: 545, h: 420 },
      scale: paperScale(denominator),
      simplify: true,
      elevationHierarchy: product.assembly.family === "mono",
      joins,
      signal,
    }),
    map = geometry.map;
  const a = map({ x: 0, y: 0, z: 0 }),
    b = map(
      view === "front"
        ? { x: product.widthMm, y: 0, z: 0 }
        : { x: 0, y: product.projectionMm, z: 0 },
    );
  horizontalDrawingDimension(
    page,
    fonts,
    a.x,
    b.x,
    a.y,
    a.y + 27,
    run.toLocaleString("en-NZ"),
  );
  const facts = refinedHeightFacts(product),
    low = map({ x: 0, y: product.projectionMm, z: facts.low });
  verticalDrawingDimension(
    page,
    fonts,
    low.y,
    a.y,
    Math.min(a.x, b.x),
    Math.min(a.x, b.x) - 35,
    Math.round(facts.low).toLocaleString("en-NZ"),
  );
  text(
    page,
    product.assembly.family === "gable"
      ? "GABLE END ELEVATION / VIEW E"
      : "SIDE ELEVATION / VIEW E",
    455,
    a.y + 55,
    8.8,
    fonts.medium,
    MUTED,
  );
  if (product.assembly.family === "box")
    for (const plane of product.assembly.roofPlanes) {
      const points = plane.boundary.map(map),
        lo = points.reduce((a, b) => (a.y > b.y ? a : b)),
        hi = points.reduce((a, b) => (a.y < b.y ? a : b));
      page.drawLine({
        start: { x: lo.x, y: 841.89 - lo.y },
        end: { x: hi.x, y: 841.89 - hi.y },
        thickness: 0.45,
        color: MUTED,
        dashArray: [3, 2],
      });
    }
  const plane = product.assembly.roofPlanes[0];
  await approvedLeader(
    page,
    fonts,
    map(centre(plane.boundary)),
    "right",
    `${facts.pitch.toFixed(1)}° ROOF PITCH`,
  );
  const flashing = product.assembly.roofFlashings?.find(
    (f) => f.metadata?.representativeGableRidge,
  );
  if (flashing)
    await approvedLeader(
      page,
      fonts,
      map(flashing.wings[0].boundary[0]),
      "left",
      "RIDGE FLASHING",
      ["150 mm wings / single fold"],
    );
  return denominator;
}
export async function approvedLighting(
  pdf: PDFDocument,
  page: PDFPage,
  product: StudioDocumentProduct,
  fonts: Fonts,
  signal?: AbortSignal,
  joins: StudioClientDocumentSource["joins"] = [],
  availableHeight?: number,
) {
  const details = product.drawingDetails!,
    denominator = drawingScale(product, availableHeight),
    geometry = await drawGeometry(pdf, page, product, {
      view: "rcp",
      viewport: { x: 485, y: 235, w: 480, h: 410 },
      scale: paperScale(denominator),
      roof: true,
      accessories: false,
      joins,
      signal,
    }),
    map = geometry.map;
  planDimensions(page, fonts, product, map);
  for (const [sites, prefix] of [
    [details.lights.rafters, "S"],
    [details.lights.cedar, "D"],
  ] as const)
    for (const [index, site] of sites.entries()) {
      const q = map(site.point);
      page.drawCircle({
        x: q.x,
        y: 841.89 - q.y,
        size: Math.max(1.6, (site.diameter * geometry.scale) / 2),
        color: rgb(1, 1, 1),
        borderColor: INK,
        borderWidth: 0.7,
      });
      line(page, q.x - 1, q.y, q.x + 1, q.y, 0.35, INK);
      line(page, q.x, q.y - 1, q.x, q.y + 1, 0.35, INK);
      text(page, `${prefix}${index + 1}`, q.x + 5, q.y - 3, 6.8, fonts.medium);
    }
  for (const [index, strip] of details.lights.strips.entries()) {
    const a = map(strip.start),
      b = map(strip.end);
    line(page, a.x, a.y, b.x, b.y, 1.25, INK);
    text(
      page,
      `LED${index + 1}`,
      (a.x + b.x) / 2 + 5,
      (a.y + b.y) / 2 - 12,
      7,
      fonts.medium,
    );
  }
  if (details.lights.rafters.length)
    await approvedLeader(
      page,
      fonts,
      map(details.lights.rafters[0].point),
      "left",
      "RAFTER SPOTS",
      [`${details.lights.rafters.length} selected`],
    );
  if (details.lights.cedar.length)
    await approvedLeader(
      page,
      fonts,
      map(details.lights.cedar[0].point),
      "right",
      "CEILING DOWNLIGHTS",
      [`${details.lights.cedar.length} selected`],
      1,
    );
  return denominator;
}
export async function approvedBlindPlan(
  pdf: PDFDocument,
  page: PDFPage,
  product: StudioDocumentProduct,
  fonts: Fonts,
  signal?: AbortSignal,
  joins: StudioClientDocumentSource["joins"] = [],
  availableHeight?: number,
) {
  const denominator = drawingScale(product, availableHeight),
    geometry = await drawGeometry(pdf, page, product, {
      view: "plan",
      viewport: { x: 485, y: 235, w: 480, h: 410 },
      scale: paperScale(denominator),
      roof: false,
      frame: false,
      joins,
      signal,
    }),
    map = geometry.map;
  planDimensions(page, fonts, product, map);
  for (let i = 0; i < product.plan.outline.length; i++) {
    const a = map(product.plan.outline[i]),
      b = map(product.plan.outline[(i + 1) % product.plan.outline.length]);
    page.drawLine({
      start: { x: a.x, y: 841.89 - a.y },
      end: { x: b.x, y: 841.89 - b.y },
      thickness: 0.4,
      color: MUTED,
      dashArray: [3, 3],
    });
  }
  for (const [index, blind] of product.drawingDetails!.blinds.entries()) {
    const o = blind.opening,
      q = map({
        x: (o.start.x + o.end.x) / 2,
        y: (o.start.y + o.end.y) / 2,
        z: o.top,
      });
    text(page, `B${index + 1}`, q.x + 8, q.y - 20, 9, fonts.semibold);
  }
  const selected = product.drawingDetails!.blinds;
  const front = selected.find(
      (b) => b.opening.side === "front" || b.opening.side === "rear",
    ),
    end = selected.find(
      (b) => b.opening.side === "left" || b.opening.side === "right",
    );
  for (const blind of [front, end])
    if (blind) {
      const o = blind.opening,
        number = selected.indexOf(blind) + 1,
        target = blindCoverTarget(
          product,
          o.id,
          o.start,
          o.end,
          o.top,
          blind.cover,
        );
      if (target)
        await approvedLeader(
          page,
          fonts,
          map(target),
          o.side === "left" ? "left" : "right",
          approvedBlindCoverLabel(blind.cover),
          [`B${number} / ${o.label}`],
        );
    }
  for (const [side, , letter] of blindElevationViews(product)) {
    const origin = map({
      x:
        side === "left"
          ? 0
          : side === "right"
            ? product.widthMm
            : product.widthMm / 2,
      y:
        side === "rear"
          ? 0
          : side === "front"
            ? product.projectionMm
            : product.projectionMm / 2,
      z: 0,
    });
    const direction =
      side === "front"
        ? { x: 0, y: -1 }
        : side === "rear"
          ? { x: 0, y: 1 }
          : side === "left"
            ? { x: 1, y: 0 }
            : { x: -1, y: 0 };
    const distance = side === "front" ? 98 : 30,
      start = {
        x: origin.x - direction.x * distance,
        y: origin.y - direction.y * distance,
      },
      tip = { x: start.x + direction.x * 23, y: start.y + direction.y * 23 };
    line(page, start.x, start.y, tip.x, tip.y, 0.55, INK);
    const angle = Math.atan2(direction.y, direction.x);
    for (const offset of [-0.5, 0.5])
      line(
        page,
        tip.x,
        tip.y,
        tip.x - 5 * Math.cos(angle + offset),
        tip.y - 5 * Math.sin(angle + offset),
        0.55,
        INK,
      );
    text(page, letter, start.x - 12, start.y - 12, 8, fonts.medium);
  }
  return denominator;
}
export function blindElevationViews(product: StudioDocumentProduct) {
  return (
    [
      ["front", "front", "A"],
      ["left", "side", "B"],
      ["right", "right", "C"],
      ["rear", "rear", "D"],
    ] as const
  ).filter(([side]) =>
    product.drawingDetails!.blinds.some((b) => b.opening.side === side),
  );
}
export async function approvedBlindElevations(
  pdf: PDFDocument,
  page: PDFPage,
  product: StudioDocumentProduct,
  fonts: Fonts,
  signal?: AbortSignal,
  joins: StudioClientDocumentSource["joins"] = [],
  availableHeight?: number,
) {
  const views = blindElevationViews(product);
  const points = actualParts(product).flatMap((part) => part.triangles.flat());
  const modelHeight =
    Math.max(...points.map((p) => p.z)) - Math.min(...points.map((p) => p.z));
  for (const [index, [side, view, letter]] of views.entries()) {
    const many = views.length > 2,
      viewport = many
        ? {
            x: 400 + (index % 2) * 365,
            y: 205 + Math.floor(index / 2) * 245,
            w: 330,
            h: 170,
          }
        : index === 0
          ? { x: 400, y: 185, w: 650, h: 290 }
          : { x: 440, y: 535, w: 500, h: 130 };
    const run =
      side === "front" || side === "rear"
        ? product.widthMm
        : product.projectionMm;
    let denominator = many
      ? ([75, 100, 150, 200].find((d) => run * paperScale(d) <= 300) ?? 250)
      : index === 0
        ? Math.max(40, drawingScale(product))
        : Math.max(75, drawingScale(product));
    if (availableHeight !== undefined) {
      const rows = views.length === 1 ? 1 : 2;
      const cellHeight = availableHeight / rows;
      viewport.y = 205 + (many ? Math.floor(index / 2) : index) * cellHeight;
      // Existing caption starts22pt above the viewport; dimension extensions
      // end32pt below the model base. Reserve those once for each real cell.
      viewport.h = cellHeight - 22 - 32;
      denominator =
        [25, 40, 50, 75, 100, 150, 200, 250, 300, 400, 500].find(
          (d) =>
            d >= denominator &&
            run * paperScale(d) <= viewport.w - 20 &&
            modelHeight * paperScale(d) <= viewport.h,
        ) ?? 600;
    }
    const geometry = await drawGeometry(pdf, page, product, {
        view,
        viewport,
        scale: paperScale(denominator),
        joins,
        signal,
      }),
      map = geometry.map;
    text(
      page,
      `${side.toUpperCase()} ELEVATION / VIEW ${letter} / 1:${denominator} @ A3`,
      viewport.x,
      viewport.y - 22,
      8.8,
      fonts.medium,
    );
    for (const blind of product.drawingDetails!.blinds.filter(
      (b) => b.opening.side === side,
    )) {
      const number = product.drawingDetails!.blinds.indexOf(blind) + 1,
        o = blind.opening,
        q = map({
          x: (o.start.x + o.end.x) / 2,
          y: (o.start.y + o.end.y) / 2,
          z: o.top / 2,
        });
      const fullLabel = `B${number} / ${blind.lowered}% lowered`;
      const label =
        availableHeight === undefined ||
        fonts.medium.widthOfTextAtSize(fullLabel, 8.8) + 8 <=
          o.width * paperScale(denominator)
          ? fullLabel
          : `B${number} / ${blind.lowered}%`;
      const placed =
        blind.cover === undefined
          ? null
          : approvedBlindLabel(product, blind, number, map, fonts.medium);
      text(
        page,
        placed?.label ?? label,
        placed?.x ??
          (availableHeight === undefined
            ? q.x - 40
            : q.x - fonts.medium.widthOfTextAtSize(label, 8.8) / 2),
        placed?.y ?? q.y,
        8.8,
        fonts.medium,
      );
      const a = map(o.start),
        b = map(o.end),
        origin = map({ x: 0, y: 0, z: 0 });
      horizontalDrawingDimension(
        page,
        fonts,
        a.x,
        b.x,
        origin.y,
        origin.y + 25,
        Math.round(o.width).toLocaleString("en-NZ"),
      );
    }
  }
}

/** Older frozen v3 pages lack the selected fact and retain their exact label. */
export function approvedBlindCoverLabel(
  cover?: "NONE" | "FLASHING" | "PELMET",
) {
  return cover === "FLASHING"
    ? "BLIND FLASHING"
    : cover === "NONE"
      ? "BLIND HARDWARE"
      : "BLIND PELMET";
}
function blindCoverTarget(
  product: StudioDocumentProduct,
  id: string,
  start: Point3,
  end: Point3,
  top: number,
  cover?: "NONE" | "FLASHING" | "PELMET",
) {
  const target = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2, z: top };
  const candidates: Point3[] = [];
  for (const mesh of product.accessories.filter(
    (m) => m.id.startsWith(`${id}:blind:`) && m.kind === "frame",
  ))
    for (let i = 0; i < mesh.indices.length; i += 3) {
      const points = mesh.indices.slice(i, i + 3).map((n) => ({
        x: mesh.positions[n * 3],
        y: mesh.positions[n * 3 + 1],
        z: mesh.positions[n * 3 + 2],
      }));
      const [a, b, c] = points;
      if (
        Math.abs((b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y)) < 0.01
      )
        continue;
      const p = centre(points);
      if (p.z >= top - (cover === "NONE" ? 60 : 5)) candidates.push(p);
    }
  return (
    candidates.sort(
      (a, b) =>
        (a.x - target.x) ** 2 +
        (a.y - target.y) ** 2 -
        (b.x - target.x) ** 2 -
        (b.y - target.y) ** 2,
    )[0] ?? null
  );
}
