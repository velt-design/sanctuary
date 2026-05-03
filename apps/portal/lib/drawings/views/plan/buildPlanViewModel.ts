import type { DrawingAssemblyModel } from '@/lib/drawings/assembly/types';
import type { Assembly3D, GeometryPlanViewModel, GeometryTopProjectionViewModel } from '@sp/geometry';
import type { ModulePlanModel } from '@/app/staff/calculator/moduleViews';
import {
  buildObjectWorkbenchPlanOverlay,
  type ObjectWorkbenchPlanOverlay,
  type ObjectWorkbenchPlanOverlayInput,
} from './objectWorkbenchPlanOverlay';
import type {
  WorkbenchPergolaRenderSource,
  WorkbenchPergolaRenderStatus,
} from '@/lib/drawings/geometry/deriveWorkbenchGeometry';
import type { WorkbenchSolvedGeometryArtifact } from '@/lib/drawings/state/workbenchSolvedModel';

type PlanGeometryArtifactDiagnostics = {
  source: WorkbenchSolvedGeometryArtifact['source'] | 'compatibility_fields' | null;
  fallback: WorkbenchSolvedGeometryArtifact['fallback'] | null;
  topProjectionFromViewerSceneArtifact: boolean | null;
};

type ModelSpacePergolaViewModel = {
  geometryPlan: GeometryPlanViewModel | null;
  geometryTopProjection: GeometryTopProjectionViewModel | null;
  geometryAssembly: Assembly3D | null;
  renderSource: WorkbenchPergolaRenderSource;
  renderStatus: WorkbenchPergolaRenderStatus;
  geometryArtifactDiagnostics: PlanGeometryArtifactDiagnostics;
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
      geometryArtifact?: WorkbenchSolvedGeometryArtifact | null;
      geometryPlan?: GeometryPlanViewModel | null;
      geometryTopProjection?: GeometryTopProjectionViewModel | null;
      geometryAssembly?: Assembly3D | null;
      pergolaRenderSource?: WorkbenchPergolaRenderSource;
      pergolaRenderStatus?: WorkbenchPergolaRenderStatus;
      canEditHouseFootprint?: boolean;
      objectWorkbenchOverlayInput?: ObjectWorkbenchPlanOverlayInput | null;
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
  const geometryArtifact = !isDrawingAssemblyModel(source) ? source.geometryArtifact ?? null : null;
  const geometryPlan = !isDrawingAssemblyModel(source)
    ? geometryArtifact?.plan ?? source.geometryPlan ?? null
    : null;
  const geometryTopProjection = !isDrawingAssemblyModel(source)
    ? geometryArtifact?.topProjection ?? source.geometryTopProjection ?? null
    : null;
  const geometryAssembly = !isDrawingAssemblyModel(source)
    ? geometryArtifact?.assembly ?? source.geometryAssembly ?? null
    : null;
  const renderSource =
    geometryArtifact?.renderSource ??
    (!isDrawingAssemblyModel(source) && source.pergolaRenderSource
      ? source.pergolaRenderSource
      : geometryPlan
        ? 'geometry'
        : 'legacy');
  const renderStatus =
    geometryArtifact?.renderStatus ??
    (!isDrawingAssemblyModel(source) && source.pergolaRenderStatus
      ? source.pergolaRenderStatus
      : geometryPlan
        ? 'geometry_ready'
        : planModel
          ? 'legacy_unsupported_family'
          : 'invalid_geometry');
  const geometryArtifactDiagnostics: PlanGeometryArtifactDiagnostics = geometryArtifact
    ? {
        source: geometryArtifact.source,
        fallback: geometryArtifact.fallback,
        topProjectionFromViewerSceneArtifact:
          geometryTopProjection === geometryArtifact.topProjection &&
          Boolean(geometryArtifact.viewerScene),
      }
    : {
        source: geometryPlan || geometryTopProjection || geometryAssembly ? 'compatibility_fields' : null,
        fallback: null,
        topProjectionFromViewerSceneArtifact: null,
      };

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
      geometryTopProjection,
      geometryAssembly,
      renderSource,
      renderStatus,
      geometryArtifactDiagnostics,
    },
    objectWorkbenchOverlay:
      !isDrawingAssemblyModel(source) && source.objectWorkbenchOverlayInput
        ? buildObjectWorkbenchPlanOverlay({
            ...source.objectWorkbenchOverlayInput,
            geometryPlan,
            geometryTopProjection,
            geometryAssembly: geometryAssembly ?? source.objectWorkbenchOverlayInput.geometryAssembly ?? null,
            geometryRenderSource: renderSource,
            geometryRenderStatus: renderStatus,
          })
        : null,
    planModel,
  };
}
