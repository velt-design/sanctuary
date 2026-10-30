import { localDemoClearance } from "./demoContactClearance";
import { CUSTOMER_DIMENSION_BOUNDS } from "@sp/configurator/core";
import {
  solvePergolaPreview,
  solveSimpleCoverSurroundings,
} from "@sp/configurator/geometry";
import type { Point3 } from "@sp/geometry";
import type { resolveStudioWebsiteDesign } from "./websiteDesign";
import type { StudioHouse, HouseSide } from "./studioHouseScene";
import {
  solveStudioHouse,
  houseWorld,
  type StudioHouseTarget,
} from "./studioHouseGeometry";
import { websiteConnectionEdge } from "./websiteConnectionEdge";
import { boxedHouseSoffits } from "./studioHouseWebsiteContact";
import {prepareStudioFacadeClearance} from './studioFacadeClearanceGeometry';
import { StudioContactFitError } from './studioConnectionDiagnostics';

type Design = Extract<
  ReturnType<typeof resolveStudioWebsiteDesign>,
  { ok: true }
>["value"];
type Pose = { x: number; y: number; rotation: number };
const GAP = 5;
export function demoHouseSurface(h: StudioHouse, side: HouseSide) {
  const g = solveStudioHouse(h),
    r = (Number(h.position.rotationDeg) * Math.PI) / 180;
  const local =
    side === "front"
      ? { x: 0, y: -1 }
      : side === "rear"
        ? { x: 0, y: 1 }
        : side === "left"
          ? { x: -1, y: 0 }
          : { x: 1, y: 0 };
  const n = {
    x: local.x * Math.cos(r) - local.y * Math.sin(r),
    y: local.x * Math.sin(r) + local.y * Math.cos(r),
  };
  const project = (p: Point3) => p.x * n.x + p.y * n.y;
  const solids = g.model.solids!;
  const gutters = solids.linearSolids
    .flatMap((s) => s.renderMesh?.vertices ?? [])
    .map((p) => houseWorld(h, p));
  const roof = solids.surfaceSolids
    .filter((s) => s.kind === "roof")
    .flatMap((s) => s.renderMesh?.vertices ?? [])
    .map((p) => houseWorld(h, p));
  const fascia = solids.surfaceSolids
    .filter((s) => s.kind === "fascia")
    .flatMap((s) => s.renderMesh?.vertices ?? [])
    .map((p) => houseWorld(h, p));
  if (!gutters.length || !roof.length || !fascia.length)
    throw Error("Actual roof, fascia or gutter surfaces are unavailable.");
  const fasciaDepthMm = g.model.eave?.fasciaHeightMm;
  if (typeof fasciaDepthMm !== 'number' || !Number.isFinite(fasciaDepthMm) || fasciaDepthMm <= 0)
    throw Error('The actual fascia depth is unavailable.');
  const obstructionOuter = Math.max(
    ...[
      ...gutters,
      ...roof,
      ...fascia,
      ...boxedHouseSoffits(g).flatMap((s) => s.world),
    ].map(project),
  );
  return {
    facadeClearance: prepareStudioFacadeClearance(g),
    n,
    fasciaOuter: Math.max(...fascia.map(project)),
    obstructionOuter,
    gutterOuter: Math.max(...gutters.map(project)),
    gutterTop: Math.max(...gutters.map((p) => p.z)),
    gutterBottom: Math.min(...gutters.map((p) => p.z)),
    roofBottom: Math.min(...roof.map((p) => p.z)),
    fasciaBottom: Math.min(...fascia.map((p) => p.z)),
    fasciaDepthMm,
  };
}
/** Explicit representative-demo placement. Website family context owns lateral
 * separation; actual authored surfaces and the complete product bound the fit. */
export function demoContact(
  h: StudioHouse,
  side: HouseSide,
  design: Design,
  target: StudioHouseTarget,
) {
  const geometry = solvePergolaPreview(design.input, design.roof).geometry;
  if (!geometry) throw Error("Product geometry unavailable.");
  const context = solveSimpleCoverSurroundings(
    design.input,
    geometry.assembly,
    design.roof,
  );
  if (!context || context.roof.extrusionAxis === "y")
    throw Error(
      "This rectangular house cannot provide the shaped fascia required by this roof orientation.",
    );
  const method = design.input.connection,
    s = demoHouseSurface(h, side);
  const edge = websiteConnectionEdge(
    geometry.assembly,
    method === "facade" ? "underside" : "top",
  );
  const contextY =
    method === "facade"
      ? context.wall.max.y
      : method === "fascia"
        ? context.fascia.max.y
        : Math.max(...context.gutter.section.map((p) => p.y)) + GAP;
  // The parallel-gable context's existing rear-gutter separation is retained;
  // it is a representative relationship, not an invented fixing assembly.
  const localEdge = {
    ...edge,
    start: { ...edge.start, y: contextY },
    end: { ...edge.end, y: contextY },
  };
  // Start at the website ledger relationship. The final solved pose is fitted
  // only against finite overlapping house surfaces, never the distant roof apex.
  const height =
    method === "facade"
      ? s.fasciaBottom - GAP
      : method === "fascia"
        ? s.gutterTop - 135
        : s.gutterTop;
  if (method === "fascia") {
    const delta = s.fasciaOuter - projectDemoSurface(s, target.start);
    const shift = (p: Point3) => ({
      ...p,
      x: p.x + s.n.x * delta,
      y: p.y + s.n.y * delta,
    });
    target = { ...target, start: shift(target.start), end: shift(target.end) };
  }
  return {
    edge: localEdge,
    target: {
      ...target,
      start: { ...target.start, z: height },
      end: { ...target.end, z: height },
      heightMm: height,
    },
    surface: s,
  };
}
export function fitDemoContactVariants(
  method: Design["input"]["connection"],
  clearance: (datum: number) => ReturnType<typeof localDemoClearance>,
  datum: number,
) {
  if (method === "soffit") return datum;
  let fitted = datum;
  for (let attempt = 0; attempt < 3; attempt++) {
    const fit = clearance(fitted);
    if (fit.requiredDropMm <= 1e-4) return fitted;
    // The shared product solve quantizes some member datums to millimetres.
    // Fit the re-solved geometry, rounding only downward so the required gap remains real.
    fitted = Math.floor(fitted - fit.requiredDropMm);
    if (fitted < CUSTOMER_DIMENSION_BOUNDS.clearHeightMm.minimum) return fitted;
  }
  return fitted;
}
export type DemoHouseSurface = ReturnType<typeof demoHouseSurface>;
export function projectDemoSurface(s: DemoHouseSurface, p: Point3) {
  return p.x * s.n.x + p.y * s.n.y;
}
export function validateDemoContactArtifacts(
  s: DemoHouseSurface,
  method: Design["input"]["connection"],
  physicalPoints: Point3[],
  bottom: number,
  pose: Pose,
  target: StudioHouseTarget,
  verticalClearance: () => number,
) {
  const r = (pose.rotation * Math.PI) / 180,
    cos = Math.cos(r), sin = Math.sin(r);
  let minNormal = Infinity, maxZ = -Infinity;
  for (const p of physicalPoints) {
    const x = pose.x + p.x * cos - p.y * sin,
      y = pose.y + p.x * sin + p.y * cos;
    minNormal = Math.min(minNormal, x * s.n.x + y * s.n.y);
    maxZ = Math.max(maxZ, p.z);
  }
  const contact = projectDemoSurface(s, target.start);
  let clearance: number;
  if (method === "soffit") {
    clearance = minNormal - s.obstructionOuter;
    if (clearance < GAP - 1e-4)
      throw Error(
        `The complete roof is only ${clearance.toFixed(1)} mm from the gutter; at least 5 mm is required.`,
      );
  } else {
    if (minNormal < contact - 1e-4)
      throw Error(
        "The roof projects behind the supported connection surface. This method does not fit this house.",
      );
    clearance = verticalClearance();
    if (clearance < GAP - 1e-4)
      throw Error(
        `This roof reaches ${(GAP - clearance).toFixed(1)} mm into the required gutter/eave clearance. Choose Soffit or another compatible roof.`,
      );
    if (method === "fascia" && bottom < s.fasciaBottom + 50 - 1e-4)
      throw new StudioContactFitError(
        `The fascia is too short: this roof needs ${(s.fasciaBottom + 50 - bottom).toFixed(1)} mm more depth to retain the website ledger margin and 5 mm roof clearance. Choose Wall or Soffit.`,
        { kind: 'fascia-depth', requiredDepthMm: s.fasciaDepthMm + s.fasciaBottom + 50 - bottom },
      );
  }
  return {
    clearanceMm: clearance,
    minimumMm: GAP,
    axis: method === "soffit" ? "outward" : "vertical",
    maxProductZ: maxZ,
    minProductNormal: minNormal,
    gutterOuter: s.gutterOuter,
    gutterBottom: s.gutterBottom,
    fasciaBottom: s.fasciaBottom,
  };
}
