import type { GeometryCameraState } from "@sp/geometry-viewer";

export {
  buildPresetCameraState,
  cameraStatesEqual,
  clampCameraStateToScene,
  defaultCameraStateForScene,
  directionFromCameraState,
  fitDistanceForSize,
  formatCameraFocusMode,
  formatCameraPreset,
  formatPoint,
  formatVector,
  offsetPoint,
  pointDistance,
  pointToVector,
  pointsRoughlyEqual,
  positionFromDirection,
  vectorToPoint,
} from "@sp/geometry-viewer";

export type {
  GeometryCameraFocusMode,
  GeometryCameraPreset,
  GeometryCameraState,
  GeometryViewportCamera,
} from "@sp/geometry-viewer";

export type Geometry3DViewportState = {
  cameraState: GeometryCameraState;
};
