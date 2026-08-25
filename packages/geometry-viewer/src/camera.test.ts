// @vitest-environment node

import { describe, expect, it } from "vitest";
import {
  buildPresetCameraState,
  clampCameraStateToScene,
  fitDistanceForSize,
  pointDistance,
} from "./camera";

describe("geometry viewer camera primitives", () => {
  const target = { x: 100, y: 200, z: 300 };

  it("builds stable front, right, and top orthographic-compatible poses", () => {
    const front = buildPresetCameraState({
      target,
      distanceMm: 5000,
      viewPreset: "front",
      focusMode: "scene",
    });
    const right = buildPresetCameraState({
      target,
      distanceMm: 5000,
      viewPreset: "right",
      focusMode: "scene",
    });
    const top = buildPresetCameraState({
      target,
      distanceMm: 5000,
      viewPreset: "top",
      focusMode: "scene",
    });

    expect(front.position.x).toBeCloseTo(target.x);
    expect(front.position.y).toBeLessThan(target.y);
    expect(right.position.x).toBeGreaterThan(target.x);
    expect(right.position.y).toBeCloseTo(target.y);
    expect(top.position).toEqual({ x: target.x, y: target.y, z: 5300 });
    expect(pointDistance(front.position, target)).toBeCloseTo(5000);
    expect(pointDistance(right.position, target)).toBeCloseTo(5000);
    expect(pointDistance(top.position, target)).toBeCloseTo(5000);
  });

  it("fits and clamps camera distance from scene size", () => {
    expect(fitDistanceForSize(0)).toBeGreaterThanOrEqual(1200);

    const state = buildPresetCameraState({
      target,
      distanceMm: 100,
      viewPreset: "top",
      focusMode: "scene",
    });
    const clamped = clampCameraStateToScene({
      state,
      sceneBounds: {
        min: { x: 0, y: 0, z: 0 },
        max: { x: 10000, y: 5000, z: 2000 },
        center: target,
        size: 10000,
      },
    });

    expect(clamped.distanceMm).toBe(1800);
    expect(clamped.position).toEqual({ x: target.x, y: target.y, z: 2100 });
  });
});
