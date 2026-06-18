import {
  applyHouseReferencePosition,
  buildHouseModel3DFromRawHouseInput,
  buildHouseReferenceProjectionShape,
  buildHouseRoofModelPipeline,
  composeRoofFromComposition,
  EMPTY_HOUSE_ROOF_STAGE_DIAGNOSTICS,
  type GeometryTopProjectionShape,
  type HouseRoofModelPipelineFailureStage,
  type HouseRoofStageDiagnostics,
  type HouseModel3D,
  type HouseReferenceGeometry,
  type Polygon3,
  type RawHouseInput,
} from "@sp/geometry";
import { houseFormTransformToAssemblyPosition } from "./houseFormTransform";
import { buildHouseFormRawGeometryInput } from "./houseFormRawGeometry";
import { deriveCompositionUnionPolygon3 } from "./houseFormCompositionFootprint";
import type {
  HouseFormModel,
  HouseRoofIntentAuthorshipResolution,
  HouseRoofIntentResolutionSource,
  WorkbenchProjectModel,
} from "./objectFirstWorkbenchModel";
import { resolveHouseRoofIntentForAuthorship } from "./objectFirstWorkbenchModel";
import type { ProjectHouseProjectionFailureStage } from "./projectHouseProjectionHealth";

export type HouseFormGeometryInputDiagnostics = {
  houseFormId: string;
  footprintPointCount: number;
  rawHouseInputPresent: boolean;
  referencePresent: boolean;
  modelPresent: boolean;
  wallCount: number;
  roofPlaneCount: number;
  failureStage: ProjectHouseProjectionFailureStage;
  diagnosticCode: string | null;
  roofPipelineFailureStage: HouseRoofModelPipelineFailureStage;
  roofIntentAuthored: boolean;
  rawRoofIntentForm: string | null;
  resolvedRoofIntentForm: string | null;
  roofIntentResolutionSource: HouseRoofIntentResolutionSource | null;
  roofIntentRepairCode: string | null;
} & HouseRoofStageDiagnostics;

type HouseFormGeometryInputSuccess = {
  ok: true;
  houseFormId: string;
  houseForm: HouseFormModel;
  rawHouseInput: RawHouseInput;
  footprint: Polygon3;
  geometry: HouseReferenceGeometry;
  model: HouseModel3D;
  referenceShape: GeometryTopProjectionShape;
  diagnostics: HouseFormGeometryInputDiagnostics;
};

type HouseFormGeometryInputFailure = {
  ok: false;
  houseFormId: string;
  failureStage: Exclude<ProjectHouseProjectionFailureStage, "none">;
  diagnosticCode: string;
  diagnostics: HouseFormGeometryInputDiagnostics;
};

export type HouseFormGeometryInputResult =
  | HouseFormGeometryInputSuccess
  | HouseFormGeometryInputFailure;

/**
 * PR-COMP-PHASE3.2 (2026-06-18): replace a legacy `HouseModel3D`'s
 * roof with one computed by `composeRoofFromComposition`. Walls,
 * eaves, openings, and solids carry through from the legacy model
 * unchanged — Phase 3 only ships single-rectangle compositions,
 * for which the legacy walls/eaves are already correct.
 *
 * The composition's roof comes back in the form's local frame
 * (composition primitives placed at originXMm/YMm relative to the
 * form). `applyHouseReferencePosition` (downstream of this swap)
 * bakes the form's world transform into every vertex, so the
 * swapped roof correctly ends up in world coords alongside the
 * walls.
 *
 * For single-rectangle compositions, the new roof's planes are
 * byte-equivalent to what the legacy solver produced because both
 * paths bottom out in `buildRectangularRoof` on the same
 * dimensions. The swap exercises the new path end-to-end and
 * stamps `roofTopologySolver: "composition_..."` so downstream
 * observability shows which forms travel the composition route.
 *
 * For Phase 4 (multi-rectangle compositions), the swap will need
 * to ALSO replace walls/eaves from the composite footprint. Not
 * in scope for Phase 3.
 */
function swapRoofFromComposition(input: {
  houseForm: HouseFormModel;
  legacyModel: HouseModel3D;
  composition: NonNullable<HouseFormModel["composition"]>;
}): HouseModel3D {
  // Match the eave height the legacy pipeline used so the
  // composition roof's eave aligns with the legacy walls. Default
  // 2400mm mirrors the pipeline's own default for forms without
  // explicit eaveHeightM. If the value can't be parsed, skip the
  // swap and return the legacy model unchanged.
  const eaveHeightMm = resolveEaveHeightMm(input.houseForm);
  if (eaveHeightMm <= 0) return input.legacyModel;
  const composed = composeRoofFromComposition({
    composition: input.composition,
    eaveHeightMm,
  });
  const mergedMetadata = {
    ...(input.legacyModel.metadata ?? {}),
    ...composed.metadata,
  };
  // Preserve the QA + diagnostic stamps the legacy pipeline put on
  // `metadata` so downstream consumers (HR3 amber-tint, HR2
  // validation panel, etc.) still see the right signals. The
  // composition path's own metadata overrides only the topology
  // solver name + composition-specific fields.
  const legacyQaStatus = input.legacyModel.metadata?.roofQaStatus;
  if (legacyQaStatus !== undefined) mergedMetadata.roofQaStatus = legacyQaStatus;
  const legacyQaFailureReason = input.legacyModel.metadata?.roofQaFailureReason;
  if (legacyQaFailureReason !== undefined) {
    mergedMetadata.roofQaFailureReason = legacyQaFailureReason;
  }
  return {
    ...input.legacyModel,
    roofPlanes: composed.roofPlanes,
    roofFeatures: composed.roofFeatures,
    metadata: mergedMetadata,
  };
}

function resolveEaveHeightMm(houseForm: HouseFormModel): number {
  const explicitM = Number.parseFloat(houseForm.eaveHeightM ?? "");
  if (Number.isFinite(explicitM) && explicitM > 0) {
    return explicitM * 1000;
  }
  return 2400;
}

function buildFailure(input: {
  houseFormId: string;
  failureStage: Exclude<ProjectHouseProjectionFailureStage, "none">;
  diagnosticCode?: string;
  footprintPointCount?: number;
  rawHouseInputPresent?: boolean;
  referencePresent?: boolean;
  modelPresent?: boolean;
  wallCount?: number;
  roofPlaneCount?: number;
  roofIntentResolution?: HouseRoofIntentAuthorshipResolution;
}): HouseFormGeometryInputFailure {
  const diagnosticCode = input.diagnosticCode ?? input.failureStage;
  return {
    ok: false,
    houseFormId: input.houseFormId,
    failureStage: input.failureStage,
    diagnosticCode,
    diagnostics: {
      houseFormId: input.houseFormId,
      footprintPointCount: input.footprintPointCount ?? 0,
      rawHouseInputPresent: input.rawHouseInputPresent ?? false,
      referencePresent: input.referencePresent ?? false,
      modelPresent: input.modelPresent ?? false,
      wallCount: input.wallCount ?? 0,
      roofPlaneCount: input.roofPlaneCount ?? 0,
      failureStage: input.failureStage,
      diagnosticCode,
      roofPipelineFailureStage: "not_started",
      roofIntentAuthored:
        input.roofIntentResolution?.roofIntentAuthored ?? false,
      rawRoofIntentForm: input.roofIntentResolution?.rawForm ?? null,
      resolvedRoofIntentForm: input.roofIntentResolution?.resolvedForm ?? null,
      roofIntentResolutionSource: input.roofIntentResolution?.source ?? null,
      roofIntentRepairCode: input.roofIntentResolution?.repairCode ?? null,
      ...EMPTY_HOUSE_ROOF_STAGE_DIAGNOSTICS,
    },
  };
}

export function buildHouseFormGeometryInputForForm(
  houseForm: HouseFormModel,
): HouseFormGeometryInputResult {
  const roofIntentResolution = resolveHouseRoofIntentForAuthorship({
    roofIntent: houseForm.roofIntent,
    roofIntentAuthored: houseForm.roofIntentAuthored,
  });
  const rawGeometry = buildHouseFormRawGeometryInput(houseForm);
  if (!rawGeometry) {
    return buildFailure({
      houseFormId: houseForm.id,
      failureStage: "invalid_footprint",
      diagnosticCode: "invalid_footprint",
      roofIntentResolution,
    });
  }

  // PR-COMP-PHASE4a.3 (2026-06-18): for multi-rectangle compositions,
  // substitute the composition's union polygon for the preset-derived
  // footprint BEFORE building the legacy model. The legacy wall /
  // eave / opening builders consume any orthogonal polygon — L / T /
  // U preset footprints have always been supported — so they handle
  // the union shape transparently. Single-rectangle compositions
  // return null from `deriveCompositionUnionPolygon3` and fall
  // through to the legacy preset path (preserves Phase 3.2's
  // byte-equivalence invariant).
  const compositionUnionFootprint = deriveCompositionUnionPolygon3(houseForm.composition);
  const footprintForLegacyBuilder = compositionUnionFootprint ?? rawGeometry.footprint;
  const legacyModel = buildHouseModel3DFromRawHouseInput({
    rawHouse: rawGeometry.rawHouse,
    footprint: footprintForLegacyBuilder,
    pergolaAttachment: null,
  });
  if (!legacyModel) {
    return buildFailure({
      houseFormId: houseForm.id,
      failureStage: "missing_model",
      footprintPointCount: footprintForLegacyBuilder.length,
      rawHouseInputPresent: true,
    });
  }
  // PR-COMP-PHASE3.2 (2026-06-18): when the form has an authored
  // composition, route the roof through `composeRoofFromComposition`
  // instead of the solver embedded in `buildHouseModel3DFromRawHouseInput`.
  // For single-rectangle compositions (Phase 3 only ships these), the
  // two paths produce byte-equivalent roof planes because both bottom
  // out in `buildRectangularRoof` on the same dimensions — the swap
  // is a no-op visually but exercises the new path end-to-end and
  // stamps `roofTopologySolver: "composition_..."` so observability
  // surfaces which forms travel the composition route.
  //
  // PR-COMP-PHASE4a.3 (2026-06-18): the substitution above feeds the
  // composite footprint into the legacy wall / eave / opening
  // builders; the swap below replaces the roof with the composition-
  // driven stitched solve. Together they make multi-rectangle
  // composites render end-to-end via the composition path.
  const model = houseForm.composition
    ? swapRoofFromComposition({
        houseForm,
        legacyModel,
        composition: houseForm.composition,
      })
    : legacyModel;

  const houseLocal: HouseReferenceGeometry = {
    wallPlane: null,
    fasciaLine: null,
    roofEdgeLine: null,
    soffitDepthMm: model.eave?.soffitDepthMm ?? null,
    footprint: model.footprint,
    model,
    attachmentTarget: null,
    position: null,
  };
  const position = houseFormTransformToAssemblyPosition(houseForm.transform);
  const geometry = applyHouseReferencePosition(houseLocal, position);
  const positionedModel = geometry.model ?? model;
  const referenceShape = buildHouseReferenceProjectionShape({
    house: geometry,
    houseSourceId: houseForm.id,
  });
  if (!referenceShape) {
    return buildFailure({
      houseFormId: houseForm.id,
      failureStage: "missing_geometry_input",
      diagnosticCode: "missing_reference_shape",
      footprintPointCount: footprintForLegacyBuilder.length,
      rawHouseInputPresent: true,
      modelPresent: true,
      wallCount: positionedModel.wallSegments.length,
      roofPlaneCount: positionedModel.roofPlanes.length,
    });
  }

  const failureStage: ProjectHouseProjectionFailureStage =
    positionedModel.roofPlanes.length <= 0 ? "missing_roof_model" : "none";
  const roofPipeline = buildHouseRoofModelPipeline({
    houseId: houseForm.id,
    model: positionedModel,
  });
  const {
    houseId: _roofPipelineHouseId,
    modelPresent: _roofPipelineModelPresent,
    failureStage: roofPipelineFailureStage,
    diagnosticCode: roofPipelineDiagnosticCode,
    ...roofStageDiagnostics
  } = roofPipeline.diagnostics;
  const diagnosticCode =
    failureStage === "none" ? roofPipelineDiagnosticCode : failureStage;
  return {
    ok: true,
    houseFormId: houseForm.id,
    houseForm,
    rawHouseInput: rawGeometry.rawHouse,
    footprint: footprintForLegacyBuilder,
    geometry,
    model: positionedModel,
    referenceShape,
    diagnostics: {
      houseFormId: houseForm.id,
      footprintPointCount: footprintForLegacyBuilder.length,
      rawHouseInputPresent: true,
      referencePresent: true,
      modelPresent: true,
      wallCount: positionedModel.wallSegments.length,
      roofPlaneCount: positionedModel.roofPlanes.length,
      failureStage,
      diagnosticCode,
      roofPipelineFailureStage,
      roofIntentAuthored: roofIntentResolution.roofIntentAuthored,
      rawRoofIntentForm: roofIntentResolution.rawForm,
      resolvedRoofIntentForm: roofIntentResolution.resolvedForm,
      roofIntentResolutionSource: roofIntentResolution.source,
      roofIntentRepairCode: roofIntentResolution.repairCode,
      ...roofStageDiagnostics,
    },
  };
}

export function buildHouseFormGeometryInput(input: {
  projectModel: WorkbenchProjectModel;
  houseFormId: string;
}): HouseFormGeometryInputResult {
  const houseForm =
    input.projectModel.houseAssembly?.houseForms.find(
      (candidate) => candidate.id === input.houseFormId,
    ) ?? null;
  if (!houseForm) {
    return buildFailure({
      houseFormId: input.houseFormId,
      failureStage: "missing_house_form",
      diagnosticCode: "missing_house_form",
    });
  }
  return buildHouseFormGeometryInputForForm(houseForm);
}

export function buildProjectHouseGeometryInputs(
  projectModel: WorkbenchProjectModel,
): Record<string, HouseFormGeometryInputResult> {
  const results: Record<string, HouseFormGeometryInputResult> = {};
  for (const houseForm of projectModel.houseAssembly?.houseForms ?? []) {
    if (results[houseForm.id]) continue;
    results[houseForm.id] = buildHouseFormGeometryInputForForm(houseForm);
  }
  return results;
}
