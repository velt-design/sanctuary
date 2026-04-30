import type { DrawingAssemblyModel } from '@/lib/drawings/assembly/types';
import type { GeometryPlanViewModel } from '@sp/geometry';
import type { ModulePlanModel } from '@/app/staff/calculator/moduleViews';
import type { HouseModel, WorkbenchHouseSelection } from '@/lib/drawings/state/houseFirstWorkbenchModel';
import {
  buildObjectWorkbenchPlanOverlay,
  type ObjectWorkbenchPlanOverlay,
} from './objectWorkbenchPlanOverlay';
import type {
  WorkbenchPergolaRenderSource,
  WorkbenchPergolaRenderStatus,
} from '@/lib/drawings/geometry/deriveWorkbenchGeometry';

export type ModelSpacePergolaViewModel = {
  geometryPlan: GeometryPlanViewModel | null;
  renderSource: WorkbenchPergolaRenderSource;
  renderStatus: WorkbenchPergolaRenderStatus;
};

export type PlanViewModel = {
  moduleId: string;
  moduleLabel: string;
  hasGeometry: boolean;
  roofType: ModulePlanModel['roofType'] | null;
  pergolaStyle: ModulePlanModel['pergolaStyle'] | null;
  rotationQuarterTurns: ModulePlanModel['drawingRotationQuarterTurns'];
  primarySize: {
    lengthA: number | null;
    spanA: number | null;
    lengthB: number | null;
    spanB: number | null;
  };
  houseContext: {
    visible: boolean;
    attachmentSide: ModulePlanModel['attachmentSide'] | 'rear';
    preset: ModulePlanModel['houseFootprintPreset'] | null;
    supportsFootprints: boolean;
    editable: boolean;
  };
  structure: {
    rafterCountA: number | null;
    rafterSpacingA: number | null;
    hasRidgeBeam: boolean;
    soffitBracketCount: number;
  };
  annotations: {
    keepTextUpright: true;
    sheetPrimaryDimensionsPinned: 'left_bottom';
    suppressDocumentAnnotationsInModelSpace: true;
  };
  modelSpacePergola: ModelSpacePergolaViewModel;
  objectWorkbenchOverlay: ObjectWorkbenchPlanOverlay | null;
  planModel: ModulePlanModel | null;
};

type PlanViewModelSource =
  | DrawingAssemblyModel
  | {
      moduleId: string;
      moduleLabel: string;
      planModel: ModulePlanModel | null;
      geometryPlan?: GeometryPlanViewModel | null;
      pergolaRenderSource?: WorkbenchPergolaRenderSource;
      pergolaRenderStatus?: WorkbenchPergolaRenderStatus;
      canEditHouseFootprint?: boolean;
      objectWorkbenchCompatibilityHouse?: HouseModel | null;
      objectWorkbenchCompatibilitySelection?: WorkbenchHouseSelection | null;
      includeObjectWorkbenchOverlay?: boolean;
      moduleLengthM?: string | null;
      moduleProjectionM?: string | null;
    };

function isDrawingAssemblyModel(source: PlanViewModelSource): source is DrawingAssemblyModel {
  return 'roof' in source && 'houseContext' in source && 'capabilities' in source;
}

export function buildPlanViewModel(source: PlanViewModelSource | null): PlanViewModel | null {
  if (!source) return null;

  const planModel = source.planModel;
  const moduleId = isDrawingAssemblyModel(source) ? source.id : source.moduleId;
  const moduleLabel = isDrawingAssemblyModel(source) ? source.label : source.moduleLabel;
  const canEditHouseFootprint = isDrawingAssemblyModel(source)
    ? source.capabilities.canEditHouseFootprint
    : Boolean(source.canEditHouseFootprint);
  const geometryPlan = !isDrawingAssemblyModel(source) ? source.geometryPlan ?? null : null;
  const renderSource =
    !isDrawingAssemblyModel(source) && source.pergolaRenderSource
      ? source.pergolaRenderSource
      : geometryPlan
        ? 'geometry'
        : 'legacy';
  const renderStatus =
    !isDrawingAssemblyModel(source) && source.pergolaRenderStatus
      ? source.pergolaRenderStatus
      : geometryPlan
        ? 'geometry_ready'
        : planModel
          ? 'legacy_unsupported_family'
          : 'invalid_geometry';

  return {
    moduleId,
    moduleLabel,
    hasGeometry: Boolean(planModel),
    roofType: planModel?.roofType ?? null,
    pergolaStyle: planModel?.pergolaStyle ?? null,
    rotationQuarterTurns: planModel?.drawingRotationQuarterTurns ?? 0,
    primarySize: {
      lengthA: planModel?.lengthA ?? null,
      spanA: planModel?.spanA ?? null,
      lengthB: planModel?.lengthB ?? null,
      spanB: planModel?.spanB ?? null,
    },
    houseContext: {
      visible: planModel?.houseConnectionType !== 'none' && planModel !== null,
      attachmentSide: planModel?.attachmentSide ?? 'rear',
      preset: planModel?.houseFootprintPreset ?? null,
      supportsFootprints: Boolean(planModel?.supportsHouseFootprints),
      editable: Boolean(planModel) && canEditHouseFootprint,
    },
    structure: {
      rafterCountA: planModel?.rafterCountA ?? null,
      rafterSpacingA: planModel?.rafterSpacingA ?? null,
      hasRidgeBeam: Boolean(planModel && planModel.ridgeBeamDepthM > 0 && planModel.ridgeBeamWidthM > 0),
      soffitBracketCount: planModel?.soffitBracketPositionsA.length ?? 0,
    },
    annotations: {
      keepTextUpright: true,
      sheetPrimaryDimensionsPinned: 'left_bottom',
      suppressDocumentAnnotationsInModelSpace: true,
    },
    modelSpacePergola: {
      geometryPlan,
      renderSource,
      renderStatus,
    },
    objectWorkbenchOverlay:
      !isDrawingAssemblyModel(source) && source.includeObjectWorkbenchOverlay
        ? buildObjectWorkbenchPlanOverlay({
            house: source.objectWorkbenchCompatibilityHouse,
            selection: source.objectWorkbenchCompatibilitySelection ?? { kind: 'house', targetId: null },
            moduleLengthM: source.moduleLengthM,
            moduleProjectionM: source.moduleProjectionM,
            geometryHouseContext: planModel?.houseContext ?? null,
          })
        : null,
    planModel,
  };
}
