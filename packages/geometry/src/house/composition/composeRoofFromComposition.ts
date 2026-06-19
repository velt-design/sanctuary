import type {
  GeometryMetadata,
  HouseRoofFeature3D,
  Point3,
  RoofPlane3D,
} from "../../contracts";
import { buildJoinedRectilinearHippedRoof } from "../roofJoinedHipped";
import { buildFlatHouseRoof, buildMonoHouseRoof } from "../roofPrimary";
import { buildRectangularRoof } from "../roofRectangle";
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
}): ComposeRoofResult {
  if (input.composition.primitives.length === 0) {
    throw new Error("composeRoofFromComposition: empty composition");
  }
  const rectangles: AxisAlignedRectangle[] = [];
  for (const primitive of input.composition.primitives) {
    if (!isAxisAlignedRectangle(primitive)) {
      throw new Error(
        `composeRoofFromComposition: unsupported primitive kind ${primitive.kind}`,
      );
    }
    rectangles.push(primitive);
  }

  const allIntentsIdentical = rectangles.every((r) =>
    intentsEqual(r.roofIntent, rectangles[0]!.roofIntent),
  );

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
  if (
    allIntentsIdentical &&
    rectangles.length > 1 &&
    rectangles[0]!.roofIntent.form === "hipped"
  ) {
    const intent = rectangles[0]!.roofIntent;
    const unionPolygon = composeFootprintFromComposition(input.composition);
    const eavePolygon: Point3[] = unionPolygon.map((p) => ({
      x: p.x,
      y: p.y,
      z: 0,
    }));
    const unified = buildJoinedRectilinearHippedRoof({
      eavePolygon,
      eaveHeightMm: input.eaveHeightMm,
      roofPitchDeg: intent.pitchDeg,
    });
    const topologyFailed =
      typeof unified.metadata?.roofTopologyFailureReason === "string";
    if (!topologyFailed && unified.roofPlanes.length > 0) {
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
