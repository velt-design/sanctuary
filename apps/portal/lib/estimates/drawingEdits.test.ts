import { describe, expect, it } from 'vitest';
import type { CalculatorModuleInputs } from '@/lib/types/calculator';
import {
  ESTIMATE_DRAWING_OVERRIDES_OUTPUT_KEY,
  applyEstimateDrawingFootprintEdit,
  applyEstimateDrawingFieldEdit,
  applyEstimateDrawingModuleFieldEdit,
  buildEstimateDrawingDraftFromSnapshot,
  deriveEstimateDrawingEditableFields,
  resolveEstimateDrawingOverridesFromSnapshot,
  updateEstimateDrawingObjectFirstDeckDrafts,
  updateEstimateDrawingObjectFirstPergolaDrafts,
} from './drawingEdits';
import { buildEstimateDrawingModules } from './moduleDrawing';

function makeModule(overrides: Partial<CalculatorModuleInputs> = {}): CalculatorModuleInputs {
  const base: Partial<CalculatorModuleInputs> = {
    pergolaId: 'pergola-1',
    pergolaStyle: 'gable',
    roofMaterial: 'acrylic',
    extrusionColour: 'White',
    boxPerimeterEnabled: false,
    internalRoofType: 'pitched',
    fallDistanceMm: '0',
    roofPitchDeg: '25',
    gableEndFramesMode: 'outer_end_only',
    gableHouseEdgeGutter: 'house',
    gableOuterEdgeGutter: 'our',
    boxGutterHouseEdge: 'house',
    boxGutterFarEdge: 'our',
    downpipeCount: '0',
    downpipeJoinCount: '0',
    downpipeElbowCount: '0',
    separateGutterEnabled: false,
    overhangEnabled: false,
    overhangAmountM: '0',
    overhangSupportBeamProfile: '150x50',
    invertedEnabled: false,
    invertedHouseGutter: false,
    mixedSkylightStripCount: '0',
    mixedSkylightStripWidthM: '0',
    mixedAcrylicBaysMain: '0',
    mixedAcrylicBaysA: '0',
    mixedAcrylicBaysB: '0',
    timberRoofAboveType: 'insulated_panels',
    timberInsulatedPanelThicknessMm: '50',
    timberTrayWidthMm: '500',
    postCount: '2',
    houseConnectionType: 'fascia',
    postConnectionType: 'slab_anchors',
    ground: 'easy',
    lengthM: '7',
    projectionM: '7',
    hipCornerLengthBM: '0',
    hipCornerProjectionBM: '0',
    postCutHeightM: '2.7',
    timberRoofAllowanceExGst: '0',
    flashings: { rows: [] },
    overrides: {},
    infills: { items: [] },
  };
  return { ...base, ...overrides } as CalculatorModuleInputs;
}

function makeSnapshot(module: CalculatorModuleInputs) {
  return {
    inputs: {
      schemaVersion: 'v2',
      projectName: 'Snapshot',
      quoteRef: 'Q-1000',
      access: 'normal',
      height: 'single_storey',
      jobType: 'residential',
      travelExGst: '0',
      extrasAllowanceExGst: '0',
      quoteDiscountPct: '0',
      pergolas: [{ id: 'pergola-1', label: 'Pergola 1' }],
      modules: [module],
    },
    outputs: {},
  } satisfies Record<string, unknown>;
}

describe('drawingEdits', () => {
  it('derives editable plan labels only for input-backed dimensions', () => {
    const snapshot = makeSnapshot(
      makeModule({
        pergolaStyle: 'hip_corner',
        lengthM: '6.5',
        projectionM: '4.2',
        hipCornerLengthBM: '3.8',
        hipCornerProjectionBM: '2.6',
      }),
    );
    const draft = buildEstimateDrawingDraftFromSnapshot(snapshot);
    const drawing = buildEstimateDrawingModules(snapshot, { ignoreModuleResults: true })[0]!;

    const fields = deriveEstimateDrawingEditableFields({
      draft,
      moduleIndex: 0,
      moduleLabel: 'M1 - Hip Corner - Acrylic',
      view: 'plan',
      planModel: drawing.planModel,
      sectionModel: drawing.sectionModel,
    });

    expect(fields.map((field) => field.id)).toEqual([
      'meta:note',
      'plan:lengthA',
      'plan:spanA',
      'plan:lengthB',
      'plan:spanB',
    ]);
  });

  it('derives gable section span, pitch, and both heights as editable', () => {
    const snapshot = makeSnapshot(makeModule({ pergolaStyle: 'gable', projectionM: '7', roofPitchDeg: '25', postCutHeightM: '2.7' }));
    const draft = buildEstimateDrawingDraftFromSnapshot(snapshot);
    const drawing = buildEstimateDrawingModules(snapshot, { ignoreModuleResults: true })[0]!;

    const fields = deriveEstimateDrawingEditableFields({
      draft,
      moduleIndex: 0,
      moduleLabel: 'M1 - Gable - Acrylic',
      view: 'section',
      planModel: drawing.planModel,
      sectionModel: drawing.sectionModel,
    });

    expect(fields.map((field) => field.id)).toEqual([
      'meta:note',
      'section:spanA',
      'section:pitch',
      'section:heightLeft',
      'section:heightRight',
    ]);
  });

  it('only exposes the input-backed mono height side as editable', () => {
    const snapshot = makeSnapshot(
      makeModule({
        pergolaStyle: 'pitched',
        projectionM: '4.5',
        roofPitchDeg: '5',
        postCutHeightM: '2.7',
      }),
    );
    const draft = buildEstimateDrawingDraftFromSnapshot(snapshot);
    const drawing = buildEstimateDrawingModules(snapshot, { ignoreModuleResults: true })[0]!;

    const fields = deriveEstimateDrawingEditableFields({
      draft,
      moduleIndex: 0,
      moduleLabel: 'M1 - Mono - Acrylic',
      view: 'section',
      planModel: drawing.planModel,
      sectionModel: drawing.sectionModel,
    });

    expect(fields.map((field) => field.id)).toContain('section:spanA');
    expect(fields.map((field) => field.id)).toContain('section:pitch');
    expect(fields.map((field) => field.id)).toContain('section:heightLeft');
    expect(fields.map((field) => field.id)).not.toContain('section:heightRight');
  });

  it('applies module, title, and note edits back into the draft', () => {
    const snapshot = makeSnapshot(makeModule());
    const draft = buildEstimateDrawingDraftFromSnapshot(snapshot)!;
    const drawing = buildEstimateDrawingModules(snapshot, { ignoreModuleResults: true })[0]!;
    const fields = deriveEstimateDrawingEditableFields({
      draft,
      moduleIndex: 0,
      moduleLabel: 'M1 - Gable - 7m x 7m - Acrylic',
      view: 'section',
      planModel: drawing.planModel,
      sectionModel: drawing.sectionModel,
    });

    const spanField = fields.find((field) => field.id === 'section:spanA')!;
    const noteField = fields.find((field) => field.id === 'meta:note')!;

    const spanResult = applyEstimateDrawingFieldEdit({ draft, field: spanField, nextValue: '8.2' });
    expect(spanResult.ok).toBe(true);
    if (!spanResult.ok) return;
    expect(spanResult.draft.inputs.modules[0]?.projectionM).toBe('8.2');

    const noteResult = applyEstimateDrawingFieldEdit({
      draft: spanResult.draft,
      field: noteField,
      nextValue: 'Custom note',
    });
    expect(noteResult.ok).toBe(true);
    if (!noteResult.ok) return;
    expect(noteResult.draft.overrides.noteOverride).toBe('Custom note');
  });

  it('rejects invalid numeric edits and clears overrides when reset', () => {
    const snapshot = makeSnapshot(makeModule());
    const draft = buildEstimateDrawingDraftFromSnapshot(snapshot)!;
    const drawing = buildEstimateDrawingModules(snapshot, { ignoreModuleResults: true })[0]!;
    const fields = deriveEstimateDrawingEditableFields({
      draft,
      moduleIndex: 0,
      moduleLabel: 'M1 - Gable - 7m x 7m - Acrylic',
      view: 'section',
      planModel: drawing.planModel,
      sectionModel: drawing.sectionModel,
    });

    const pitchField = fields.find((field) => field.id === 'section:pitch')!;
    const badPitch = applyEstimateDrawingFieldEdit({ draft, field: pitchField, nextValue: '120' });
    expect(badPitch).toEqual({ ok: false, error: 'Enter a pitch between 0 and 85.' });

    const noteField = fields.find((field) => field.id === 'meta:note')!;
    const noted = applyEstimateDrawingFieldEdit({ draft, field: noteField, nextValue: 'Custom note' });
    expect(noted.ok).toBe(true);
    if (!noted.ok) return;
    const cleared = applyEstimateDrawingFieldEdit({
      draft: noted.draft,
      field: noteField,
      nextValue: noteField.defaultValue ?? '',
    });
    expect(cleared.ok).toBe(true);
    if (!cleared.ok) return;
    expect(resolveEstimateDrawingOverridesFromSnapshot({
      outputs: {
        [ESTIMATE_DRAWING_OVERRIDES_OUTPUT_KEY]: cleared.draft.overrides,
      },
    }).noteOverride).toBeUndefined();
  });

  it('applies live footprint edits into the drawing draft', () => {
    const snapshot = makeSnapshot(makeModule());
    const draft = buildEstimateDrawingDraftFromSnapshot(snapshot)!;

    const presetResult = applyEstimateDrawingFootprintEdit({
      draft,
      moduleIndex: 0,
      edit: { type: 'preset', preset: 'u_shape' },
    });
    expect(presetResult.ok).toBe(true);
    if (!presetResult.ok) return;
    expect(presetResult.draft.inputs.modules[0]?.houseFootprintPreset).toBe('u_shape');

    const rotateResult = applyEstimateDrawingFootprintEdit({
      draft: presetResult.draft,
      moduleIndex: 0,
      edit: { type: 'rotate', delta: 1 },
    });
    expect(rotateResult.ok).toBe(true);
    if (!rotateResult.ok) return;
    expect(rotateResult.draft.inputs.modules[0]?.drawingRotationQuarterTurns).toBe(1);

    const sideResult = applyEstimateDrawingFootprintEdit({
      draft: rotateResult.draft,
      moduleIndex: 0,
      edit: { type: 'attachment_side', side: 'left' },
    });
    expect(sideResult.ok).toBe(true);
    if (!sideResult.ok) return;
    expect(sideResult.draft.inputs.modules[0]?.attachmentSide).toBe('left');

    const paramResult = applyEstimateDrawingFootprintEdit({
      draft: sideResult.draft,
      moduleIndex: 0,
      edit: { type: 'param', key: 'bandDepthM', value: '2.7' },
    });
    expect(paramResult.ok).toBe(true);
    if (!paramResult.ok) return;
    expect(paramResult.draft.inputs.modules[0]?.houseFootprintParams?.bandDepthM).toBe('2.7');
  });

  it('applies module configurator edits into the drawing draft', () => {
    const snapshot = makeSnapshot(makeModule({ pergolaStyle: 'gable', houseConnectionType: 'soffit', postConnectionType: 'deck_bracket' }));
    const draft = buildEstimateDrawingDraftFromSnapshot(snapshot)!;

    const styleResult = applyEstimateDrawingModuleFieldEdit({
      draft,
      moduleIndex: 0,
      edit: { field: 'pergolaStyle', value: 'hip' },
    });
    expect(styleResult.ok).toBe(true);
    if (!styleResult.ok) return;
    expect(styleResult.draft.inputs.modules[0]?.pergolaStyle).toBe('hip');

    const connectionResult = applyEstimateDrawingModuleFieldEdit({
      draft: styleResult.draft,
      moduleIndex: 0,
      edit: { field: 'houseConnectionType', value: 'none' },
    });
    expect(connectionResult.ok).toBe(true);
    if (!connectionResult.ok) return;
    expect(connectionResult.draft.inputs.modules[0]?.houseConnectionType).toBe('none');
    expect(connectionResult.draft.inputs.modules[0]?.boxGutterHouseEdge).toBe('none');

    const supportResult = applyEstimateDrawingModuleFieldEdit({
      draft: connectionResult.draft,
      moduleIndex: 0,
      edit: { field: 'postConnectionType', value: 'pile_1m' },
    });
    expect(supportResult.ok).toBe(true);
    if (!supportResult.ok) return;
    expect(supportResult.draft.inputs.modules[0]?.postConnectionType).toBe('pile_1m');
  });

  it('supports mixed roofs in the portal configurator draft edits', () => {
    const snapshot = makeSnapshot(makeModule({ roofMaterial: 'acrylic' }));
    const draft = buildEstimateDrawingDraftFromSnapshot(snapshot)!;

    const mixedRoof = applyEstimateDrawingModuleFieldEdit({
      draft,
      moduleIndex: 0,
      edit: { field: 'roofMaterial', value: 'mixed' },
    });

    expect(mixedRoof.ok).toBe(true);
    if (!mixedRoof.ok) return;
    expect(mixedRoof.draft.inputs.modules[0]?.roofMaterial).toBe('mixed');
  });

  it('writes object-first drafts without dual-writing compatibility state', () => {
    const snapshot = makeSnapshot(makeModule());
    const draft = buildEstimateDrawingDraftFromSnapshot(snapshot)!;

    const deckDraft = updateEstimateDrawingObjectFirstDeckDrafts({
      draft,
      decks: [
        {
          id: ' deck-1 ',
          label: ' Rear deck ',
          kind: 'deck',
          shape: 'preset',
          presetType: 'rect_attached',
          presetRect: {
            widthM: '3.6',
            depthM: '3',
            centerOffsetM: '0',
          },
          outline: [],
          elevationMode: 'aligned_to_threshold',
          levelOffsetMm: '0',
          isAttached: true,
          surfaceMaterial: 'timber_decking',
          hostEdgeId: ' rear ',
        },
      ],
    });

    expect('houseFirst' in (deckDraft as Record<string, unknown>)).toBe(false);
    expect(deckDraft.objectFirst?.decks[0]).toMatchObject({
      id: 'deck-1',
      label: 'Rear deck',
      hostEdgeId: 'rear',
      presetRect: {
        widthM: '3.6',
        depthM: '3',
        centerOffsetM: '0',
      },
    });

    const pergolaDraft = updateEstimateDrawingObjectFirstPergolaDrafts({
      draft: deckDraft,
      pergolas: [
        {
          id: 'pergola-1',
          label: 'Mono',
          family: 'mono',
          attachmentEdgeId: 'footprint-edge-3',
          attachmentZoneId: 'zone-soffit-footprint-edge-3',
          side: 'rear',
          strategy: null,
        },
      ],
    });

    expect('houseFirst' in (pergolaDraft as Record<string, unknown>)).toBe(false);
    expect(pergolaDraft.objectFirst?.pergolas[0]?.attachmentZoneId).toBe('zone-soffit-footprint-edge-3');
  });
});
