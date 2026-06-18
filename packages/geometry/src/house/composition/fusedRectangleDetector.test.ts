import { describe, expect, it } from "vitest";
import type { Polygon3 } from "../../contracts";
import { detectFusedRectangle } from "./fusedRectangleDetector";

function poly(points: Array<[number, number]>): Polygon3 {
  return points.map(([x, y]) => ({ x, y, z: 0 }));
}

describe("detectFusedRectangle (PR-COMP1)", () => {
  it("detects a clean axis-aligned rectangle", () => {
    const result = detectFusedRectangle(
      poly([
        [0, 0],
        [6000, 0],
        [6000, 4000],
        [0, 4000],
      ]),
    );
    expect(result).toEqual({
      fused: true,
      originXMm: 0,
      originYMm: 0,
      widthMm: 6000,
      depthMm: 4000,
    });
  });

  it("detects a rectangle regardless of corner ordering", () => {
    // CCW starting from north-east
    const result = detectFusedRectangle(
      poly([
        [6000, 4000],
        [0, 4000],
        [0, 0],
        [6000, 0],
      ]),
    );
    expect(result.fused).toBe(true);
    if (result.fused) {
      expect(result.widthMm).toBe(6000);
      expect(result.depthMm).toBe(4000);
    }
  });

  it("rejects an L-shape (6 vertices)", () => {
    const result = detectFusedRectangle(
      poly([
        [0, -2400],
        [5814, -2400],
        [5814, 0],
        [12500, 0],
        [12500, 8000],
        [0, 8000],
      ]),
    );
    expect(result).toEqual({ fused: false });
  });

  it("rejects a degenerate polygon (3 vertices)", () => {
    const result = detectFusedRectangle(
      poly([
        [0, 0],
        [6000, 0],
        [3000, 4000],
      ]),
    );
    expect(result).toEqual({ fused: false });
  });

  it("rejects a 4-vertex polygon with zero area", () => {
    const result = detectFusedRectangle(
      poly([
        [0, 0],
        [6000, 0],
        [6000, 0],
        [0, 0],
      ]),
    );
    expect(result).toEqual({ fused: false });
  });
});
