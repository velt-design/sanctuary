import { describe, expect, it } from 'vitest';
import type { WorkbenchDrawingSurfaceGeometry } from './workbenchDrawingSurfaceGeometry';
import { resolveModelSpaceSurfaceReadiness } from './modelSpaceSurfaceReadiness';

const planModel = { view: 'plan-model' } as WorkbenchDrawingSurfaceGeometry['planModel'];
const sectionModel = { view: 'section-model' } as WorkbenchDrawingSurfaceGeometry['sectionModel'];
const geometryPlan = { view: 'geometry-plan' } as WorkbenchDrawingSurfaceGeometry['geometryPlan'];
const geometryTopProjection = { view: 'geometry-top-projection' } as WorkbenchDrawingSurfaceGeometry['geometryTopProjection'];
const geometrySection = { view: 'geometry-section' } as WorkbenchDrawingSurfaceGeometry['geometrySection'];

function makeSurface(overrides: Partial<WorkbenchDrawingSurfaceGeometry>): WorkbenchDrawingSurfaceGeometry {
  return {
    source: 'unavailable',
    artifact: null,
    legacyFallback: {
      planModel: null,
      sectionModel: null,
    },
    planModel: null,
    planViewModel: null,
    geometryPlan: null,
    geometryTopProjection: null,
    sectionModel: null,
    geometrySection: null,
    ...overrides,
  };
}

describe('resolveModelSpaceSurfaceReadiness', () => {
  it('marks plan ready only from a solved surface with an artifact and derived plan/top projection', () => {
    const readiness = resolveModelSpaceSurfaceReadiness({
      view: 'plan',
      drawingSurfaceGeometry: makeSurface({
        source: 'solved_geometry',
        artifact: {
          plan: geometryPlan,
          topProjection: geometryTopProjection,
        } as WorkbenchDrawingSurfaceGeometry['artifact'],
        legacyFallback: {
          planModel,
          sectionModel: null,
        },
        planModel,
        geometryPlan,
        geometryTopProjection,
      }),
    });

    expect(readiness.hasGeometryReadyPlan).toBe(true);
    expect(readiness.showDrawingViewport).toBe(true);
    expect(readiness.legacyPlanModel).toBe(planModel);
  });

  it('marks solved plan ready from the artifact even without a legacy plan fallback', () => {
    const readiness = resolveModelSpaceSurfaceReadiness({
      view: 'plan',
      drawingSurfaceGeometry: makeSurface({
        source: 'solved_geometry',
        artifact: {
          plan: geometryPlan,
          topProjection: geometryTopProjection,
        } as WorkbenchDrawingSurfaceGeometry['artifact'],
        geometryPlan,
        geometryTopProjection,
      }),
    });

    expect(readiness.hasGeometryReadyPlan).toBe(true);
    expect(readiness.showDrawingViewport).toBe(true);
    expect(readiness.legacyPlanModel).toBeNull();
  });

  it('does not treat loose fallback presenters as geometry-ready plan input', () => {
    const readiness = resolveModelSpaceSurfaceReadiness({
      view: 'plan',
      drawingSurfaceGeometry: makeSurface({
        source: 'legacy_fallback',
        legacyFallback: {
          planModel,
          sectionModel: null,
        },
        planModel,
      }),
    });

    expect(readiness.hasGeometryReadyPlan).toBe(false);
    expect(readiness.showDrawingViewport).toBe(false);
  });

  it('allows section drawing from solved section or explicit legacy fallback', () => {
    expect(
      resolveModelSpaceSurfaceReadiness({
        view: 'section',
        drawingSurfaceGeometry: makeSurface({
          source: 'solved_geometry',
          artifact: {
            section: geometrySection,
          } as WorkbenchDrawingSurfaceGeometry['artifact'],
          geometrySection,
        }),
      }).hasDrawableSection,
    ).toBe(true);

    expect(
      resolveModelSpaceSurfaceReadiness({
        view: 'section',
        drawingSurfaceGeometry: makeSurface({
          source: 'legacy_fallback',
          legacyFallback: {
            planModel: null,
            sectionModel,
          },
          sectionModel,
        }),
      }).hasDrawableSection,
    ).toBe(true);
  });
});
