import { describe, expect, it } from 'vitest';
import { buildEstimateDrawingModules } from '@/lib/estimates/moduleDrawing';
import { getSanctuaryGeometryWorkbenchFixture } from '@/lib/drawings/sanctuaryWorkbenchFixtures';
import { buildHouseFirstWorkbenchProjectModel } from '@/lib/drawings/state/houseFirstWorkbenchAdapter';
import { buildDrawingWorkbenchStore } from '@/lib/drawings/state/drawingWorkbenchStore';
import { createDrawingWorkbenchUiState } from '@/lib/drawings/state/drawingWorkbenchUiState';
import { buildWorkbenchGeometryPreview } from './buildWorkbenchGeometryPreview';
import { coerceHiddenWorkbenchGableBaseline } from './hiddenWorkbenchGableBaseline';
import { deriveWorkbenchGeometry } from './deriveWorkbenchGeometry';
import { resolveWorkbenchGeometryModule } from './resolveWorkbenchGeometryModule';

function requireFixture(slug: 'mono-standard' | 'gable-standard' | 'box-standard') {
  const fixture = getSanctuaryGeometryWorkbenchFixture(slug);
  if (!fixture) throw new Error(`Missing ${slug} fixture.`);
  return fixture;
}

describe('deriveWorkbenchGeometry', () => {
  (['mono-standard', 'gable-standard', 'box-standard'] as const).forEach((slug) => {
    it(`matches the shared store and 3D preview solve outputs for ${slug}`, () => {
      const fixture = requireFixture(slug);
      const resolved = resolveWorkbenchGeometryModule({
        snapshot: fixture.snapshot,
        moduleIndex: 0,
      });
      if (!resolved.ok) throw new Error(`Expected resolved geometry module for ${slug}.`);

      const drawingModule = buildEstimateDrawingModules(fixture.snapshot)[0];
      if (!drawingModule) throw new Error(`Expected drawing module for ${slug}.`);

      const projectModel = buildHouseFirstWorkbenchProjectModel({
        snapshot: fixture.snapshot,
      });
      const derivation = deriveWorkbenchGeometry({
        projectId: 'proj_shared',
        estimateId: fixture.estimate.id,
        designRequestId: fixture.request.id,
        moduleId: drawingModule.id,
        module: coerceHiddenWorkbenchGableBaseline(resolved.module),
        result: resolved.moduleResult,
        sharedHouse: projectModel.house,
        fallbackPlanModel: drawingModule.planModel,
        fallbackSectionModel: drawingModule.sectionModel,
      });

      expect(derivation.kind).toBe('geometry');
      if (derivation.kind !== 'geometry') return;

      const preview = buildWorkbenchGeometryPreview({
        projectId: 'proj_shared',
        estimateId: fixture.estimate.id,
        designRequestId: fixture.request.id,
        snapshot: fixture.snapshot,
        moduleIndex: 0,
      });
      expect(preview.kind).toBe('ready');
      if (preview.kind !== 'ready') return;

      const store = buildDrawingWorkbenchStore({
        snapshot: fixture.snapshot,
        ui: createDrawingWorkbenchUiState({
          activeView: 'plan',
          viewportMode: 'model',
        }),
      });

      expect(preview.config).toEqual(derivation.config);
      expect(preview.assembly).toEqual(derivation.assembly);
      expect(store.persisted.modules[0]?.geometryPlanViewModel).toEqual(derivation.geometryPlan);
      expect(store.persisted.modules[0]?.planRenderSource).toBe('geometry');
      expect(store.persisted.modules[0]?.planRenderStatus).toBe('geometry_ready');
      expect(store.derived.activePlanViewModel?.modelSpacePergola.geometryPlan).toEqual(derivation.geometryPlan);
      expect(store.derived.activePlanViewModel?.modelSpacePergola.renderSource).toBe('geometry');
      expect(store.derived.activePlanViewModel?.modelSpacePergola.renderStatus).toBe('geometry_ready');
    });
  });

  it('builds geometry-backed models for hip families', () => {
    const fixture = requireFixture('mono-standard');
    const snapshot = structuredClone(fixture.snapshot) as {
      inputs: { modules: Array<{ pergolaStyle: string }> };
    };
    snapshot.inputs.modules[0]!.pergolaStyle = 'hip';

    const resolved = resolveWorkbenchGeometryModule({
      snapshot: snapshot as unknown as Record<string, unknown>,
      moduleIndex: 0,
    });
    if (!resolved.ok) throw new Error('Expected resolved hip geometry module.');

    const drawingModule = buildEstimateDrawingModules(snapshot as unknown as Record<string, unknown>)[0];
    if (!drawingModule) throw new Error('Expected hip drawing module.');

    const projectModel = buildHouseFirstWorkbenchProjectModel({
      snapshot: snapshot as unknown as Record<string, unknown>,
    });
    const derivation = deriveWorkbenchGeometry({
      projectId: 'proj_shared',
      estimateId: fixture.estimate.id,
      designRequestId: fixture.request.id,
      moduleId: drawingModule.id,
      module: coerceHiddenWorkbenchGableBaseline(resolved.module),
      result: resolved.moduleResult,
      sharedHouse: projectModel.house,
      fallbackPlanModel: drawingModule.planModel,
      fallbackSectionModel: drawingModule.sectionModel,
    });

    expect(derivation.kind).toBe('geometry');
    if (derivation.kind !== 'geometry') return;
    expect(derivation.config.family).toBe('hip');
    expect(derivation.assembly.family).toBe('hip');
    expect(derivation.geometryPlan.family).toBe('hip');
    expect(derivation.renderSource).toBe('geometry');
    expect(derivation.renderStatus).toBe('geometry_ready');
    expect(derivation.planModel?.roofType).toBe('hip');
    expect(derivation.sectionModel?.roofType).toBe('hip');
  });

  it('builds geometry-backed models for hip-corner families while preserving B-dimension sheet metadata', () => {
    const fixture = requireFixture('mono-standard');
    const snapshot = structuredClone(fixture.snapshot) as {
      inputs: {
        modules: Array<{
          pergolaStyle: string;
          hipCornerLengthBM?: string;
          hipCornerProjectionBM?: string;
        }>;
      };
    };
    snapshot.inputs.modules[0]!.pergolaStyle = 'hip_corner';
    snapshot.inputs.modules[0]!.hipCornerLengthBM = '4';
    snapshot.inputs.modules[0]!.hipCornerProjectionBM = '2';

    const resolved = resolveWorkbenchGeometryModule({
      snapshot: snapshot as unknown as Record<string, unknown>,
      moduleIndex: 0,
    });
    if (!resolved.ok) throw new Error('Expected resolved hip-corner geometry module.');

    const drawingModule = buildEstimateDrawingModules(snapshot as unknown as Record<string, unknown>)[0];
    if (!drawingModule) throw new Error('Expected hip-corner drawing module.');

    const projectModel = buildHouseFirstWorkbenchProjectModel({
      snapshot: snapshot as unknown as Record<string, unknown>,
    });
    const derivation = deriveWorkbenchGeometry({
      projectId: 'proj_shared',
      estimateId: fixture.estimate.id,
      designRequestId: fixture.request.id,
      moduleId: drawingModule.id,
      module: coerceHiddenWorkbenchGableBaseline(resolved.module),
      result: resolved.moduleResult,
      sharedHouse: projectModel.house,
      fallbackPlanModel: drawingModule.planModel,
      fallbackSectionModel: drawingModule.sectionModel,
    });

    expect(derivation.kind).toBe('geometry');
    if (derivation.kind !== 'geometry') return;
    expect(derivation.config.family).toBe('hip_corner');
    expect(derivation.assembly.family).toBe('hip_corner');
    expect(derivation.geometryPlan.family).toBe('hip_corner');
    expect(derivation.renderSource).toBe('geometry');
    expect(derivation.renderStatus).toBe('geometry_ready');
    expect(derivation.planModel?.roofType).toBe('hip_corner');
    expect(derivation.planModel?.lengthB).toBeCloseTo(4);
    expect(derivation.planModel?.spanB).toBeCloseTo(2);
  });
});
