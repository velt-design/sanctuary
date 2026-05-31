import { describe, expect, it } from 'vitest';
import { makeObjectFirstWorkbenchProjectFixture } from './objectFirstWorkbenchFixtures';
import { buildObjectWorkbenchStatusFacade } from './objectWorkbenchStatusModel';

describe('buildObjectWorkbenchStatusFacade', () => {
  it('keeps selected house status null when no house form is selected', () => {
    const projectModel = makeObjectFirstWorkbenchProjectFixture('separate_forms');

    const status = buildObjectWorkbenchStatusFacade({
      activeDeckId: null,
      activeHouseFormId: null,
      activeModuleInput: undefined,
      projectModel,
    });

    expect(Object.keys(status.houseFormsById)).toEqual(['form-a', 'form-b']);
    expect(status.selectedHouseFormId).toBeNull();
    expect(status.selectedHouseFormStatus).toBeNull();
    expect(status.houseForm).toBeNull();
  });

  it('keeps selected house status null for an invalid house id', () => {
    const projectModel = makeObjectFirstWorkbenchProjectFixture('separate_forms');

    const status = buildObjectWorkbenchStatusFacade({
      activeDeckId: null,
      activeHouseFormId: 'missing-house',
      activeModuleInput: undefined,
      projectModel,
    });

    expect(status.selectedHouseFormId).toBeNull();
    expect(status.selectedHouseFormStatus).toBeNull();
    expect(status.houseForm).toBeNull();
  });

  it('resolves selected status by house form id without borrowing another form', () => {
    const projectModel = makeObjectFirstWorkbenchProjectFixture('separate_forms');
    const houseOne = projectModel.houseAssembly?.houseForms[0];
    const houseTwo = projectModel.houseAssembly?.houseForms[1];
    if (!houseOne || !houseTwo) throw new Error('Expected two house forms.');
    houseOne.footprint.preset = 'straight';
    houseOne.roofIntent = { ...houseOne.roofIntent, form: 'mono' };
    houseTwo.footprint.preset = 'wrap_right';
    houseTwo.roofIntent = { ...houseTwo.roofIntent, form: 'hipped' };

    const houseOneStatus = buildObjectWorkbenchStatusFacade({
      activeDeckId: null,
      activeHouseFormId: houseOne.id,
      activeModuleInput: undefined,
      projectModel,
    });
    const houseTwoStatus = buildObjectWorkbenchStatusFacade({
      activeDeckId: null,
      activeHouseFormId: houseTwo.id,
      activeModuleInput: undefined,
      projectModel,
    });

    expect(houseOneStatus.selectedHouseFormId).toBe(houseOne.id);
    expect(houseOneStatus.selectedHouseFormStatus).toEqual(houseOneStatus.houseFormsById[houseOne.id]);
    expect(houseOneStatus.selectedHouseFormStatus).toMatchObject({
      footprintPreset: 'straight',
      roofForm: 'mono',
    });
    expect(houseTwoStatus.selectedHouseFormId).toBe(houseTwo.id);
    expect(houseTwoStatus.selectedHouseFormStatus).toEqual(houseTwoStatus.houseFormsById[houseTwo.id]);
    expect(houseTwoStatus.selectedHouseFormStatus).toMatchObject({
      footprintPreset: 'wrap_right',
      roofForm: 'hipped',
    });
  });
});
