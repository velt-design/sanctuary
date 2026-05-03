import type {
  GeometryPlanViewModel,
  GeometrySectionViewModel,
  GeometryTopProjectionViewModel,
} from '@sp/geometry';
import type { ModulePlanModel, ModuleSectionModel } from '@/app/staff/calculator/moduleViews';
import type {
  WorkbenchSolvedGeometryArtifact,
  WorkbenchViewportGeometry,
} from '@/lib/drawings/state/workbenchSolvedModel';
import type { PlanViewModel } from './plan/buildPlanViewModel';

type WorkbenchDrawingSurfaceGeometrySource =
  | 'solved_geometry'
  | 'legacy_fallback'
  | 'unavailable';

export type WorkbenchDrawingSurfaceGeometry = {
  source: WorkbenchDrawingSurfaceGeometrySource;
  artifact: WorkbenchSolvedGeometryArtifact | null;
  legacyFallback: {
    planModel: ModulePlanModel | null;
    sectionModel: ModuleSectionModel | null;
  };
  legacyPlanModel: ModulePlanModel | null;
  planViewModel: PlanViewModel | null;
  geometryPlan: GeometryPlanViewModel | null;
  geometryTopProjection: GeometryTopProjectionViewModel | null;
  legacySectionModel: ModuleSectionModel | null;
  geometrySection: GeometrySectionViewModel | null;
};

export function buildWorkbenchDrawingSurfaceGeometry(input: {
  viewportGeometry: WorkbenchViewportGeometry | null;
  planViewModel: PlanViewModel | null;
}): WorkbenchDrawingSurfaceGeometry {
  const artifact = input.viewportGeometry?.artifact ?? null;
  const fallback = input.viewportGeometry?.legacyFallback ?? {
    planModel: null,
    sectionModel: null,
  };

  if (artifact) {
    return {
      source: 'solved_geometry',
      artifact,
      legacyFallback: fallback,
      legacyPlanModel: fallback.planModel,
      planViewModel: input.planViewModel,
      geometryPlan: artifact.plan,
      geometryTopProjection: artifact.topProjection,
      legacySectionModel: fallback.sectionModel,
      geometrySection: artifact.section,
    };
  }

  if (fallback.planModel || fallback.sectionModel) {
    return {
      source: 'legacy_fallback',
      artifact: null,
      legacyFallback: fallback,
      legacyPlanModel: fallback.planModel,
      planViewModel: input.planViewModel,
      geometryPlan: null,
      geometryTopProjection: null,
      legacySectionModel: fallback.sectionModel,
      geometrySection: null,
    };
  }

  return {
    source: 'unavailable',
    artifact: null,
    legacyFallback: fallback,
    legacyPlanModel: null,
    planViewModel: input.planViewModel,
    geometryPlan: null,
    geometryTopProjection: null,
    legacySectionModel: null,
    geometrySection: null,
  };
}
