/**
 * PR-COMP1 (2026-06-18): public API barrel for the house
 * composition module.
 *
 * Composition geometry lives in @sp/geometry and is reusable by
 * any consumer (workbench, future tools, server-side reports).
 * Per the composition vision, the design workbench will adopt this
 * as the canonical authored representation for new house forms;
 * legacy free-form polygon house forms continue to render via the
 * existing geometry pipeline as a read-only path.
 *
 * See `docs/house-composition-vision.md` for the model and
 * `docs/pr-comp1-plan.md` for the Phase 1 scope.
 */
export type {
  AxisAlignedRectangle,
  CompositionEdge,
  CompositionJoin,
  CompositionPrimitive,
  CompositionValidationError,
  CompositionValidationResult,
  HouseComposition,
  RectangleRoofIntent,
} from "./types";
export { isAxisAlignedRectangle } from "./types";
export { validateHouseComposition } from "./validateHouseComposition";
export { composeFootprintFromComposition } from "./composeFootprintFromComposition";
export { detectFusedRectangle } from "./fusedRectangleDetector";
export type { FusedRectangleDetection } from "./fusedRectangleDetector";
export { composeRoofFromComposition } from "./composeRoofFromComposition";
export type { ComposeRoofResult } from "./composeRoofFromComposition";
