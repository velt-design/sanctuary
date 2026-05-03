import type { ModuleViewsTab } from '@/app/staff/calculator/ModuleViewsCard';
import type { ModulePlanModel, ModuleSectionModel } from '@/app/staff/calculator/moduleViews';
import type { WorkbenchDrawingSurfaceGeometry } from './workbenchDrawingSurfaceGeometry';

export type ModelSpaceSurfaceReadiness = {
  planModel: ModulePlanModel | null;
  sectionModel: ModuleSectionModel | null;
  hasGeometryReadyPlan: boolean;
  hasDrawableSection: boolean;
  showDrawingViewport: boolean;
};

export function resolveModelSpaceSurfaceReadiness(input: {
  view: ModuleViewsTab;
  drawingSurfaceGeometry: WorkbenchDrawingSurfaceGeometry | null | undefined;
}): ModelSpaceSurfaceReadiness {
  const surface = input.drawingSurfaceGeometry ?? null;
  const planModel = surface?.legacyFallback.planModel ?? null;
  const sectionModel = surface?.legacyFallback.sectionModel ?? null;
  const hasGeometryReadyPlan =
    input.view === 'plan' &&
    surface?.source === 'solved_geometry' &&
    Boolean(surface.artifact) &&
    Boolean(surface.geometryPlan) &&
    Boolean(surface.geometryTopProjection);
  const hasDrawableSection =
    input.view === 'section' &&
    ((surface?.source === 'solved_geometry' && Boolean(surface.geometrySection)) ||
      (surface?.source === 'legacy_fallback' && Boolean(sectionModel)));

  return {
    planModel,
    sectionModel,
    hasGeometryReadyPlan,
    hasDrawableSection,
    showDrawingViewport: hasGeometryReadyPlan || hasDrawableSection,
  };
}
