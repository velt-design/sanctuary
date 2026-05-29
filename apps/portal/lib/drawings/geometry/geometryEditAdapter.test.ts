import { describe, expect, it } from 'vitest';
import { getSanctuaryGeometryWorkbenchFixture } from '@/lib/drawings/sanctuaryWorkbenchFixtures';
import { buildEstimateDrawingDraftFromSnapshot, type EstimateDrawingField } from '@/lib/estimates/drawingEdits';
import type { ObjectFirstWorkbenchDraftVNext } from '@/lib/drawings/state/objectFirstWorkbenchModel';
import {
  applyGeometryEditIntent,
  buildObjectWorkbenchPergolaPatchFromGeometryIntent,
  buildGeometryEditState,
  mirrorObjectWorkbenchPergolaPatchToTemporaryGeometryModuleFields,
  translateEstimateDrawingFieldToGeometryIntent,
  translateFootprintEditToGeometryIntent,
} from './geometryEditAdapter';

function getFixtureSnapshot(slug: 'mono-standard' | 'gable-standard' | 'box-standard') {
  const fixture = getSanctuaryGeometryWorkbenchFixture(slug);
  if (!fixture) throw new Error(`Missing fixture: ${slug}`);
  return fixture.snapshot;
}

function makeStaleGableSnapshot(
  snapshot: Record<string, unknown>,
  overrides: { houseConnectionType?: 'none' | 'soffit' | 'fascia' | 'facade' } = {},
) {
  const stale = structuredClone(snapshot) as {
    inputs?: {
      modules?: Array<{
        houseConnectionType?: string;
        gableEndFramesMode?: string;
        gableHouseEdgeGutter?: string;
        gableOuterEdgeGutter?: string;
      }>;
    };
  };
  const module = stale.inputs?.modules?.[0];
  if (!module) {
    throw new Error('Expected fixture snapshot module.');
  }
  module.gableEndFramesMode = 'none';
  if (overrides.houseConnectionType) {
    module.houseConnectionType = overrides.houseConnectionType;
  }
  module.gableHouseEdgeGutter = 'house';
  module.gableOuterEdgeGutter = 'our';
  return stale as Record<string, unknown>;
}

function makeObjectFirstGeometryDraft(): ObjectFirstWorkbenchDraftVNext {
  return {
    houseAssembly: {
      id: 'assembly-object',
      label: 'Object-first house',
      houseForms: [
        {
          id: 'house-object',
          label: 'Object House',
          transform: {
            offsetXM: 0,
            offsetYM: 0,
            rotationQuarterTurns: 0,
          },
          footprint: {
            mode: 'custom_polygon',
            preset: 'straight',
            params: {
              widthM: '9',
              offsetXM: '0',
              setbackM: '0',
              bandDepthM: '2.4',
              returnRunM: '2.4',
              recessWidthM: '2.4',
              recessDepthM: '1.2',
              leftLegRunM: '2.4',
              rightLegRunM: '2.4',
              sideRunM: '2.4',
            },
            polygon: [
              { alongM: '0', depthM: '0' },
              { alongM: '9', depthM: '0' },
              { alongM: '9', depthM: '2.4' },
              { alongM: '0', depthM: '2.4' },
            ],
            attachmentSide: 'rear',
          },
          roofIntent: {
            form: 'mono',
            material: 'trapezoidal_5_rib',
            primaryPitchDeg: '11',
            primaryFallDirection: 'negative_y',
            ridgeAxis: 'x',
            openGableEndIds: [],
          },
          roofIntentAuthored: true,
          storeyMode: 'double_storey',
          attachmentStrategy: 'facade_ledger',
          eaveHeightM: '3.4',
          wallHeightM: '3',
          soffitDepthMm: '720',
          fasciaHeightMm: '260',
          gutterWidthMm: '180',
          gutterDepthMm: '115',
          gutterProjectionMm: '155',
          eaveOverhangMm: '800',
        },
      ],
    },
    decks: [
      {
        id: 'deck-object',
        shape: 'custom',
        presetType: null,
        outline: [
          { alongM: '0', depthM: '0' },
          { alongM: '2', depthM: '0' },
          { alongM: '2', depthM: '1' },
          { alongM: '0', depthM: '1' },
        ],
        levelOffsetMm: '0',
        isAttached: true,
        surfaceMaterial: 'composite',
        hostEdgeId: 'footprint-edge-1',
      },
    ],
    openings: [
      {
        id: 'opening-object',
        label: 'Object Opening',
        kind: 'slider',
        panelCount: 3,
        hostWallId: 'wall-rear',
        sourceFormId: 'house-object',
        wallId: 'rear',
        hostEdgeId: 'footprint-edge-1',
        widthM: '2.4',
        heightM: '2.1',
        sillHeightM: '0',
        offsetAlongWallM: '3',
      },
    ],
    pergolas: [],
  };
}

describe('geometryEditAdapter', () => {
  it('builds geometry-backed edit state from the effective draft snapshot', () => {
    const snapshot = getFixtureSnapshot('mono-standard');
    const result = buildGeometryEditState({
      snapshot,
      moduleIndex: 0,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.family).toBe('mono');
    expect(result.value.dimensions.lengthM).toBe('6');
    expect(result.value.dimensions.projectionM).toBe('3');
    expect(result.value.connection.type).toBe('soffit');
    expect(result.value.supports.postCount).toBe('4');
    expect(result.value.overrides.frontBeamProfile).toBe('');
  });

  it('builds geometry edit state from object-first house, deck, and opening context', () => {
    const snapshot = getFixtureSnapshot('mono-standard');
    const draft = buildEstimateDrawingDraftFromSnapshot(snapshot);
    if (!draft) throw new Error('Expected draft');
    const module = draft.inputs.modules[0];
    if (!module) throw new Error('Expected fixture module');
    delete module.houseFootprintMode;
    delete module.houseFootprintPolygon;
    delete module.houseEaveHeightM;
    delete module.houseWallHeightM;
    delete module.houseRoofPitchDeg;
    delete module.houseSoffitDepthMm;
    delete module.houseFasciaHeightMm;
    delete module.houseGutterWidthMm;
    delete module.houseGutterDepthMm;
    delete module.houseGutterProjectionMm;
    delete module.houseEaveOverhangMm;
    draft.objectFirst = makeObjectFirstGeometryDraft();

    const result = buildGeometryEditState({
      snapshot,
      draft,
      moduleIndex: 0,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const houseModel = result.value.config.houseContext.model as typeof result.value.config.houseContext.model & {
      decks?: Array<{ id: string }>;
      openings?: Array<{ id: string }>;
    };
    expect(result.value.houseContext.storeyMode).toBe('double_storey');
    expect(result.value.houseContext.attachmentStrategy).toBe('auto');
    expect(result.value.config.houseContext.attachmentStrategy).toBe('facade_ledger');
    expect(result.value.houseContext.eaveHeightM).toBe('3.4');
    expect(result.value.houseContext.wallHeightM).toBe('3');
    expect(result.value.houseContext.soffitDepthMm).toBe('720');
    expect(result.value.config.houseContext.footprint).toContainEqual({ x: 9000, y: -2400, z: 0 });
    expect(result.value.config.houseContext.model?.footprint).toContainEqual({ x: 9000, y: -2400, z: 0 });
    expect(result.value.config.houseContext.model?.eaveHeightMm).toBe(3400);
    expect(houseModel?.decks?.map((deck) => deck.id)).toContain('deck-object');
    expect(houseModel?.openings?.map((opening) => opening.id)).toContain('opening-object');
  });

  it('applies family switch edits through the geometry adapter and updates underlying draft fields', () => {
    const snapshot = getFixtureSnapshot('mono-standard');
    const draft = buildEstimateDrawingDraftFromSnapshot(snapshot);
    if (!draft) throw new Error('Expected draft');

    const result = applyGeometryEditIntent({
      snapshot,
      draft,
      moduleIndex: 0,
      intent: {
        type: 'family',
        value: 'box',
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.draft.inputs.modules[0]?.pergolaStyle).toBe('pitched');
    expect(result.draft.inputs.modules[0]?.boxPerimeterEnabled).toBe(true);
  });

  it('maps pergola geometry intents to object-first patches and mirrors them through the temporary module adapter', () => {
    const snapshot = getFixtureSnapshot('mono-standard');
    const draft = buildEstimateDrawingDraftFromSnapshot(snapshot);
    if (!draft) throw new Error('Expected draft');

    const dimensionPatch = buildObjectWorkbenchPergolaPatchFromGeometryIntent({
      type: 'dimension',
      field: 'lengthM',
      value: '7',
    });
    const strategyPatch = buildObjectWorkbenchPergolaPatchFromGeometryIntent({
      type: 'house_config',
      key: 'houseAttachmentStrategy',
      value: 'facade_ledger',
    });

    expect(dimensionPatch).toEqual({
      geometry: {
        dimensions: {
          lengthM: '7',
        },
      },
    });
    expect(strategyPatch).toEqual({
      strategy: 'facade_ledger',
    });

    const mirrorResult = mirrorObjectWorkbenchPergolaPatchToTemporaryGeometryModuleFields({
      snapshot,
      draft,
      moduleIndexes: [0],
      patch: {
        connectionKind: 'wall',
        side: 'left',
        strategy: 'facade_ledger',
        geometry: {
          dimensions: {
            lengthM: '7',
          },
          roof: {
            pitchDeg: '9',
          },
          supports: {
            postCount: '6',
          },
          overrides: {
            ledgerProfile: '100x50',
          },
        },
      },
    });

    expect(mirrorResult.ok).toBe(true);
    if (!mirrorResult.ok) return;
    expect(mirrorResult.draft.inputs.modules[0]).toMatchObject({
      houseConnectionType: 'facade',
      attachmentSide: 'left',
      houseAttachmentStrategy: 'facade_ledger',
      lengthM: '7',
      roofPitchDeg: '9',
      postCount: '6',
      overrides: {
        ledgerProfile: '100x50',
      },
    });
  });

  it('coerces attached family switches onto the supported gable baseline', () => {
    const snapshot = getFixtureSnapshot('mono-standard');
    const draft = buildEstimateDrawingDraftFromSnapshot(snapshot);
    if (!draft) throw new Error('Expected draft');

    const result = applyGeometryEditIntent({
      snapshot,
      draft,
      moduleIndex: 0,
      intent: {
        type: 'family',
        value: 'gable',
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.draft.inputs.modules[0]?.pergolaStyle).toBe('gable');
    expect(result.draft.inputs.modules[0]?.boxPerimeterEnabled).toBe(false);
    expect(result.draft.inputs.modules[0]?.gableEndFramesMode).toBe('outer_end_only');
    expect(result.draft.inputs.modules[0]?.gableHouseEdgeGutter).toBe('house');
    expect(result.draft.inputs.modules[0]?.gableOuterEdgeGutter).toBe('our');
    expect(result.draft.inputs.modules[0]?.overrides?.ridgeBeamProfile ?? '').toBe('');
  });

  it('coerces freestanding family switches onto the supported gable baseline', () => {
    const snapshot = getFixtureSnapshot('mono-standard');
    const draft = buildEstimateDrawingDraftFromSnapshot(snapshot);
    if (!draft) throw new Error('Expected draft');

    const freestandingResult = applyGeometryEditIntent({
      snapshot,
      draft,
      moduleIndex: 0,
      intent: {
        type: 'house_connection',
        value: 'freestanding',
      },
    });

    expect(freestandingResult.ok).toBe(true);
    if (!freestandingResult.ok) return;

    const gableResult = applyGeometryEditIntent({
      snapshot,
      draft: freestandingResult.draft,
      moduleIndex: 0,
      intent: {
        type: 'family',
        value: 'gable',
      },
    });

    expect(gableResult.ok).toBe(true);
    if (!gableResult.ok) return;
    expect(gableResult.draft.inputs.modules[0]?.gableEndFramesMode).toBe('both_ends');
    expect(gableResult.draft.inputs.modules[0]?.gableHouseEdgeGutter).toBe('our');
    expect(gableResult.draft.inputs.modules[0]?.gableOuterEdgeGutter).toBe('our');
  });

  it('translates drawing-field and footprint edits into geometry intents and produces the next draft', () => {
    const snapshot = getFixtureSnapshot('mono-standard');
    const draft = buildEstimateDrawingDraftFromSnapshot(snapshot);
    if (!draft) throw new Error('Expected draft');

    const lengthField: EstimateDrawingField = {
      id: 'plan:lengthA',
      label: 'Plan length',
      rawValue: '6',
      displayValue: '6.00m',
      svgFieldId: 'plan:lengthA',
      editor: 'singleline',
      target: { type: 'module_input', moduleIndex: 0, field: 'lengthM' },
    };

    const lengthIntent = translateEstimateDrawingFieldToGeometryIntent(lengthField, '7');
    expect(lengthIntent).toEqual({
      type: 'dimension',
      field: 'lengthM',
      value: '7',
    });

    const lengthResult =
      lengthIntent &&
      applyGeometryEditIntent({
        snapshot,
        draft,
        moduleIndex: 0,
        intent: lengthIntent,
      });

    expect(lengthResult && lengthResult.ok).toBe(true);
    if (!lengthResult || !lengthResult.ok) return;
    expect(lengthResult.draft.inputs.modules[0]?.lengthM).toBe('7');

    const footprintIntent = translateFootprintEditToGeometryIntent({
      type: 'preset',
      preset: 'u_shape',
    });
    expect(footprintIntent).toEqual({
      type: 'footprint_preset',
      value: 'u_shape',
    });

    const footprintResult =
      footprintIntent &&
      applyGeometryEditIntent({
        snapshot,
        draft: lengthResult.draft,
        moduleIndex: 0,
        intent: footprintIntent,
      });

    expect(footprintResult && footprintResult.ok).toBe(true);
    if (!footprintResult || !footprintResult.ok) return;
    expect(footprintResult.draft.inputs.modules[0]?.houseFootprintPreset).toBe('u_shape');

    const nextState = buildGeometryEditState({
      snapshot,
      draft: footprintResult.draft,
      moduleIndex: 0,
    });
    expect(nextState.ok).toBe(true);
    if (!nextState.ok) return;
    expect(nextState.value.dimensions.lengthM).toBe('7');
    expect(nextState.value.houseContext.footprintPreset).toBe('u_shape');
  });

  it('applies house footprint size and placement params and reflects moved normalized context', () => {
    const snapshot = getFixtureSnapshot('mono-standard');
    const draft = buildEstimateDrawingDraftFromSnapshot(snapshot);
    if (!draft) throw new Error('Expected draft');

    const edits = [
      { key: 'widthM', value: '8' },
      { key: 'offsetXM', value: '-1' },
      { key: 'setbackM', value: '0.4' },
    ] as const;

    let nextDraft = draft;
    for (const edit of edits) {
      const result = applyGeometryEditIntent({
        snapshot,
        draft: nextDraft,
        moduleIndex: 0,
        intent: {
          type: 'footprint_param',
          key: edit.key,
          value: edit.value,
        },
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      nextDraft = result.draft;
    }

    expect(nextDraft.inputs.modules[0]?.houseFootprintParams).toEqual(
      expect.objectContaining({
        widthM: '8',
        offsetXM: '-1',
        setbackM: '0.4',
      }),
    );

    const nextState = buildGeometryEditState({
      snapshot,
      draft: nextDraft,
      moduleIndex: 0,
    });
    expect(nextState.ok).toBe(true);
    if (!nextState.ok) return;

    expect(nextState.value.houseContext.footprintParams).toEqual(
      expect.objectContaining({
        widthM: '8',
        offsetXM: '-1',
        setbackM: '0.4',
      }),
    );
    expect(nextState.value.config.houseContext.footprint?.[0]).toEqual({ x: -1000, y: -2200, z: 0 });
    expect(nextState.value.config.houseContext.model?.footprint?.[2]).toEqual({ x: 7000, y: -400, z: 0 });
  });

  it('applies custom footprint mode and polygon edits into normalized context', () => {
    const snapshot = getFixtureSnapshot('mono-standard');
    const draft = buildEstimateDrawingDraftFromSnapshot(snapshot);
    if (!draft) throw new Error('Expected draft');

    const modeResult = applyGeometryEditIntent({
      snapshot,
      draft,
      moduleIndex: 0,
      intent: {
        type: 'footprint_mode',
        value: 'custom_polygon',
      },
    });
    expect(modeResult.ok).toBe(true);
    if (!modeResult.ok) return;
    expect(modeResult.draft.inputs.modules[0]?.houseFootprintMode).toBe('custom_polygon');
    expect(modeResult.draft.inputs.modules[0]?.houseFootprintPolygon?.length).toBeGreaterThanOrEqual(4);

    const polygon = [
      { alongM: '0', depthM: '2.4' },
      { alongM: '6', depthM: '2.4' },
      { alongM: '6', depthM: '0' },
      { alongM: '3', depthM: '0' },
      { alongM: '3', depthM: '1.2' },
      { alongM: '0', depthM: '1.2' },
    ];
    const polygonResult = applyGeometryEditIntent({
      snapshot,
      draft: modeResult.draft,
      moduleIndex: 0,
      intent: {
        type: 'footprint_polygon',
        polygon,
      },
    });
    expect(polygonResult.ok).toBe(true);
    if (!polygonResult.ok) return;

    const nextState = buildGeometryEditState({
      snapshot,
      draft: polygonResult.draft,
      moduleIndex: 0,
    });
    expect(nextState.ok).toBe(true);
    if (!nextState.ok) return;
    expect(nextState.value.houseContext.footprintMode).toBe('custom_polygon');
    expect(nextState.value.houseContext.footprintPolygon).toEqual(polygon);
    expect(nextState.value.config.houseContext.footprint).toContainEqual({ x: 3000, y: -1200, z: 0 });
  });

  it('rejects invalid custom footprint polygon edits before persisting the draft', () => {
    const snapshot = getFixtureSnapshot('mono-standard');
    const draft = buildEstimateDrawingDraftFromSnapshot(snapshot);
    if (!draft) throw new Error('Expected draft');

    const result = applyGeometryEditIntent({
      snapshot,
      draft,
      moduleIndex: 0,
      intent: {
        type: 'footprint_polygon',
        polygon: [
          { alongM: '0', depthM: '0' },
          { alongM: '4', depthM: '0' },
          { alongM: '1', depthM: '3' },
          { alongM: '4', depthM: '2' },
        ],
      },
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain('self-intersect');
  });

  it('returns no geometry intent for unsupported field targets', () => {
    const unsupportedField: EstimateDrawingField = {
      id: 'meta:note',
      label: 'Drawing note',
      rawValue: 'Draft note',
      displayValue: 'Draft note',
      editor: 'multiline',
      target: { type: 'estimate_note' },
    };

    expect(translateEstimateDrawingFieldToGeometryIntent(unsupportedField, 'Updated')).toBeNull();
  });

  it('applies override edits through the geometry adapter and persists them into the draft', () => {
    const snapshot = getFixtureSnapshot('mono-standard');
    const draft = buildEstimateDrawingDraftFromSnapshot(snapshot);
    if (!draft) throw new Error('Expected draft');

    const result = applyGeometryEditIntent({
      snapshot,
      draft,
      moduleIndex: 0,
      intent: {
        type: 'override',
        key: 'ledgerProfile',
        value: '100x50',
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.draft.inputs.modules[0]?.overrides?.ledgerProfile).toBe('100x50');

    const nextState = buildGeometryEditState({
      snapshot,
      draft: result.draft,
      moduleIndex: 0,
    });
    expect(nextState.ok).toBe(true);
    if (!nextState.ok) return;
    expect(nextState.value.overrides.ledgerProfile).toBe('100x50');
  });

  it('applies house config edits and reflects normalized house model values', () => {
    const snapshot = getFixtureSnapshot('mono-standard');
    const draft = buildEstimateDrawingDraftFromSnapshot(snapshot);
    if (!draft) throw new Error('Expected draft');

    const edits = [
      { key: 'houseAttachmentStrategy', value: 'fascia_under_gutter' },
      { key: 'houseStoreyMode', value: 'double_storey' },
      { key: 'houseEaveHeightM', value: '3' },
      { key: 'houseWallHeightM', value: '2.7' },
      { key: 'houseRoofPitchDeg', value: '30' },
      { key: 'houseSoffitDepthMm', value: '600' },
      { key: 'houseFasciaHeightMm', value: '240' },
      { key: 'houseGutterWidthMm', value: '150' },
      { key: 'houseGutterDepthMm', value: '100' },
      { key: 'houseGutterProjectionMm', value: '135' },
      { key: 'houseEaveOverhangMm', value: '650' },
    ] as const;

    let nextDraft = draft;
    for (const edit of edits) {
      const result = applyGeometryEditIntent({
        snapshot,
        draft: nextDraft,
        moduleIndex: 0,
        intent: {
          type: 'house_config',
          key: edit.key,
          value: edit.value,
        },
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      nextDraft = result.draft;
    }

    expect(nextDraft.inputs.modules[0]).toEqual(
      expect.objectContaining({
        houseAttachmentStrategy: 'fascia_under_gutter',
        houseStoreyMode: 'double_storey',
        houseEaveHeightM: '3',
        houseWallHeightM: '2.7',
        houseRoofPitchDeg: '30',
        houseSoffitDepthMm: '600',
        houseFasciaHeightMm: '240',
        houseGutterWidthMm: '150',
        houseGutterDepthMm: '100',
        houseGutterProjectionMm: '135',
        houseEaveOverhangMm: '650',
      }),
    );

    const nextState = buildGeometryEditState({
      snapshot,
      draft: nextDraft,
      moduleIndex: 0,
    });
    expect(nextState.ok).toBe(true);
    if (!nextState.ok) return;
    expect(nextState.value.houseContext.attachmentStrategy).toBe('fascia_under_gutter');
    expect(nextState.value.houseContext.storeyMode).toBe('double_storey');
    expect(nextState.value.houseContext.eaveHeightM).toBe('3');
    expect(nextState.value.houseContext.wallHeightM).toBe('2.7');
    expect(nextState.value.houseContext.roofPitchDeg).toBe('30');
    expect(nextState.value.config.houseContext.model?.eaveHeightMm).toBe(3000);
    expect(nextState.value.config.houseContext.model?.eave?.fasciaHeightMm).toBe(240);

    const clearHeight = applyGeometryEditIntent({
      snapshot,
      draft: nextDraft,
      moduleIndex: 0,
      intent: {
        type: 'house_config',
        key: 'houseEaveHeightM',
        value: '',
      },
    });
    expect(clearHeight.ok).toBe(true);
    if (!clearHeight.ok) return;
    expect(clearHeight.draft.inputs.modules[0]?.houseEaveHeightM).toBeUndefined();

    const clearStrategy = applyGeometryEditIntent({
      snapshot,
      draft: clearHeight.draft,
      moduleIndex: 0,
      intent: {
        type: 'house_config',
        key: 'houseAttachmentStrategy',
        value: 'auto',
      },
    });
    expect(clearStrategy.ok).toBe(true);
    if (!clearStrategy.ok) return;
    expect(clearStrategy.draft.inputs.modules[0]?.houseAttachmentStrategy).toBeUndefined();

    const clearedState = buildGeometryEditState({
      snapshot,
      draft: clearStrategy.draft,
      moduleIndex: 0,
    });
    expect(clearedState.ok).toBe(true);
    if (!clearedState.ok) return;
    expect(clearedState.value.houseContext.attachmentStrategy).toBe('auto');
    expect(clearedState.value.houseContext.eaveHeightM).not.toBe('3');
    expect(clearedState.value.config.houseContext.attachmentStrategy).toBe('soffit_brackets');
  });

  it('exposes supported gable baseline values in geometry edit state', () => {
    const snapshot = getFixtureSnapshot('gable-standard');
    const result = buildGeometryEditState({
      snapshot,
      moduleIndex: 0,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.family).toBe('gable');
    expect(result.value.gable).toEqual({
      endFramesMode: 'outer_end_only',
      houseEaveGutterMode: 'house',
      outerEaveGutterMode: 'our',
    });
  });

  it('preserves explicit attached gable no-frame edit state while constraining gutters', () => {
    const snapshot = makeStaleGableSnapshot(getFixtureSnapshot('gable-standard'), {
      houseConnectionType: 'soffit',
    });

    const result = buildGeometryEditState({
      snapshot,
      moduleIndex: 0,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.family).toBe('gable');
    expect(result.value.gable).toEqual({
      endFramesMode: 'none',
      houseEaveGutterMode: 'house',
      outerEaveGutterMode: 'our',
    });
  });

  it('preserves explicit freestanding gable no-frame edit state while constraining gutters', () => {
    const snapshot = makeStaleGableSnapshot(getFixtureSnapshot('gable-standard'), {
      houseConnectionType: 'none',
    });

    const result = buildGeometryEditState({
      snapshot,
      moduleIndex: 0,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.family).toBe('gable');
    expect(result.value.gable).toEqual({
      endFramesMode: 'none',
      houseEaveGutterMode: 'our',
      outerEaveGutterMode: 'our',
    });
  });

  it('edits attached gable end frames across the supported values', () => {
    const snapshot = getFixtureSnapshot('gable-standard');
    const draft = buildEstimateDrawingDraftFromSnapshot(snapshot);
    if (!draft) throw new Error('Expected draft');

    const noneResult = applyGeometryEditIntent({
      snapshot,
      draft,
      moduleIndex: 0,
      intent: {
        type: 'gable_end_frames',
        value: 'none',
      },
    });

    expect(noneResult.ok).toBe(true);
    if (!noneResult.ok) return;
    expect(noneResult.draft.inputs.modules[0]?.gableEndFramesMode).toBe('none');

    const outerResult = applyGeometryEditIntent({
      snapshot,
      draft: noneResult.draft,
      moduleIndex: 0,
      intent: {
        type: 'gable_end_frames',
        value: 'outer_end_only',
      },
    });

    expect(outerResult.ok).toBe(true);
    if (!outerResult.ok) return;
    expect(outerResult.draft.inputs.modules[0]?.gableEndFramesMode).toBe('outer_end_only');

    const bothResult = applyGeometryEditIntent({
      snapshot,
      draft: outerResult.draft,
      moduleIndex: 0,
      intent: {
        type: 'gable_end_frames',
        value: 'both_ends',
      },
    });

    expect(bothResult.ok).toBe(true);
    if (!bothResult.ok) return;
    expect(bothResult.draft.inputs.modules[0]?.gableEndFramesMode).toBe('both_ends');
  });

  it('edits freestanding gable end frames only within the supported values', () => {
    const snapshot = getFixtureSnapshot('gable-standard');
    const draft = buildEstimateDrawingDraftFromSnapshot(snapshot);
    if (!draft) throw new Error('Expected draft');

    const freestandingResult = applyGeometryEditIntent({
      snapshot,
      draft,
      moduleIndex: 0,
      intent: {
        type: 'house_connection',
        value: 'freestanding',
      },
    });

    expect(freestandingResult.ok).toBe(true);
    if (!freestandingResult.ok) return;

    const noneResult = applyGeometryEditIntent({
      snapshot,
      draft: freestandingResult.draft,
      moduleIndex: 0,
      intent: {
        type: 'gable_end_frames',
        value: 'none',
      },
    });

    expect(noneResult.ok).toBe(true);
    if (!noneResult.ok) return;
    expect(noneResult.draft.inputs.modules[0]?.gableEndFramesMode).toBe('none');

    const bothResult = applyGeometryEditIntent({
      snapshot,
      draft: noneResult.draft,
      moduleIndex: 0,
      intent: {
        type: 'gable_end_frames',
        value: 'both_ends',
      },
    });

    expect(bothResult.ok).toBe(true);
    if (!bothResult.ok) return;
    expect(bothResult.draft.inputs.modules[0]?.gableEndFramesMode).toBe('both_ends');

    const outerResult = applyGeometryEditIntent({
      snapshot,
      draft: bothResult.draft,
      moduleIndex: 0,
      intent: {
        type: 'gable_end_frames',
        value: 'outer_end_only',
      },
    });

    expect(outerResult.ok).toBe(false);
    if (outerResult.ok) return;
    expect(outerResult.message).toContain('Freestanding gable supports None or Both ends only.');
  });
});
