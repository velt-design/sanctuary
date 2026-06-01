import {
  applyHouseReferencePosition,
  buildHouseModel3DFromRawHouseInput,
  buildHouseReferenceProjectionShape,
  type GeometryTopProjectionShape,
  type HouseModel3D,
  type HouseReferenceGeometry,
  type Polygon3,
  type RawHouseInput,
} from '@sp/geometry';
import { houseFormTransformToAssemblyPosition } from './houseFormTransform';
import { buildHouseFormRawGeometryInput } from './houseFormRawGeometry';
import type { HouseFormModel, WorkbenchProjectModel } from './objectFirstWorkbenchModel';
import type { ProjectHouseProjectionFailureStage } from './projectHouseProjectionHealth';

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
};

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
  failureStage: Exclude<ProjectHouseProjectionFailureStage, 'none'>;
  diagnosticCode: string;
  diagnostics: HouseFormGeometryInputDiagnostics;
};

export type HouseFormGeometryInputResult =
  | HouseFormGeometryInputSuccess
  | HouseFormGeometryInputFailure;

function buildFailure(input: {
  houseFormId: string;
  failureStage: Exclude<ProjectHouseProjectionFailureStage, 'none'>;
  diagnosticCode?: string;
  footprintPointCount?: number;
  rawHouseInputPresent?: boolean;
  referencePresent?: boolean;
  modelPresent?: boolean;
  wallCount?: number;
  roofPlaneCount?: number;
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
    },
  };
}

export function buildHouseFormGeometryInputForForm(
  houseForm: HouseFormModel,
): HouseFormGeometryInputResult {
  const rawGeometry = buildHouseFormRawGeometryInput(houseForm);
  if (!rawGeometry) {
    return buildFailure({
      houseFormId: houseForm.id,
      failureStage: 'invalid_footprint',
      diagnosticCode: 'invalid_footprint',
    });
  }

  const model = buildHouseModel3DFromRawHouseInput({
    rawHouse: rawGeometry.rawHouse,
    footprint: rawGeometry.footprint,
    pergolaAttachment: null,
  });
  if (!model) {
    return buildFailure({
      houseFormId: houseForm.id,
      failureStage: 'missing_model',
      footprintPointCount: rawGeometry.footprint.length,
      rawHouseInputPresent: true,
    });
  }

  const houseLocal: HouseReferenceGeometry = {
    wallPlane: null,
    fasciaLine: null,
    roofEdgeLine: null,
    soffitDepthMm: model.eave?.soffitDepthMm ?? null,
    footprint: rawGeometry.footprint,
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
      failureStage: 'missing_geometry_input',
      diagnosticCode: 'missing_reference_shape',
      footprintPointCount: rawGeometry.footprint.length,
      rawHouseInputPresent: true,
      modelPresent: true,
      wallCount: positionedModel.wallSegments.length,
      roofPlaneCount: positionedModel.roofPlanes.length,
    });
  }

  const failureStage: ProjectHouseProjectionFailureStage =
    positionedModel.roofPlanes.length <= 0 ? 'missing_roof_model' : 'none';
  return {
    ok: true,
    houseFormId: houseForm.id,
    houseForm,
    rawHouseInput: rawGeometry.rawHouse,
    footprint: rawGeometry.footprint,
    geometry,
    model: positionedModel,
    referenceShape,
    diagnostics: {
      houseFormId: houseForm.id,
      footprintPointCount: rawGeometry.footprint.length,
      rawHouseInputPresent: true,
      referencePresent: true,
      modelPresent: true,
      wallCount: positionedModel.wallSegments.length,
      roofPlaneCount: positionedModel.roofPlanes.length,
      failureStage,
      diagnosticCode: failureStage === 'none' ? null : failureStage,
    },
  };
}

export function buildHouseFormGeometryInput(input: {
  projectModel: WorkbenchProjectModel;
  houseFormId: string;
}): HouseFormGeometryInputResult {
  const houseForm =
    input.projectModel.houseAssembly?.houseForms.find((candidate) => candidate.id === input.houseFormId) ??
    null;
  if (!houseForm) {
    return buildFailure({
      houseFormId: input.houseFormId,
      failureStage: 'missing_house_form',
      diagnosticCode: 'missing_house_form',
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
