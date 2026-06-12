import type {
  GeometryPlanViewModel,
  GeometrySectionViewModel,
  GeometryTopProjectionViewModel,
} from '@sp/geometry';
import type {
  WorkbenchSolvedGeometryArtifact,
  WorkbenchViewportGeometry,
} from '@/lib/drawings/state/workbenchSolvedModel';
import type { PlanViewModel } from './plan/buildPlanViewModel';

type WorkbenchDrawingSurfaceGeometrySource =
  | 'solved_geometry'
  | 'unavailable';

export type WorkbenchDrawingSurfaceGeometry = {
  source: WorkbenchDrawingSurfaceGeometrySource;
  artifact: WorkbenchSolvedGeometryArtifact | null;
  planViewModel: PlanViewModel | null;
  geometryPlan: GeometryPlanViewModel | null;
  geometryTopProjection: GeometryTopProjectionViewModel | null;
  geometrySection: GeometrySectionViewModel | null;
};

export function buildWorkbenchDrawingSurfaceGeometry(input: {
  viewportGeometry: WorkbenchViewportGeometry | null;
  planViewModel: PlanViewModel | null;
}): WorkbenchDrawingSurfaceGeometry {
  const artifact = input.viewportGeometry?.artifact ?? null;

  if (artifact) {
    return {
      source: 'solved_geometry',
      artifact,
      planViewModel: input.planViewModel,
      geometryPlan: artifact.plan,
      geometryTopProjection: artifact.topProjection,
      geometrySection: artifact.section,
    };
  }

  return {
    source: 'unavailable',
    artifact: null,
    planViewModel: input.planViewModel,
    geometryPlan: null,
    geometryTopProjection: null,
    geometrySection: null,
  };
}
