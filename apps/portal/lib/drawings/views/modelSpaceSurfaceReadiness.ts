import type { ModuleViewsTab } from '@/app/staff/calculator/ModuleViewsCard';
import type { ModulePlanModel, ModuleSectionModel } from '@/app/staff/calculator/moduleViews';
import type { WorkbenchDrawingSurfaceGeometry } from './workbenchDrawingSurfaceGeometry';

type ModelSpaceSurfaceReadiness = {
  legacyPlanModel: ModulePlanModel | null;
  legacySectionModel: ModuleSectionModel | null;
  hasGeometryReadyPlan: boolean;
  hasLegacyPlanFallback: boolean;
  hasDrawableSection: boolean;
  showDrawingViewport: boolean;
};

export function resolveModelSpaceSurfaceReadiness(input: {
  view: ModuleViewsTab;
  drawingSurfaceGeometry: WorkbenchDrawingSurfaceGeometry | null | undefined;
}): ModelSpaceSurfaceReadiness {
  const surface = input.drawingSurfaceGeometry ?? null;
  const legacyPlanModel = surface?.legacyFallback.planModel ?? null;
  const legacySectionModel = surface?.legacyFallback.sectionModel ?? null;
  const artifact = surface?.source === 'solved_geometry' ? surface.artifact : null;
  const hasGeometryReadyPlan =
    input.view === 'plan' &&
    Boolean(artifact?.plan) &&
    Boolean(artifact?.topProjection);
  const hasLegacyPlanFallback =
    input.view === 'plan' &&
    surface?.source === 'legacy_fallback' &&
    Boolean(legacyPlanModel);
  const hasDrawableSection =
    input.view === 'section' &&
    (Boolean(artifact?.section) ||
      (surface?.source === 'legacy_fallback' && Boolean(legacySectionModel)));

  return {
    legacyPlanModel,
    legacySectionModel,
    hasGeometryReadyPlan,
    hasLegacyPlanFallback,
    hasDrawableSection,
    showDrawingViewport: hasGeometryReadyPlan || hasLegacyPlanFallback || hasDrawableSection,
  };
}
