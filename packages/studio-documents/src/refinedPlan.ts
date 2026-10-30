import {
  rgb,
  pushGraphicsState,
  popGraphicsState,
  rectangle,
  clip,
  endPath,
  type PDFPage,
} from "pdf-lib";
import type { Point3 } from "@sp/geometry";
import type {
  StudioClientDocumentSource,
  StudioDocumentProduct,
} from "./contract";
import {
  PAPER,
  INK,
  MUTED,
  line,
  text,
  drawingHeading,
  type Fonts,
} from "./layout";
import { polygon, dimension, worldToProduct } from "./plan";
import { documentTextLines } from "./textLayout";
import { refinedExtras, refinedSpecificationRows } from "./refinedFacts";
const EDGE = rgb(0.48, 0.52, 0.49),
  PT_PER_MM = 72 / 25.4;
export function technicalLeader(
  page: PDFPage,
  fonts: Fonts,
  anchor: { x: number; y: number },
  label: { x: number; y: number; width: number },
  values: string[],
) {
  const right = label.x > anchor.x,
    edge = right ? label.x - 5 : label.x + label.width + 5,
    elbow = { x: right ? edge - 10 : edge + 10, y: label.y + 7 };
  line(page, anchor.x, anchor.y, elbow.x, elbow.y, 0.5, INK);
  line(page, elbow.x, elbow.y, edge, elbow.y, 0.5, INK);
  const angle = Math.atan2(elbow.y - anchor.y, elbow.x - anchor.x);
  line(
    page,
    anchor.x,
    anchor.y,
    anchor.x + 3.5 * Math.cos(angle - 0.4),
    anchor.y + 3.5 * Math.sin(angle - 0.4),
    0.55,
    INK,
  );
  line(
    page,
    anchor.x,
    anchor.y,
    anchor.x + 3.5 * Math.cos(angle + 0.4),
    anchor.y + 3.5 * Math.sin(angle + 0.4),
    0.55,
    INK,
  );
  let y = label.y;
  values.forEach((value, index) => {
    for (const lineValue of documentTextLines(
      value,
      label.width,
      index ? 8.5 : 8.8,
      index ? fonts.regular : fonts.medium,
    )) {
      text(
        page,
        lineValue,
        label.x,
        y,
        index ? 8.5 : 8.8,
        index ? fonts.regular : fonts.medium,
        index ? MUTED : INK,
      );
      y += 11.5;
    }
  });
}
function memberBand(
  page: PDFPage,
  a: { x: number; y: number },
  b: { x: number; y: number },
  width: number,
  fill: ReturnType<typeof rgb>,
) {
  const length = Math.hypot(b.x - a.x, b.y - a.y);
  if (length < 0.001) return;
  const dx = ((-(b.y - a.y) / length) * width) / 2,
    dy = (((b.x - a.x) / length) * width) / 2;
  polygon(
    page,
    [
      { x: a.x + dx, y: a.y + dy },
      { x: b.x + dx, y: b.y + dy },
      { x: b.x - dx, y: b.y - dy },
      { x: a.x - dx, y: a.y - dy },
    ],
    fill,
    EDGE,
    0.4,
  );
}
export function drawRefinedPlan(
  page: PDFPage,
  source: StudioClientDocumentSource,
  product: StudioDocumentProduct,
  fonts: Fonts,
  drawingBottom = 690,
) {
  const outline = product.plan.outline,
    xs = outline.map((p) => p.x),
    ys = outline.map((p) => p.y),
    minX = Math.min(...xs),
    maxX = Math.max(...xs),
    minY = Math.min(...ys),
    maxY = Math.max(...ys),
    flowHeight = Math.max(90, Math.min(410, drawingBottom - 240));
  const limit = Math.min(
      480 / Math.max(maxX - minX, 1),
      flowHeight / Math.max(maxY - minY, 1),
    ),
    denominator =
      [20, 25, 40, 50, 75, 100, 150, 200, 250].find(
        (d) => PT_PER_MM / d <= limit,
      ) ?? 300,
    scale = PT_PER_MM / denominator;
  const x0 = 485 + (480 - (maxX - minX) * scale) / 2,
    y0 = 240 + (flowHeight - (maxY - minY) * scale) / 2,
    map = (p: { x: number; y: number }) => ({
      x: x0 + (p.x - minX) * scale,
      y: y0 + (p.y - minY) * scale,
    });
  drawingHeading(
    page,
    product,
    `PROPOSED ROOF PLAN / 1:${denominator} @ A3`,
    fonts,
  );
  page.pushOperators(
    pushGraphicsState(),
    rectangle(276, PAPER.height - drawingBottom, 870, drawingBottom - 120),
    clip(),
    endPath(),
  );
  for (const house of source.houses) {
    const points = house.footprint.map((p) => map(worldToProduct(p, product))),
      hx = points.map((p) => p.x),
      hy = points.map((p) => p.y),
      left = Math.min(...hx),
      right = Math.max(...hx),
      top = Math.min(...hy),
      bottom = Math.max(...hy),
      visW = Math.max(0, Math.min(right, 1145) - Math.max(left, 276)),
      visH = Math.max(0, Math.min(bottom, drawingBottom) - Math.max(top, 120));
    if (
      visW < 150 ||
      visH < 50 ||
      (visW * visH) / Math.max((right - left) * (bottom - top), 1) < 0.3
    )
      continue;
    polygon(page, points, rgb(0.975, 0.96, 0.95), rgb(0.7, 0.65, 0.62), 0.5);
    for (const roof of house.roof)
      polygon(
        page,
        roof.map((p) => map(worldToProduct(p, product))),
        rgb(0.975, 0.96, 0.95),
        rgb(0.79, 0.75, 0.72),
        0.35,
      );
    const label = "HOUSE / SAVED CONTEXT";
    text(
      page,
      label,
      Math.max(282, left + 12),
      Math.max(134, top + 15),
      9,
      fonts.medium,
      MUTED,
    );
  }
  polygon(page, outline.map(map), rgb(0.97, 0.984, 0.976), EDGE, 0.6);
  for (const region of product.covering?.regions ?? [])
    polygon(
      page,
      region.boundary.map(map),
      region.material === "solid"
        ? rgb(0.94, 0.948, 0.925)
        : rgb(0.968, 0.985, 0.978),
      rgb(0.74, 0.78, 0.73),
      0.35,
    );
  const members = [
    ...product.plan.members.rafters,
    ...product.plan.members.beams,
    ...product.plan.members.ledgers,
    ...product.plan.members.gutters,
    ...product.plan.members.joiners,
    ...product.plan.members.ridge,
  ];
  for (const member of members) {
    const a = map(member.centerline.start),
      b = map(member.centerline.end);
    memberBand(
      page,
      a,
      b,
      member.profile.widthMm * scale,
      member.role === "rafter"
        ? rgb(0.91, 0.935, 0.91)
        : product.frameFinish === "White"
          ? rgb(0.96, 0.97, 0.95)
          : rgb(0.49, 0.55, 0.5),
    );
  }
  for (const member of product.plan.members.posts) {
    const p = map(member.centerline.start),
      w =
        Number(member.metadata?.footprintWidthMm ?? member.profile.widthMm) *
        scale,
      h =
        Number(
          member.metadata?.footprintProjectionMm ?? member.profile.widthMm,
        ) * scale;
    page.drawRectangle({
      x: p.x - w / 2,
      y: PAPER.height - p.y - h / 2,
      width: w,
      height: h,
      color: INK,
    });
  }
  for (const flashing of product.assembly.roofFlashings ?? [])
    for (const wing of flashing.wings)
      polygon(page, wing.boundary.map(map), rgb(0.78, 0.82, 0.77), EDGE, 0.4);
  for (const join of source.joins.filter((value) =>
    value.objectIds.includes(product.id),
  ))
    for (const boundary of join.polygons) {
      const local = boundary.map((p) => map(worldToProduct(p, product)));
      for (let i = 1; i < local.length; i++)
        line(
          page,
          local[i - 1].x,
          local[i - 1].y,
          local[i].x,
          local[i].y,
          1,
          rgb(0.44, 0.42, 0.35),
        );
    }
  for (const mesh of product.accessories) {
    const points = Array.from({ length: mesh.positions.length / 3 }, (_, i) =>
      map({ x: mesh.positions[3 * i], y: mesh.positions[3 * i + 1] }),
    );
    if (mesh.kind === "light") {
      if (points.length === 2)
        line(
          page,
          points[0].x,
          points[0].y,
          points[1].x,
          points[1].y,
          1.2,
          rgb(0.67, 0.58, 0.31),
        );
      else if (points.length) {
        const center = points.reduce(
          (s, p) => ({
            x: s.x + p.x / points.length,
            y: s.y + p.y / points.length,
          }),
          { x: 0, y: 0 },
        );
        page.drawCircle({
          x: center.x,
          y: PAPER.height - center.y,
          size: 1.8,
          color: rgb(0.72, 0.64, 0.36),
          borderColor: INK,
          borderWidth: 0.3,
        });
      }
    } else
      for (let i = 0; i < mesh.indices.length; i += 3)
        polygon(
          page,
          [
            points[mesh.indices[i]],
            points[mesh.indices[i + 1]],
            points[mesh.indices[i + 2]],
          ],
          mesh.kind === "timber"
            ? rgb(0.79, 0.69, 0.55)
            : mesh.kind === "acrylic"
              ? rgb(0.94, 0.97, 0.95)
              : rgb(0.6, 0.65, 0.6),
          EDGE,
          0.2,
        );
  }
  page.pushOperators(popGraphicsState());
  const a = map({ x: minX, y: minY }),
    b = map({ x: maxX, y: minY }),
    c = map({ x: maxX, y: maxY }),
    bottom = c.y,
    rightLabelX = Math.min(1018, b.x + 76),
    rightLabelWidth = 1148 - rightLabelX;
  dimension(page, fonts, a, b, (maxX - minX).toLocaleString("en-NZ"), -81);
  dimension(page, fonts, b, c, (maxY - minY).toLocaleString("en-NZ"), 43, true);
  const posts = [
    ...new Set(
      product.plan.members.posts
        .filter((p) => Math.abs(p.centerline.start.y - maxY) < 300)
        .map((p) => p.centerline.start.x),
    ),
  ].sort((a, b) => a - b);
  for (let i = 1; i < posts.length; i++)
    dimension(
      page,
      fonts,
      map({ x: posts[i - 1], y: minY }),
      map({ x: posts[i], y: minY }),
      Math.round(posts[i] - posts[i - 1]).toLocaleString("en-NZ"),
      -47,
    );
  if (posts.length > 1)
    text(
      page,
      "POST CENTRES",
      (a.x + b.x) / 2 - 30,
      a.y - 35,
      7,
      fonts.regular,
      MUTED,
    );
  for (const plane of product.assembly.roofPlanes) {
    const center = plane.boundary.reduce(
        (s, p) => ({
          x: s.x + p.x / plane.boundary.length,
          y: s.y + p.y / plane.boundary.length,
        }),
        { x: 0, y: 0 },
      ),
      p = map(center),
      fall = plane.fallVector,
      length = Math.hypot(fall.x, fall.y);
    if (!length) continue;
    const dx = fall.x / length,
      dy = fall.y / length,
      tip = { x: p.x + dx * 16, y: p.y + dy * 16 };
    line(page, p.x - dx * 16, p.y - dy * 16, tip.x, tip.y, 0.6, INK);
    line(
      page,
      tip.x,
      tip.y,
      tip.x - dx * 5 - dy * 3,
      tip.y - dy * 5 + dx * 3,
      0.6,
      INK,
    );
    line(
      page,
      tip.x,
      tip.y,
      tip.x - dx * 5 + dy * 3,
      tip.y - dy * 5 - dx * 3,
      0.6,
      INK,
    );
    const n = plane.plane.normal,
      pitch = (Math.atan2(Math.hypot(n.x, n.y), Math.abs(n.z)) * 180) / Math.PI;
    text(
      page,
      `${Math.round(pitch * 10) / 10}°`,
      p.x + 10,
      p.y - 13,
      8.5,
      fonts.medium,
    );
  }
  const nearestTop = (
    points: readonly { x: number; y: number }[],
    right = false,
  ) =>
    map(
      [...points].sort(
        (a, b) => a.y - b.y || (right ? b.x - a.x : a.x - b.x),
      )[0],
    );
  const acrylic = product.covering?.regions.find(
      (value) => value.material === "acrylic",
    ),
    solid = product.covering?.regions.find(
      (value) => value.material === "solid",
    ),
    specs = refinedSpecificationRows(product),
    roof =
      specs.find(([label]) => label === "ROOF")?.[1] ?? product.roofMaterial;
  if (solid)
    technicalLeader(
      page,
      fonts,
      nearestTop(solid.boundary),
      { x: 280, y: a.y - 16, width: 176 },
      [
        roof.toUpperCase(),
        specs.find(([label]) => label === "CEILING")?.[1] ?? "Solid roof zone",
      ],
    );
  else if (!acrylic)
    technicalLeader(
      page,
      fonts,
      nearestTop(outline),
      { x: 280, y: a.y - 16, width: 176 },
      [roof.toUpperCase(), product.frameFinish + " aluminium frame"],
    );
  if (acrylic)
    technicalLeader(
      page,
      fonts,
      nearestTop(acrylic.boundary, true),
      { x: rightLabelX, y: a.y - 25, width: rightLabelWidth },
      [
        "ACRYLIC SKYLIGHT",
        specs.find(([label]) => label === "SKYLIGHT")?.[1] ??
          "Selected acrylic roof zone",
      ],
    );
  const gutters = product.assembly.members
    .filter((m) => m.role === "gutter")
    .sort(
      (a, b) =>
        b.centerline.start.y +
        b.centerline.end.y -
        (a.centerline.start.y + a.centerline.end.y),
    );
  if (gutters[0]) {
    const member = gutters[0],
      end =
        member.centerline.start.x > member.centerline.end.x
          ? member.centerline.start
          : member.centerline.end;
    technicalLeader(
      page,
      fonts,
      map(end),
      { x: rightLabelX, y: bottom - 33, width: rightLabelWidth },
      [
        product.assembly.family === "gable"
          ? "EAVE GUTTERS"
          : "LOW-EDGE GUTTER",
        gutters.length > 1 ? `${gutters.length} shown` : "As shown",
      ],
    );
  }
  const flashing = product.assembly.roofFlashings?.find(
    (value) => value.metadata?.representativeGableRidge,
  );
  if (flashing?.wings[0])
    technicalLeader(
      page,
      fonts,
      map([...flashing.wings[0].boundary].sort((a, b) => b.x - a.x)[0]),
      { x: rightLabelX, y: (a.y + bottom) / 2 - 65, width: rightLabelWidth },
      ["RIDGE FLASHING", "Over roof junction"],
    );
  const frontPost = product.plan.members.posts
      .filter((p) => Math.abs(p.centerline.start.y - maxY) < 300)
      .sort((a, b) => a.centerline.start.x - b.centerline.start.x)[0],
    postCount = product.assembly.members.filter(
      (m) => m.role === "post",
    ).length;
  if (frontPost)
    technicalLeader(
      page,
      fonts,
      map(frontPost.centerline.start),
      { x: 280, y: bottom - 80, width: 176 },
      [
        "POSTS",
        `${postCount} positions shown`,
        product.assembly.supportConditions.some(
          (c) => c.type === "house_connection",
        )
          ? "House-connected frame"
          : "Freestanding frame",
      ],
    );
  const panel =
    product.accessories.find((m) => m.kind === "timber") ??
    (product.extras.infills.length
      ? product.accessories.find((m) => m.kind !== "light")
      : null);
  if (panel) {
    const points = Array.from(
        { length: panel.positions.length / 3 },
        (_, i) => ({
          x: panel.positions[3 * i],
          y: panel.positions[3 * i + 1],
        }),
      ),
      target = points.sort((a, b) => a.x - b.x || b.y - a.y)[0];
    technicalLeader(
      page,
      fonts,
      map(target),
      { x: 280, y: bottom - 20, width: 176 },
      [
        panel.kind === "timber" ? "TIMBER INFILL" : "SELECTED INFILL",
        drawingBottom !== 690
          ? "Complete schedule below."
          : (refinedExtras(product).find((row) => row.key === "infills")
              ?.value ?? "Selected infill"),
      ],
    );
  }
  const strip = product.accessories
    .filter((m) => m.kind === "light" && m.positions.length === 6)
    .at(-1);
  if (strip) {
    const points = [
        { x: strip.positions[0], y: strip.positions[1] },
        { x: strip.positions[3], y: strip.positions[4] },
      ],
      target = points.sort((a, b) => b.y - a.y || b.x - a.x)[0];
    technicalLeader(
      page,
      fonts,
      map(target),
      {
        x: rightLabelX,
        y:
          drawingBottom !== 690
            ? Math.min(bottom + 8, drawingBottom - 30)
            : bottom + 22,
        width: rightLabelWidth,
      },
      [
        "SELECTED LIGHTING",
        drawingBottom !== 690
          ? "Complete schedule below."
          : (refinedExtras(product).find((row) => row.key === "lights")
              ?.value ?? ""),
      ],
    );
  }
  text(
    page,
    "Roof outline and model sections. Dimensions in mm. Full saved house context and arrangement: A00.",
    280,
    drawingBottom === 690 ? 712 : 724,
    8,
    fonts.regular,
    MUTED,
  );
  return `1:${denominator} @ A3`;
}
