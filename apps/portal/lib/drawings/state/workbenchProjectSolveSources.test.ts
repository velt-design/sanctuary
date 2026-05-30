import { describe, expect, it } from 'vitest';
import { getSanctuaryGeometryWorkbenchFixture } from '@/lib/drawings/sanctuaryWorkbenchFixtures';
import { buildEstimateDrawingModules } from '@/lib/estimates/moduleDrawing';
import {
  buildEstimateDrawingDraftFromSnapshot,
  mergeEstimateDrawingDraftIntoSnapshot,
  resolveCalculatorInputsFromSnapshot,
} from '@/lib/estimates/drawingEdits';
import { buildObjectWorkbenchGeometryContext } from '@/lib/drawings/geometry/objectWorkbenchGeometryContext';
import { mapProjectDecks, mapProjectOpenings } from '@/lib/drawings/geometry/buildRawGeometryModuleInput';
import { resolveModuleHouseForm } from '@/lib/drawings/geometry/resolveModuleHouseForm';
import { buildObjectFirstPergolaSolveSources } from './objectFirstPergolaSolveSources';
import { buildObjectFirstWorkbenchDraftBaselineFromLegacyEstimateSnapshot } from './legacyEstimateSnapshotAdapter';
import {
  buildWorkbenchProjectSolveSources,
  solveWorkbenchProjectSources,
} from './workbenchProjectSolveSources';

function getFixtureSnapshot(name: Parameters<typeof getSanctuaryGeometryWorkbenchFixture>[0]): Record<string, unknown> {
  const fixture = getSanctuaryGeometryWorkbenchFixture(name);
  if (!fixture) {
    throw new Error(`Missing ${name} workbench fixture.`);
  }
  return fixture.snapshot;
}

function addTransientPergolaTwo(
  draft: NonNullable<ReturnType<typeof buildEstimateDrawingDraftFromSnapshot>>,
  snapshot: Record<string, unknown>,
) {
  const baseline = buildObjectFirstWorkbenchDraftBaselineFromLegacyEstimateSnapshot({
    snapshot,
    draft,
  });
  if (!baseline) throw new Error('Expected objectFirst baseline draft.');
  baseline.pergolas.push({
    id: 'pergola-2',
    label: 'Pergola 2',
    family: 'mono',
    connectionKind: 'freestanding',
    attachmentEdgeId: null,
    attachmentZoneId: null,
    side: 'rear',
    strategy: 'none',
    geometry: {
      dimensions: { lengthM: '4', projectionM: '2.5' },
      roof: { pitchDeg: '5', material: 'acrylic' },
      supports: {
        postCount: '4',
        postCutHeightM: '2.4',
        postConnectionType: 'slab_anchors',
        ground: 'easy',
      },
    },
    position: { originXMm: '12000', originYMm: '0', rotationDeg: '0' },
    attachment: { spatialKind: 'freestanding', host: null, method: 'none' },
  });
  draft.objectFirst = baseline;
}

describe('workbench project solve sources', () => {
  it('builds one ordered source list for persisted and transient pergolas', () => {
    const snapshot = getFixtureSnapshot('mono-standard');
    const draft = buildEstimateDrawingDraftFromSnapshot(snapshot);
    if (!draft) throw new Error('Expected drawing draft.');
    const initialModuleCount = draft.inputs.modules.length;
    addTransientPergolaTwo(draft, snapshot);

    const effectiveSnapshot = mergeEstimateDrawingDraftIntoSnapshot(snapshot, draft);
    const drawingModules = buildEstimateDrawingModules(effectiveSnapshot, {
      ignoreModuleResults: false,
    });
    const geometryContext = buildObjectWorkbenchGeometryContext({
      snapshot,
      draft,
    });
    const projectModel = geometryContext.projectModel;
    if (!projectModel) throw new Error('Expected project model.');
    const objectFirstPergolaSources = buildObjectFirstPergolaSolveSources({
      projectModel,
      drawingModules,
    });
    const sources = buildWorkbenchProjectSolveSources({
      snapshot,
      draft,
      drawingModules,
      objectFirstPergolaSources,
      effectiveSnapshot,
      baseInputs: resolveCalculatorInputsFromSnapshot(effectiveSnapshot),
      geometryIdentity: {
        projectId: 'proj_1',
        estimateId: 'est_1',
        designRequestId: null,
      },
      geometryContext,
      projectDecks: mapProjectDecks(projectModel),
      projectOpenings: mapProjectOpenings(projectModel),
    });

    expect(draft.inputs.modules).toHaveLength(initialModuleCount);
    expect(sources.map((source) => source.sourceKind)).toEqual([
      'drawing_module',
      'object_first_pergola',
    ]);
    expect(sources.map((source) => source.index)).toEqual([0, 1]);
    expect(sources.map((source) => source.moduleInput?.pergolaId)).toEqual([
      'pergola-1',
      'pergola-2',
    ]);
    expect(sources.every((source) => source.rawInput)).toBe(true);
    expect(sources.every((source) => source.rawHouse?.houseId === source.hostHouseForm?.id)).toBe(true);
  });

  it('uses the same host-house resolver as raw geometry input building', () => {
    const snapshot = getFixtureSnapshot('mono-standard');
    const effectiveSnapshot = mergeEstimateDrawingDraftIntoSnapshot(snapshot, null);
    const drawingModules = buildEstimateDrawingModules(effectiveSnapshot, {
      ignoreModuleResults: false,
    });
    const geometryContext = buildObjectWorkbenchGeometryContext({ snapshot });
    const projectModel = geometryContext.projectModel;
    if (!projectModel) throw new Error('Expected project model.');
    const sources = buildWorkbenchProjectSolveSources({
      snapshot,
      drawingModules,
      objectFirstPergolaSources: [],
      effectiveSnapshot,
      baseInputs: resolveCalculatorInputsFromSnapshot(effectiveSnapshot),
      geometryIdentity: {
        projectId: 'proj_1',
        estimateId: 'est_1',
        designRequestId: null,
      },
      geometryContext,
      projectDecks: mapProjectDecks(projectModel),
      projectOpenings: mapProjectOpenings(projectModel),
    });

    const source = sources[0];
    if (!source?.moduleInput) throw new Error('Expected module input.');
    const expectedHost = resolveModuleHouseForm({
      projectModel,
      module: source.moduleInput,
      moduleId: source.drawingModule.id,
    });
    expect(source.hostHouseForm?.id).toBe(expectedHost?.id);
    expect(source.rawInput?.houseContext.houseId).toBe(expectedHost?.id);
  });

  it('marks no-object-first sources as legacy fallback and excludes them from project solve', () => {
    const snapshot = getFixtureSnapshot('mono-standard');
    const effectiveSnapshot = mergeEstimateDrawingDraftIntoSnapshot(snapshot, null);
    const drawingModules = buildEstimateDrawingModules(effectiveSnapshot, {
      ignoreModuleResults: false,
    });
    const sources = buildWorkbenchProjectSolveSources({
      snapshot,
      drawingModules,
      objectFirstPergolaSources: [],
      effectiveSnapshot,
      baseInputs: resolveCalculatorInputsFromSnapshot(effectiveSnapshot),
      geometryIdentity: {
        projectId: 'proj_1',
        estimateId: 'est_1',
        designRequestId: null,
      },
      geometryContext: { projectModel: null },
      projectDecks: null,
      projectOpenings: null,
    });

    expect(sources).toHaveLength(1);
    expect(sources[0]?.rawInput).toBeTruthy();
    expect(sources[0]?.hostHouseForm).toBeNull();
    expect(sources[0]?.projectSolveGroupKey).toBeNull();
    expect(solveWorkbenchProjectSources(sources).size).toBe(0);
  });

  it('solves eligible grouped sources through the package project-solve boundary', () => {
    const snapshot = getFixtureSnapshot('mono-standard');
    const draft = buildEstimateDrawingDraftFromSnapshot(snapshot);
    if (!draft) throw new Error('Expected drawing draft.');
    addTransientPergolaTwo(draft, snapshot);

    const effectiveSnapshot = mergeEstimateDrawingDraftIntoSnapshot(snapshot, draft);
    const drawingModules = buildEstimateDrawingModules(effectiveSnapshot, {
      ignoreModuleResults: false,
    });
    const geometryContext = buildObjectWorkbenchGeometryContext({ snapshot, draft });
    const projectModel = geometryContext.projectModel;
    if (!projectModel) throw new Error('Expected project model.');
    const sources = buildWorkbenchProjectSolveSources({
      snapshot,
      draft,
      drawingModules,
      objectFirstPergolaSources: buildObjectFirstPergolaSolveSources({
        projectModel,
        drawingModules,
      }),
      effectiveSnapshot,
      baseInputs: resolveCalculatorInputsFromSnapshot(effectiveSnapshot),
      geometryIdentity: {
        projectId: 'proj_1',
        estimateId: 'est_1',
        designRequestId: null,
      },
      geometryContext,
      projectDecks: mapProjectDecks(projectModel),
      projectOpenings: mapProjectOpenings(projectModel),
    });

    const solved = solveWorkbenchProjectSources(sources);
    expect(solved.size).toBe(2);
    expect([...solved.values()].every((result) => result.source === 'project_solve')).toBe(true);
    expect([...solved.values()].map((result) => result.config.houseContext.houseId)).toEqual([
      'house-main',
      'house-main',
    ]);
  });
});
