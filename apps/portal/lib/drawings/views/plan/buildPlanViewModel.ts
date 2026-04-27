import type { DrawingAssemblyModel } from '@/lib/drawings/assembly/types';
import type { ModulePlanModel } from '@/app/staff/calculator/moduleViews';
import type { HouseModel, WorkbenchHouseSelection } from '@/lib/drawings/state/houseFirstWorkbenchModel';
import {
  buildHouseFirstPlanOverlay,
  type HouseFirstPlanOverlay,
} from './houseFirstPlanOverlay';

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
  houseFirst: HouseFirstPlanOverlay | null;
  planModel: ModulePlanModel | null;
};

type PlanViewModelSource =
  | DrawingAssemblyModel
  | {
      moduleId: string;
      moduleLabel: string;
      planModel: ModulePlanModel | null;
      canEditHouseFootprint?: boolean;
      house?: HouseModel | null;
      activeHouseSelection?: WorkbenchHouseSelection | null;
      includeHouseFirstOverlay?: boolean;
      moduleLengthM?: string | null;
      moduleProjectionM?: string | null;
    };

function isDrawingAssemblyModel(source: PlanViewModelSource): source is DrawingAssemblyModel {
  return 'roof' in source && 'houseContext' in source && 'capabilities' in source;
}

export function buildPlanViewModel(source: PlanViewModelSource | null): PlanViewModel | null {
  if (!source) return null;

  const planModel = source.planModel;
  if (!planModel) return null;

  const moduleId = isDrawingAssemblyModel(source) ? source.id : source.moduleId;
  const moduleLabel = isDrawingAssemblyModel(source) ? source.label : source.moduleLabel;
  const canEditHouseFootprint = isDrawingAssemblyModel(source)
    ? source.capabilities.canEditHouseFootprint
    : Boolean(source.canEditHouseFootprint);

  return {
    moduleId,
    moduleLabel,
    hasGeometry: true,
    roofType: planModel.roofType,
    pergolaStyle: planModel.pergolaStyle,
    rotationQuarterTurns: planModel.drawingRotationQuarterTurns,
    primarySize: {
      lengthA: planModel.lengthA,
      spanA: planModel.spanA,
      lengthB: planModel.lengthB,
      spanB: planModel.spanB,
    },
    houseContext: {
      visible: planModel.houseConnectionType !== 'none',
      attachmentSide: planModel.attachmentSide,
      preset: planModel.houseFootprintPreset,
      supportsFootprints: planModel.supportsHouseFootprints,
      editable: canEditHouseFootprint,
    },
    structure: {
      rafterCountA: planModel.rafterCountA,
      rafterSpacingA: planModel.rafterSpacingA,
      hasRidgeBeam: planModel.ridgeBeamDepthM > 0 && planModel.ridgeBeamWidthM > 0,
      soffitBracketCount: planModel.soffitBracketPositionsA.length,
    },
    annotations: {
      keepTextUpright: true,
      sheetPrimaryDimensionsPinned: 'left_bottom',
      suppressDocumentAnnotationsInModelSpace: true,
    },
    houseFirst:
      !isDrawingAssemblyModel(source) && source.includeHouseFirstOverlay
        ? buildHouseFirstPlanOverlay({
            house: source.house,
            selection: source.activeHouseSelection ?? { kind: 'house', targetId: null },
            moduleLengthM: source.moduleLengthM,
            moduleProjectionM: source.moduleProjectionM,
            geometryHouseContext: planModel.houseContext ?? null,
          })
        : null,
    planModel,
  };
}
