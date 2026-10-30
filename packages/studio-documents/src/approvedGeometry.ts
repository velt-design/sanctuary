import { rgb, type PDFDocument, type PDFPage } from "pdf-lib";
import type { Point3 } from "@sp/geometry";
import type {
  StudioDocumentProduct,
  StudioClientDocumentSource,
} from "./contract";
import { actualParts, type Part } from "./approvedParts";
export { actualParts } from "./approvedParts";
import { encodeRgbPng } from "./png";
import { approvedGlazingBoundaries } from "./approvedRoofSurfaces";
type Projected = { x: number; y: number; depth: number };
type Face = Part & {
  faceIndex: number;
  world: Point3[];
  points: Projected[];
  normal: Point3;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};
type ProjectionView =
  | "plan"
  | "rcp"
  | "front"
  | "rear"
  | "side"
  | "right"
  | "iso";
export type DrawingGeometryOptions = {
  view: ProjectionView;
  viewport: { x: number; y: number; w: number; h: number };
  scale?: number;
  roof?: boolean;
  accessories?: boolean;
  frame?: boolean;
  edgeScale?: number;
  physicalDetails?: boolean;
  simplify?: boolean;
  elevationHierarchy?: boolean;
  signal?: AbortSignal;
  joins?: StudioClientDocumentSource["joins"];
};
const yieldTurn = () => new Promise<void>((resolve) => setImmediate(resolve));
export const projections = {
  plan: (p: Point3) => ({ x: p.x, y: p.y, depth: p.z }),
  rcp: (p: Point3) => ({ x: p.x, y: p.y, depth: -p.z }),
  front: (p: Point3) => ({ x: -p.x, y: -p.z, depth: p.y }),
  rear: (p: Point3) => ({ x: p.x, y: -p.z, depth: -p.y }),
  side: (p: Point3) => ({ x: -p.y, y: -p.z, depth: -p.x }),
  right: (p: Point3) => ({ x: p.y, y: -p.z, depth: p.x }),
  iso: (p: Point3) => ({
    x: ((p.y - p.x) * Math.sqrt(3)) / 2,
    y: (p.x + p.y) / 2 - p.z,
    depth: p.x + p.y + p.z,
  }),
};
const xyz = (p: Point3) =>
  `${p.x.toFixed(4)},${p.y.toFixed(4)},${p.z.toFixed(4)}`;
function normal(points: Point3[]) {
  const [a, b, c] = points,
    u = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z },
    v = { x: c.x - a.x, y: c.y - a.y, z: c.z - a.z };
  const n = {
      x: u.y * v.z - u.z * v.y,
      y: u.z * v.x - u.x * v.z,
      z: u.x * v.y - u.y * v.x,
    },
    l = Math.hypot(n.x, n.y, n.z) || 1;
  return { x: n.x / l, y: n.y / l, z: n.z / l };
}
const cross = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  a.x * b.y - a.y * b.x;
function intersection(a: Projected, b: Projected, c: Projected, d: Projected) {
  const r = { x: b.x - a.x, y: b.y - a.y },
    s = { x: d.x - c.x, y: d.y - c.y },
    den = cross(r, s);
  if (Math.abs(den) < 1e-8) return null;
  const o = { x: c.x - a.x, y: c.y - a.y },
    t = cross(o, s) / den,
    u = cross(o, r) / den;
  return t > 1e-7 && t < 1 - 1e-7 && u >= -1e-7 && u <= 1 + 1e-7 ? t : null;
}
function depthAt(p: Projected, points: Projected[]) {
  const [a, b, c] = points,
    den = (b.y - c.y) * (a.x - c.x) + (c.x - b.x) * (a.y - c.y);
  if (Math.abs(den) < 1e-9) return null;
  const u = ((b.y - c.y) * (p.x - c.x) + (c.x - b.x) * (p.y - c.y)) / den,
    v = ((c.y - a.y) * (p.x - c.x) + (a.x - c.x) * (p.y - c.y)) / den,
    w = 1 - u - v;
  return Math.min(u, v, w) >= -1e-6
    ? u * a.depth + v * b.depth + w * c.depth
    : null;
}
const lerp = (a: Projected, b: Projected, t: number) => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
  depth: a.depth + (b.depth - a.depth) * t,
});
function partColour(kind: string) {
  return kind === "fabric"
    ? [225, 229, 226]
    : kind === "timber" || kind === "cedar"
      ? [244, 239, 229]
      : kind === "glass" || kind === "acrylic"
        ? [249, 253, 254]
        : kind === "post"
          ? [251, 251, 250]
          : [246, 246, 246];
}
export async function drawGeometry(
  pdf: PDFDocument,
  page: PDFPage,
  product: StudioDocumentProduct,
  options: DrawingGeometryOptions,
) {
  const {
      view,
      viewport,
      scale: fixedScale,
      roof = true,
      accessories = true,
      frame = true,
      edgeScale = 1,
      physicalDetails = true,
      simplify = false,
    } = options,
    projection = projections[view],
    parts = actualParts(product, {
      roof,
      accessories,
      frame,
      physicalDetails,
      joins: options.joins,
    }),
    planLike = view === "plan" || view === "rcp";
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const part of parts)
    for (const tri of part.triangles)
      for (const p of tri) {
        const q = projection(p);
        minX = Math.min(minX, q.x);
        maxX = Math.max(maxX, q.x);
        minY = Math.min(minY, q.y);
        maxY = Math.max(maxY, q.y);
      }
  const scale =
    fixedScale ??
    Math.min(viewport.w / (maxX - minX), viewport.h / (maxY - minY));
  const fit = planLike
    ? { minX: 0, minY: 0, maxX: product.widthMm, maxY: product.projectionMm }
    : { minX, minY, maxX, maxY };
  const ox =
      viewport.x +
      (viewport.w - (fit.maxX - fit.minX) * scale) / 2 -
      fit.minX * scale,
    oy =
      viewport.y +
      (viewport.h - (fit.maxY - fit.minY) * scale) / 2 -
      fit.minY * scale;
  const map = (p: Pick<Point3, "x" | "y"> & Partial<Pick<Point3, "z">>) => {
    const q = projection({ ...p, z: p.z ?? 0 });
    return { x: ox + q.x * scale, y: oy + q.y * scale, depth: q.depth };
  };
  const faces: Face[] = [];
  const partFaces: { part: Part; faces: Face[] }[] = [];
  for (const part of parts) {
    const visible: Face[] = [];
    for (const points of part.triangles) {
      const q = points.map(map),
        det =
          (q[1].x - q[0].x) * (q[2].y - q[0].y) -
          (q[1].y - q[0].y) * (q[2].x - q[0].x);
      if (Math.abs(det) <= 1e-8) continue;
      const f = {
        ...part,
        faceIndex: faces.length,
        world: points,
        points: q,
        normal: normal(points),
        minX: Math.min(...q.map((p) => p.x)),
        maxX: Math.max(...q.map((p) => p.x)),
        minY: Math.min(...q.map((p) => p.y)),
        maxY: Math.max(...q.map((p) => p.y)),
      };
      visible.push(f);
      faces.push(f);
    }
    partFaces.push({ part, faces: visible });
  }
  const left = Math.floor(Math.min(...faces.map((f) => f.minX))) - 2,
    top = Math.floor(Math.min(...faces.map((f) => f.minY))) - 2;
  const width = Math.ceil(Math.max(...faces.map((f) => f.maxX)) - left) + 2,
    height = Math.ceil(Math.max(...faces.map((f) => f.maxY)) - top) + 2,
    density = 2;
  const w = width * density,
    h = height * density,
    pixels = new Uint8Array(w * h * 3);
  pixels.fill(255);
  const zbuffer = new Float64Array(w * h);
  zbuffer.fill(-Infinity);
  const materialBuffer = new Int32Array(w * h);
  materialBuffer.fill(-1);
  for (const glass of [false, true])
    for (const face of faces) {
      if (face.glass !== glass) continue;
      const points = face.points.map((p) => ({
        x: (p.x - left) * density,
        y: (p.y - top) * density,
        depth: p.depth,
      }));
      const [a, b, c] = points,
        den = (b.y - c.y) * (a.x - c.x) + (c.x - b.x) * (a.y - c.y);
      const colour = partColour(face.kind);
      const shade =
        view === "plan" ? 1 : 1 - 0.025 * (1 - Math.abs(face.normal.z));
      const xmin = Math.max(0, Math.floor(Math.min(...points.map((p) => p.x)))),
        xmax = Math.min(w - 1, Math.ceil(Math.max(...points.map((p) => p.x)))),
        ymin = Math.max(0, Math.floor(Math.min(...points.map((p) => p.y)))),
        ymax = Math.min(h - 1, Math.ceil(Math.max(...points.map((p) => p.y))));
      for (let y = ymin; y <= ymax; y++) {
        if (y % 32 === 0) {
          await yieldTurn();
          options.signal?.throwIfAborted();
        }
        for (let x = xmin; x <= xmax; x++) {
          const u =
              ((b.y - c.y) * (x + 0.5 - c.x) + (c.x - b.x) * (y + 0.5 - c.y)) /
              den,
            v =
              ((c.y - a.y) * (x + 0.5 - c.x) + (a.x - c.x) * (y + 0.5 - c.y)) /
              den,
            t = 1 - u - v;
          if (Math.min(u, v, t) < 0) continue;
          const d = u * a.depth + v * b.depth + t * c.depth,
            i = y * w + x;
          if (d < zbuffer[i] - 0.02) continue;
          if (!glass) {
            zbuffer[i] = d;
            materialBuffer[i] = face.faceIndex;
          }
          for (let k = 0; k < 3; k++)
            pixels[i * 3 + k] = glass
              ? Math.round(pixels[i * 3 + k] * 0.92 + colour[k] * 0.08)
              : Math.round(colour[k] * shade);
        }
      }
    }
  const png = await pdf.embedPng(await encodeRgbPng(w, h, pixels));
  page.drawImage(png, { x: left, y: 841.89 - top - height, width, height });
  const opaque = faces.filter((f) => !f.glass);
  let visibleEdges = 0;
  const draw = (a: Projected, b: Projected, width: number, colour: number[]) =>
    page.drawLine({
      start: { x: a.x, y: 841.89 - a.y },
      end: { x: b.x, y: 841.89 - b.y },
      thickness: width,
      color: rgb(colour[0], colour[1], colour[2]),
    });
  for (const { part, faces: pf } of partFaces) {
    options.signal?.throwIfAborted();
    await yieldTurn();
    if (view === "plan" && ["steel", "cedar"].includes(part.kind)) continue;
    const edges = new Map<
      string,
      { a: Projected; b: Projected; normals: Point3[] }
    >();
    for (const face of pf)
      for (let i = 0; i < 3; i++) {
        const a = face.world[i],
          b = face.world[(i + 1) % 3],
          key = [xyz(a), xyz(b)].sort().join("|");
        const found = edges.get(key);
        if (found) found.normals.push(face.normal);
        else edges.set(key, { a: map(a), b: map(b), normals: [face.normal] });
      }
    for (const edge of edges.values()) {
      if (
        edge.normals.length > 1 &&
        edge.normals.every(
          (n) =>
            Math.abs(
              n.x * edge.normals[0].x +
                n.y * edge.normals[0].y +
                n.z * edge.normals[0].z,
            ) > 0.99999,
        )
      )
        continue;
      if (part.kind === "steel" && edge.normals.length > 1) continue;
      if (Math.hypot(edge.b.x - edge.a.x, edge.b.y - edge.a.y) < 0.008)
        continue;
      const possible = opaque.filter(
        (f) =>
          f.maxX >= Math.min(edge.a.x, edge.b.x) - 0.01 &&
          f.minX <= Math.max(edge.a.x, edge.b.x) + 0.01 &&
          f.maxY >= Math.min(edge.a.y, edge.b.y) - 0.01 &&
          f.minY <= Math.max(edge.a.y, edge.b.y) + 0.01,
      );
      const stops = [0, 1];
      for (const f of possible)
        for (let j = 0; j < 3; j++) {
          const t = intersection(
            edge.a,
            edge.b,
            f.points[j],
            f.points[(j + 1) % 3],
          );
          if (t !== null) stops.push(t);
        }
      const sorted = [
        ...new Set(stops.map((v) => Math.round(v * 1e8) / 1e8)),
      ].sort((a, b) => a - b);
      for (let j = 0; j < sorted.length - 1; j++) {
        const mid = lerp(edge.a, edge.b, (sorted[j] + sorted[j + 1]) / 2);
        options.signal?.throwIfAborted();
        if (
          possible.some((f) => {
            const depth = depthAt(mid, f.points);
            return depth !== null && depth > mid.depth + 0.08;
          })
        )
          continue;
        if (simplify) {
          const dx = edge.b.x - edge.a.x,
            dy = edge.b.y - edge.a.y,
            length = Math.hypot(dx, dy),
            category = (k: string) =>
              ["cedar", "timber"].includes(k)
                ? "timber"
                : ["glass", "acrylic"].includes(k)
                  ? "glass"
                  : ["rafter", "joiner"].includes(k)
                    ? "rafter"
                    : k;
          const sample = (x: number, y: number) => {
            const px = Math.floor((x - left) * density),
              py = Math.floor((y - top) * density);
            return px < 0 || py < 0 || px >= w || py >= h
              ? null
              : faces[materialBuffer[py * w + px]];
          };
          const a = sample(
              mid.x - (dy / length) * 0.42,
              mid.y + (dx / length) * 0.42,
            ),
            b = sample(
              mid.x + (dy / length) * 0.42,
              mid.y - (dx / length) * 0.42,
            );
          if (a && b && category(a.kind) === category(b.kind)) continue;
        }
        const colour = part.glass
          ? [0.7, 0.76, 0.76]
          : part.kind === "steel"
            ? [0.63, 0.65, 0.65]
            : view === "rcp" && part.kind === "cedar"
              ? [0.64, 0.59, 0.5]
              : [0.29, 0.32, 0.3];
        const weight =
          view === "rcp" && part.kind === "cedar"
            ? 0.14
            : part.kind === "post"
              ? 0.6
              : part.kind === "beam" || part.kind === "gutter"
                ? 0.4
                : part.kind === "joiner"
                  ? 0.2
                  : part.glass
                    ? 0.16
                    : 0.29;
        const secondary =
          options.elevationHierarchy &&
          ["flashing", "cedar", "steel", "joiner"].includes(part.kind);
        const primary =
          options.elevationHierarchy && ["rafter", "beam"].includes(part.kind);
        draw(
          lerp(edge.a, edge.b, sorted[j]),
          lerp(edge.a, edge.b, sorted[j + 1]),
          (secondary ? 0.15 : primary ? 0.43 : weight) * edgeScale,
          secondary ? [0.61, 0.63, 0.61] : colour,
        );
        visibleEdges++;
      }
    }
  }
  // Opaque roof patterns use real selected-profile crest locations, not seams.
  if (roof && view !== "rcp" && !simplify) {
    for (const mesh of product.covering?.meshes.filter(
      (m) => m.kind === "steel",
    ) ?? []) {
      const index = Number(mesh.id.split("-").at(-1)),
        plane =
          product.assembly.roofPlanes[index]?.plane ??
          product.assembly.roofPlanes[0].plane;
      const z = (x: number, y: number) =>
        plane.origin.z -
        ((x - plane.origin.x) * plane.normal.x +
          (y - plane.origin.y) * plane.normal.y) /
          plane.normal.z;
      const xs = new Map<number, number>();
      let loY = Infinity,
        hiY = -Infinity;
      for (let i = 0; i < mesh.positions.length; i += 3) {
        const [x, y, h] = mesh.positions.slice(i, i + 3),
          key = Math.round(x * 1e5) / 1e5;
        xs.set(key, Math.max(xs.get(key) ?? -Infinity, h - z(x, y)));
        loY = Math.min(loY, y);
        hiY = Math.max(hiY, y);
      }
      const samples = [...xs].sort((a, b) => a[0] - b[0]);
      let i = 1;
      while (i < samples.length - 1) {
        let j = i;
        while (
          j + 1 < samples.length &&
          Math.abs(samples[j + 1][1] - samples[i][1]) < 0.001
        )
          j++;
        if (
          samples[i][1] > samples[i - 1][1] + 0.001 &&
          j < samples.length - 1 &&
          samples[j][1] > samples[j + 1][1] + 0.001
        ) {
          const x = (samples[i][0] + samples[j][0]) / 2,
            a = map({ x, y: loY, z: z(x, loY) + samples[i][1] }),
            b = map({ x, y: hiY, z: z(x, hiY) + samples[i][1] });
          const possible = opaque.filter(
            (f) =>
              f.id !== mesh.id &&
              f.maxX >= Math.min(a.x, b.x) - 0.01 &&
              f.minX <= Math.max(a.x, b.x) + 0.01 &&
              f.maxY >= Math.min(a.y, b.y) - 0.01 &&
              f.minY <= Math.max(a.y, b.y) + 0.01,
          );
          const stops = [0, 1];
          for (const f of possible)
            for (let k = 0; k < 3; k++) {
              const t = intersection(a, b, f.points[k], f.points[(k + 1) % 3]);
              if (t !== null) stops.push(t);
            }
          const sorted = [
            ...new Set(stops.map((t) => Math.round(t * 1e8) / 1e8)),
          ].sort((a, b) => a - b);
          for (let k = 0; k < sorted.length - 1; k++) {
            const mid = lerp(a, b, (sorted[k] + sorted[k + 1]) / 2);
            if (
              possible.some((f) => {
                const d = depthAt(mid, f.points);
                return d !== null && d > mid.depth + 0.1;
              })
            )
              continue;
            draw(
              lerp(a, b, sorted[k]),
              lerp(a, b, sorted[k + 1]),
              0.15 * edgeScale,
              [0.63, 0.65, 0.65],
            );
          }
        }
        i = j + 1;
      }
    }
  }
  if (planLike && roof) {
    const panes = approvedGlazingBoundaries(product);
    for (const boundary of panes) {
      const xs = boundary.map((p) => p.x),
        ys = boundary.map((p) => p.y),
        cx = (Math.min(...xs) + Math.max(...xs)) / 2;
      for (const fraction of [0.28, 0.74]) {
        const cy =
          Math.min(...ys) + (Math.max(...ys) - Math.min(...ys)) * fraction;
        for (const offset of [-18, 18])
          draw(
            map({ x: cx - 42 + offset, y: cy - 42, z: 0 }),
            map({ x: cx + 42 + offset, y: cy + 42, z: 0 }),
            0.15 * edgeScale,
            [0.74, 0.8, 0.8],
          );
      }
    }
  }
  // Conventional post-position footprints use the actual canonical support sizes.
  // They remain readable even when the roof/fascia hides the post top in plan.
  if (planLike)
    for (const post of product.plan.members.posts) {
      const q = map(post.centerline.start),
        width =
          Number(post.metadata?.footprintWidthMm ?? post.profile.widthMm) *
          scale,
        height =
          Number(post.metadata?.footprintProjectionMm ?? post.profile.widthMm) *
          scale;
      page.drawRectangle({
        x: q.x - width / 2,
        y: 841.89 - q.y - height / 2,
        width,
        height,
        color: rgb(0.985, 0.985, 0.98),
        borderColor: rgb(0.24, 0.27, 0.25),
        borderWidth: 0.65 * edgeScale,
      });
    }
  return {
    map,
    scale,
    extents: { minX, minY, maxX, maxY },
    visibleEdges,
    parts: parts.length,
    projectedFaces: faces.length,
    viewport,
  };
}
