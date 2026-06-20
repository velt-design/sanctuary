import { describe, expect, it } from "vitest";
import { buildSkeletonRoof } from "./roofSkeleton";
import { classifyVertex } from "../straightSkeleton/bisector";
import type { OrthogonalPolygon } from "../straightSkeleton/types";
import type { Polygon3 } from "../contracts";

/**
 * PR-SS-3 (2026-06-20): roof-translator spec. The translator turns the
 * straight-skeleton graph into roof facets + features. The invariants
 * here are the ones the roof QA gate (PR-SS-4) will later enforce, so
 * we assert them directly: one slope facet per eave, valley per reflex
 * corner, and area conservation (the facets partition the footprint).
 */

const EAVE = 2400;
const PITCH = 25;

function footprintAreaMm2(polygon: OrthogonalPolygon): number {
  let area2 = 0;
  for (let i = 0; i < polygon.length; i += 1) {
    const a = polygon[i]!;
    const b = polygon[(i + 1) % polygon.length]!;
    area2 += a.x * b.y - b.x * a.y;
  }
  return Math.abs(area2 / 2);
}

function facetPlanAreaMm2(boundary: Polygon3): number {
  let area2 = 0;
  for (let i = 0; i < boundary.length; i += 1) {
    const a = boundary[i]!;
    const b = boundary[(i + 1) % boundary.length]!;
    area2 += a.x * b.y - b.x * a.y;
  }
  return Math.abs(area2 / 2);
}

function reflexCount(polygon: OrthogonalPolygon): number {
  let c = 0;
  for (let i = 0; i < polygon.length; i += 1) {
    if (classifyVertex(polygon, i) === "reflex") c += 1;
  }
  return c;
}

const RECT: OrthogonalPolygon = [
  { x: 0, y: 0 },
  { x: 8000, y: 0 },
  { x: 8000, y: 5000 },
  { x: 0, y: 5000 },
];

const ASYM_L: OrthogonalPolygon = [
  { x: 0, y: 0 },
  { x: 30000, y: 0 },
  { x: 30000, y: 12000 },
  { x: 18000, y: 12000 }, // reflex
  { x: 18000, y: 20000 },
  { x: 0, y: 20000 },
];

const ASYM_T: OrthogonalPolygon = [
  { x: 0, y: 0 },
  { x: 40000, y: 0 },
  { x: 40000, y: 14000 },
  { x: 24000, y: 14000 }, // reflex
  { x: 24000, y: 30000 },
  { x: 14000, y: 30000 },
  { x: 14000, y: 14000 }, // reflex
  { x: 0, y: 14000 },
];

const ASYM_U: OrthogonalPolygon = [
  { x: 0, y: 0 },
  { x: 40000, y: 0 },
  { x: 40000, y: 24000 },
  { x: 26000, y: 24000 },
  { x: 26000, y: 10000 }, // reflex
  { x: 12000, y: 10000 }, // reflex
  { x: 12000, y: 24000 },
  { x: 0, y: 24000 },
];

const ASYM_PLUS: OrthogonalPolygon = [
  { x: 16000, y: 0 },
  { x: 28000, y: 0 },
  { x: 28000, y: 10000 }, // reflex
  { x: 44000, y: 10000 },
  { x: 44000, y: 20000 },
  { x: 28000, y: 20000 }, // reflex
  { x: 28000, y: 40000 },
  { x: 16000, y: 40000 },
  { x: 16000, y: 20000 }, // reflex
  { x: 0, y: 20000 },
  { x: 0, y: 10000 },
  { x: 16000, y: 10000 }, // reflex
];

function assertConsistentRoof(polygon: OrthogonalPolygon): void {
  const result = buildSkeletonRoof({ polygon, eaveHeightMm: EAVE, roofPitchDeg: PITCH });
  expect(result.ok, JSON.stringify((result as { error?: unknown }).error)).toBe(true);
  if (!result.ok) return;

  // One slope facet per eave (fully hipped).
  expect(result.roofPlanes.length, "facet count").toBe(polygon.length);

  // Every facet is a closed simple-ish polygon with positive plan area
  // and a high edge above the eave.
  let summedPlanArea = 0;
  for (const plane of result.roofPlanes) {
    expect(plane.boundary.length).toBeGreaterThanOrEqual(3);
    const area = facetPlanAreaMm2(plane.boundary);
    expect(area, `facet ${plane.id} plan area`).toBeGreaterThan(0);
    summedPlanArea += area;
    const maxZ = Math.max(...plane.boundary.map((p) => p.z));
    expect(maxZ, `facet ${plane.id} has a raised edge`).toBeGreaterThan(EAVE);
    // Eave corners stay at eave height.
    const minZ = Math.min(...plane.boundary.map((p) => p.z));
    expect(minZ).toBe(EAVE);
  }

  // Area conservation: facets partition the footprint exactly.
  expect(summedPlanArea).toBeCloseTo(footprintAreaMm2(polygon), 0);

  // Valley count == reflex-vertex count; at least one ridge.
  const valleys = result.roofFeatures.filter((f) => f.kind === "valley").length;
  expect(valleys, "valley count").toBe(reflexCount(polygon));
  if (polygon.length > 4) {
    expect(result.roofFeatures.some((f) => f.kind === "ridge")).toBe(true);
  }
}

describe("buildSkeletonRoof", () => {
  it("single rectangle → 4 facets, 0 valleys, area conserved", () => {
    const result = buildSkeletonRoof({ polygon: RECT, eaveHeightMm: EAVE, roofPitchDeg: PITCH });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.roofPlanes.length).toBe(4);
    expect(result.roofFeatures.filter((f) => f.kind === "valley").length).toBe(0);
    expect(result.roofFeatures.filter((f) => f.kind === "ridge").length).toBeGreaterThanOrEqual(1);
    const summed = result.roofPlanes.reduce((s, p) => s + facetPlanAreaMm2(p.boundary), 0);
    expect(summed).toBeCloseTo(footprintAreaMm2(RECT), 0);
  });

  it("ridge height matches pitch × half-span", () => {
    const result = buildSkeletonRoof({ polygon: RECT, eaveHeightMm: EAVE, roofPitchDeg: PITCH });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // 8000 × 5000 → ridge sits half the short span (2500) in, at
    // z = eave + 2500·tan(25°).
    const expectedRidgeZ = EAVE + 2500 * Math.tan((PITCH * Math.PI) / 180);
    const maxZ = Math.max(
      ...result.roofPlanes.flatMap((p) => p.boundary.map((pt) => pt.z)),
    );
    expect(maxZ).toBeCloseTo(expectedRidgeZ, 3);
  });

  it("asymmetric L → 6 facets, 1 valley, closed + area conserved", () => {
    assertConsistentRoof(ASYM_L);
  });

  it("asymmetric T / U → facets per eave, valley per reflex, area conserved", () => {
    assertConsistentRoof(ASYM_T);
    assertConsistentRoof(ASYM_U);
  });

  it("plus (4-way central convergence) → 12 facets, 4 valleys, area conserved", () => {
    // The equidistance/offset solver (PR-SS-2 part 3) resolves the 4-way
    // centre exactly — the convergence case the kinematic solver never
    // could. The roof partitions the footprint cleanly.
    assertConsistentRoof(ASYM_PLUS);
  });

  it("symmetric L / T (perfect-symmetry canaries) → area conserved", () => {
    const symmetricL: OrthogonalPolygon = [
      { x: 0, y: 0 },
      { x: 10000, y: 0 },
      { x: 10000, y: 5000 },
      { x: 5000, y: 5000 },
      { x: 5000, y: 10000 },
      { x: 0, y: 10000 },
    ];
    const symmetricT: OrthogonalPolygon = [
      { x: 0, y: 0 },
      { x: 30000, y: 0 },
      { x: 30000, y: 10000 },
      { x: 20000, y: 10000 },
      { x: 20000, y: 20000 },
      { x: 10000, y: 20000 },
      { x: 10000, y: 10000 },
      { x: 0, y: 10000 },
    ];
    assertConsistentRoof(symmetricL);
    assertConsistentRoof(symmetricT);
  });

  it("never emits silently-wrong geometry — unresolved shapes return a typed error", () => {
    // A few complex junctions (e.g. an H whose crossbar meets the bars
    // off-centre, or a many-vertex stepped plus) are not yet fully
    // resolved. The guards (completeness invariant + area conservation)
    // turn those into typed errors, never overlapping facets. This pins
    // that contract; flip the specific shape to assertConsistentRoof when
    // its junction case lands.
    const syntheticH: OrthogonalPolygon = [
      { x: 0, y: 0 }, { x: 6000, y: 0 }, { x: 6000, y: 4000 }, { x: 16000, y: 4000 },
      { x: 16000, y: 0 }, { x: 22000, y: 0 }, { x: 22000, y: 16000 }, { x: 16000, y: 16000 },
      { x: 16000, y: 12000 }, { x: 6000, y: 12000 }, { x: 6000, y: 16000 }, { x: 0, y: 16000 },
    ];
    const result = buildSkeletonRoof({ polygon: syntheticH, eaveHeightMm: EAVE, roofPitchDeg: PITCH });
    if (!result.ok) {
      expect(
        ["unsupported_topology", "facets_do_not_partition", "face_not_closed"].includes(result.error.code),
      ).toBe(true);
    }
    // If it does succeed, it must still conserve area (no silent overlap).
    if (result.ok) {
      const foot = Math.abs(footprintAreaMm2(syntheticH));
      const sum = result.roofPlanes.reduce((s, p) => s + facetPlanAreaMm2(p.boundary), 0);
      expect(Math.abs(sum - foot)).toBeLessThanOrEqual(Math.max(1, foot * 1e-6));
    }
  });
});
