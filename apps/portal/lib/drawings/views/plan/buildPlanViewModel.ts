import type { Assembly3D, GeometryPlanViewModel, GeometryTopProjectionViewModel } from '@sp/geometry';
import {
  buildObjectWorkbenchPlanOverlay,
  type ObjectWorkbenchPlanOverlay,
  type ObjectWorkbenchPlanOverlayInput,
} from './objectWorkbenchPlanOverlay';
import type {
  WorkbenchPergolaRenderSource,
  WorkbenchPergolaRenderStatus,
  WorkbenchSolvedGeometryArtifact,
} from '@/lib/drawings/state/workbenchSolvedModel';

type PlanGeometryArtifactDiagnostics = {
  source: WorkbenchSolvedGeometryArtifact['source'] | null;
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
  viewId: string;
  viewLabel: string;
  hasGeometry: boolean;
  roofType: string | null;
  pergolaStyle: string | null;
  rotationQuarterTurns: 0;
  primarySize: {
    lengthA: number | null;
    spanA: number | null;
    lengthB: number | null;
    spanB: number | null;
  };
  houseReference: {
    visible: false;
    attachmentSide: 'rear';
    preset: null;
    supportsFootprints: false;
    editable: false;
  };
  structure: {
    rafterCountA: number | null;
    rafterSpacingA: number | null;
    hasRidgeBeam: false;
    soffitBracketCount: 0;
  };
  annotations: {
    keepTextUpright: true;
    sheetPrimaryDimensionsPinned: 'left_bottom';
    suppressDocumentAnnotationsInModelSpace: true;
  };
  modelSpacePergola: ModelSpacePergolaViewModel;
  objectWorkbenchOverlay: ObjectWorkbenchPlanOverlay | null;
  planModel: null;
};

type PlanViewModelSource = {
  viewId: string;
  viewLabel: string;
  geometryArtifact?: WorkbenchSolvedGeometryArtifact | null;
  geometryPlan?: GeometryPlanViewModel | null;
  geometryTopProjection?: GeometryTopProjectionViewModel | null;
  geometryAssembly?: Assembly3D | null;
  pergolaRenderSource?: WorkbenchPergolaRenderSource;
  pergolaRenderStatus?: WorkbenchPergolaRenderStatus;
  objectWorkbenchOverlayInput?: ObjectWorkbenchPlanOverlayInput | null;
};

function primarySizeFromGeometry(geometryPlan: GeometryPlanViewModel | null): PlanViewModel['primarySize'] {
  return {
    lengthA: geometryPlan ? geometryPlan.extents.lengthMm / 1000 : null,
    spanA: geometryPlan ? geometryPlan.extents.projectionMm / 1000 : null,
    lengthB: null,
    spanB: null,
  };
}

export function buildPlanViewModel(source: PlanViewModelSource | null): PlanViewModel | null {
  if (!source) return null;

  const geometryArtifact = source.geometryArtifact ?? null;
  const geometryPlan = geometryArtifact?.plan ?? source.geometryPlan ?? null;
  const geometryTopProjection = geometryArtifact?.topProjection ?? source.geometryTopProjection ?? null;
  const geometryAssembly = geometryArtifact?.assembly ?? source.geometryAssembly ?? null;
  const renderSource = geometryArtifact?.renderSource ?? source.pergolaRenderSource ?? (geometryPlan ? 'geometry' : 'none');
  const renderStatus =
    geometryArtifact?.renderStatus ?? source.pergolaRenderStatus ?? (geometryPlan ? 'geometry_ready' : 'invalid_geometry');
  const geometryArtifactDiagnostics: PlanGeometryArtifactDiagnostics = geometryArtifact
    ? {
        source: geometryArtifact.source,
        fallback: geometryArtifact.fallback,
        topProjectionFromViewerSceneArtifact:
          geometryTopProjection === geometryArtifact.topProjection &&
          Boolean(geometryArtifact.viewerScene),
      }
    : {
        source: null,
        fallback: null,
        topProjectionFromViewerSceneArtifact: null,
      };

  return {
    viewId: source.viewId,
    viewLabel: source.viewLabel,
    hasGeometry: Boolean(geometryArtifact?.plan ?? geometryPlan),
    roofType: null,
    pergolaStyle: null,
    rotationQuarterTurns: 0,
    primarySize: primarySizeFromGeometry(geometryArtifact?.plan ?? geometryPlan),
    houseReference: {
      visible: false,
      attachmentSide: 'rear',
      preset: null,
      supportsFootprints: false,
      editable: false,
    },
    structure: {
      rafterCountA: null,
      rafterSpacingA: null,
      hasRidgeBeam: false,
      soffitBracketCount: 0,
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
    objectWorkbenchOverlay: source.objectWorkbenchOverlayInput
      ? buildObjectWorkbenchPlanOverlay({
          ...source.objectWorkbenchOverlayInput,
          geometryPlan,
          geometryTopProjection,
          geometryAssembly: geometryAssembly ?? source.objectWorkbenchOverlayInput.geometryAssembly ?? null,
          geometryRenderSource: renderSource,
          geometryRenderStatus: renderStatus,
        })
      : null,
    planModel: null,
  };
}
