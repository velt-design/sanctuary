import { describe, expect, it } from 'vitest';
import type { ModulePlanModel } from '@/app/staff/calculator/moduleViews';
import type { HouseModel } from '@/lib/drawings/state/houseFirstWorkbenchModel';
import { buildPlanViewModel } from './buildPlanViewModel';

function makeCompatibilityHouse(): HouseModel {
  return {
    id: 'house-main',
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
      polygon: [
        { alongM: '0', depthM: '0' },
        { alongM: '6', depthM: '0' },
        { alongM: '6', depthM: '1.8' },
        { alongM: '0', depthM: '1.8' },
      ],
      drawingRotationQuarterTurns: 0,
      attachmentSide: 'rear',
    },
    decks: [],
    openings: [],
  } as unknown as HouseModel;
}

function makePlanModelWithHouseContext(): ModulePlanModel {
  return {
    roofType: 'flat',
    pergolaStyle: null,
    drawingRotationQuarterTurns: 0,
    lengthA: 6,
    spanA: 3,
    lengthB: null,
    spanB: null,
    houseConnectionType: 'attached',
    attachmentSide: 'rear',
    houseFootprintPreset: 'straight',
    supportsHouseFootprints: true,
    rafterCountA: null,
    rafterSpacingA: null,
    ridgeBeamDepthM: 0,
    ridgeBeamWidthM: 0,
    soffitBracketPositionsA: [],
    houseContext: {
      surfaces: [
        {
          id: 'house-footprint',
          kind: 'footprint',
          boundary: [
            { x: 0, y: -1.8 },
            { x: 6, y: -1.8 },
            { x: 6, y: 0 },
            { x: 0, y: 0 },
          ],
        },
      ],
      lines: [],
    },
  } as unknown as ModulePlanModel;
}

describe('buildPlanViewModel', () => {
  it('exposes the object-workbench overlay when compatibility context is requested', () => {
    const viewModel = buildPlanViewModel({
      moduleId: 'module-1',
      moduleLabel: 'Module 1',
      planModel: makePlanModelWithHouseContext(),
      canEditHouseFootprint: true,
      objectWorkbenchCompatibilityHouse: makeCompatibilityHouse(),
      objectWorkbenchCompatibilitySelection: { kind: 'footprint', targetId: 'house-main' },
      includeObjectWorkbenchOverlay: true,
      moduleLengthM: '6',
      moduleProjectionM: '3',
    });

    expect(viewModel?.objectWorkbenchOverlay?.shapes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ownerKind: 'footprint',
          ownerId: 'house-main',
          selected: true,
        }),
      ]),
    );
  });
});
