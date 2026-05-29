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
  buildNewObjectWorkbenchPergolaDraft,
  buildObjectFirstDraftWithDecks,
  buildObjectFirstDraftWithOpenings,
  buildObjectFirstDraftWithPergolas,
  buildObjectWorkbenchRoofCommitDraft,
  mergeHouseFormRoofIntentAfterFootprintSync,
  nextObjectWorkbenchPergolaId,
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
      shape: 'preset',
      presetType: 'rect_attached',
      isAttached: true,
    });
    expect(deck.outline.length).toBe(4);
    expect(nextDecks[0]).toMatchObject({
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
      // PR-T9 (2026-05-29): `label`, `kind`, `elevationMode` removed.
      shape: 'preset',
      presetType: 'rect_attached',
      outline: [],
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
      // PR-T9 (2026-05-29): `label`, `kind`, `elevationMode` removed.
      shape: 'preset',
      presetType: 'rect_attached',
      outline: [],
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

  it('builds a freestanding object-first pergola draft with solve-safe defaults', () => {
    const pergola = buildNewObjectWorkbenchPergolaDraft({
      pergolaId: 'pergola-2',
      currentPergolas: [],
    });

    expect(pergola).toMatchObject({
      id: 'pergola-2',
      label: 'Pergola 2',
      family: 'mono',
      connectionKind: 'freestanding',
      attachmentEdgeId: null,
      attachmentZoneId: null,
      side: 'rear',
      strategy: null,
      geometry: {
        dimensions: {
          lengthM: '6',
          projectionM: '3',
        },
        roof: {
          pitchDeg: '5',
        },
        supports: {
          postConnectionType: 'slab_anchors',
          ground: 'easy',
          postCount: '4',
          postCutHeightM: '2.4',
        },
      },
      position: {
        originXMm: '0',
        originYMm: '0',
        rotationDeg: '0',
      },
      attachment: {
        spatialKind: 'freestanding',
        host: null,
        method: 'none',
      },
    });
  });

  it('allocates the next pergola id without filling deleted gaps', () => {
    expect(
      nextObjectWorkbenchPergolaId([
        {
          id: 'pergola-1',
          label: 'Pergola 1',
          family: 'mono',
          attachmentEdgeId: null,
          attachmentZoneId: null,
          side: 'rear',
          strategy: null,
        },
        {
          id: 'pergola-4',
          label: 'Pergola 4',
          family: 'mono',
          attachmentEdgeId: null,
          attachmentZoneId: null,
          side: 'rear',
          strategy: null,
        },
      ]),
    ).toBe('pergola-3');
  });

  it('places a new pergola to the right of the active pergola when available', () => {
    const currentPergolas: ObjectFirstPergolaDraft[] = [
      {
        id: 'pergola-1',
        label: 'Pergola 1',
        family: 'mono',
        attachmentEdgeId: null,
        attachmentZoneId: null,
        side: 'rear',
        strategy: null,
        geometry: {
          dimensions: {
            lengthM: '6',
          },
        },
        position: {
          originXMm: '1000',
          originYMm: '2000',
          rotationDeg: '0',
        },
      },
      {
        id: 'pergola-2',
        label: 'Pergola 2',
        family: 'mono',
        attachmentEdgeId: null,
        attachmentZoneId: null,
        side: 'rear',
        strategy: null,
        geometry: {
          dimensions: {
            lengthM: '7',
          },
        },
        position: {
          originXMm: '12000',
          originYMm: '3000',
          rotationDeg: '0',
        },
      },
    ];

    const pergola = buildNewObjectWorkbenchPergolaDraft({
      pergolaId: 'pergola-3',
      currentPergolas,
      activePergolaId: 'pergola-2',
    });

    expect(pergola.position).toEqual({
      originXMm: '21000',
      originYMm: '3000',
      rotationDeg: '0',
    });
  });

  it('places a new pergola after the last pergola when no active pergola is available', () => {
    const pergola = buildNewObjectWorkbenchPergolaDraft({
      pergolaId: 'pergola-2',
      currentPergolas: [
        {
          id: 'pergola-1',
          label: 'Pergola 1',
          family: 'mono',
          attachmentEdgeId: null,
          attachmentZoneId: null,
          side: 'rear',
          strategy: null,
        },
      ],
      activePergolaId: 'missing-pergola',
    });

    expect(pergola.position).toEqual({
      originXMm: '8000',
      originYMm: '0',
      rotationDeg: '0',
    });
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
        form: 'hipped',
        material: 'trapezoidal_5_rib',
        primaryPitchDeg: '22',
        ridgeAxis: 'y',
        openGableEndIds: ['terminal-a'],
      }),
    });
    const syncedForm = mergeHouseFormRoofIntentAfterFootprintSync({
      previewHouseForm: {
        ...makeObjectFirstDraft().houseAssembly!.houseForms[0]!,
        roofIntent: makeRoofIntent({ form: 'hipped', openGableEndIds: ['terminal-a', 'terminal-stale'] }),
      },
      existingHouseForm: nextDraft.objectFirst!.houseAssembly!.houseForms[0]!,
      terminalEndIds: new Set(['terminal-a']),
    });

    expect(nextDraft.inputs.modules[0]).toMatchObject({
      houseRoofMaterial: 'trapezoidal_5_rib',
      houseRoofPitchDeg: '22',
    });
    expect(nextDraft.objectFirst?.houseAssembly?.houseForms[0]?.roofIntent).toMatchObject({
      // Milestone 13 session C: gable retired -- commit serializes
      // the canonical hipped form value.
      form: 'hipped',
      material: 'trapezoidal_5_rib',
      primaryPitchDeg: '22',
      ridgeAxis: 'y',
      openGableEndIds: ['terminal-a'],
    });
    expect(nextDraft.objectFirst?.houseAssembly?.houseForms[0]?.roofIntentAuthored).toBe(true);
    expect(syncedForm.roofIntent.openGableEndIds).toEqual(['terminal-a']);
    expectNoStaleHouseFirst(nextDraft);
  });

  it('preserves the existing house transform when footprint sync rebuilds the preview form', () => {
    const existingHouseForm = {
      ...makeHouseForm(),
      transform: { offsetXM: 3, offsetYM: -1, rotationQuarterTurns: 1 as const },
    };
    const previewHouseForm = {
      ...makeHouseForm(),
      transform: { offsetXM: 0, offsetYM: 0, rotationQuarterTurns: 0 as const },
    };

    const syncedForm = mergeHouseFormRoofIntentAfterFootprintSync({
      previewHouseForm,
      existingHouseForm,
      terminalEndIds: new Set(),
    });

    expect(syncedForm.transform).toEqual({
      offsetXM: 3,
      offsetYM: -1,
      rotationQuarterTurns: 1,
    });
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

  describe('lazy attachment migration on first patch (step 8 follow-up #2)', () => {
    // Legacy pergolas have `connectionKind` + `strategy` but no `attachment`.
    // The first time any patch runs against a legacy-only pergola, the patch
    // pipeline derives an `attachment` from the post-patch legacy fields and
    // writes it through alongside the patch. One-time migration per pergola
    // — subsequent patches see `currentPergola.attachment` already set and
    // skip the derivation.

    function makeLegacyPergola(
      overrides: Partial<ObjectFirstPergolaDraft> = {},
    ): ObjectFirstPergolaDraft {
      return {
        id: 'pergola-1',
        label: 'Pergola 1',
        family: 'mono',
        connectionKind: 'soffit',
        attachmentEdgeId: 'footprint-edge-1',
        attachmentZoneId: 'zone-1',
        side: 'rear',
        strategy: null,
        ...overrides,
      };
    }

    it('writes attachment derived from connectionKind=soffit on the first patch', () => {
      const next = applyObjectWorkbenchPergolaPatch({
        currentPergolas: [makeLegacyPergola()],
        pergolaId: 'pergola-1',
        patch: { label: 'Renamed Pergola' },
      });
      expect(next[0]?.attachment).toEqual({
        spatialKind: 'roof_edge',
        host: null,
        method: 'direct_to_soffit',
      });
      expect(next[0]?.label).toBe('Renamed Pergola');
      // Legacy fields preserved alongside.
      expect(next[0]?.connectionKind).toBe('soffit');
    });

    it('preserves a roof_edge strategy on the legacy field when deriving method', () => {
      const next = applyObjectWorkbenchPergolaPatch({
        currentPergolas: [makeLegacyPergola({ strategy: 'soffit_brackets' })],
        pergolaId: 'pergola-1',
        patch: { label: 'Edited' },
      });
      expect(next[0]?.attachment?.method).toBe('soffit_brackets');
    });

    it('derives from POST-patch state when the patch changes connectionKind', () => {
      // User changes connection kind via legacy inspector path: patch.connectionKind
      // = 'fascia'. The derivation must use the new kind (post-patch), not the
      // stale current kind.
      const next = applyObjectWorkbenchPergolaPatch({
        currentPergolas: [makeLegacyPergola({ connectionKind: 'soffit' })],
        pergolaId: 'pergola-1',
        patch: { connectionKind: 'fascia' },
      });
      expect(next[0]?.attachment?.spatialKind).toBe('roof_edge');
      expect(next[0]?.attachment?.method).toBe('fascia_under_gutter');
      expect(next[0]?.connectionKind).toBe('fascia');
    });

    it('does not overwrite an existing attachment (one-time migration only)', () => {
      const existingAttachment = {
        spatialKind: 'wall' as const,
        host: {
          objectFamily: 'house_forms' as const,
          objectId: 'house-main',
          edgeKind: 'wall' as const,
          edgeId: 'wall-house-wall-1',
          myEdgeIndex: 0,
        },
        method: 'facade_ledger' as const,
      };
      const next = applyObjectWorkbenchPergolaPatch({
        currentPergolas: [makeLegacyPergola({ attachment: existingAttachment })],
        pergolaId: 'pergola-1',
        // Even when the patch changes connectionKind to something
        // contradictory, the existing attachment wins until it's explicitly
        // patched. Caller is responsible for clearing attachment if they
        // want the legacy fields to drive again.
        patch: { connectionKind: 'wall' },
      });
      expect(next[0]?.attachment).toEqual(existingAttachment);
    });

    it('respects an explicit attachment in the patch (snap commit path)', () => {
      // The pergola edge-drag handler writes attachment directly on snap.
      // The lazy migration must not overwrite that explicit write.
      const explicitAttachment = {
        spatialKind: 'roof_edge' as const,
        host: {
          objectFamily: 'house_forms' as const,
          objectId: 'house-main',
          edgeKind: 'roof_eave' as const,
          edgeId: 'roof-eave-edge-1',
          myEdgeIndex: 0,
        },
        method: 'soffit_brackets' as const,
      };
      const next = applyObjectWorkbenchPergolaPatch({
        currentPergolas: [makeLegacyPergola({ connectionKind: 'wall' })],
        pergolaId: 'pergola-1',
        patch: { attachment: explicitAttachment },
      });
      expect(next[0]?.attachment).toEqual(explicitAttachment);
    });

    it('clears attachment when patch sets it to null (caller wants legacy back)', () => {
      const existingAttachment = {
        spatialKind: 'roof_edge' as const,
        host: null,
        method: 'fascia_under_gutter' as const,
      };
      const next = applyObjectWorkbenchPergolaPatch({
        currentPergolas: [makeLegacyPergola({ attachment: existingAttachment })],
        pergolaId: 'pergola-1',
        patch: { attachment: null },
      });
      expect(next[0]?.attachment).toBeNull();
    });

    it('writes a freestanding attachment for legacy connectionKind=freestanding', () => {
      const next = applyObjectWorkbenchPergolaPatch({
        currentPergolas: [
          makeLegacyPergola({ connectionKind: 'freestanding', attachmentEdgeId: null, attachmentZoneId: null }),
        ],
        pergolaId: 'pergola-1',
        patch: { label: 'Edited' },
      });
      expect(next[0]?.attachment).toEqual({
        spatialKind: 'freestanding',
        host: null,
        method: 'none',
      });
    });
  });

  describe('atomic edge-drag commit (step 8 follow-up #1 race fix)', () => {
    // The pergola edge-drag commit handler used to fire up to 4 separate
    // fire-and-forget patches (position / lengthM / projectionM / attachment)
    // in the same React tick. Each patch cloned the pre-tick draft and
    // last-persist-won, so the pergola visibly "jumped back to original size"
    // on snap-release — the attachment write usually landed last and dropped
    // the dimension/position writes.
    //
    // Fix: a single atomic patch covering position + geometry.dimensions +
    // attachment goes through one transaction. This test locks the contract
    // that one combined patch successfully merges all fields.

    it('writes position, dimensions, and attachment in a single combined patch', () => {
      const pergola: ObjectFirstPergolaDraft = {
        id: 'pergola-1',
        label: 'Pergola 1',
        family: 'mono',
        connectionKind: 'soffit',
        attachmentEdgeId: 'footprint-edge-1',
        attachmentZoneId: 'zone-1',
        side: 'rear',
        strategy: null,
        position: { originXMm: '0', originYMm: '0', rotationDeg: '0' },
        attachment: {
          spatialKind: 'roof_edge',
          host: null,
          method: 'direct_to_soffit',
        },
      };

      const next = applyObjectWorkbenchPergolaPatch({
        currentPergolas: [pergola],
        pergolaId: 'pergola-1',
        patch: {
          // The atomic edge-drag commit produces all of these in one patch.
          position: { originXMm: '1500', originYMm: '-3000', rotationDeg: '0' },
          geometry: {
            dimensions: { lengthM: '7', projectionM: '4' },
          },
          attachment: {
            spatialKind: 'wall',
            host: {
              objectFamily: 'house_forms',
              objectId: 'house-main',
              edgeKind: 'wall',
              edgeId: 'wall-house-wall-1',
              myEdgeIndex: 0,
            },
            method: 'facade_ledger',
          },
        },
      });

      expect(next[0]?.position).toEqual({
        originXMm: '1500',
        originYMm: '-3000',
        rotationDeg: '0',
      });
      expect(next[0]?.geometry?.dimensions?.lengthM).toBe('7');
      expect(next[0]?.geometry?.dimensions?.projectionM).toBe('4');
      expect(next[0]?.attachment).toEqual({
        spatialKind: 'wall',
        host: {
          objectFamily: 'house_forms',
          objectId: 'house-main',
          edgeKind: 'wall',
          edgeId: 'wall-house-wall-1',
          myEdgeIndex: 0,
        },
        method: 'facade_ledger',
      });
    });

    it('preserves unchanged pergola fields when only some are in the combined patch', () => {
      const pergola: ObjectFirstPergolaDraft = {
        id: 'pergola-1',
        label: 'Pergola 1',
        family: 'gable',
        connectionKind: 'fascia',
        attachmentEdgeId: 'edge-1',
        attachmentZoneId: 'zone-1',
        side: 'rear',
        strategy: 'fascia_under_gutter',
      };

      const next = applyObjectWorkbenchPergolaPatch({
        currentPergolas: [pergola],
        pergolaId: 'pergola-1',
        // Patch only writes attachment — position/dimensions stay null/undefined.
        patch: {
          attachment: {
            spatialKind: 'roof_edge',
            host: {
              objectFamily: 'house_forms',
              objectId: 'house-main',
              edgeKind: 'roof_eave',
              edgeId: 'roof-eave-edge-1',
              myEdgeIndex: 0,
            },
            method: 'soffit_brackets',
          },
        },
      });

      expect(next[0]?.attachment?.method).toBe('soffit_brackets');
      // Legacy fields preserved.
      expect(next[0]?.connectionKind).toBe('fascia');
      expect(next[0]?.side).toBe('rear');
      expect(next[0]?.attachmentEdgeId).toBe('edge-1');
      expect(next[0]?.family).toBe('gable');
    });
  });
});
