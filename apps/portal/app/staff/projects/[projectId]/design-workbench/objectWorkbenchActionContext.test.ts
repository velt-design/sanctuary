import { describe, expect, it } from 'vitest';
import type {
  HouseFormModel,
  WorkbenchObjectRef,
} from '@/lib/drawings/state/objectFirstWorkbenchModel';
import {
  resolveObjectOwnedHouseActionContext,
  resolveSelectedHouseActionContext,
} from './objectWorkbenchActionContext';

function houseForm(id: string): HouseFormModel {
  return {
    id,
    label: id,
    transform: { offsetXM: id === 'house-form-2' ? 10 : 0, offsetYM: 0, rotationQuarterTurns: 0 },
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
    roofIntent: {
      form: 'mono',
      material: 'corrugated_iron',
      primaryPitchDeg: '5',
      primaryFallDirection: 'negative_y',
      ridgeAxis: 'x',
      openGableEndIds: [],
    },
    storeyMode: 'single_storey',
    attachmentStrategy: null,
  };
}

const HOUSE_FORMS = [houseForm('house-main'), houseForm('house-form-2')];

describe('object workbench action context', () => {
  it('resolves only an explicitly selected house form', () => {
    expect(
      resolveSelectedHouseActionContext({
        activeObjectRef: { family: 'house_forms', objectId: 'house-form-2' },
        houseForms: HOUSE_FORMS,
      })?.houseForm.id,
    ).toBe('house-form-2');

    expect(
      resolveSelectedHouseActionContext({
        activeObjectRef: { family: 'house_forms', objectId: null },
        houseForms: HOUSE_FORMS,
      }),
    ).toBeNull();
  });

  it('resolves deck and opening host houses by owned ids', () => {
    expect(
      resolveObjectOwnedHouseActionContext({
        target: { family: 'decks', objectId: 'deck-2' },
        houseForms: HOUSE_FORMS,
        decks: [
          {
            id: 'deck-2',
            attachment: {
              host: {
                objectFamily: 'house_forms',
                objectId: 'house-form-2',
                edgeKind: 'wall',
                edgeId: 'wall-2',
                myEdgeIndex: 0,
              },
              spatialKind: 'wall',
            },
          },
        ],
      })?.houseForm.id,
    ).toBe('house-form-2');

    expect(
      resolveObjectOwnedHouseActionContext({
        target: { family: 'openings', objectId: 'opening-2' },
        houseForms: HOUSE_FORMS,
        openings: [{ id: 'opening-2', sourceFormId: 'house-form-2' }],
      })?.houseForm.id,
    ).toBe('house-form-2');
  });

  it('returns null for unhosted or invalid object ids instead of falling back to House 1', () => {
    const targets: WorkbenchObjectRef[] = [
      { family: 'decks', objectId: 'deck-unhosted' },
      { family: 'openings', objectId: 'opening-unhosted' },
      { family: 'pergolas', objectId: 'pergola-unhosted' },
      { family: 'house_forms', objectId: 'missing-house' },
    ];

    for (const target of targets) {
      expect(
        resolveObjectOwnedHouseActionContext({
          target,
          houseForms: HOUSE_FORMS,
          decks: [{ id: 'deck-unhosted', attachment: null }],
          openings: [{ id: 'opening-unhosted', sourceFormId: null }],
          pergolas: [{ id: 'pergola-unhosted', attachment: null }],
        }),
      ).toBeNull();
    }
  });
});
