import type { Point3 } from "@sp/geometry";

/**
 * Axis-aligned bounding box of every renderable point in a viewer scene.
 * Used to seed the orbit camera's target/distance, and consumed by the
 * camera-state helpers (`defaultCameraStateForScene`,
 * `clampCameraStateToScene`) to keep the camera framed on the scene as
 * the visible-object set changes.
 *
 * Lives in its own tiny module to break the otherwise circular import
 * cycle: `cameraState.ts` needs the type, but the full
 * `computeSceneBounds` implementation (in the main viewport) depends on
 * the buffer-geometry helpers which themselves consume scene types.
 */
export type SceneBounds = {
  min: Point3;
  max: Point3;
  center: Point3;
  size: number;
};
