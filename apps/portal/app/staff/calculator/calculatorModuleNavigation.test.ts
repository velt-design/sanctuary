import { describe, expect, it } from 'vitest';
import type { CalculatorInputs, CalculatorModuleInputs } from '@/lib/types/calculator';
import { makeDefaultCalculatorInputs, makeDefaultModule, makeInfillId } from './calculatorInputs';
import { makeFlashingId } from './calculatorFlashings';
import {
  addCalculatorModule,
  addCalculatorPergola,
  buildCalculatorModuleNavigatorModel,
  calculatorIssueCountLabel,
  calculatorModuleCountLabel,
  duplicateCalculatorModule,
  moveCalculatorModule,
  removeCalculatorModule,
  renameCalculatorPergola,
} from './calculatorModuleNavigation';

function makeInputs(): CalculatorInputs {
  const base = makeDefaultCalculatorInputs();
  return {
    ...base,
    pergolas: [
      { id: 'pergola-1', label: 'Pergola 1' },
      { id: 'pergola-2', label: 'Pergola 2' },
    ],
    modules: [
      { ...makeDefaultModule('pergola-1'), lengthM: '6', projectionM: '3' },
      { ...makeDefaultModule('pergola-1'), pergolaStyle: 'gable', lengthM: '4.8', projectionM: '3.2' },
      { ...makeDefaultModule('pergola-2'), pergolaStyle: 'hip_corner', lengthM: '5.4', projectionM: '3.6', hipCornerLengthBM: '2.4', hipCornerProjectionBM: '2.1' },
    ],
  };
}

describe('calculatorModuleNavigation', () => {
  it('uses correct issue-count grammar', () => {
    expect(calculatorIssueCountLabel(0)).toBe('0 issues');
    expect(calculatorIssueCountLabel(1)).toBe('1 issue');
    expect(calculatorIssueCountLabel(2)).toBe('2 issues');
  });

  it('uses correct module-count grammar', () => {
    expect(calculatorModuleCountLabel(0)).toBe('0 modules');
    expect(calculatorModuleCountLabel(1)).toBe('1 module');
    expect(calculatorModuleCountLabel(2)).toBe('2 modules');
  });

  it('groups modules by pergola with canonical local labels, summaries, active state, and issue counts', () => {
    const values = makeInputs();
    values.modules[0] = { ...values.modules[0], boxPerimeterEnabled: true };
    const errors: Array<Partial<Record<keyof CalculatorModuleInputs, string>>> = [
      {},
      { lengthM: 'Required', projectionM: 'Required' },
      {},
    ];
    const model = buildCalculatorModuleNavigatorModel({ values, activeModuleIndex: 2, errorsByModule: errors });

    expect(model.groups.map((group) => [group.label, group.items.map((item) => item.label)])).toEqual([
      ['Pergola 1', ['Pergola 1 · Module 1', 'Pergola 1 · Module 2']],
      ['Pergola 2', ['Pergola 2 · Module 1']],
    ]);
    expect(model.items[1]).toMatchObject({ styleLabel: 'Gable', dimensionsLabel: '4.8m × 3.2m', issueCount: 2 });
    expect(model.items[0].styleLabel).toBe('Pitched + box perimeter');
    expect(model.items[2]).toMatchObject({
      dimensionsLabel: 'A 5.4m × 3.6m · B 2.4m × 2.1m',
      isActive: true,
    });
    expect(model.activeModuleLabel).toBe('Pergola 2 · Module 1');
    expect(model.totalIssueCount).toBe(2);
  });

  it('retains empty pergolas in the navigator model', () => {
    const values = makeInputs();
    values.modules = values.modules.filter((module) => module.pergolaId === 'pergola-1');
    const model = buildCalculatorModuleNavigatorModel({ values, activeModuleIndex: 0, errorsByModule: [] });
    expect(model.groups[1]).toEqual({ pergolaId: 'pergola-2', label: 'Pergola 2', items: [] });
  });

  it('adds a fresh default module to the requested pergola and selects it', () => {
    const values = makeInputs();
    values.modules[0] = { ...values.modules[0], lengthM: '9.9', pergolaStyle: 'gable' };
    const result = addCalculatorModule(values, 0, 'pergola-2');
    const added = result.values.modules.at(-1);
    expect(result.activeModuleIndex).toBe(3);
    expect(added).toMatchObject({ pergolaId: 'pergola-2', lengthM: '6', projectionM: '3', pergolaStyle: 'pitched' });
  });

  it('adds a new pergola with a fresh starter module and selects it', () => {
    const result = addCalculatorPergola(makeInputs(), 0);
    expect(result.values.pergolas?.at(-1)).toEqual({
      id: 'pergola-3',
      label: 'Pergola 3',
      lighting: { lightCount: '0', dimmer: false },
    });
    expect(result.values.modules.at(-1)).toMatchObject({ pergolaId: 'pergola-3', lengthM: '6', projectionM: '3' });
    expect(result.activeModuleIndex).toBe(3);
  });

  it('renames a pergola without changing its stable id or module assignment', () => {
    const values = makeInputs();
    const result = renameCalculatorPergola(values, 'pergola-2', 'Pool cover');

    expect(result.pergolas).toContainEqual({ id: 'pergola-2', label: 'Pool cover' });
    expect(result.modules[2].pergolaId).toBe('pergola-2');
    expect(buildCalculatorModuleNavigatorModel({
      values: result,
      activeModuleIndex: 2,
      errorsByModule: [{}, {}, {}],
    }).activeModuleLabel).toBe('Pool cover · Module 1');
  });

  it('deep-duplicates a module, regenerates nested ids, and selects the copy', () => {
    const values = makeInputs();
    values.modules[0] = {
      ...values.modules[0],
      lengthM: '7.25',
      flashings: { rows: [{ id: makeFlashingId(), kind: 'extra', band: '0-200', lengthM: '1' }] },
      additionalAluminium: {
        rows: [{ id: 'extra-bar-1', profile: '150x50', stockLengthM: '6', quantity: '2' }],
      },
      infills: {
        items: [{
          id: makeInfillId(),
          label: 'Test infill',
          location: 'side',
          qty: '1',
          acrylicSource: 'sheet_panels',
          panelOrientation: 'vertical',
          widthMode: 'target_width',
          targetPanelWidthM: '0.62',
          maxPanelWidthM: '0.62',
          support: { hasTop: true, hasBottom: true, hasLeft: true, hasRight: true },
          shape: { type: 'rect', widthM: '2', heightM: '1' },
        }],
      },
    };
    const result = duplicateCalculatorModule(values, 0, 0);
    const source = result.values.modules[0];
    const duplicate = result.values.modules.at(-1);

    expect(result.activeModuleIndex).toBe(3);
    expect(duplicate).toMatchObject({ pergolaId: 'pergola-1', lengthM: '7.25' });
    expect(duplicate).not.toBe(source);
    expect(duplicate?.flashings).not.toBe(source.flashings);
    expect(duplicate?.flashings?.rows[0].id).not.toBe(source.flashings?.rows[0].id);
    expect(duplicate?.additionalAluminium).not.toBe(source.additionalAluminium);
    expect(duplicate?.additionalAluminium?.rows[0].id).not.toBe(source.additionalAluminium?.rows[0].id);
    expect(duplicate?.infills).not.toBe(source.infills);
    expect(duplicate?.infills?.items[0].id).not.toBe(source.infills?.items[0].id);
  });

  it('moves a module without reordering or deleting an emptied pergola', () => {
    const values = makeInputs();
    const before = values.modules.slice();
    const result = moveCalculatorModule(values, 2, 2, 'pergola-1');
    expect(result.values.modules.map((module) => module.lengthM)).toEqual(before.map((module) => module.lengthM));
    expect(result.values.modules[2].pergolaId).toBe('pergola-1');
    expect(result.values.pergolas).toContainEqual({ id: 'pergola-2', label: 'Pergola 2' });
    expect(result.activeModuleIndex).toBe(2);
  });

  it('removes a module, prunes an emptied pergola, and chooses the nearest remaining module', () => {
    const result = removeCalculatorModule(makeInputs(), 2, 2);
    expect(result.values.modules).toHaveLength(2);
    expect(result.values.pergolas).toEqual([{ id: 'pergola-1', label: 'Pergola 1' }]);
    expect(result.activeModuleIndex).toBe(1);
  });

  it('adjusts active selection when removing an earlier inactive module', () => {
    const result = removeCalculatorModule(makeInputs(), 2, 0);
    expect(result.activeModuleIndex).toBe(1);
    expect(result.values.modules[1].pergolaId).toBe('pergola-2');
  });

  it('prevents removal of the final module', () => {
    const values = makeDefaultCalculatorInputs();
    const result = removeCalculatorModule(values, 0, 0);
    expect(result.values).toBe(values);
    expect(result.activeModuleIndex).toBe(0);
  });
});
