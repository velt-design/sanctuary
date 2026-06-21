import type {
  GeometryMetadata,
  HouseRoofFeature3D,
  Point3,
  RoofPlane3D,
} from "../../contracts";
import { buildJoinedRectilinearHippedRoof } from "../roofJoinedHipped";
import { buildFlatHouseRoof, buildMonoHouseRoof } from "../roofPrimary";
import { buildRectangularRoof } from "../roofRectangle";
import { buildSkeletonRoof } from "../roofSkeleton";
import { composeFootprintFromComposition } from "./composeFootprintFromComposition";
import { detectFusedRectangle } from "./fusedRectangleDetector";
import {
  isAxisAlignedRectangle,
  type AxisAlignedRectangle,
  type HouseComposition,
  type RectangleRoofIntent,
} from "./types";

/**
 * PR-COMP1 (2026-06-18): orchestrator that turns a
 * `HouseComposition` (+ composite-level `eaveHeightMm`) into a
 * `HouseRoofBuildResult`-shaped output.
 *
 * Two strategies:
 *
 * 1. **Fused-rectangle shortcut.** If the composition's primitives
 *    union into a single axis-aligned rectangle AND every
 *    rectangle's roof intent is identical, route to one
 *    `buildRectangularRoof` call on the merged dimensions. One
 *    continuous hipped roof, one ridge, four facets. Visually
 *    correct AND geometrically correct.
 *
 * 2. **Per-rectangle stitched solve.** For non-fused compositions
 *    (L, T, U, cross) OR fused compositions with mismatched
 *    intents: solve each constituent rectangle independently using
 *    its own roof intent, then concatenate the resulting planes
 *    and features. Each rectangle's eave at the join edges becomes
 *    a "low ridge" where two roofs meet at eave height (water
 *    drains away on both sides). This is geometrically valid but
 *    architecturally simplified — a true unified-topology roof
 *    (with a single ridge merging across the union and proper
 *    valleys at inside corners) is deferred to COMP2.
 *
 *    The stitched-strategy result is stamped with
 *    `approximationReasons: ['composition_stitched_render']` so the
 *    workbench rail (PR-HR2) surfaces the limitation to designers.
 *
 * Caller responsibilities:
 *  - Run `validateHouseComposition` first. This function trusts its
 *    input (will throw on structurally bad compositions).
 *  - Provide `eaveHeightMm` — composite-level, shared across all
 *    constituents.
 *  - Run `applyRoofQa` on the result if QA gating is desired
 *    (matches the pattern of the existing builders). This function
 *    does NOT call `applyRoofQa` internally; QA is a downstream
 *    concern.
 *
 * Returns the same shape that existing builders return:
 *   `{ roofPlanes, roofFeatures, metadata }`
 * so downstream consumers (`applyRoofQa`, `buildHouseModel3D`
 * wiring in Phase 2) work without translation.
 */
export type ComposeRoofResult = {
  roofPlanes: RoofPlane3D[];
  roofFeatures: HouseRoofFeature3D[];
  metadata: GeometryMetadata;
};

export function composeRoofFromComposition(input: {
  composition: HouseComposition;
  eaveHeightMm: number;
  /**
   * PR-COMP-UNIFIED-3 (2026-06-19): composite-level roof intent
   * override. Per the composition vision doc, the composite owns the
   * roof intent — per-primitive intents are a v1 implementation
   * artifact and should not drive the solver.
   *
   * When provided, this intent replaces every primitive's intent at
   * the point of use: the orchestrator sees a uniform composition,
   * routes to the unified-wavefront path for hipped, and uses the
   * composite's pitch/ridgeAxis instead of primitive[0]'s.
   *
   * When omitted (callers that don't have composite-level intent),
   * falls back to per-primitive intent. Existing tests preserve
   * their behaviour without modification.
   */
  compositeRoofIntent?: RectangleRoofIntent;
}): ComposeRoofResult {
  if (input.composition.primitives.length === 0) {
    throw new Error("composeRoofFromComposition: empty composition");
  }
  const rawRectangles: AxisAlignedRectangle[] = [];
  for (const primitive of input.composition.primitives) {
    if (!isAxisAlignedRectangle(primitive)) {
      throw new Error(
        `composeRoofFromComposition: unsupported primitive kind ${primitive.kind}`,
      );
    }
    rawRectangles.push(primitive);
  }
  // Apply composite intent override if provided. Every rectangle's
  // intent becomes the composite intent; `intentsEqual` is trivially
  // true and the unified path takes over for hipped composites.
  const rectangles: AxisAlignedRectangle[] = input.compositeRoofIntent
    ? rawRectangles.map((r) => ({ ...r, roofIntent: input.compositeRoofIntent! }))
    : rawRectangles;

  const allIntentsIdentical = rectangles.every((r) =>
    intentsEqual(r.roofIntent, rectangles[0]!.roofIntent),
  );
  // PR-SS-7 (2026-06-21): the unified straight-skeleton solver only
  // needs the union polygon + one pitch — per-primitive cap / ridge-axis
  // / pitch differences are irrelevant to it. Those per-primitive
  // intents are a v1 authoring artifact (and drift after joins:
  // drag-resize leaves e.g. rect2.ridgeAxis 'x', rect0 startCap
  // 'open_gable'), so gating the unified solve on byte-identical intents
  // forced multi-rect hipped composites into the per-rectangle STITCHED
  // fallback, which overlaps/voids at the joins and fails roof QA with
  // `outside_eave_or_spans_void`. Gate the unified solve on "every
  // rectangle is hipped" instead so the composite always renders as one
  // coherent roof. (With a composite intent override the rectangles are
  // already uniform, so this only changes the no-override / drifted-
  // intent path — turning a broken stitched roof into a valid unified
  // one.)
  const allHipped = rectangles.every((r) => r.roofIntent.form === "hipped");

  // Single hipped rectangle: route through the rectangular builder so
  // the designer's ridge-axis choice is honoured, and stamp a unified
  // (non-stitched) result. (PR-SS-4: closes the 01 single-rect fixture
  // — it previously fell through to the per-rectangle stitched path.)
  if (rectangles.length === 1 && rectangles[0]!.roofIntent.form === "hipped") {
    const result = solveSingleRectangle({
      rectangle: rectangles[0]!,
      eaveHeightMm: input.eaveHeightMm,
      idSuffix: "rect1",
    });
    return {
      roofPlanes: result.roofPlanes,
      roofFeatures: result.roofFeatures,
      metadata: {
        roofGeometry: "composition_unified",
        roofTopologySolver: "composition_single_rectangle",
        compositionPrimitiveCount: 1,
      },
    };
  }

  // Strategy 1: fused-rectangle shortcut.
  if (allIntentsIdentical && rectangles.length > 1) {
    const unionPolygon = composeFootprintFromComposition(input.composition);
    const fused = detectFusedRectangle(unionPolygon);
    if (fused.fused) {
      const fusedRect: AxisAlignedRectangle = {
        kind: "axisAlignedRectangle",
        originXMm: fused.originXMm,
        originYMm: fused.originYMm,
        widthMm: fused.widthMm,
        depthMm: fused.depthMm,
        roofIntent: rectangles[0]!.roofIntent,
      };
      const result = solveSingleRectangle({
        rectangle: fusedRect,
        eaveHeightMm: input.eaveHeightMm,
        idSuffix: "fused",
      });
      return {
        roofPlanes: result.roofPlanes,
        roofFeatures: result.roofFeatures,
        metadata: {
          roofGeometry: "composition_fused_rectangle",
          roofTopologySolver: "composition_fused_rectangle",
          compositionPrimitiveCount: rectangles.length,
        },
      };
    }
  }

  // Strategy 2: unified-topology hipped solve. Routes the composite
  // union polygon to `buildJoinedRectilinearHippedRoof`, an inward-
  // wavefront solver that produces a single coherent roof with
  // valleys at reflex corners and hips at convex ones. Eligible only
  // when every rectangle has a hipped intent with identical pitch +
  // ridge axis (open-gable per-end caps are honored below via
  // perimeter-aware end derivation; v1 ignores them here and uses
  // the start/end caps from rectangles[0]).
  let compositionUnifiedAttempted = false;
  let compositionUnifiedFailureReason: string | null = null;
  if (
    allHipped &&
    rectangles.length > 1 &&
    rectangles[0]!.roofIntent.form === "hipped"
  ) {
    const intent = rectangles[0]!.roofIntent;
    const unionPolygon = composeFootprintFromComposition(input.composition);

    // Strategy 2a (PR-SS-4): orthogonal straight-skeleton solver. The
    // from-scratch equidistance engine produces a single coherent hipped
    // roof — exact ridges/valleys, area-conserving — for L/T/U/H/plus and
    // symmetric shapes. It self-guards (returns !ok with a typed error on
    // any shape it cannot yet fully resolve, e.g. some crossbar/stepped
    // junctions), so we fall through to the wavefront fallback below
    // rather than ever emitting overlapping facets.
    const skeletonRoof = buildSkeletonRoof({
      polygon: unionPolygon.map((p) => ({ x: Math.round(p.x), y: Math.round(p.y) })),
      eaveHeightMm: input.eaveHeightMm,
      roofPitchDeg: intent.pitchDeg,
    });
    if (skeletonRoof.ok) {
      return {
        roofPlanes: skeletonRoof.roofPlanes,
        roofFeatures: skeletonRoof.roofFeatures,
        metadata: {
          ...skeletonRoof.metadata,
          roofGeometry: "composition_unified",
          roofTopologySolver: "orthogonal_straight_skeleton",
          compositionPrimitiveCount: rectangles.length,
        },
      };
    }

    // Strategy 2b: unified wavefront fallback (the legacy inward-wavefront
    // solver) for shapes the skeleton cannot yet resolve.
    compositionUnifiedAttempted = true;
    // PR-COMP-UNIFIED-3 (2026-06-19): integer-snap the union polygon
    // before passing to the wavefront. Composition primitives carry
    // float-precision noise from drag-resize operations
    // (e.g. originXMm: `-3178.891240000001`). The wavefront's
    // collinearity / alignment checks treat near-zero-but-nonzero
    // offsets as real reflex vertices, generating spurious fallback
    // features that get classified as a topology failure. For house
    // geometry, 1mm precision is far more than enough; the snap
    // eliminates the noise without losing meaningful detail and lets
    // the wavefront produce clean topology on real composites.
    const eavePolygon: Point3[] = unionPolygon.map((p) => ({
      x: Math.round(p.x),
      y: Math.round(p.y),
      z: 0,
    }));
    const unified = buildJoinedRectilinearHippedRoof({
      eavePolygon,
      eaveHeightMm: input.eaveHeightMm,
      roofPitchDeg: intent.pitchDeg,
    });
    const topologyFailureReason =
      typeof unified.metadata?.roofTopologyFailureReason === "string"
        ? unified.metadata.roofTopologyFailureReason
        : null;
    if (topologyFailureReason === null && unified.roofPlanes.length > 0) {
      return {
        roofPlanes: unified.roofPlanes,
        roofFeatures: unified.roofFeatures,
        metadata: {
          ...(unified.metadata ?? {}),
          roofGeometry: "composition_unified",
          roofTopologySolver: "composition_joined_wavefront",
          compositionPrimitiveCount: rectangles.length,
        },
      };
    }
    compositionUnifiedFailureReason =
      topologyFailureReason ?? "unified_zero_planes";
  }

  // Strategy 3: per-rectangle stitched solve. Fallback for mixed
  // intents, mono/flat composites, or when the wavefront fails on a
  // specific geometry.
  const allPlanes: RoofPlane3D[] = [];
  const allFeatures: HouseRoofFeature3D[] = [];
  for (let i = 0; i < rectangles.length; i += 1) {
    const result = solveSingleRectangle({
      rectangle: rectangles[i]!,
      eaveHeightMm: input.eaveHeightMm,
      idSuffix: `rect${i + 1}`,
    });
    allPlanes.push(...result.roofPlanes);
    allFeatures.push(...result.roofFeatures);
  }

  return {
    roofPlanes: allPlanes,
    roofFeatures: allFeatures,
    metadata: {
      roofGeometry: "composition_stitched",
      roofTopologySolver: "composition_per_rectangle_stitched",
      compositionPrimitiveCount: rectangles.length,
      approximationReasons: "composition_stitched_render",
      compositionUnifiedAttempted,
      compositionUnifiedFailureReason,
    },
  };
}

function intentsEqual(a: RectangleRoofIntent, b: RectangleRoofIntent): boolean {
  if (a.form !== b.form) return false;
  if (a.form === "flat" && b.form === "flat") return true;
  if (a.form === "mono" && b.form === "mono") {
    return a.pitchDeg === b.pitchDeg && a.fallDirection === b.fallDirection;
  }
  if (a.form === "hipped" && b.form === "hipped") {
    return (
      a.pitchDeg === b.pitchDeg &&
      a.ridgeAxis === b.ridgeAxis &&
      a.startCap === b.startCap &&
      a.endCap === b.endCap
    );
  }
  return false;
}

/**
 * Solve a single axis-aligned rectangle's roof using its own intent.
 * Dispatches to `buildRectangularRoof` / `buildFlatHouseRoof` /
 * `buildMonoHouseRoof` based on the form.
 *
 * `idSuffix` is appended to plane / feature ids so that stitched
 * results from multiple rectangles don't collide on ids.
 */
function solveSingleRectangle(input: {
  rectangle: AxisAlignedRectangle;
  eaveHeightMm: number;
  idSuffix: string;
}): { roofPlanes: RoofPlane3D[]; roofFeatures: HouseRoofFeature3D[] } {
  const rect = input.rectangle;
  const intent = rect.roofIntent;
  const minX = rect.originXMm;
  const maxX = rect.originXMm + rect.widthMm;
  const minY = rect.originYMm;
  const maxY = rect.originYMm + rect.depthMm;
  const eavePolygon = [
    { x: minX, y: minY, z: 0 },
    { x: maxX, y: minY, z: 0 },
    { x: maxX, y: maxY, z: 0 },
    { x: minX, y: maxY, z: 0 },
  ];

  switch (intent.form) {
    case "flat": {
      const result = buildFlatHouseRoof({
        eavePolygon,
        eaveHeightMm: input.eaveHeightMm,
      });
      return suffixIds(
        { roofPlanes: result.roofPlanes, roofFeatures: result.roofFeatures },
        input.idSuffix,
      );
    }
    case "mono": {
      const result = buildMonoHouseRoof({
        eavePolygon,
        eaveHeightMm: input.eaveHeightMm,
        roofPitchDeg: intent.pitchDeg,
        fallDirection: intent.fallDirection,
      });
      return suffixIds(
        { roofPlanes: result.roofPlanes, roofFeatures: result.roofFeatures },
        input.idSuffix,
      );
    }
    case "hipped": {
      const result = buildRectangularRoof({
        minX,
        maxX,
        minY,
        maxY,
        eaveHeightMm: input.eaveHeightMm,
        roofPitchDeg: intent.pitchDeg,
        ridgeAxis: intent.ridgeAxis,
        startCap: intent.startCap,
        endCap: intent.endCap,
      });
      return suffixIds(result, input.idSuffix);
    }
  }
}

function suffixIds(
  input: { roofPlanes: RoofPlane3D[]; roofFeatures: HouseRoofFeature3D[] },
  suffix: string,
): { roofPlanes: RoofPlane3D[]; roofFeatures: HouseRoofFeature3D[] } {
  return {
    roofPlanes: input.roofPlanes.map((plane) => ({
      ...plane,
      id: `${plane.id}--${suffix}`,
    })),
    roofFeatures: input.roofFeatures.map((feature) => ({
      ...feature,
      id: `${feature.id}--${suffix}`,
    })),
  };
}
