// @vitest-environment node

import type {
  ViewerSceneHouseLinearSolidObject,
  ViewerSceneHouseSurfaceSolidObject,
} from "@sp/geometry";
import { describe, expect, it } from "vitest";
import {
  buildDeckGrooveLines,
  buildLineGeometry,
  buildLinearSolidPlacement,
  buildPolygonGeometry,
  buildPolygonSlabGeometry,
  buildRenderMeshGeometry,
  resolveDeckMaterial,
} from "@sp/geometry-viewer/three";

const horizontalPlane = {
  origin: { x: 0, y: 0, z: 0 },
  xAxis: { x: 1, y: 0, z: 0 },
  yAxis: { x: 0, y: 1, z: 0 },
  normal: { x: 0, y: 0, z: 1 },
};

const square = [
  { x: 0, y: 0, z: 0 },
  { x: 1000, y: 0, z: 0 },
  { x: 1000, y: 1000, z: 0 },
  { x: 0, y: 1000, z: 0 },
];

describe("shared Three geometry builders", () => {
  it("builds line, polygon, mesh and slab buffers without browser globals", () => {
    const line = buildLineGeometry(square.slice(0, 2));
    const polygon = buildPolygonGeometry(square);
    const mesh = buildRenderMeshGeometry({
      vertices: square.slice(0, 3),
      faces: [[0, 1, 2]],
    });
    const slab = buildPolygonSlabGeometry(square, horizontalPlane, 50);

    expect(line.getAttribute("position").count).toBe(2);
    expect(polygon.getAttribute("position").count).toBe(6);
    expect(mesh?.getAttribute("position").count).toBe(3);
    expect(slab.getAttribute("position").count).toBeGreaterThan(6);
  });

  it("derives a stable local placement for linear solids", () => {
    const object: ViewerSceneHouseLinearSolidObject = {
      id: "gutter-1",
      type: "house_linear_solid",
      kind: "gutter",
      centerline: {
        start: { x: 0, y: 0, z: 100 },
        end: { x: 1000, y: 0, z: 100 },
      },
      localFrame: {
        origin: { x: 0, y: 0, z: 100 },
        xAxis: { x: 1, y: 0, z: 0 },
        yAxis: { x: 0, y: 1, z: 0 },
        zAxis: { x: 0, y: 0, z: 1 },
      },
      profileWidthMm: 100,
      profileDepthMm: 80,
    };

    const placement = buildLinearSolidPlacement(object);

    expect(placement?.lengthMm).toBe(1000);
    expect(placement?.matrix.elements.slice(12, 15)).toEqual([500, 0, 100]);
  });

  it("keeps deck material and groove generation in the shared visual layer", () => {
    const object: ViewerSceneHouseSurfaceSolidObject = {
      id: "deck-1",
      type: "house_surface_solid",
      kind: "deck",
      boundary: square,
      plane: horizontalPlane,
      thicknessMm: 50,
      metadata: {
        deckSurfaceMaterial: "composite",
        deckPresetRectWidthMm: 1000,
      },
    };

    expect(resolveDeckMaterial(object)).toBe("composite");
    expect(buildDeckGrooveLines(object).length).toBeGreaterThan(0);
  });
});
