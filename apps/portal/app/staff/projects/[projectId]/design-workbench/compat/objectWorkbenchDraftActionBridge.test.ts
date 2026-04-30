import { describe, expect, it } from 'vitest';
import type { EstimateDrawingDraft } from '@/lib/estimates/drawingEdits';
import type {
  HouseAssemblyModel,
  HouseFormRoofIntentModel,
  ObjectFirstWorkbenchDraftVNext,
} from '@/lib/drawings/state/objectFirstWorkbenchModel';
import {
  applyObjectWorkbenchDeckPatch,
  applyObjectWorkbenchOpeningPatch,
  buildObjectFirstDraftWithCompatibilityDecks,
  buildObjectWorkbenchRoofCommitDraft,
  upsertObjectWorkbenchPergolaDrafts,
  type ObjectWorkbenchCompatibilityDeckDraft,
  type ObjectWorkbenchCompatibilityOpeningDraft,
} from './objectWorkbenchDraftActionBridge';

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

function makeObjectFirstDraft(): ObjectFirstWorkbenchDraftVNext {
  return {
    houseAssembly: {
      id: 'house-main',
      label: 'House',
      houseForms: [
        {
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
        },
      ],
    },
    decks: [],
    openings: [],
    pergolas: [],
  };
}

describe('objectWorkbenchDraftActionBridge', () => {
  it('translates object deck patches into compatibility deck draft fields', () => {
    const deck: ObjectWorkbenchCompatibilityDeckDraft = {
      id: 'deck-1',
      name: 'Old deck',
      kind: 'deck',
      shape: 'custom',
      presetType: null,
      outline: [
        { alongM: '0', depthM: '0' },
        { alongM: '1', depthM: '0' },
        { alongM: '1', depthM: '1' },
      ],
      elevationMode: 'ground',
      levelOffsetMm: '0',
      hostEdgeId: null,
      attachmentMode: 'floating',
      primaryHostEdgeId: null,
      secondaryHostEdgeId: null,
      cornerVertexId: null,
      isAttached: false,
      surfaceMaterial: 'timber_decking',
    };

    const nextDecks = applyObjectWorkbenchDeckPatch({
      currentDecks: [deck],
      deckId: 'deck-1',
      housePolygon: [],
      patch: {
        label: 'New deck',
        levelOffsetMm: '150',
      },
    });

    expect(nextDecks[0]).toMatchObject({
      name: 'New deck',
      levelOffsetMm: '150',
      shape: 'custom',
    });
  });

  it('normalizes opening host-wall patches against derived wall spans', () => {
    const houseAssembly: HouseAssemblyModel = {
      id: 'house-main',
      label: 'House',
      houseForms: [],
      derivedEnvelope: {
        mergedFormIds: ['house-main'],
        footprint: [],
        wallGraph: {
          walls: [
            {
              id: 'wall-a',
              label: 'Rear wall',
              sourceFormIds: ['house-main'],
              edgeIds: ['edge-a'],
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
    const opening: ObjectWorkbenchCompatibilityOpeningDraft = {
      id: 'opening-1',
      label: 'Window 1',
      kind: 'window',
      panelCount: null,
      hostWallId: null,
      wallId: 'rear',
      hostEdgeId: null,
      widthM: '1',
      heightM: '1.2',
      sillHeightM: '0.9',
      offsetAlongWallM: '0',
    };

    const nextOpenings = applyObjectWorkbenchOpeningPatch({
      activeModuleInput: null,
      currentOpenings: [opening],
      openingId: 'opening-1',
      houseAssembly,
      house: null,
      patch: {
        hostWallId: 'wall-a',
        widthM: '1',
        offsetAlongWallM: '10',
      },
    });

    expect(nextOpenings[0]).toMatchObject({
      hostWallId: 'wall-a',
      hostEdgeId: 'edge-a',
      offsetAlongWallM: '2',
    });
  });

  it('upserts pergola attachment compatibility drafts', () => {
    const nextPergolas = upsertObjectWorkbenchPergolaDrafts(
      [{ id: 'pergola-1', attachmentEdgeId: null, attachmentZoneId: null }],
      'pergola-1',
      {
        attachmentEdgeId: 'edge-a',
        attachmentZoneId: 'zone-a',
      },
    );

    expect(nextPergolas).toEqual([
      {
        id: 'pergola-1',
        attachmentEdgeId: 'edge-a',
        attachmentZoneId: 'zone-a',
      },
    ]);
  });

  it('commits roof intent into object-first draft data and mirrors module roof fields', () => {
    const draft = {
      inputs: {
        modules: [{}],
      },
      overrides: {},
    } as EstimateDrawingDraft;
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
  });

  it('builds object-first deck drafts from compatibility fallback drafts', () => {
    const objectFirstDraft = makeObjectFirstDraft();
    const nextDraft = buildObjectFirstDraftWithCompatibilityDecks({
      objectFirstDraft,
      decks: [
        {
          id: 'deck-1',
          name: 'Compatibility deck',
          kind: 'deck',
          shape: 'preset',
          presetType: 'rect_attached',
          presetRect: null,
          floatingRect: null,
          outline: [],
          elevationMode: 'aligned_to_threshold',
          levelOffsetMm: '0',
          hostEdgeId: 'rear',
          attachmentMode: 'single_edge',
          primaryHostEdgeId: 'rear',
          secondaryHostEdgeId: null,
          cornerVertexId: null,
          isAttached: true,
          surfaceMaterial: 'timber_decking',
        },
      ],
    });

    expect(nextDraft.decks).toEqual([
      expect.objectContaining({
        id: 'deck-1',
        label: 'Compatibility deck',
        hostEdgeId: 'rear',
      }),
    ]);
  });
});
