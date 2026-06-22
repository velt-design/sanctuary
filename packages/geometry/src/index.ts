export * from "./contracts";
export {
  buildCustomHouseFootprintPolygon,
  buildHouseFootprintPresetSideLocalPoints,
  buildSideLocalPolygonFromWorld,
  houseFootprintSideLocalToWorldPolygon,
  resolveHouseFootprintFrame,
  resolveHouseFootprintParams,
} from "./footprints";
export {
  HOUSE_ROOF_FORM_ORDER,
  MIN_VISIBLE_HOUSE_ROOF_PITCH_DEG,
  deriveHouseGableTerminalEnds,
  deriveHouseRoofCapabilities,
  deriveHouseRoofGeometryKind,
  getHouseRoofFormBehavior,
  houseRoofFormUsesMinimumVisiblePitch,
  isHouseRoofForm,
  normalizeHouseRoofPitchInputForForm,
  preferredMonoFallDirectionForAttachmentSide,
  validateHouseRoofSelection,
} from "./houseRoofCapabilities";
export { normalizeGeometryConfig } from "./normalize";
export { solveAssembly3D } from "./solve";
export { solveProject } from "./solveProject";
export { solvePergolaGeometry } from "./solvePergolaGeometry";
export type { PergolaGeometryInput } from "./solvePergolaGeometry";
export { validateGeometrySolve } from "./validate";
export {
  buildHouseModelSceneObjects,
  buildViewerSceneModel,
} from "./viewer";
export {
  buildHouseModelTopProjectionShapes,
  buildHouseReferenceProjectionShape,
  buildProjectReferenceShapes,
  buildTopProjectionParityReport,
  buildTopProjectionViewModelFromScene,
} from "./topProjection";
export type {
  ProjectPergolaEntry,
} from "./topProjection";
export { buildAssemblyQuantityTakeoff } from "./takeoff";
// House-form geometry boundary: portal callers build object-owned house
// models and diagnostics from raw house inputs without reviving a
// calculator/module-owned workbench state path.
export {
  buildHouseModel3DFromRawHouseInput,
  buildHouseRoofEnvelopeArtifacts,
} from "./houseModel";
export {
  DEFAULT_SOFFIT_DEPTH_MM,
  DEFAULT_FASCIA_HEIGHT_MM,
  DEFAULT_GUTTER_WIDTH_MM,
  DEFAULT_GUTTER_DEPTH_MM,
  DEFAULT_GUTTER_PROJECTION_MM,
  DEFAULT_EAVE_OVERHANG_MM,
} from "./house/constants";
export {
  EMPTY_HOUSE_ROOF_STAGE_DIAGNOSTICS,
  firstHouseRoofStageDiagnosticCode,
  pickHouseRoofStageDiagnostics,
  summarizeHouseModelRoofStageDiagnostics,
} from "./houseRoofDiagnostics";
export type {
  HouseRoofStageDiagnostics,
} from "./houseRoofDiagnostics";
export { buildHouseRoofModelPipeline } from "./house/roofModelPipeline";
export type { HouseRoofModelPipelineFailureStage } from "./house/roofModelPipeline";
export { applyHouseReferencePosition } from "./applyAssemblyPosition";
export { applyRoofQa } from "./house/roofQa";

// PR-COMP1 (2026-06-18): house composition geometry primitives.
// Authored representation for new house forms (rectangles + joins +
// per-rectangle roof intent). See docs/house-composition-vision.md.
export {
  composeFootprintFromComposition,
  composeRoofFromComposition,
  detachHouseFormAtSeam,
  detectSharedSeamBetweenForms,
  findCompositionJoinSeamMidpoint,
  isAxisAlignedRectangle,
  joinTwoHouseForms,
  validateHouseComposition,
} from "./house/composition";
export type {
  AxisAlignedRectangle,
  HouseComposition,
  RectangleRoofIntent,
} from "./house/composition";
