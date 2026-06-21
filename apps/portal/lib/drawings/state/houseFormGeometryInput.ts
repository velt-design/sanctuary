import {
  applyHouseReferencePosition,
  applyRoofQa,
  buildHouseModel3DFromRawHouseInput,
  buildHouseReferenceProjectionShape,
  buildHouseRoofEnvelopeArtifacts,
  buildHouseRoofModelPipeline,
  composeFootprintFromComposition,
  composeRoofFromComposition,
  DEFAULT_EAVE_OVERHANG_MM,
  DEFAULT_FASCIA_HEIGHT_MM,
  DEFAULT_GUTTER_DEPTH_MM,
  DEFAULT_GUTTER_PROJECTION_MM,
  DEFAULT_GUTTER_WIDTH_MM,
  DEFAULT_HOUSE_ROOF_MATERIAL,
  DEFAULT_SOFFIT_DEPTH_MM,
  EMPTY_HOUSE_ROOF_STAGE_DIAGNOSTICS,
  type GeometryTopProjectionShape,
  type HouseComposition,
  type HouseRoofModelPipelineFailureStage,
  type HouseRoofStageDiagnostics,
  type HouseModel3D,
  type RectangleRoofIntent,
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
export function swapRoofFromComposition(input: {
  houseForm: HouseFormModel;
  legacyModel: HouseModel3D;
  composition: HouseComposition;
}): HouseModel3D {
  // Match the eave height the legacy pipeline used so the
  // composition roof's eave aligns with the legacy walls. Default
  // 2400mm mirrors the pipeline's own default for forms without
  // explicit eaveHeightM. If the value can't be parsed, skip the
  // swap and return the legacy model unchanged.
  const eaveHeightMm = resolveEaveHeightMm(input.houseForm);
  if (eaveHeightMm <= 0) return input.legacyModel;
  // PR-COMP-UNIFIED-3 (2026-06-19): derive composite-level roof
  // intent from the houseForm and pass to the orchestrator. Per the
  // composition vision, the composite owns the roof intent; per-
  // primitive intents are a v1 implementation artifact that should
  // not drive the solver. Without this, the orchestrator's
  // `intentsEqual` check sees mismatched primitive intents (post-
  // Join, primitives keep their pre-join intents) and falls to
  // stitched at the wrong pitch.
  const compositeRoofIntent = deriveCompositeRoofIntent(input.houseForm);
  // PR-SS-8 (2026-06-21): resolve the eave overhang from the legacy
  // model's eave config and pass it to the composition solver so the
  // unified skeleton roof overhangs the walls (a soffit then fills the
  // gap). The legacy model already resolved this value with defaults.
  const legacyEave = input.legacyModel.eave;
  const eaveOverhangMm = legacyEave.eaveOverhangMm ?? DEFAULT_EAVE_OVERHANG_MM;
  const composed = composeRoofFromComposition({
    composition: input.composition,
    eaveHeightMm,
    compositeRoofIntent,
    eaveOverhangMm,
  });
  // PR-COMP-UNIFIED-2 (2026-06-19): re-run package QA on the
  // composition's planes against the composition's union polygon.
  // Previously the swap preserved the legacy model's `roofQaStatus`
  // and `roofQaFailureReason`, but those QA stamps were computed on
  // the LEGACY roof planes — for multi-rectangle composites those
  // planes differ from the composition planes (different topology
  // solver) so legacy QA doesn't apply. Re-running QA on the
  // composition planes gives the rail a correct verdict.
  const unionPolygon = composeFootprintFromComposition(input.composition);
  const footprintPolygon = unionPolygon.map((p) => ({ x: p.x, y: p.y, z: 0 }));
  // PR-SS-8 (2026-06-21): the roof EAVES sit on the overhang-offset
  // polygon the skeleton actually solved (`composed.eavePolygon`), not
  // the bare footprint — QA must validate facet containment against
  // that, and the soffit/fascia must be derived between the wall
  // footprint and this eave line. Non-skeleton strategies don't return
  // an eave polygon; fall back to the flush footprint (no overhang).
  const roofEavePolygon = composed.eavePolygon ?? footprintPolygon;
  const composedWithQa = applyRoofQa({
    roof: {
      roofPlanes: composed.roofPlanes,
      roofFeatures: composed.roofFeatures,
      metadata: composed.metadata,
    },
    eavePolygon: roofEavePolygon,
  });
  // PR-COMP-UNIFIED-2 (2026-06-19): strip legacy roof-pipeline
  // stamps before merging. Fields like `roofTopologyFailureReason`,
  // `roofWavefrontFailureReason`, `roofFacetMergeMode`, and the eave
  // offset stage diagnostics all describe the LEGACY solver's
  // behaviour on the (potentially wrong) polygon it was given.
  // After the composition swap, the rendered planes come from a
  // different solver — keeping those stamps would mislead the rail
  // diagnostic into reporting failures the active planes don't have.
  const legacyMetadata = input.legacyModel.metadata ?? {};
  const carriedLegacyMetadata = Object.fromEntries(
    Object.entries(legacyMetadata).filter(([key]) => {
      if (key.startsWith("roofTopology")) return false;
      if (key.startsWith("roofWavefront")) return false;
      if (key.startsWith("roofEaveOffsetRepair")) return false;
      if (key.startsWith("eaveOffset")) return false;
      if (key === "roofFacetMergeMode") return false;
      if (key === "roofGeometry") return false;
      if (key === "roofTopologySolver") return false;
      if (key === "roofQaStatus") return false;
      if (key === "roofQaFailureReason") return false;
      if (key === "roofQaFacetAreaMm2") return false;
      if (key === "roofQaEaveAreaMm2") return false;
      if (key === "roofQaAreaDeltaMm2") return false;
      if (key === "roofQaRejectedFacetCount") return false;
      if (key === "roofRejectedFacetCount") return false;
      if (key === "approximationReasons") return false;
      return true;
    }),
  );
  const mergedMetadata = {
    ...carriedLegacyMetadata,
    ...composedWithQa.metadata,
  };
  // PR-SS-6 (2026-06-21): rebuild the roof's 3D artifacts (extruded
  // solids, eave trim, flashings, material visuals, eave snap targets)
  // from the composition roof planes. Without this, the legacy build's
  // roof artifacts carry through unchanged — and for composites the
  // legacy solver fails QA, so it built ZERO roof solids, leaving the 3D
  // viewport with walls but no roof ("plan-good / 3D-bad"). This uses the
  // SAME geometry helper `buildHouseModel3D` uses, so there is one
  // derivation rather than a drifting parallel pipeline. The wall line
  // is the union footprint; the roof eaves sit on `roofEavePolygon`
  // (footprint + overhang) — the soffit/fascia/gutter fill the gap
  // between them. Both come from `composeFootprintFromComposition`, so
  // their vertices correspond edge-for-edge (required by the perimeter
  // builder).
  const roofArtifacts = buildHouseRoofEnvelopeArtifacts({
    footprint: footprintPolygon,
    eavePolygon: roofEavePolygon,
    roofForm: compositeRoofIntent.form,
    roof: {
      roofPlanes: composedWithQa.roofPlanes,
      roofFeatures: composedWithQa.roofFeatures ?? [],
      metadata: composedWithQa.metadata,
    },
    eaveHeightMm,
    wallSegments: input.legacyModel.wallSegments,
    decks: input.legacyModel.decks ?? [],
    roofMaterial: input.legacyModel.roofMaterial ?? DEFAULT_HOUSE_ROOF_MATERIAL,
    attachmentTarget: input.legacyModel.attachmentTarget ?? {
      kind: "none",
      strategy: "none",
    },
    joinSourceEdgeId: input.legacyModel.attachmentTarget?.sourceEdgeId ?? null,
    soffitDepthMm: legacyEave.soffitDepthMm ?? DEFAULT_SOFFIT_DEPTH_MM,
    fasciaHeightMm: legacyEave.fasciaHeightMm ?? DEFAULT_FASCIA_HEIGHT_MM,
    gutterWidthMm: legacyEave.gutterWidthMm ?? DEFAULT_GUTTER_WIDTH_MM,
    gutterDepthMm: legacyEave.gutterDepthMm ?? DEFAULT_GUTTER_DEPTH_MM,
    gutterProjectionMm:
      legacyEave.gutterProjectionMm ?? DEFAULT_GUTTER_PROJECTION_MM,
    eaveOverhangMm: legacyEave.eaveOverhangMm ?? DEFAULT_EAVE_OVERHANG_MM,
  });
  return {
    ...input.legacyModel,
    roofPlanes: composedWithQa.roofPlanes,
    roofFeatures: composedWithQa.roofFeatures,
    roofFlashings: roofArtifacts.roofFlashings,
    roofMaterialVisuals: roofArtifacts.roofMaterialVisuals,
    solids: roofArtifacts.solids,
    eave: roofArtifacts.eave,
    roofEaves: roofArtifacts.roofEaves,
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

/**
 * PR-COMP-UNIFIED-3 (2026-06-19): translate the workbench-shaped
 * composite roof intent (`HouseFormRoofIntentModel`) into the
 * geometry-package primitive intent shape (`RectangleRoofIntent`).
 *
 * The composite's `primaryPitchDeg` is a string at the model layer
 * (rail input); parse it to a number for the solver. The default
 * pitch matches the rail's minimum (5°) to keep solver output
 * defined when the input is unparseable.
 *
 * `startCap` / `endCap` are forced to `"hipped"` here — per-end
 * Dutch-hip derivation from composite `openGableEndIds` is a
 * separate followup (PR-COMP-UNIFIED-4); it requires mapping
 * composite terminal-end ids to specific wavefront stationary edge
 * indexes, which isn't trivial.
 */
function deriveCompositeRoofIntent(
  houseForm: HouseFormModel,
): RectangleRoofIntent {
  const intent = houseForm.roofIntent;
  const pitchDeg = Number.parseFloat(intent.primaryPitchDeg);
  const resolvedPitch = Number.isFinite(pitchDeg) && pitchDeg > 0 ? pitchDeg : 5;
  if (intent.form === "flat") {
    return { form: "flat" };
  }
  if (intent.form === "mono") {
    return {
      form: "mono",
      pitchDeg: resolvedPitch,
      fallDirection: intent.primaryFallDirection,
    };
  }
  return {
    form: "hipped",
    pitchDeg: resolvedPitch,
    ridgeAxis: intent.ridgeAxis,
    startCap: "hipped",
    endCap: "hipped",
  };
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
