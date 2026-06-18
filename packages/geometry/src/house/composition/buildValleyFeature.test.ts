import { describe, expect, it } from "vitest";
import type {
  AxisAlignedRectangle,
  HouseComposition,
} from "./types";
import {
  buildValleyFeatureLine,
  deriveLClassValleyLine,
  deriveInsideCornerValleys,
} from "./buildValleyFeature";

function rect(input: {
  x: number;
  y: number;
  w: number;
  d: number;
}): AxisAlignedRectangle {
  return {
    kind: "axisAlignedRectangle",
    originXMm: input.x,
    originYMm: input.y,
    widthMm: input.w,
    depthMm: input.d,
  };
}

describe("buildValleyFeatureLine (PR-COMP1)", () => {
  it("wraps a start/end into a HouseRoofFeature3D valley", () => {
    const feature = buildValleyFeatureLine({
      id: "house-valley-1",
      start: { x: 0, y: 0, z: 2400 },
      end: { x: 1000, y: 1000, z: 3000 },
      metadata: { custom: "value" },
    });
    expect(feature).toEqual({
      id: "house-valley-1",
      kind: "valley",
      line: {
        start: { x: 0, y: 0, z: 2400 },
        end: { x: 1000, y: 1000, z: 3000 },
      },
      metadata: { custom: "value" },
    });
  });
});

describe("deriveLClassValleyLine (PR-COMP1)", () => {
  it("climbs at 45° in plan and terminates at the lower of the two ridge heights", () => {
    // Both rectangles at 25° pitch. Main is 12500 × 8000 (min dim
    // 8000 → half = 4000); extension is 5814 × 2400 (min dim 2400
    // → half = 1200). Extension's ridge is lower, so the valley
    // tops out at extension's ridge height.
    const main = rect({ x: 0, y: 0, w: 12500, d: 8000 });
    const extension = rect({ x: 0, y: -2400, w: 5814, d: 2400 });
    const line = deriveLClassValleyLine({
      cornerXY: { x: 5814, y: 0 },
      inwardDirection: { x: -1, y: 1 },
      rectangleA: main,
      rectangleB: extension,
      eaveHeightMm: 2400,
      pitchDeg: 25,
    });

    expect(line.start).toEqual({ x: 5814, y: 0, z: 2400 });

    const tan25 = Math.tan((25 * Math.PI) / 180);
    const expectedRiseMm = 1200 * tan25; // extension half-min-dim * tan(pitch)
    const expectedDiagonalInPlan = expectedRiseMm / tan25; // = 1200
    const expectedComponent = expectedDiagonalInPlan / Math.SQRT2;
    expect(line.end.x).toBeCloseTo(5814 - expectedComponent, 6);
    expect(line.end.y).toBeCloseTo(0 + expectedComponent, 6);
    expect(line.end.z).toBeCloseTo(2400 + expectedRiseMm, 6);
  });
});

describe("deriveInsideCornerValleys (PR-COMP1)", () => {
  it("emits exactly one valley for an L-shape inside corner", () => {
    // Graham–Oratia v1 (~dimensions). Main 12500 × 8000 at (0,0);
    // extension 5814 × 2400 at (0,-2400). One inside corner at
    // (5814, 0).
    const main = rect({ x: 0, y: 0, w: 12500, d: 8000 });
    const extension = rect({ x: 0, y: -2400, w: 5814, d: 2400 });
    const composition: HouseComposition = {
      primitives: [main, extension],
      joins: [
        {
          fromPrimitiveIndex: 0,
          fromEdge: "south",
          toPrimitiveIndex: 1,
          toEdge: "north",
        },
      ],
    };
    const valleys = deriveInsideCornerValleys({
      composition,
      eaveHeightMm: 2400,
      pitchDeg: 25,
    });
    expect(valleys).toHaveLength(1);
    const v = valleys[0]!;
    expect(v.kind).toBe("valley");
    expect(v.line.start.x).toBeCloseTo(5814, 6);
    expect(v.line.start.y).toBeCloseTo(0, 6);
    expect(v.line.start.z).toBeCloseTo(2400, 6);
    // Climbs into the union interior (NW from the corner).
    expect(v.line.end.x).toBeLessThan(v.line.start.x);
    expect(v.line.end.y).toBeGreaterThan(v.line.start.y);
    expect(v.line.end.z).toBeGreaterThan(v.line.start.z);
    expect(v.metadata?.valleyClass).toBe("l_class_inside_corner");
  });

  it("emits two valleys for a T-shape (north join with bar wider than stem on both sides)", () => {
    // Bar 9000 × 2000 at (0,0); stem 3000 × 3000 at (3000, 2000).
    // Inside corners at (3000, 2000) and (6000, 2000).
    const bar = rect({ x: 0, y: 0, w: 9000, d: 2000 });
    const stem = rect({ x: 3000, y: 2000, w: 3000, d: 3000 });
    const composition: HouseComposition = {
      primitives: [bar, stem],
      joins: [
        {
          fromPrimitiveIndex: 0,
          fromEdge: "north",
          toPrimitiveIndex: 1,
          toEdge: "south",
        },
      ],
    };
    const valleys = deriveInsideCornerValleys({
      composition,
      eaveHeightMm: 2400,
      pitchDeg: 25,
    });
    expect(valleys).toHaveLength(2);
    const xs = valleys.map((v) => v.line.start.x).sort((a, b) => a - b);
    expect(xs[0]).toBeCloseTo(3000, 6);
    expect(xs[1]).toBeCloseTo(6000, 6);
    // Both climb into the union interior (toward y > 2000 — the stem).
    for (const v of valleys) {
      expect(v.line.start.y).toBeCloseTo(2000, 6);
      expect(v.line.end.y).toBeGreaterThan(v.line.start.y);
      expect(v.line.end.z).toBeGreaterThan(v.line.start.z);
    }
  });

  it("emits zero valleys for a fully-fused side-by-side join (no reflex perimeter)", () => {
    // Two 6000 × 4000 rectangles snapped on east↔west edges of
    // identical extent. The union is 12000 × 4000 — no inside
    // corner anywhere.
    const left = rect({ x: 0, y: 0, w: 6000, d: 4000 });
    const right = rect({ x: 6000, y: 0, w: 6000, d: 4000 });
    const composition: HouseComposition = {
      primitives: [left, right],
      joins: [
        {
          fromPrimitiveIndex: 0,
          fromEdge: "east",
          toPrimitiveIndex: 1,
          toEdge: "west",
        },
      ],
    };
    const valleys = deriveInsideCornerValleys({
      composition,
      eaveHeightMm: 2400,
      pitchDeg: 25,
    });
    expect(valleys).toHaveLength(0);
  });
});
