export * from "./contracts";
export * from "./footprints";
export * from "./houseRoofCapabilities";
export { normalizeGeometryConfig } from "./normalize";
export type {
  NormalizeGeometryConfigErrorCode,
  NormalizeGeometryConfigResult,
} from "./normalize";
export { solveAssembly3D } from "./solve";
export type {
  SolveAssembly3DErrorCode,
  SolveAssembly3DResult,
} from "./solve.types";
export { solveProject } from "./solveProject";
export type {
  SolveProjectInput,
  SolveProjectPergolaErrorCode,
  SolveProjectPergolaResult,
  SolveProjectResult,
} from "./solveProject";
export { validateGeometrySolve } from "./validate";
export type { ValidateGeometrySolveInput } from "./validate";
export {
  buildHouseModelRoofMaterialSceneObjects,
  buildHouseModelSceneObjects,
  buildViewerSceneModel,
} from "./viewer";
export type { BuildViewerSceneModelOptions } from "./viewer";
export {
  buildHouseModelPlanProjectionShapes,
  buildHouseModelTopProjectionShapes,
  buildHouseReferenceProjectionShape,
  buildProjectReferenceShapes,
  buildTopProjectionParityReport,
  buildTopProjectionViewModel,
  buildTopProjectionViewModelFromScene,
} from "./topProjection";
export type {
  BuildTopProjectionParityReportOptions,
  BuildTopProjectionViewModelFromSceneOptions,
  ProjectPergolaEntry,
  ReferenceShapeIdentifiers,
  TopProjectionParityIssue,
  TopProjectionParityIssueCode,
  TopProjectionParityReport,
} from "./topProjection";
export { buildPlanViewModel } from "./plan";
export { buildSectionViewModel } from "./section";
export { buildAssemblyQuantityTakeoff } from "./takeoff";
// Multi-form workbench rendering (PR8): portal callers build per-form
// freestanding geometry by composing these directly, bypassing the
// per-pergola normalize/solve pipeline.
export { buildHouseModel3DFromRawHouseInput } from "./houseModel";
export { buildHouseModel3DGeometryConfigInputFromRawHouseInput } from "./houseModelRawInputAdapter";
export type {
  HouseModel3DGeometryConfigInput,
  HouseModel3DPergolaAttachment,
  HouseModel3DRawHouseInput,
} from "./houseModelRawInputAdapter";
export {
  EMPTY_HOUSE_ROOF_STAGE_DIAGNOSTICS,
  firstHouseRoofStageDiagnosticCode,
  pickHouseRoofStageDiagnostics,
  summarizeHouseModelRoofStageDiagnostics,
} from "./houseRoofDiagnostics";
export type {
  HouseRoofStageDiagnostics,
  HouseRoofStageStatus,
} from "./houseRoofDiagnostics";
export {
  buildHouseRoofModelPipeline,
  houseRoofModelPipelineFailureStage,
} from "./house/roofModelPipeline";
export type {
  HouseRoofModelPipelineDiagnostics,
  HouseRoofModelPipelineFailureStage,
  HouseRoofModelPipelineResult,
} from "./house/roofModelPipeline";
export { applyHouseReferencePosition } from "./applyAssemblyPosition";
