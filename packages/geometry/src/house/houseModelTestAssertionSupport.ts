// Shared house-model test helpers split by responsibility.
import { expect } from "vitest";
import type {
  HouseRoofMaterial,
  Line3,
  Point3,
  Polygon3,
  RenderMesh3D,
} from "../contracts";
import type { HouseModel } from "./houseModelTestConfigSupport";
import {
  distanceToLine3D,
  dotPoint3,
  eavePolygonFromModel,
  lineLength3,
  normalizeVector3,
  pointDistanceSquared3,
  pointOnSegment2D,
  polygonAreaXY,
  polygonIsHorizontal,
  reflexEaveVertices,
  roofBoundarySegmentCounts,
  roofBoundarySegments,
  roofPointKey,
  roofSegmentKey,
  segmentInsidePolygon2D,
  subtractPoint3,
} from "./houseModelTestGeometrySupport";

export function expectRoofFacetsCoverEaveOnce(model: HouseModel): void {
  const eaveArea = polygonAreaXY(eavePolygonFromModel(model));
  const facetArea = model.roofPlanes.reduce(
    (sum, plane) => sum + polygonAreaXY(plane.boundary),
    0,
  );
  expect(Math.abs(facetArea - eaveArea)).toBeLessThan(100);
}

export function expectRoofQaValid(model: HouseModel): void {
  expect(model.metadata?.roofQaStatus).toBe("valid");
  expect(model.eave.metadata?.roofQaStatus).toBe("valid");
  expect(typeof model.metadata?.roofQaFacetAreaMm2).toBe("number");
  expect(typeof model.metadata?.roofQaEaveAreaMm2).toBe("number");
  expect(typeof model.metadata?.roofQaAreaDeltaMm2).toBe("number");
  expect(model.metadata?.roofQaRejectedFacetCount).toBe(0);
  expect(model.metadata?.roofQaFailureReason).toBeNull();
  expect(
    model.roofPlanes.every((plane) => plane.metadata?.roofQaStatus === "valid"),
  ).toBe(true);
  expect(
    model.roofFeatures?.every(
      (feature) => feature.metadata?.roofQaStatus === "valid",
    ),
  ).toBe(true);
  expect(
    Math.abs(Number(model.metadata?.roofQaAreaDeltaMm2 ?? Number.NaN)),
  ).toBeLessThanOrEqual(100);
}

export function expectRoofFacetsInsideEave(
  model: HouseModel,
  eaveHeightMm: number,
): void {
  const eavePolygon = eavePolygonFromModel(model);
  expect(eavePolygon.length).toBeGreaterThan(3);
  for (const roofPlane of model.roofPlanes) {
    for (let index = 0; index < roofPlane.boundary.length; index += 1) {
      const start = roofPlane.boundary[index]!;
      const end = roofPlane.boundary[(index + 1) % roofPlane.boundary.length]!;
      expect(
        segmentInsidePolygon2D(start, end, eavePolygon),
        `${roofPlane.id} segment ${index}`,
      ).toBe(true);
    }
  }
}


export function expectJoinedRoofFeaturesBackedByFinalFacets(model: HouseModel): void {
  const eavePolygon = eavePolygonFromModel(model);
  const counts = roofBoundarySegmentCounts(model);
  expect(model.roofFeatures?.length ?? 0).toBeGreaterThan(0);
  for (const feature of model.roofFeatures ?? []) {
    expect(feature.metadata?.roofFeatureSource, feature.id).toBe(
      "facet_adjacency",
    );
    expect(
      counts.get(roofSegmentKey(feature.line.start, feature.line.end)) ?? 0,
      feature.id,
    ).toBe(2);
    expect(
      segmentInsidePolygon2D(feature.line.start, feature.line.end, eavePolygon),
      feature.id,
    ).toBe(true);
  }
}

export function expectRoofBoundaryEavePointsAtEaveHeight(
  model: HouseModel,
  eaveHeightMm: number,
): void {
  const eavePolygon = eavePolygonFromModel(model);
  for (const roofPlane of model.roofPlanes) {
    for (const candidate of roofPlane.boundary) {
      if (
        eavePolygon.some((start, index) =>
          pointOnSegment2D(
            candidate,
            start,
            eavePolygon[(index + 1) % eavePolygon.length]!,
          ),
        )
      ) {
        expect(
          Math.abs(candidate.z - eaveHeightMm),
          `${roofPlane.id} ${roofPointKey(candidate)}`,
        ).toBeLessThanOrEqual(1);
      }
    }
  }
}

export function expectValleysStartAtReentrantCorners(
  model: HouseModel,
  eaveHeightMm: number,
  expectedCount: number,
): void {
  const reflexVertices = reflexEaveVertices(model);
  const valleys =
    model.roofFeatures?.filter((feature) => feature.kind === "valley") ?? [];
  expect(reflexVertices).toHaveLength(expectedCount);
  expect(valleys).toHaveLength(expectedCount);
  for (const vertex of reflexVertices) {
    const matchingValley = valleys.find(
      (feature) =>
        Math.abs(feature.line.start.x - vertex.x) <= 1 &&
        Math.abs(feature.line.start.y - vertex.y) <= 1 &&
        Math.abs(feature.line.start.z - eaveHeightMm) <= 1,
    );
    expect(matchingValley, `${vertex.x},${vertex.y}`).toBeDefined();
    expect(matchingValley?.metadata?.roofFeatureSource).toBe("facet_adjacency");
  }
}

export function expectNoInternalEaveHeightRoofSeams(
  model: HouseModel,
  eaveHeightMm: number,
): void {
  const eavePolygon = eavePolygonFromModel(model);
  const internalSegments: string[] = [];
  for (const roofPlane of model.roofPlanes) {
    for (let index = 0; index < roofPlane.boundary.length; index += 1) {
      const start = roofPlane.boundary[index]!;
      const end = roofPlane.boundary[(index + 1) % roofPlane.boundary.length]!;
      if (
        Math.abs(start.z - eaveHeightMm) > 1 ||
        Math.abs(end.z - eaveHeightMm) > 1
      )
        continue;
      const segmentLength = Math.hypot(end.x - start.x, end.y - start.y);
      const onEaveBoundary =
        eavePolygon.reduce((overlap, edgeStart, edgeIndex) => {
          const edgeEnd = eavePolygon[(edgeIndex + 1) % eavePolygon.length]!;
          if (
            !pointOnSegment2D(start, edgeStart, edgeEnd) &&
            !pointOnSegment2D(end, edgeStart, edgeEnd)
          ) {
            return overlap;
          }
          const axis =
            Math.abs(end.x - start.x) >= Math.abs(end.y - start.y) ? "x" : "y";
          const segmentMin = Math.min(start[axis], end[axis]);
          const segmentMax = Math.max(start[axis], end[axis]);
          const edgeMin = Math.min(edgeStart[axis], edgeEnd[axis]);
          const edgeMax = Math.max(edgeStart[axis], edgeEnd[axis]);
          return (
            overlap +
            Math.max(
              0,
              Math.min(segmentMax, edgeMax) - Math.max(segmentMin, edgeMin),
            )
          );
        }, 0) >=
        segmentLength - 5;
      if (!onEaveBoundary)
        internalSegments.push(`${roofPlane.id}:${roofSegmentKey(start, end)}`);
    }
  }
  expect(internalSegments).toEqual([]);
  expect(model.metadata?.roofTopologyInternalEaveHeightSegmentCount).toBe(0);
}

export function expectPoint3CloseTo(
  actual: Point3 | undefined,
  expected: Point3,
): void {
  expect(actual).toBeDefined();
  expect(actual?.x).toBeCloseTo(expected.x, 6);
  expect(actual?.y).toBeCloseTo(expected.y, 6);
  expect(actual?.z).toBeCloseTo(expected.z, 6);
}

export function expectUnorderedSegment3CloseTo(
  firstStart: Point3,
  firstEnd: Point3,
  secondStart: Point3,
  secondEnd: Point3,
): void {
  const directDistance =
    pointDistanceSquared3(firstStart, secondStart) +
    pointDistanceSquared3(firstEnd, secondEnd);
  const reversedDistance =
    pointDistanceSquared3(firstStart, secondEnd) +
    pointDistanceSquared3(firstEnd, secondStart);
  if (directDistance <= reversedDistance) {
    expectPoint3CloseTo(firstStart, secondStart);
    expectPoint3CloseTo(firstEnd, secondEnd);
  } else {
    expectPoint3CloseTo(firstStart, secondEnd);
    expectPoint3CloseTo(firstEnd, secondStart);
  }
}

export function expectPolygon3CloseTo(
  actual: Polygon3 | undefined,
  expected: Polygon3,
): void {
  expect(actual).toBeDefined();
  expect(actual).toHaveLength(expected.length);
  for (const [index, point] of expected.entries()) {
    expectPoint3CloseTo(actual?.[index], point);
  }
}

export function expectPolygon3CloseToIgnoringRotation(
  actual: Polygon3 | undefined,
  expected: Polygon3,
): void {
  expect(actual).toBeDefined();
  expect(actual).toHaveLength(expected.length);
  if (!actual || actual.length !== expected.length) return;

  const startIndexes = actual
    .map((candidate, index) =>
      pointDistanceSquared3(candidate, expected[0]!) <= 1e-6 ? index : null,
    )
    .filter((index): index is number => index !== null);
  expect(startIndexes.length).toBeGreaterThan(0);
  if (startIndexes.length === 0) return;

  const matches = startIndexes.some((startIndex) => {
    const forward = expected.every(
      (point, index) =>
        pointDistanceSquared3(
          actual[(startIndex + index) % actual.length]!,
          point,
        ) <= 1e-6,
    );
    const reverse = expected.every((point, index) => {
      const actualIndex = (startIndex - index + actual.length) % actual.length;
      return pointDistanceSquared3(actual[actualIndex]!, point) <= 1e-6;
    });
    return forward || reverse;
  });
  expect(matches).toBe(true);
  if (!matches) return;

  const startIndex = startIndexes[0]!;
  const forward = expected.every(
    (point, index) =>
      pointDistanceSquared3(
        actual[(startIndex + index) % actual.length]!,
        point,
      ) <= 1e-6,
  );
  for (const [index, point] of expected.entries()) {
    const actualIndex = forward
      ? (startIndex + index) % actual.length
      : (startIndex - index + actual.length) % actual.length;
    expectPoint3CloseTo(actual[actualIndex], point);
  }
}

export function expectSolidBoundariesExact(
  sourceBoundaries: Polygon3[],
  solidBoundaries: Polygon3[],
): void {
  expect(sourceBoundaries.length).toBeGreaterThan(0);
  expect(solidBoundaries).toHaveLength(sourceBoundaries.length);

  for (const [index, sourceBoundary] of sourceBoundaries.entries()) {
    expectPolygon3CloseTo(solidBoundaries[index], sourceBoundary);
  }
}

export function expectVerticalPrismRenderMesh(
  renderMesh: RenderMesh3D | undefined,
  bottomZ: number,
  topZ: number,
): void {
  expect(renderMesh).toBeDefined();
  expect(renderMesh?.vertices).toHaveLength(8);
  expect(renderMesh?.faces).toHaveLength(12);
  for (const vertex of renderMesh?.vertices.slice(0, 4) ?? []) {
    expect(vertex.z).toBeCloseTo(bottomZ, 6);
  }
  for (const vertex of renderMesh?.vertices.slice(4) ?? []) {
    expect(vertex.z).toBeCloseTo(topZ, 6);
  }
}

export function expectMiteredRenderMeshesAroundCorners(
  renderMeshes: Array<RenderMesh3D | undefined>,
  bottomZ: number,
  topZ: number,
): void {
  expect(renderMeshes.length).toBeGreaterThan(0);
  for (const renderMesh of renderMeshes) {
    expectVerticalPrismRenderMesh(renderMesh, bottomZ, topZ);
  }

  for (let index = 0; index < renderMeshes.length - 1; index += 1) {
    const renderMesh = renderMeshes[index]!;
    const nextRenderMesh = renderMeshes[index + 1]!;
    expectPoint3CloseTo(renderMesh?.vertices[1], nextRenderMesh?.vertices[0]!);
    expectPoint3CloseTo(renderMesh?.vertices[2], nextRenderMesh?.vertices[3]!);
    expectPoint3CloseTo(renderMesh?.vertices[5], nextRenderMesh?.vertices[4]!);
    expectPoint3CloseTo(renderMesh?.vertices[6], nextRenderMesh?.vertices[7]!);
  }
}

export function expectHouseGutterBoundariesUseProjection(model: HouseModel): void {
  const gutterBoundaries = model.eave.gutterBoundaries ?? [];
  const gutterLines = model.eave.gutterLines ?? [];
  const gutterSolids =
    model.solids?.linearSolids.filter((solid) => solid.kind === "gutter") ?? [];

  expect(gutterBoundaries).toHaveLength(gutterLines.length);

  for (const [index, boundary] of gutterBoundaries.entries()) {
    const gutterLine = gutterLines[index]!;
    const gutterSolid = gutterSolids[index]!;

    expectPolygon3CloseToIgnoringRotation(boundary, [
      {
        x: gutterSolid.renderMesh!.vertices[4]!.x,
        y: gutterSolid.renderMesh!.vertices[4]!.y,
        z: gutterLine.start.z,
      },
      {
        x: gutterSolid.renderMesh!.vertices[5]!.x,
        y: gutterSolid.renderMesh!.vertices[5]!.y,
        z: gutterLine.start.z,
      },
      {
        x: gutterSolid.renderMesh!.vertices[6]!.x,
        y: gutterSolid.renderMesh!.vertices[6]!.y,
        z: gutterLine.start.z,
      },
      {
        x: gutterSolid.renderMesh!.vertices[7]!.x,
        y: gutterSolid.renderMesh!.vertices[7]!.y,
        z: gutterLine.start.z,
      },
    ]);
  }

  for (let index = 0; index < gutterBoundaries.length - 1; index += 1) {
    const boundary = gutterBoundaries[index]!;
    const nextBoundary = gutterBoundaries[index + 1]!;
    if (
      pointDistanceSquared3(
        gutterLines[index]!.end,
        gutterLines[index + 1]!.start,
      ) > 1e-6
    )
      continue;
    expectPoint3CloseTo(boundary[1], nextBoundary[0]!);
    expectPoint3CloseTo(boundary[2], nextBoundary[3]!);
  }
}

export function expectHouseGutterSolidsMiteredAroundCorners(model: HouseModel): void {
  const gutterLines = model.eave.gutterLines ?? [];
  const gutterSolids =
    model.solids?.linearSolids.filter((solid) => solid.kind === "gutter") ?? [];

  expect(gutterLines.length).toBeGreaterThan(0);
  expect(gutterSolids).toHaveLength(gutterLines.length);

  for (const [index, gutterLine] of gutterLines.entries()) {
    const gutterSolid = gutterSolids[index]!;
    const sourceLength = lineLength3(gutterLine);
    const xAxis = {
      x: (gutterLine.end.x - gutterLine.start.x) / sourceLength,
      y: (gutterLine.end.y - gutterLine.start.y) / sourceLength,
      z: (gutterLine.end.z - gutterLine.start.z) / sourceLength,
    };
    const centerlineZ = gutterLine.start.z - gutterSolid.profileDepthMm / 2;

    expectPoint3CloseTo(gutterSolid.centerline.start, {
      x: gutterLine.start.x,
      y: gutterLine.start.y,
      z: centerlineZ,
    });
    expectPoint3CloseTo(gutterSolid.centerline.end, {
      x: gutterLine.end.x,
      y: gutterLine.end.y,
      z: centerlineZ,
    });
    expectPoint3CloseTo(
      gutterSolid.localFrame.origin,
      gutterSolid.centerline.start,
    );
    expect(gutterSolid.localFrame.xAxis.x).toBeCloseTo(xAxis.x, 6);
    expect(gutterSolid.localFrame.xAxis.y).toBeCloseTo(xAxis.y, 6);
    expect(gutterSolid.localFrame.xAxis.z).toBeCloseTo(xAxis.z, 6);
    expect(lineLength3(gutterSolid.centerline)).toBeCloseTo(sourceLength, 6);
    expectVerticalPrismRenderMesh(
      gutterSolid.renderMesh,
      centerlineZ - gutterSolid.profileDepthMm / 2,
      centerlineZ + gutterSolid.profileDepthMm / 2,
    );
  }

  for (let index = 0; index < gutterLines.length - 1; index += 1) {
    const current = gutterLines[index]!;
    const next = gutterLines[index + 1]!;
    if (pointDistanceSquared3(current.end, next.start) > 1e-6) continue;
    expectPoint3CloseTo(
      gutterSolids[index]?.renderMesh?.vertices[1],
      gutterSolids[index + 1]?.renderMesh?.vertices[0]!,
    );
    expectPoint3CloseTo(
      gutterSolids[index]?.renderMesh?.vertices[2],
      gutterSolids[index + 1]?.renderMesh?.vertices[3]!,
    );
    expectPoint3CloseTo(
      gutterSolids[index]?.renderMesh?.vertices[5],
      gutterSolids[index + 1]?.renderMesh?.vertices[4]!,
    );
    expectPoint3CloseTo(
      gutterSolids[index]?.renderMesh?.vertices[6],
      gutterSolids[index + 1]?.renderMesh?.vertices[7]!,
    );
  }
  expectHouseGutterBoundariesUseProjection(model);
}

export function expectHouseSurfaceSolidsUseExactBoundariesAndMiteredMeshes(
  model: HouseModel,
): void {
  const wallSolids =
    model.solids?.surfaceSolids.filter((solid) => solid.kind === "wall") ?? [];
  const fasciaPolygons = model.eave.fasciaPolygons ?? [];
  const fasciaSolids =
    model.solids?.surfaceSolids.filter((solid) => solid.kind === "fascia") ??
    [];
  const soffitPolygons = model.eave.soffitPolygons ?? [];
  const soffitSolids =
    model.solids?.surfaceSolids.filter((solid) => solid.kind === "soffit") ??
    [];

  expectSolidBoundariesExact(
    model.wallSegments.map((segment) => segment.boundary),
    wallSolids.map((solid) => solid.boundary),
  );
  expect(wallSolids.every((solid) => solid.thicknessMm === 150)).toBe(true);
  expectMiteredRenderMeshesAroundCorners(
    wallSolids.map((solid) => solid.renderMesh),
    0,
    model.wallSegments[0]!.boundary[2]!.z,
  );
  expectSolidBoundariesExact(
    fasciaPolygons,
    fasciaSolids.map((solid) => solid.boundary),
  );
  expect(fasciaSolids.every((solid) => solid.thicknessMm === 18)).toBe(true);
  for (const renderMesh of fasciaSolids.map((solid) => solid.renderMesh)) {
    expectVerticalPrismRenderMesh(renderMesh, 2220, 2400);
  }
  for (let index = 0; index < fasciaPolygons.length - 1; index += 1) {
    const current = fasciaPolygons[index]!;
    const next = fasciaPolygons[index + 1]!;
    if (pointDistanceSquared3(current[1]!, next[0]!) > 1e-6) continue;
    expectPoint3CloseTo(
      fasciaSolids[index]?.renderMesh?.vertices[1],
      fasciaSolids[index + 1]?.renderMesh?.vertices[0]!,
    );
    expectPoint3CloseTo(
      fasciaSolids[index]?.renderMesh?.vertices[2],
      fasciaSolids[index + 1]?.renderMesh?.vertices[3]!,
    );
    expectPoint3CloseTo(
      fasciaSolids[index]?.renderMesh?.vertices[5],
      fasciaSolids[index + 1]?.renderMesh?.vertices[4]!,
    );
    expectPoint3CloseTo(
      fasciaSolids[index]?.renderMesh?.vertices[6],
      fasciaSolids[index + 1]?.renderMesh?.vertices[7]!,
    );
  }
  expectSolidBoundariesExact(
    soffitPolygons,
    soffitSolids.map((solid) => solid.boundary),
  );
  expect(soffitSolids.every((solid) => solid.thicknessMm === 10)).toBe(true);
  for (const [index, solid] of soffitSolids.entries()) {
    if (polygonIsHorizontal(solid.boundary)) {
      expectVerticalPrismRenderMesh(solid.renderMesh, 2395, 2405);
      continue;
    }
    expect(solid.renderMesh, `soffit ${index + 1}`).toBeUndefined();
  }
  for (let index = 0; index < soffitPolygons.length - 1; index += 1) {
    const current = soffitPolygons[index]!;
    const next = soffitPolygons[index + 1]!;
    if (!polygonIsHorizontal(current) || !polygonIsHorizontal(next)) continue;
    if (pointDistanceSquared3(current[1]!, next[0]!) > 1e-6) continue;
    expectPoint3CloseTo(
      soffitSolids[index]?.renderMesh?.vertices[1],
      soffitSolids[index + 1]?.renderMesh?.vertices[0]!,
    );
    expectPoint3CloseTo(
      soffitSolids[index]?.renderMesh?.vertices[2],
      soffitSolids[index + 1]?.renderMesh?.vertices[3]!,
    );
    expectPoint3CloseTo(
      soffitSolids[index]?.renderMesh?.vertices[5],
      soffitSolids[index + 1]?.renderMesh?.vertices[4]!,
    );
    expectPoint3CloseTo(
      soffitSolids[index]?.renderMesh?.vertices[6],
      soffitSolids[index + 1]?.renderMesh?.vertices[7]!,
    );
  }
}

export function expectHouseRoofSolidsUseExactBoundariesAndMiteredMeshes(
  model: HouseModel,
): void {
  const roofSolids =
    model.solids?.surfaceSolids.filter((solid) => solid.kind === "roof") ?? [];

  expect(roofSolids).toHaveLength(model.roofPlanes.length);
  expectSolidBoundariesExact(
    model.roofPlanes.map((roofPlane) => roofPlane.boundary),
    roofSolids.map((solid) => solid.boundary),
  );

  for (const [roofPlaneIndex, roofPlane] of model.roofPlanes.entries()) {
    const roofSolid = roofSolids[roofPlaneIndex]!;
    const renderMesh = roofSolid.renderMesh;
    const roofNormal = normalizeVector3(roofPlane.plane.normal);
    const topPlaneConstant = dotPoint3(roofNormal, roofPlane.plane.origin);
    const expectedBottomPlaneOffset = roofNormal.z >= 0 ? -120 : 120;

    expect(roofSolid.thicknessMm).toBe(120);
    expect(renderMesh).toBeDefined();
    expect(renderMesh?.vertices).toHaveLength(roofPlane.boundary.length * 2);
    expect(renderMesh?.faces.length).toBeGreaterThan(0);
    expectPolygon3CloseTo(
      renderMesh?.vertices.slice(0, roofPlane.boundary.length),
      roofPlane.boundary,
    );

    for (const bottomVertex of renderMesh?.vertices.slice(
      roofPlane.boundary.length,
    ) ?? []) {
      expect(
        dotPoint3(roofNormal, bottomVertex) - topPlaneConstant,
      ).toBeCloseTo(expectedBottomPlaneOffset, 4);
    }
  }

  for (const references of roofBoundarySegments(model).values()) {
    if (references.length !== 2) continue;
    const [firstReference, secondReference] = references;
    const firstSolid = roofSolids[firstReference!.roofPlaneIndex]!;
    const secondSolid = roofSolids[secondReference!.roofPlaneIndex]!;
    const firstBoundaryLength = firstSolid.boundary.length;
    const secondBoundaryLength = secondSolid.boundary.length;
    const firstNext = (firstReference!.edgeIndex + 1) % firstBoundaryLength;
    const secondNext = (secondReference!.edgeIndex + 1) % secondBoundaryLength;

    expectUnorderedSegment3CloseTo(
      firstSolid.renderMesh!.vertices[
        firstBoundaryLength + firstReference!.edgeIndex
      ]!,
      firstSolid.renderMesh!.vertices[firstBoundaryLength + firstNext]!,
      secondSolid.renderMesh!.vertices[
        secondBoundaryLength + secondReference!.edgeIndex
      ]!,
      secondSolid.renderMesh!.vertices[secondBoundaryLength + secondNext]!,
    );
  }
}

export function expectHouseRoofFeatureFlashings(
  model: HouseModel,
  expectedKinds: Array<"ridge" | "hip" | "valley">,
): void {
  const featureById = new Map(
    (model.roofFeatures ?? []).map((feature) => [feature.id, feature]),
  );
  const roofSegments = roofBoundarySegments(model);
  const expectedFeatures = (model.roofFeatures ?? []).filter((feature) => {
    if (feature.metadata?.roofFeatureSource === "reentrant_fallback")
      return false;
    return (
      (
        roofSegments.get(
          roofSegmentKey(feature.line.start, feature.line.end),
        ) ?? []
      ).length === 2
    );
  });
  const flashings = (model.roofFlashings ?? []).filter(
    (flashing) => flashing.metadata?.featureKind != null,
  );

  expect(flashings).toHaveLength(expectedFeatures.length);
  expect(flashings.map((flashing) => flashing.metadata?.featureKind)).toEqual(
    expect.arrayContaining(expectedKinds),
  );

  for (const flashing of flashings) {
    const sourceFeatureId = flashing.metadata?.sourceFeatureId;
    const feature =
      typeof sourceFeatureId === "string"
        ? featureById.get(sourceFeatureId)
        : undefined;
    expect(feature, flashing.id).toBeDefined();
    if (!feature) continue;

    const adjacentReferences =
      roofSegments.get(roofSegmentKey(feature.line.start, feature.line.end)) ??
      [];
    const adjacentPlaneIndexes = adjacentReferences
      .map((reference) => reference.roofPlaneIndex)
      .sort((a, b) => a - b);

    expect(flashing.thicknessMm).toBe(1);
    expect(flashing.metadata).toMatchObject({
      source: "house_model",
      sourceFeatureId: feature.id,
      featureKind: feature.kind,
      position: feature.kind,
      girthMm: 300,
      wingLengthMm: 150,
      thicknessMm: 1,
      surfaceOffsetMm: 0.5,
    });
    expect(flashing.wings).toHaveLength(2);

    const wingPlaneIndexes = flashing.wings
      .map((wing) => {
        expect(wing.boundary.length, wing.id).toBeGreaterThanOrEqual(3);
        expect(
          wing.boundary.every(
            (candidate) =>
              Number.isFinite(candidate.x) &&
              Number.isFinite(candidate.y) &&
              Number.isFinite(candidate.z),
          ),
        ).toBe(true);
        expect(
          Math.min(
            ...wing.boundary.map((candidate) =>
              distanceToLine3D(candidate, feature.line),
            ),
          ),
          wing.id,
        ).toBeLessThanOrEqual(1);
        expect(
          Math.max(
            ...wing.boundary.map((candidate) =>
              distanceToLine3D(candidate, feature.line),
            ),
          ),
          wing.id,
        ).toBeLessThanOrEqual(151);

        const roofPlaneIndex = model.roofPlanes.findIndex(
          (roofPlane) => wing.id === `${flashing.id}-${roofPlane.id}-wing`,
        );
        expect(roofPlaneIndex, wing.id).toBeGreaterThanOrEqual(0);

        const roofPlane = model.roofPlanes[roofPlaneIndex]!;
        const roofNormal = normalizeVector3(roofPlane.plane.normal);
        const topNormal =
          roofNormal.z >= 0
            ? roofNormal
            : { x: -roofNormal.x, y: -roofNormal.y, z: -roofNormal.z };
        const topPlaneConstant = dotPoint3(topNormal, roofPlane.plane.origin);
        const projectedBoundary = wing.boundary.map((candidate) => ({
          x: candidate.x - topNormal.x * 0.5,
          y: candidate.y - topNormal.y * 0.5,
          z: candidate.z - topNormal.z * 0.5,
        }));
        for (let index = 0; index < projectedBoundary.length; index += 1) {
          expect(
            segmentInsidePolygon2D(
              projectedBoundary[index]!,
              projectedBoundary[(index + 1) % projectedBoundary.length]!,
              roofPlane.boundary,
            ),
            `${wing.id} edge ${index}`,
          ).toBe(true);
        }
        for (const candidate of wing.boundary) {
          expect(
            dotPoint3(topNormal, candidate) - topPlaneConstant,
            `${wing.id} ${roofPointKey(candidate)}`,
          ).toBeCloseTo(0.5, 3);
        }

        return roofPlaneIndex;
      })
      .sort((a, b) => a - b);

    expect(wingPlaneIndexes, flashing.id).toEqual(adjacentPlaneIndexes);
  }
}

export function expectHouseRoofMaterialVisuals(
  model: HouseModel,
  material: HouseRoofMaterial,
): void {
  const visuals = model.roofMaterialVisuals ?? [];

  expect(model.roofMaterial).toBe(material);
  expect(visuals.length).toBeGreaterThan(0);
  expect(visuals.every((visual) => visual.material === material)).toBe(true);

  for (const visual of visuals) {
    const roofPlane = model.roofPlanes.find(
      (candidate) => candidate.id === visual.roofPlaneId,
    );
    expect(roofPlane, visual.id).toBeDefined();
    if (!roofPlane) continue;

    const roofNormal = normalizeVector3(roofPlane.plane.normal);
    const topNormal =
      roofNormal.z >= 0
        ? roofNormal
        : { x: -roofNormal.x, y: -roofNormal.y, z: -roofNormal.z };
    const topPlaneConstant = dotPoint3(topNormal, roofPlane.plane.origin);
    const fallAxis = normalizeVector3(roofPlane.fallVector);

    expect(visual.surfaceOffsetMm).toBe(2);
    expect(visual.lines.length, visual.id).toBeGreaterThan(0);
    expect(visual.metadata).toMatchObject({
      source: "house_model",
      sourceRoofPlaneId: roofPlane.id,
      material,
      lineCount: visual.lines.length,
    });

    for (const materialLine of visual.lines) {
      for (const candidate of [materialLine.start, materialLine.end]) {
        expect(
          dotPoint3(topNormal, candidate) - topPlaneConstant,
          `${visual.id} ${roofPointKey(candidate)}`,
        ).toBeCloseTo(2, 3);
      }

      const projectedStart = {
        x: materialLine.start.x - topNormal.x * 2,
        y: materialLine.start.y - topNormal.y * 2,
        z: materialLine.start.z - topNormal.z * 2,
      };
      const projectedEnd = {
        x: materialLine.end.x - topNormal.x * 2,
        y: materialLine.end.y - topNormal.y * 2,
        z: materialLine.end.z - topNormal.z * 2,
      };
      expect(
        segmentInsidePolygon2D(
          projectedStart,
          projectedEnd,
          roofPlane.boundary,
        ),
        `${visual.id} clipped`,
      ).toBe(true);

      const lineDirection = normalizeVector3(
        subtractPoint3(materialLine.end, materialLine.start),
      );
      if (material === "shingles") {
        expect(
          Math.abs(dotPoint3(lineDirection, fallAxis)),
          visual.id,
        ).toBeLessThan(0.01);
      } else {
        expect(
          Math.abs(dotPoint3(lineDirection, fallAxis)),
          visual.id,
        ).toBeGreaterThan(0.99);
      }
    }
  }
}
