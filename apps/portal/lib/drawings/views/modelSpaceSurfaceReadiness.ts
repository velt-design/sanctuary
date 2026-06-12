import type { WorkbenchViewTab } from '@/lib/drawings/workbenchViewTypes';
import type { WorkbenchDrawingSurfaceGeometry } from './workbenchDrawingSurfaceGeometry';

type ModelSpaceSurfaceReadiness = {
  hasGeometryReadyPlan: boolean;
  hasDrawableSection: boolean;
  showDrawingViewport: boolean;
};

export function resolveModelSpaceSurfaceReadiness(input: {
  view: WorkbenchViewTab;
  drawingSurfaceGeometry: WorkbenchDrawingSurfaceGeometry | null | undefined;
}): ModelSpaceSurfaceReadiness {
  const surface = input.drawingSurfaceGeometry ?? null;
  const artifact = surface?.source === 'solved_geometry' ? surface.artifact : null;
  const hasGeometryReadyPlan =
    input.view === 'plan' &&
    Boolean(artifact?.plan) &&
    Boolean(artifact?.topProjection);
  const hasDrawableSection =
    input.view === 'section' &&
    Boolean(artifact?.section);

  return {
    hasGeometryReadyPlan,
    hasDrawableSection,
    showDrawingViewport: hasGeometryReadyPlan || hasDrawableSection,
  };
}
