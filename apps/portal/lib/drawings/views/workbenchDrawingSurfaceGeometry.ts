import type {
  GeometryPlanViewModel,
  GeometrySectionViewModel,
  GeometryTopProjectionViewModel,
} from '@sp/geometry';
import type { ModulePlanModel, ModuleSectionModel } from '@/app/staff/calculator/moduleViews';
import type { WorkbenchViewportGeometry } from '@/lib/drawings/state/workbenchSolvedModel';
import type { PlanViewModel } from './plan/buildPlanViewModel';

export type WorkbenchDrawingSurfaceGeometrySource =
  | 'solved_geometry'
  | 'legacy_fallback'
  | 'unavailable';

export type WorkbenchDrawingSurfaceGeometry = {
  source: WorkbenchDrawingSurfaceGeometrySource;
  planModel: ModulePlanModel | null;
  planViewModel: PlanViewModel | null;
  geometryPlan: GeometryPlanViewModel | null;
  geometryTopProjection: GeometryTopProjectionViewModel | null;
  sectionModel: ModuleSectionModel | null;
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
      planModel: fallback.planModel,
      planViewModel: input.planViewModel,
      geometryPlan: artifact.plan,
      geometryTopProjection: artifact.topProjection,
      sectionModel: fallback.sectionModel,
      geometrySection: artifact.section,
    };
  }

  if (fallback.planModel || fallback.sectionModel) {
    return {
      source: 'legacy_fallback',
      planModel: fallback.planModel,
      planViewModel: input.planViewModel,
      geometryPlan: null,
      geometryTopProjection: null,
      sectionModel: fallback.sectionModel,
      geometrySection: null,
    };
  }

  return {
    source: 'unavailable',
    planModel: null,
    planViewModel: input.planViewModel,
    geometryPlan: null,
    geometryTopProjection: null,
    sectionModel: null,
    geometrySection: null,
  };
}
