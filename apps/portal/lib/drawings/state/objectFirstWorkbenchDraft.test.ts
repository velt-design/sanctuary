import { describe, expect, it } from 'vitest';
import {
  normalizeObjectFirstWorkbenchDraftVNext,
  type ObjectFirstWorkbenchDraftVNext,
} from './objectFirstWorkbenchModel';

function makePolygon() {
  return [
    { alongM: '0', depthM: '0' },
    { alongM: '6', depthM: '0' },
    { alongM: '6', depthM: '4' },
    { alongM: '0', depthM: '4' },
  ];
}

function makeFootprintParams() {
  return {
    widthM: '6',
    offsetXM: '0',
    setbackM: '0',
    bandDepthM: '4',
    returnRunM: '0',
    recessWidthM: '0',
    recessDepthM: '0',
    leftLegRunM: '0',
    rightLegRunM: '0',
    sideRunM: '0',
  };
}

describe('objectFirstWorkbenchDraft authored envelope', () => {
  it('normalizes an authored-only draft with multiple independent house forms', () => {
    const draft = normalizeObjectFirstWorkbenchDraftVNext({
      houseAssembly: {
        id: ' assembly-main ',
        label: 'Main House',
        houseForms: [
          {
            id: ' form-b ',
            label: 'Form B',
            transform: { offsetXM: 4, offsetYM: 1, rotationQuarterTurns: 1 },
            footprint: {
              mode: 'preset',
              preset: 'straight',
              params: makeFootprintParams(),
              polygon: makePolygon(),
              attachmentSide: 'left',
            },
            roofIntent: {
              form: 'mono',
              material: 'corrugated_iron',
              primaryPitchDeg: '5',
              primaryFallDirection: 'negative_x',
              ridgeAxis: 'y',
              openGableEndIds: [],
            },
            storeyMode: 'single_storey',
            attachmentStrategy: null,
          },
          {
            id: 'form-a',
            label: 'Form A',
            transform: { offsetXM: 0, offsetYM: 0, rotationQuarterTurns: 0 },
            footprint: {
              mode: 'preset',
              preset: 'straight',
              params: makeFootprintParams(),
              polygon: makePolygon(),
              attachmentSide: 'rear',
            },
            roofIntent: {
              form: 'gable',
              material: 'corrugated_iron',
              primaryPitchDeg: '7',
              primaryFallDirection: 'negative_y',
              ridgeAxis: 'x',
              openGableEndIds: [],
            },
            storeyMode: 'single_storey',
            attachmentStrategy: null,
          },
        ],
        derivedEnvelope: { mergedFormIds: ['should-not-survive'] },
      } as unknown as ObjectFirstWorkbenchDraftVNext['houseAssembly'],
      decks: [],
      openings: [],
      pergolas: [],
      ui: {
        activeObjectFamily: 'decks',
        activeObjectRef: { family: 'decks', objectId: 'deck-1' },
      },
    } as unknown as Partial<ObjectFirstWorkbenchDraftVNext>);

    expect(draft.houseAssembly?.id).toBe('assembly-main');
    expect(draft.houseAssembly?.houseForms).toHaveLength(2);
    expect(draft.houseAssembly?.houseForms[0]?.id).toBe('form-b');
    expect(draft.houseAssembly?.houseForms[1]?.id).toBe('form-a');
    expect(draft.houseAssembly?.houseForms[0]?.transform.offsetXM).toBe(4);
    expect('derivedEnvelope' in (draft.houseAssembly ?? {})).toBe(false);
    expect('ui' in draft).toBe(false);
  });

  it('normalizes missing authored collections to empty arrays and missing assembly to null', () => {
    const draft = normalizeObjectFirstWorkbenchDraftVNext(null);

    expect(draft).toEqual({
      houseAssembly: null,
      decks: [],
      openings: [],
      pergolas: [],
    });
  });

  it('drops objects without stable ids while preserving authored order for valid objects', () => {
    const draft = normalizeObjectFirstWorkbenchDraftVNext({
      decks: [
        { id: 'deck-b', label: 'Deck B' },
        { id: '   ', label: 'Invalid Deck' },
        { id: 'deck-a', label: 'Deck A' },
      ],
      openings: [
        { id: 'opening-1', hostWallId: ' wall-1 ', sourceFormId: ' form-a ' },
      ],
      pergolas: [
        {
          id: 'pergola-2',
          attachmentEdgeId: ' edge-2 ',
          attachmentZoneId: ' zone-2 ',
          side: 'rear',
        },
      ],
    } as unknown as Partial<ObjectFirstWorkbenchDraftVNext>);

    expect(draft.decks.map((deck) => deck.id)).toEqual(['deck-b', 'deck-a']);
    expect(draft.openings[0]).toMatchObject({
      id: 'opening-1',
      hostWallId: 'wall-1',
      sourceFormId: 'form-a',
    });
    expect(draft.pergolas[0]).toMatchObject({
      id: 'pergola-2',
      attachmentEdgeId: 'edge-2',
      attachmentZoneId: 'zone-2',
    });
  });
});
