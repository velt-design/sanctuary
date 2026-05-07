import { describe, expect, it } from 'vitest';
import type { EstimateDrawingDraft } from '@/lib/estimates/drawingEdits';
import type {
  HouseAssemblyModel,
  HouseFormModel,
  HouseFormRoofIntentModel,
  ObjectFirstDeckDraft,
  ObjectFirstOpeningDraft,
  ObjectFirstPergolaDraft,
  ObjectFirstWorkbenchDraftVNext,
} from '@/lib/drawings/state/objectFirstWorkbenchModel';
import {
  applyObjectWorkbenchDeckPatch,
  applyObjectWorkbenchOpeningPatch,
  applyObjectWorkbenchPergolaPatch,
  buildNewObjectWorkbenchDeckDraft,
  buildNewObjectWorkbenchOpeningDraft,
  buildObjectFirstDraftWithDecks,
  buildObjectFirstDraftWithOpenings,
  buildObjectFirstDraftWithPergolas,
  buildObjectWorkbenchRoofCommitDraft,
  mergeHouseFormRoofIntentAfterFootprintSync,
  updateDraftObjectFirst,
} from './objectWorkbenchDraftActions';

function makeRoofIntent(overrides: Partial<HouseFormRoofIntentModel> = {}): HouseFormRoofIntentModel {
  return {
    form: 'mono',
    material: 'corrugated_iron',
    primaryPitchDeg: '5',
    primaryFallDirection: 'negative_y',
    ridgeAxis: 'x',
    openGableEndIds: [],
    appendage: {
      enabled: false,
      form: 'flat',
      hostEdge: 'rear',
      pitchDeg: '2',
      dropMm: '100',
    },
    ...overrides,
  };
}

function makeHouseForm(): HouseFormModel {
  return {
    id: 'house-main',
    label: 'House',
    transform: {
      offsetXM: 0,
      offsetYM: 0,
      rotationQuarterTurns: 0,
    },
    footprint: {
      mode: 'preset',
      preset: 'straight',
      params: {
        widthM: '6',
        offsetXM: '0',
        setbackM: '0',
        bandDepthM: '1.8',
        returnRunM: '2.4',
        recessWidthM: '2.4',
        recessDepthM: '1.2',
        leftLegRunM: '2.4',
        rightLegRunM: '2.4',
        sideRunM: '2.4',
      },
      polygon: [],
      attachmentSide: 'rear',
    },
    roofIntent: makeRoofIntent(),
    storeyMode: 'single_storey',
    attachmentStrategy: null,
  };
}

function makeObjectFirstDraft(): ObjectFirstWorkbenchDraftVNext {
  const houseForm = makeHouseForm();
  return {
    houseAssembly: {
      id: 'house-main',
      label: 'House',
      houseForms: [
        {
          id: houseForm.id,
          label: houseForm.label,
          transform: houseForm.transform,
          footprint: houseForm.footprint,
          roofIntent: houseForm.roofIntent,
          storeyMode: houseForm.storeyMode,
          attachmentStrategy: houseForm.attachmentStrategy,
        },
      ],
    },
    decks: [],
    openings: [],
    pergolas: [],
  };
}

function makeDraft(objectFirst: ObjectFirstWorkbenchDraftVNext = makeObjectFirstDraft()): EstimateDrawingDraft {
  return {
    inputs: {
      modules: [
        {
          pergolaId: 'pergola-1',
          lengthM: '6',
          projectionM: '3',
          houseConnectionType: 'soffit',
          attachmentSide: 'rear',
        },
      ],
    },
    overrides: {},
    objectFirst,
  } as EstimateDrawingDraft;
}

function expectNoStaleHouseFirst(draft: EstimateDrawingDraft) {
  expect('houseFirst' in (draft as EstimateDrawingDraft & { houseFirst?: unknown })).toBe(false);
}

const legacyHouseFirstKey = 'houseFirst';

describe('objectWorkbenchDraftActions', () => {
  it('adds preset deck geometry and patches deck object fields directly', () => {
    const housePolygon = [
      { alongM: '0', depthM: '0' },
      { alongM: '6', depthM: '0' },
      { alongM: '6', depthM: '3' },
      { alongM: '0', depthM: '3' },
    ];
    const deck = buildNewObjectWorkbenchDeckDraft({
      deckId: 'deck-1',
      deckIndex: 0,
      hostEdgeId: 'rear',
      housePolygon,
      mode: 'preset',
    });
    const nextDecks = applyObjectWorkbenchDeckPatch({
      currentDecks: [deck],
      deckId: 'deck-1',
      housePolygon,
      patch: {
        label: 'Kitchen deck',
        levelOffsetMm: '150',
        presetRect: {
          widthM: '2.4',
          depthM: '1.5',
          centerOffsetM: '0',
        },
      },
    });

    expect(deck).toMatchObject({
      id: 'deck-1',
      label: 'Deck 1',
      shape: 'preset',
      presetType: 'rect_attached',
      isAttached: true,
    });
    expect(deck.outline.length).toBe(4);
    expect(nextDecks[0]).toMatchObject({
      label: 'Kitchen deck',
      levelOffsetMm: '150',
      shape: 'preset',
      presetRect: expect.objectContaining({
        widthM: '2.4',
        depthM: '1.5',
      }),
    });
  });

  it('keeps custom deck outlines as object-first deck drafts', () => {
    const deck: ObjectFirstDeckDraft = {
      id: 'deck-1',
      label: 'Deck 1',
      kind: 'deck',
      shape: 'preset',
      presetType: 'rect_attached',
      outline: [],
      elevationMode: 'ground',
      levelOffsetMm: '0',
      hostEdgeId: 'rear',
      attachmentMode: 'single_edge',
      primaryHostEdgeId: 'rear',
      secondaryHostEdgeId: null,
      cornerVertexId: null,
      isAttached: true,
      surfaceMaterial: 'timber_decking',
    };
    const outline = [
      { alongM: '0', depthM: '0' },
      { alongM: '1', depthM: '0' },
      { alongM: '1', depthM: '1' },
    ];

    const nextObjectFirst = buildObjectFirstDraftWithDecks({
      objectFirstDraft: makeObjectFirstDraft(),
      decks: applyObjectWorkbenchDeckPatch({
        currentDecks: [deck],
        deckId: 'deck-1',
        housePolygon: [],
        patch: {
          shape: 'custom',
          outline,
        },
      }),
    });

    expect(nextObjectFirst.decks[0]).toMatchObject({
      id: 'deck-1',
      shape: 'custom',
      outline,
    });
  });

  it('preserves deck position through edge-drag patch + normalization round-trip', () => {
    // Mirrors the full EdgeDragTool → applyObjectWorkbenchDeckPatch → draft
    // normalize flow for a deck. If `position` is dropped at any step the
    // deck snaps back to its original world location on the next render
    // because the decoder has nothing to translate the side-local outline by.
    const deck: ObjectFirstDeckDraft = {
      id: 'deck-1',
      label: 'Deck 1',
      kind: 'deck',
      shape: 'preset',
      presetType: 'rect_attached',
      outline: [],
      elevationMode: 'ground',
      levelOffsetMm: '0',
      hostEdgeId: 'rear',
      attachmentMode: 'single_edge',
      primaryHostEdgeId: 'rear',
      secondaryHostEdgeId: null,
      cornerVertexId: null,
      isAttached: true,
      surfaceMaterial: 'timber_decking',
    };
    const outline = [
      { alongM: '0', depthM: '0' },
      { alongM: '2.4', depthM: '0' },
      { alongM: '2.4', depthM: '1.5' },
      { alongM: '0', depthM: '1.5' },
    ];
    const position = {
      originXMm: '1500',
      originYMm: '-3000',
      rotationDeg: '0',
    } as const;

    const patched = applyObjectWorkbenchDeckPatch({
      currentDecks: [deck],
      deckId: 'deck-1',
      housePolygon: [],
      patch: {
        shape: 'custom',
        outline,
        position,
      },
    });

    expect(patched[0]?.position).toEqual(position);
    expect(patched[0]?.outline).toEqual(outline);
    expect(patched[0]?.shape).toBe('custom');
  });

  it('adds and patches openings with object-first host wall normalization', () => {
    const houseForm = makeHouseForm();
    const houseAssembly: HouseAssemblyModel = {
      id: 'house-main',
      label: 'House',
      houseForms: [houseForm],
      derivedEnvelope: {
        mergedFormIds: ['house-main'],
        footprint: [],
        wallGraph: {
          walls: [
            {
              id: 'wall-a',
              label: 'Rear wall',
              sourceFormIds: ['house-main'],
              edgeIds: ['footprint-edge-1'],
              kind: 'exterior',
              polygon: [
                { alongM: '0', depthM: '0' },
                { alongM: '3', depthM: '0' },
              ],
            },
          ],
          mergeGroups: [],
        },
        roofZones: [],
        edges: [],
        attachmentZones: [],
      },
    };
    const opening = buildNewObjectWorkbenchOpeningDraft({
      currentOpenings: [],
      kind: 'slider',
      openingId: 'opening-1',
      sourceFormId: 'house-main',
      hostWallId: null,
      hostEdgeId: null,
      wallId: 'rear',
    });

    const nextOpenings = applyObjectWorkbenchOpeningPatch({
      activeModuleInput: null,
      currentOpenings: [opening],
      openingId: 'opening-1',
      houseAssembly,
      houseForm,
      patch: {
        hostWallId: 'wall-a',
        kind: 'stacker',
        widthM: '1',
        offsetAlongWallM: '10',
      },
    });

    expect(opening).toMatchObject({
      kind: 'slider',
      panelCount: 2,
      sourceFormId: 'house-main',
    });
    expect(nextOpenings[0]).toMatchObject({
      hostWallId: 'wall-a',
      hostEdgeId: 'footprint-edge-1',
      kind: 'stacker',
      panelCount: null,
      offsetAlongWallM: '2',
    });
  });

  it('removes openings through the object-first draft list', () => {
    const opening: ObjectFirstOpeningDraft = {
      id: 'opening-1',
      label: 'Window 1',
      kind: 'window',
      panelCount: null,
      hostWallId: null,
      sourceFormId: 'house-main',
      widthM: '1',
      heightM: '1.2',
      sillHeightM: '0.9',
      offsetAlongWallM: '0',
    };

    const nextObjectFirst = buildObjectFirstDraftWithOpenings({
      objectFirstDraft: makeObjectFirstDraft(),
      openings: [opening].filter((candidate) => candidate.id !== 'opening-1'),
      sourceFormId: 'house-main',
    });

    expect(nextObjectFirst.openings).toEqual([]);
  });

  it('updates pergola attachment, side, strategy, and geometry as an object-first patch', () => {
    const pergola: ObjectFirstPergolaDraft = {
      id: 'pergola-1',
      label: 'Pergola 1',
      family: 'mono',
      attachmentEdgeId: null,
      attachmentZoneId: null,
      side: 'rear',
      strategy: null,
    };
    const nextPergolas = applyObjectWorkbenchPergolaPatch({
      currentPergolas: [pergola],
      pergolaId: 'pergola-1',
      patch: {
        connectionKind: 'wall',
        attachmentEdgeId: 'edge-a',
        attachmentZoneId: 'zone-a',
        side: 'left',
        strategy: 'facade_ledger',
        geometry: {
          dimensions: {
            lengthM: '7',
          },
          roof: {
            pitchDeg: '9',
          },
        },
      },
      fallbackPergola: pergola,
    });
    const objectFirst = buildObjectFirstDraftWithPergolas({
      objectFirstDraft: makeObjectFirstDraft(),
      pergolas: nextPergolas,
    });
    const nextDraft = updateDraftObjectFirst({
      draft: makeDraft(),
      objectFirst,
    });

    expect(nextPergolas[0]).toMatchObject({
      connectionKind: 'wall',
      attachmentEdgeId: 'edge-a',
      attachmentZoneId: 'zone-a',
      side: 'left',
      strategy: 'facade_ledger',
      geometry: {
        dimensions: {
          lengthM: '7',
        },
        roof: {
          pitchDeg: '9',
        },
      },
    });
    expect(nextDraft.objectFirst?.pergolas[0]).toMatchObject({
      connectionKind: 'wall',
      attachmentEdgeId: 'edge-a',
      attachmentZoneId: 'zone-a',
      side: 'left',
      strategy: 'facade_ledger',
      geometry: {
        dimensions: {
          lengthM: '7',
        },
        roof: {
          pitchDeg: '9',
        },
      },
    });
    expectNoStaleHouseFirst(nextDraft);
  });

  it('commits roof intent and removes invalid terminal-end ids after footprint sync', () => {
    const draft = {
      ...makeDraft(),
      [legacyHouseFirstKey]: {
        roof: {
          form: 'mono',
        },
      },
    } as EstimateDrawingDraft & { houseFirst?: unknown };
    const nextDraft = buildObjectWorkbenchRoofCommitDraft({
      draft,
      objectFirstDraft: makeObjectFirstDraft(),
      roof: makeRoofIntent({
        form: 'gable',
        material: 'trapezoidal_5_rib',
        primaryPitchDeg: '22',
        ridgeAxis: 'y',
        openGableEndIds: ['terminal-a'],
      }),
    });
    const syncedForm = mergeHouseFormRoofIntentAfterFootprintSync({
      previewHouseForm: {
        ...makeObjectFirstDraft().houseAssembly!.houseForms[0]!,
        roofIntent: makeRoofIntent({ form: 'gable', openGableEndIds: ['terminal-a', 'terminal-stale'] }),
      },
      existingHouseForm: nextDraft.objectFirst!.houseAssembly!.houseForms[0]!,
      terminalEndIds: new Set(['terminal-a']),
    });

    expect(nextDraft.inputs.modules[0]).toMatchObject({
      houseRoofMaterial: 'trapezoidal_5_rib',
      houseRoofPitchDeg: '22',
    });
    expect(nextDraft.objectFirst?.houseAssembly?.houseForms[0]?.roofIntent).toMatchObject({
      form: 'gable',
      material: 'trapezoidal_5_rib',
      primaryPitchDeg: '22',
      ridgeAxis: 'y',
      openGableEndIds: ['terminal-a'],
    });
    expect(nextDraft.objectFirst?.houseAssembly?.houseForms[0]?.roofIntentAuthored).toBe(true);
    expect(syncedForm.roofIntent.openGableEndIds).toEqual(['terminal-a']);
    expectNoStaleHouseFirst(nextDraft);
  });

  it('clears stale houseFirst data whenever object-first draft data is written', () => {
    const draft = {
      ...makeDraft(),
      [legacyHouseFirstKey]: {
        decks: [{ id: 'legacy-deck' }],
      },
    } as EstimateDrawingDraft & { houseFirst?: unknown };

    const nextDraft = updateDraftObjectFirst({
      draft,
      objectFirst: makeObjectFirstDraft(),
    });

    expectNoStaleHouseFirst(nextDraft);
  });
});
