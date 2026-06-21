import {
  buildHouseModelRoofMaterialSceneObjects,
  buildHouseModelSceneObjects,
  buildHouseModelTopProjectionShapes,
  EMPTY_HOUSE_ROOF_STAGE_DIAGNOSTICS,
  firstHouseRoofStageDiagnosticCode,
  pickHouseRoofStageDiagnostics,
  type GeometryTopProjectionShape,
} from "@sp/geometry";
import {
  planHouseFormOwner,
  planShapeIsHouseRoofBody,
  planShapeIsHouseRoofMaterialBody,
} from "@/lib/drawings/views/plan/planShapeOwnership";
import type { WorkbenchProjectModel } from "./objectFirstWorkbenchModel";
import {
  buildProjectHouseGeometryInputs,
  type HouseFormGeometryInputDiagnostics,
} from "./houseFormGeometryInput";
import {
  buildProjectHouseGeometryRegistry,
  type ProjectHouseGeometryEntry,
} from "./projectHouseGeometryRegistry";
import type {
  ProjectHouseProjectionFailureStage,
  ProjectHouseProjectionHealth,
} from "./projectHouseProjectionHealth";

export type ProjectHouseRenderPipeline = {
  projectHouseGeometries: ProjectHouseGeometryEntry[];
  projectHousePlanShapes: GeometryTopProjectionShape[];
  projectHouseProjectionHealth: ProjectHouseProjectionHealth[];
  houseGeometryInputsById: Record<string, HouseFormGeometryInputDiagnostics>;
};

function dedupeTopProjectionShapes(
  shapes: ReadonlyArray<GeometryTopProjectionShape>,
): GeometryTopProjectionShape[] {
  const seen = new Set<string>();
  const deduped: GeometryTopProjectionShape[] = [];
  for (const shape of shapes) {
    if (seen.has(shape.id)) continue;
    seen.add(shape.id);
    deduped.push(shape);
  }
  return deduped;
}

function emptyHouseHealth(input: {
  houseFormId: string;
  inputDiagnostics?: HouseFormGeometryInputDiagnostics;
  fallbackStage?: ProjectHouseProjectionFailureStage;
}): ProjectHouseProjectionHealth {
  const failureStage: ProjectHouseProjectionFailureStage =
    input.inputDiagnostics && input.inputDiagnostics.failureStage !== "none"
      ? input.inputDiagnostics.failureStage
      : (input.fallbackStage ?? "missing_geometry_input");
  const diagnosticCode =
    input.inputDiagnostics?.diagnosticCode ??
    (failureStage === "none" ? null : failureStage);
  const roofDiagnostics =
    input.inputDiagnostics ?? EMPTY_HOUSE_ROOF_STAGE_DIAGNOSTICS;
  return {
    houseFormId: input.houseFormId,
    geometryInputPresent: Boolean(input.inputDiagnostics?.rawHouseInputPresent),
    rawHouseInputPresent: Boolean(input.inputDiagnostics?.rawHouseInputPresent),
    footprintPointCount: input.inputDiagnostics?.footprintPointCount ?? 0,
    referencePresent: false,
    modelPresent: false,
    wallCount: 0,
    roofPlaneCount: 0,
    roofBodyCount: 0,
    roofMaterialBodyCount: 0,
    planBodyIds: [],
    roofBodyIds: [],
    roofMaterialBodyIds: [],
    sceneBodyCount: 0,
    sceneRoofBodyCount: 0,
    sceneRoofSurfaceCount: 0,
    sceneRoofMaterialBodyCount: 0,
    canRenderCommittedBody: false,
    visibleReferenceFallbackIds: [],
    failureStage,
    diagnosticCode,
    roofValidationStatus: roofDiagnostics.roofQaStatus,
    roofValidationCode: roofDiagnostics.roofQaFailureReason,
    roofIntentAuthored: input.inputDiagnostics?.roofIntentAuthored ?? false,
    rawRoofIntentForm: input.inputDiagnostics?.rawRoofIntentForm ?? null,
    resolvedRoofIntentForm:
      input.inputDiagnostics?.resolvedRoofIntentForm ?? null,
    roofIntentResolutionSource:
      input.inputDiagnostics?.roofIntentResolutionSource ?? null,
    roofIntentRepairCode: input.inputDiagnostics?.roofIntentRepairCode ?? null,
    ...pickHouseRoofStageDiagnostics(roofDiagnostics),
  };
}

function houseProjectionFailureStage(
  health: Pick<
    ProjectHouseProjectionHealth,
    | "geometryInputPresent"
    | "rawHouseInputPresent"
    | "referencePresent"
    | "modelPresent"
    | "wallCount"
    | "roofPlaneCount"
    | "sceneBodyCount"
    | "roofBodyCount"
    | "roofMaterialBodyCount"
  >,
): ProjectHouseProjectionFailureStage {
  if (!health.geometryInputPresent || !health.rawHouseInputPresent)
    return "missing_geometry_input";
  if (!health.referencePresent) return "missing_geometry_input";
  if (!health.modelPresent) return "missing_model";
  if (health.wallCount <= 0) return "missing_3d_body";
  if (health.roofPlaneCount <= 0) return "missing_roof_model";
  if (health.sceneBodyCount <= 0) return "missing_3d_body";
  if (health.roofBodyCount <= 0 && health.roofMaterialBodyCount <= 0)
    return "missing_plan_body";
  return "none";
}

function buildHealthForEntry(input: {
  entry: ProjectHouseGeometryEntry;
  planShapes: ReadonlyArray<GeometryTopProjectionShape>;
}): ProjectHouseProjectionHealth {
  const { entry } = input;
  const planBodyIds: string[] = [];
  const roofBodyIds: string[] = [];
  const roofMaterialBodyIds: string[] = [];

  for (const shape of input.planShapes) {
    if (planHouseFormOwner(shape) !== entry.houseFormId) continue;
    if (!planShapeIsHouseRoofBody(shape)) continue;
    planBodyIds.push(shape.id);
    roofBodyIds.push(shape.id);
    if (planShapeIsHouseRoofMaterialBody(shape)) {
      roofMaterialBodyIds.push(shape.id);
    }
  }

  const sceneObjects = buildHouseModelSceneObjects({
    model: entry.model,
    attachmentTarget: null,
  });
  const roofMaterialSceneObjects = buildHouseModelRoofMaterialSceneObjects({
    model: entry.model,
  });
  const referencePresent = Boolean(entry.referenceShape);
  const modelPresent = Boolean(entry.model);
  const wallCount = entry.model.wallSegments.length;
  const roofPlaneCount = entry.model.roofPlanes.length;
  const roofBodyCount = roofBodyIds.length;
  const roofMaterialBodyCount = roofMaterialBodyIds.length;
  const sceneBodyCount = sceneObjects.length;
  const sceneRoofBodyCount =
    entry.model.solids?.surfaceSolids.filter((solid) => solid.kind === "roof")
      .length ?? 0;
  const sceneRoofSurfaceCount = sceneObjects.filter(
    (object) => object.type === "house_surface" && object.kind === "roof",
  ).length;
  const sceneRoofMaterialBodyCount = roofMaterialSceneObjects.length;
  const inputDiagnostics = entry.geometryInputDiagnostics;
  const failureStage = houseProjectionFailureStage({
    geometryInputPresent: true,
    rawHouseInputPresent: inputDiagnostics.rawHouseInputPresent,
    referencePresent,
    modelPresent,
    wallCount,
    roofPlaneCount,
    sceneBodyCount,
    roofBodyCount,
    roofMaterialBodyCount,
  });
  const visibleReferenceFallbackIds =
    roofBodyCount > 0 || roofMaterialBodyCount > 0
      ? []
      : [entry.referenceShape.id];

  return {
    houseFormId: entry.houseFormId,
    geometryInputPresent: true,
    rawHouseInputPresent: inputDiagnostics.rawHouseInputPresent,
    footprintPointCount: inputDiagnostics.footprintPointCount,
    referencePresent,
    modelPresent,
    wallCount,
    roofPlaneCount,
    roofBodyCount,
    roofMaterialBodyCount,
    planBodyIds: planBodyIds.sort(),
    roofBodyIds: roofBodyIds.sort(),
    roofMaterialBodyIds: roofMaterialBodyIds.sort(),
    sceneBodyCount,
    sceneRoofMaterialBodyCount,
    canRenderCommittedBody: roofBodyCount > 0 || roofMaterialBodyCount > 0,
    visibleReferenceFallbackIds: visibleReferenceFallbackIds.sort(),
    failureStage,
    diagnosticCode:
      failureStage === "none"
        ? firstHouseRoofStageDiagnosticCode(inputDiagnostics)
        : (firstHouseRoofStageDiagnosticCode(inputDiagnostics) ?? failureStage),
    roofValidationStatus: inputDiagnostics.roofQaStatus,
    roofValidationCode: inputDiagnostics.roofQaFailureReason,
    roofIntentAuthored: inputDiagnostics.roofIntentAuthored,
    rawRoofIntentForm: inputDiagnostics.rawRoofIntentForm,
    resolvedRoofIntentForm: inputDiagnostics.resolvedRoofIntentForm,
    roofIntentResolutionSource: inputDiagnostics.roofIntentResolutionSource,
    roofIntentRepairCode: inputDiagnostics.roofIntentRepairCode,
    sceneRoofBodyCount,
    sceneRoofSurfaceCount,
    ...pickHouseRoofStageDiagnostics(inputDiagnostics),
  };
}

export function buildProjectHouseRenderPipeline(input: {
  projectModel: WorkbenchProjectModel;
  projectHouseGeometries?: ReadonlyArray<ProjectHouseGeometryEntry>;
}): ProjectHouseRenderPipeline {
  const houseFormIds =
    input.projectModel.houseAssembly?.houseForms.map(
      (houseForm) => houseForm.id,
    ) ?? [];
  const geometryInputResults = buildProjectHouseGeometryInputs(
    input.projectModel,
  );
  const houseGeometryInputsById: Record<
    string,
    HouseFormGeometryInputDiagnostics
  > = {};
  for (const [houseFormId, result] of Object.entries(geometryInputResults)) {
    houseGeometryInputsById[houseFormId] = result.diagnostics;
  }
  const projectHouseGeometries = [
    ...(input.projectHouseGeometries ??
      buildProjectHouseGeometryRegistry(input.projectModel)),
  ];
  const planShapesByHouseFormId = new Map<
    string,
    GeometryTopProjectionShape[]
  >();
  const allPlanShapes: GeometryTopProjectionShape[] = [];

  for (const entry of projectHouseGeometries) {
    const planShapes = dedupeTopProjectionShapes([
      entry.referenceShape,
      ...buildHouseModelTopProjectionShapes({
        model: entry.model,
      }),
    ]);
    planShapesByHouseFormId.set(entry.houseFormId, planShapes);
    allPlanShapes.push(...planShapes);
  }

  const healthByHouseFormId = new Map<string, ProjectHouseProjectionHealth>();
  for (const houseFormId of houseFormIds) {
    healthByHouseFormId.set(
      houseFormId,
      emptyHouseHealth({
        houseFormId,
        inputDiagnostics: houseGeometryInputsById[houseFormId],
      }),
    );
  }
  for (const entry of projectHouseGeometries) {
    healthByHouseFormId.set(
      entry.houseFormId,
      buildHealthForEntry({
        entry,
        planShapes: planShapesByHouseFormId.get(entry.houseFormId) ?? [],
      }),
    );
  }

  return {
    projectHouseGeometries,
    projectHousePlanShapes: dedupeTopProjectionShapes(allPlanShapes),
    projectHouseProjectionHealth: Array.from(healthByHouseFormId.values()).sort(
      (left, right) => left.houseFormId.localeCompare(right.houseFormId),
    ),
    houseGeometryInputsById,
  };
}
