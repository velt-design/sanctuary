export * from "./contracts";
export {addRepresentativeRoofBattens,type RepresentativeRoofBattens} from './representativeRoofBattens';
export {matchRepresentativePitchedLedger} from './representativePitchedLedger';
export { buildRepresentativeSidePanel } from './representativeSidePanel';
export type { SidePanelMesh } from './representativeSidePanel';
export { fitRepresentativeBlindPosts } from './representativeBlindPosts';
export { buildRepresentativeGable } from './representativeGable';
export { buildRepresentativeBox } from './representativeBox';
export { buildRepresentativeBoxContext } from './representativeBoxContext';
export type { RepresentativeGableOptions } from './representativeGable';
export { buildRepresentativeGableContext } from './representativeGableContext';
export { buildRepresentativeSurroundings } from './representativeSurroundings';
export type { RepresentativeSurroundings, ContextBox, ContextSection } from './representativeSurroundings';
export {
  buildHouseFootprintPolygon,
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
export { buildPergolaInteractionAnchors } from "./interactionAnchors";
export type {
  PergolaInteractionAnchors,
  PergolaInteractionEdge,
  PergolaInteractionEdgeId,
  PergolaLightingRun,
} from "./interactionAnchors";
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

export { buildRepresentativeRoofFinish } from "./representativeRoofFinish";
export { DEFAULT_ROOF_FINISH, roofFinishBayLimit } from "./representativeRoofFinishTypes";
export type { RepresentativeRoofFinish, RoofFinishGeometry, RoofFinishMesh } from "./representativeRoofFinishTypes";
export { representativeRoofProfile } from "./representativeRoofProfiles";
export { representativeBoxRoofMaxProjection } from "./representativeRoofBoxFinish";
export { representativeBlindOpenings, blindHeaderDepth } from './representativeBlindOpenings';
export type { BlindOpening } from './representativeBlindOpenings';
export { buildRepresentativeBlind } from './representativeBlind';
export type { BlindMesh } from './representativeBlind';
