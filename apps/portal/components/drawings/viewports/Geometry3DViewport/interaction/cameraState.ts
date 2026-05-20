import * as THREE from "three";
import type { Point3 } from "@sp/geometry";
import type { SceneBounds } from "../geometry/sceneBoundsTypes";

/**
 * Camera-state types and helpers for the 3D viewport. The viewport
 * keeps a single `GeometryCameraState` object in component state and
 * pushes it back to the parent via `Geometry3DViewportState` so the
 * choice of preset / target / distance persists across remounts (e.g.
 * when the user switches the active object family).
 *
 * The helpers here split into three groups:
 *  - format*           — human-readable labels for UI badges
 *  - pointToVector etc — small THREE.Vector3 ⇄ Point3 conversions
 *  - build/default/clamp/cameraStatesEqual — pure transforms over
 *    `GeometryCameraState` consumed by the orbit-controls bridge in
 *    the main component.
 *
 * Pure module: no React, no DOM, no scene access. Scene-derived inputs
 * (a `SceneBounds`) arrive as parameters.
 */

export type GeometryCameraPreset = "iso" | "front" | "right" | "top" | "custom";

export type GeometryCameraFocusMode = "scene" | "selection" | "manual";

export type GeometryCameraState = {
  position: Point3;
  target: Point3;
  distanceMm: number;
  viewPreset: GeometryCameraPreset;
  focusMode: GeometryCameraFocusMode;
};

export type Geometry3DViewportState = {
  cameraState: GeometryCameraState;
};

export type GeometryViewportCamera = THREE.PerspectiveCamera | THREE.OrthographicCamera;

export function pointToVector(point: Point3): THREE.Vector3 {
  return new THREE.Vector3(point.x, point.y, point.z);
}

export function vectorToPoint(vector: THREE.Vector3): Point3 {
  return {
    x: vector.x,
    y: vector.y,
    z: vector.z,
  };
}

export function formatVector(vector: { x: number; y: number; z: number }): string {
  return `${vector.x.toFixed(3)}, ${vector.y.toFixed(3)}, ${vector.z.toFixed(3)}`;
}

export function offsetPoint(
  origin: Point3,
  direction: { x: number; y: number; z: number },
  distance: number,
): Point3 {
  const vector = pointToVector(origin).add(
    new THREE.Vector3(direction.x, direction.y, direction.z).multiplyScalar(
      distance,
    ),
  );
  return vectorToPoint(vector);
}

export function formatPoint(point: Point3): string {
  return `${Math.round(point.x)}, ${Math.round(point.y)}, ${Math.round(point.z)} mm`;
}

export function formatCameraFocusMode(focusMode: GeometryCameraFocusMode): string {
  if (focusMode === "scene") return "Scene";
  if (focusMode === "selection") return "Selected";
  return "Manual";
}

export function formatCameraPreset(viewPreset: GeometryCameraPreset): string {
  if (viewPreset === "iso") return "Iso";
  if (viewPreset === "front") return "Front";
  if (viewPreset === "right") return "Right";
  if (viewPreset === "custom") return "Custom";
  return "Top";
}

export function fitDistanceForSize(size: number, fovDeg = 40): number {
  const radius = Math.max(size, 1000) / 2;
  const fovRadians = THREE.MathUtils.degToRad(fovDeg / 2);
  return Math.max((radius / Math.tan(fovRadians)) * 1.25, 1200);
}

export function directionForPreset(viewPreset: GeometryCameraPreset): THREE.Vector3 {
  if (viewPreset === "front") return new THREE.Vector3(0, -1, 0.28).normalize();
  if (viewPreset === "right") return new THREE.Vector3(1, 0, 0.28).normalize();
  if (viewPreset === "top")
    return new THREE.Vector3(0, 0, 1).normalize();
  return new THREE.Vector3(1, -1.15, 0.82).normalize();
}

export function pointDistance(a: Point3, b: Point3): number {
  return pointToVector(a).distanceTo(pointToVector(b));
}

export function pointsRoughlyEqual(
  a: Point3,
  b: Point3,
  toleranceMm: number,
): boolean {
  return pointDistance(a, b) <= toleranceMm;
}

export function positionFromDirection(
  target: Point3,
  direction: THREE.Vector3,
  distanceMm: number,
): Point3 {
  const next = pointToVector(target).add(
    direction.clone().multiplyScalar(distanceMm),
  );
  return vectorToPoint(next);
}

export function directionFromCameraState(state: GeometryCameraState): THREE.Vector3 {
  const direction = pointToVector(state.position).sub(
    pointToVector(state.target),
  );
  if (direction.lengthSq() < 1e-6) {
    const fallbackPreset =
      state.viewPreset === "custom" ? "iso" : state.viewPreset;
    return directionForPreset(fallbackPreset);
  }
  return direction.normalize();
}

export function buildPresetCameraState({
  target,
  distanceMm,
  viewPreset,
  focusMode,
}: {
  target: Point3;
  distanceMm: number;
  viewPreset: Exclude<GeometryCameraPreset, "custom">;
  focusMode: GeometryCameraFocusMode;
}): GeometryCameraState {
  const direction = directionForPreset(viewPreset);
  return {
    position: positionFromDirection(target, direction, distanceMm),
    target,
    distanceMm,
    viewPreset,
    focusMode,
  };
}

export function defaultCameraStateForScene(input: {
  sceneBounds: SceneBounds | null;
  sceneFitDistance: number;
}): GeometryCameraState {
  if (!input.sceneBounds) {
    return buildPresetCameraState({
      target: { x: 0, y: 0, z: 500 },
      distanceMm: fitDistanceForSize(2000),
      viewPreset: "iso",
      focusMode: "scene",
    });
  }
  return buildPresetCameraState({
    target: input.sceneBounds.center,
    distanceMm: input.sceneFitDistance,
    viewPreset: "iso",
    focusMode: "scene",
  });
}

export function cameraStatesEqual(a: GeometryCameraState, b: GeometryCameraState): boolean {
  return (
    a.distanceMm === b.distanceMm &&
    a.viewPreset === b.viewPreset &&
    a.focusMode === b.focusMode &&
    a.position.x === b.position.x &&
    a.position.y === b.position.y &&
    a.position.z === b.position.z &&
    a.target.x === b.target.x &&
    a.target.y === b.target.y &&
    a.target.z === b.target.z
  );
}

export function clampCameraStateToScene(input: {
  state: GeometryCameraState;
  sceneBounds: SceneBounds | null;
}): GeometryCameraState {
  if (!input.sceneBounds) return input.state;
  const minDistance = Math.max(input.sceneBounds.size * 0.18, 250);
  const maxDistance = Math.max(input.sceneBounds.size * 14, 14000);
  const nextDistance = Math.min(Math.max(input.state.distanceMm, minDistance), maxDistance);
  if (nextDistance === input.state.distanceMm) return input.state;
  return {
    ...input.state,
    position: positionFromDirection(
      input.state.target,
      directionFromCameraState(input.state),
      nextDistance,
    ),
    distanceMm: nextDistance,
  };
}
