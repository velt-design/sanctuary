// @vitest-environment node

import { describe, expect, it } from "vitest";
import {
  allSceneBoundsFinite,
  computeSceneBoundsFromPoints,
  isRenderableLine,
  isRenderablePolygon,
} from "./scene";

describe("geometry viewer scene primitives", () => {
  it("computes deterministic bounds from renderable points", () => {
    const bounds = computeSceneBoundsFromPoints([
      { x: -1000, y: 500, z: 0 },
      { x: 3000, y: 2500, z: 1500 },
    ]);

    expect(bounds).toEqual({
      min: { x: -1000, y: 500, z: 0 },
      max: { x: 3000, y: 2500, z: 1500 },
      center: { x: 1000, y: 1500, z: 750 },
      size: 4000,
    });
    expect(allSceneBoundsFinite(bounds)).toBe(true);
  });

  it("preserves the existing empty-scene camera bounds", () => {
    expect(computeSceneBoundsFromPoints([])).toEqual({
      min: { x: -500, y: -500, z: 0 },
      max: { x: 500, y: 500, z: 1000 },
      center: { x: 0, y: 0, z: 500 },
      size: 2000,
    });
  });

  it("rejects collapsed lines and polygons", () => {
    expect(isRenderableLine({
      start: { x: 0, y: 0, z: 0 },
      end: { x: 0, y: 0, z: 0 },
    })).toBe(false);
    expect(isRenderablePolygon([
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 0, z: 0 },
      { x: 2, y: 0, z: 0 },
    ])).toBe(false);
  });
});
