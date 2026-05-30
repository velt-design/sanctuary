import { describe, expect, it } from 'vitest';
import { getSanctuaryGeometryWorkbenchFixture } from '@/lib/drawings/sanctuaryWorkbenchFixtures';
import { buildObjectWorkbenchGeometryContext } from '@/lib/drawings/geometry/objectWorkbenchGeometryContext';
import {
  buildEstimateDrawingDraftFromSnapshot,
  mergeEstimateDrawingDraftIntoSnapshot,
} from '@/lib/estimates/drawingEdits';
import { buildEstimateDrawingModules } from '@/lib/estimates/moduleDrawing';
import { buildObjectFirstPergolaSolveSources } from './objectFirstPergolaSolveSources';
import { buildObjectFirstWorkbenchDraftBaselineFromLegacyEstimateSnapshot } from './legacyEstimateSnapshotAdapter';

function getFixtureSnapshot(name: Parameters<typeof getSanctuaryGeometryWorkbenchFixture>[0]): Record<string, unknown> {
  const fixture = getSanctuaryGeometryWorkbenchFixture(name);
  if (!fixture) throw new Error(`Missing ${name} workbench fixture.`);
  return fixture.snapshot;
}

describe('buildObjectFirstPergolaSolveSources', () => {
  it('synthesizes transient pergola module inputs from object-first data, not the active persisted module', () => {
    const snapshot = getFixtureSnapshot('mono-standard');
    const draft = buildEstimateDrawingDraftFromSnapshot(snapshot);
    if (!draft) throw new Error('Expected drawing draft.');
    const baseline = buildObjectFirstWorkbenchDraftBaselineFromLegacyEstimateSnapshot({
      snapshot,
      draft,
    });
    if (!baseline) throw new Error('Expected object-first baseline draft.');
    baseline.pergolas.push({
      id: 'pergola-2',
      label: 'Transient gable',
      family: 'gable',
      connectionKind: 'freestanding',
      attachmentEdgeId: null,
      attachmentZoneId: null,
      side: 'front',
      strategy: 'none',
      geometry: {
        dimensions: { lengthM: '4.2', projectionM: '2.7' },
      },
      position: { originXMm: '12000', originYMm: '0', rotationDeg: '0' },
      attachment: { spatialKind: 'freestanding', host: null, method: 'none' },
    });
    draft.objectFirst = baseline;

    const drawingModules = buildEstimateDrawingModules(
      mergeEstimateDrawingDraftIntoSnapshot(snapshot, draft),
      { ignoreModuleResults: false },
    );
    const persisted = drawingModules[0]?.input;
    if (!persisted) throw new Error('Expected persisted module.');
    persisted.pergolaStyle = 'hip_corner';
    persisted.internalRoofType = 'hip_corner';
    persisted.boxPerimeterEnabled = true;
    persisted.roofMaterial = 'timber';
    persisted.roofPitchDeg = '44';
    persisted.lengthM = '9.9';
    persisted.projectionM = '8.8';
    persisted.postConnectionType = 'slab_anchors';
    persisted.postCutHeightM = '3.3';
    persisted.houseFootprintPreset = 'wrap_right';
    persisted.houseFootprintPosition = { originXMm: '9999', originYMm: '8888', rotationDeg: '180' };
    persisted.drawingRotationQuarterTurns = 2;
    persisted.flashings = {
      rows: [{ id: 'toxic-flashing', kind: 'primary', band: '301-400', purpose: 'CUSTOM', lengthM: '99' }],
    };
    persisted.overrides = { frontBeamProfile: 'toxic-front-beam' };

    const geometryContext = buildObjectWorkbenchGeometryContext({ snapshot, draft });
    const projectModel = geometryContext.projectModel;
    if (!projectModel) throw new Error('Expected project model.');
    const sources = buildObjectFirstPergolaSolveSources({
      projectModel,
      drawingModules,
    });
    const source = sources.find((candidate) => candidate.pergola.id === 'pergola-2');
    if (!source) throw new Error('Expected transient source.');

    expect(source.moduleInput).toMatchObject({
      pergolaId: 'pergola-2',
      pergolaStyle: 'gable',
      internalRoofType: 'gable',
      boxPerimeterEnabled: false,
      houseConnectionType: 'none',
      houseAttachmentStrategy: 'none',
      attachmentSide: 'front',
      lengthM: '4.2',
      projectionM: '2.7',
      roofMaterial: 'acrylic',
      roofPitchDeg: '',
      postConnectionType: 'deck_bracket',
      postCount: '4',
      postCutHeightM: '2.4',
      houseFootprintPreset: 'straight',
      drawingRotationQuarterTurns: 0,
      overrides: {},
    });
    expect(source.moduleInput.houseFootprintPosition).toBeUndefined();
    const flashingRows = source.moduleInput.flashings?.rows ?? [];
    expect(flashingRows.map((row) => row.id)).not.toContain('toxic-flashing');
    expect(source.moduleInput.gableHouseEdgeGutter).toBe('our');
    expect(source.moduleInput.gableOuterEdgeGutter).toBe('our');
  });

  it('keeps module-backed pergolas out of transient solve sources', () => {
    const snapshot = getFixtureSnapshot('mono-standard');
    const draft = buildEstimateDrawingDraftFromSnapshot(snapshot);
    if (!draft) throw new Error('Expected drawing draft.');
    const geometryContext = buildObjectWorkbenchGeometryContext({ snapshot, draft });
    const projectModel = geometryContext.projectModel;
    if (!projectModel) throw new Error('Expected project model.');
    const drawingModules = buildEstimateDrawingModules(
      mergeEstimateDrawingDraftIntoSnapshot(snapshot, draft),
      { ignoreModuleResults: false },
    );

    expect(buildObjectFirstPergolaSolveSources({ projectModel, drawingModules })).toEqual([]);
  });
});
