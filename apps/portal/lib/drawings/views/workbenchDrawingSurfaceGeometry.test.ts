import { describe, expect, it } from 'vitest';
import type {
  GeometryPlanViewModel,
  GeometrySectionViewModel,
  GeometryTopProjectionViewModel,
} from '@sp/geometry';
import type { ModulePlanModel, ModuleSectionModel } from '@/app/staff/calculator/moduleViews';
import type { WorkbenchViewportGeometry } from '@/lib/drawings/state/workbenchSolvedModel';
import type { PlanViewModel } from './plan/buildPlanViewModel';
import { buildWorkbenchDrawingSurfaceGeometry } from './workbenchDrawingSurfaceGeometry';

const planModel = { view: 'plan-model' } as unknown as ModulePlanModel;
const sectionModel = { view: 'section-model' } as unknown as ModuleSectionModel;
const planViewModel = { view: 'plan-view-model' } as unknown as PlanViewModel;
const geometryPlan = { view: 'geometry-plan' } as unknown as GeometryPlanViewModel;
const geometryTopProjection = { view: 'geometry-top-projection' } as unknown as GeometryTopProjectionViewModel;
const geometrySection = { view: 'geometry-section' } as unknown as GeometrySectionViewModel;

function makeViewportGeometry(overrides: Partial<WorkbenchViewportGeometry>): WorkbenchViewportGeometry {
  return {
    artifact: null,
    legacyFallback: {
      planModel: null,
      sectionModel: null,
    },
    preview: null,
    status: {
      source: 'fallback',
      trust: 'fallback',
      reason: 'none',
      details: [],
    },
    ...overrides,
  } as WorkbenchViewportGeometry;
}

describe('buildWorkbenchDrawingSurfaceGeometry', () => {
  it('routes solved geometry while keeping named fallback plan and section aliases visible', () => {
    const surface = buildWorkbenchDrawingSurfaceGeometry({
      viewportGeometry: makeViewportGeometry({
        artifact: {
          plan: geometryPlan,
          topProjection: geometryTopProjection,
          section: geometrySection,
        } as WorkbenchViewportGeometry['artifact'],
        legacyFallback: {
          planModel,
          sectionModel,
        },
      }),
      planViewModel,
    });

    expect(surface.artifact).toBeTruthy();
    expect(surface.artifact?.plan).toBe(geometryPlan);
    expect(surface.legacyFallback).toEqual({
      planModel,
      sectionModel,
    });
    expect(surface).toMatchObject({
      source: 'solved_geometry',
      legacyPlanModel: planModel,
      planViewModel,
      geometryPlan,
      geometryTopProjection,
      legacySectionModel: sectionModel,
      geometrySection,
    });
  });

  it('routes solved geometry without requiring legacy plan or section presenters', () => {
    const surface = buildWorkbenchDrawingSurfaceGeometry({
      viewportGeometry: makeViewportGeometry({
        artifact: {
          plan: geometryPlan,
          topProjection: geometryTopProjection,
          section: geometrySection,
        } as WorkbenchViewportGeometry['artifact'],
      }),
      planViewModel,
    });

    expect(surface.source).toBe('solved_geometry');
    expect(surface.legacyPlanModel).toBeNull();
    expect(surface.legacySectionModel).toBeNull();
    expect(surface.geometryPlan).toBe(geometryPlan);
    expect(surface.geometryTopProjection).toBe(geometryTopProjection);
    expect(surface.geometrySection).toBe(geometrySection);
    expect('planModel' in surface).toBe(false);
    expect('sectionModel' in surface).toBe(false);
  });

  it('routes fallback-only geometry as a named legacy fallback surface', () => {
    const surface = buildWorkbenchDrawingSurfaceGeometry({
      viewportGeometry: makeViewportGeometry({
        legacyFallback: {
          planModel,
          sectionModel,
        },
      }),
      planViewModel,
    });

    expect(surface).toMatchObject({
      source: 'legacy_fallback',
      artifact: null,
      legacyFallback: {
        planModel,
        sectionModel,
      },
      legacyPlanModel: planModel,
      planViewModel,
      geometryPlan: null,
      geometryTopProjection: null,
      legacySectionModel: sectionModel,
      geometrySection: null,
    });
  });

  it('returns an unavailable surface without dropping the plan view model', () => {
    const surface = buildWorkbenchDrawingSurfaceGeometry({
      viewportGeometry: null,
      planViewModel,
    });

    expect(surface).toMatchObject({
      source: 'unavailable',
      artifact: null,
      legacyFallback: {
        planModel: null,
        sectionModel: null,
      },
      legacyPlanModel: null,
      planViewModel,
      geometryPlan: null,
      geometryTopProjection: null,
      legacySectionModel: null,
      geometrySection: null,
    });
  });
});
