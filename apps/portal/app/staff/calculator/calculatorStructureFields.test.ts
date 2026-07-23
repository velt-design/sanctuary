import type { Dispatch, SetStateAction } from 'react';
import { describe, expect, it, vi } from 'vitest';

import type { CalculatorInputs, CalculatorModuleInputs } from '@/lib/types/calculator';
import type { CalculatorConfigurationField } from './calculatorConfigurationSections';
import { makeDefaultCalculatorInputs, makeDefaultModule } from './calculatorInputs';
import {
  buildCalculatorStructureFields,
  type CalculatorStructureFieldBuilderInput,
} from './calculatorStructureFields';

function fieldById(fields: readonly CalculatorConfigurationField[], id: string): CalculatorConfigurationField {
  const field = fields.find((candidate) => candidate.id === id);
  if (!field) throw new Error(`Missing calculator structure field: ${id}`);
  return field;
}

function buildFields(moduleOverrides: Partial<CalculatorModuleInputs> = {}) {
  const activeModule = makeDefaultModule('pergola-1');
  Object.assign(activeModule, moduleOverrides);

  let values: CalculatorInputs = {
    ...makeDefaultCalculatorInputs(),
    modules: [activeModule],
  };
  const setValues: Dispatch<SetStateAction<CalculatorInputs>> = (action) => {
    values = typeof action === 'function' ? action(values) : action;
  };
  const setModuleField = vi.fn() as unknown as CalculatorStructureFieldBuilderInput['setModuleField'];
  const setModuleOverride = vi.fn() as unknown as CalculatorStructureFieldBuilderInput['setModuleOverride'];
  const fields = buildCalculatorStructureFields({
    activeModule,
    activeModuleIndex: 0,
    activePergolaId: 'pergola-1',
    errors: {},
    flashingTileContent: null,
    setValues,
    setModuleField,
    setModuleOverride,
  });

  return {
    fields,
    setModuleField,
    setModuleOverride,
    values: () => values,
  };
}

describe('calculator structure fields', () => {
  it('builds the established core structure and override fields', () => {
    const { fields } = buildFields();
    const ids = fields.map((field) => field.id);

    expect(ids).toEqual(expect.arrayContaining([
      'pergolaStyle',
      'boxPerimeterEnabled',
      'roofMaterial',
      'extrusionColour',
      'lengthM',
      'projectionM',
      'roofPitchDeg',
      'flashings',
      'ledgerProfileOverride',
      'rafterProfileOverride',
      'postProfileOverride',
      'postCutHeightM',
      'postCount',
    ]));
    expect(ids).not.toContain('hipCornerLengthBM');
    expect(ids).not.toContain('timberRoofAboveType');
  });

  it('builds gable-only controls and calculated hint fields without changing field order', () => {
    const { fields } = buildFields({
      pergolaStyle: 'gable',
      houseConnectionType: 'none',
      projectionM: '4',
      roofPitchDeg: '0',
    });
    const ids = fields.map((field) => field.id);

    expect(ids.indexOf('gableEndFramesMode')).toBeGreaterThan(ids.indexOf('flashings'));
    expect(fieldById(fields, 'gableHouseEdgeGutter').options).toEqual([
      { label: 'Our gutter (SP)', value: 'our' },
    ]);
    expect(fieldById(fields, 'perSideSpanM').value).toBe('2.00');
    expect(fieldById(fields, 'slopedLengthPerSideM').value).toBe('2.00 (at 0°)');
  });

  it('preserves pergola-style and mixed-roof field mutations', () => {
    const style = buildFields({ boxPerimeterEnabled: true });
    style.fields.find((field) => field.id === 'pergolaStyle')?.onChange?.('hip_corner');
    expect(style.values().modules[0].pergolaStyle).toBe('hip_corner');
    expect(style.values().modules[0].boxPerimeterEnabled).toBe(false);

    const material = buildFields({ roofMaterial: 'acrylic', mixedAcrylicBaysMain: '' });
    material.fields.find((field) => field.id === 'roofMaterial')?.onChange?.('mixed');
    expect(material.values().modules[0].roofMaterial).toBe('mixed');
    expect(material.values().modules[0].mixedAcrylicBaysMain).not.toBe('');
  });

  it('delegates ordinary fields and overrides to their existing setters', () => {
    const { fields, setModuleField, setModuleOverride } = buildFields();

    fieldById(fields, 'lengthM').onChange?.('6.2');
    fieldById(fields, 'rafterProfileOverride').onChange?.('150x50');

    expect(setModuleField).toHaveBeenCalledWith('lengthM', '6.2');
    expect(setModuleOverride).toHaveBeenCalledWith('rafterProfile', '150x50');
  });
});
