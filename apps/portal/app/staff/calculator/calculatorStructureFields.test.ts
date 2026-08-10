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

function buildFields(
  moduleOverrides: Partial<CalculatorModuleInputs> = {},
  inputOverrides: Partial<CalculatorInputs> = {},
) {
  const activeModule = makeDefaultModule('pergola-1');
  Object.assign(activeModule, moduleOverrides);

  let values: CalculatorInputs = {
    ...makeDefaultCalculatorInputs(),
    ...inputOverrides,
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
    resolvedDefaults: { roofPitchDeg: 'Auto - current result uses 5 deg' },
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
    expect(fieldById(fields, 'roofPitchDeg')).toMatchObject({
      value: '',
      resolvedDefaultText: 'Auto - current result uses 5 deg',
    });
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

  it('selects and presents an open pergola with fixed frame rules', () => {
    const selection = buildFields({
      pergolaStyle: 'gable',
      boxPerimeterEnabled: true,
      roofPitchDeg: '25',
      overhangEnabled: true,
      invertedEnabled: true,
      downpipeCount: '2',
      flashings: { rows: [{ id: 'extra-1', kind: 'extra', band: '301-400', lengthM: '2' }] },
    }, { pricingClassification: 'simple' });
    fieldById(selection.fields, 'roofMaterial').onChange?.('none');

    expect(selection.values().modules[0]).toMatchObject({
      roofMaterial: 'none',
      pergolaStyle: 'pitched',
      boxPerimeterEnabled: false,
      roofPitchDeg: '0',
      rafterSpacingMm: '500',
      overhangEnabled: false,
      invertedEnabled: false,
      downpipeCount: '0',
      flashings: { rows: [] },
      overrides: {
        ledgerProfile: '150x50',
        rafterProfile: '150x50',
        frontBeamProfile: '150x50',
      },
    });
    expect(selection.values().pricingClassification).toBe('simple');

    const open = buildFields({
      roofMaterial: 'none',
      rafterSpacingMm: '725',
      overrides: {
        ledgerProfile: '100x50',
        rafterProfile: '80x50',
        frontBeamProfile: '200x50',
      },
    });
    const ids = open.fields.map((field) => field.id);
    expect(fieldById(open.fields, 'rafterSpacingMm')).toMatchObject({ value: '725', min: 1, step: 1 });
    expect(fieldById(open.fields, 'pergolaStyle').disabled).toBe(true);
    expect(fieldById(open.fields, 'roofPitchDeg')).toMatchObject({ value: '0', disabled: true });
    const expectedOpenProfiles = ['50x50', '80x50', '100x50', '150x50', '200x50', '250x50', '300x50'];
    expect(fieldById(open.fields, 'ledgerProfileOverride')).toMatchObject({ value: '100x50' });
    expect(fieldById(open.fields, 'rafterProfileOverride')).toMatchObject({ value: '80x50' });
    expect(fieldById(open.fields, 'frontBeamProfileOverride')).toMatchObject({ value: '200x50' });
    for (const fieldId of ['ledgerProfileOverride', 'rafterProfileOverride', 'frontBeamProfileOverride']) {
      const field = fieldById(open.fields, fieldId);
      expect(field.disabled).not.toBe(true);
      expect(field.options?.map((option) => option.value)).toEqual(expectedOpenProfiles);
    }
    expect(ids).not.toEqual(expect.arrayContaining(['flashings', 'overhangEnabled', 'invertedEnabled', 'separateGutterEnabled']));
  });

  it('returns the standard 6m x 3m module to its exact roofed defaults after Open', () => {
    const selection = buildFields();
    const before = selection.values().modules[0];
    const roofMaterial = fieldById(selection.fields, 'roofMaterial');

    roofMaterial.onChange?.('none');
    expect(selection.values().modules[0]).not.toEqual(before);

    roofMaterial.onChange?.('acrylic');
    expect(selection.values().modules[0]).toEqual(before);
  });

  it.each(['acrylic', 'timber', 'mixed'] as const)(
    'applies roofed defaults while preserving job context when Open changes to %s',
    (roofMaterialValue) => {
      const selection = buildFields({
        roofMaterial: 'none',
        lengthM: '7.2',
        projectionM: '3.4',
        postCount: '6',
        extrusionColour: 'White',
        roofPitchDeg: '0',
        flashings: { rows: [] },
        overrides: {
          ledgerProfile: '150x50',
          rafterProfile: '150x50',
          frontBeamProfile: '150x50',
          postProfile: '100x100',
        },
      });

      fieldById(selection.fields, 'roofMaterial').onChange?.(roofMaterialValue);

      expect(selection.values().modules[0]).toMatchObject({
        roofMaterial: roofMaterialValue,
        pergolaStyle: 'pitched',
        lengthM: '7.2',
        projectionM: '3.4',
        postCount: '6',
        extrusionColour: 'White',
        roofPitchDeg: '',
        flashings: {
          rows: [expect.objectContaining({ kind: 'primary', band: '201-300', lengthM: '7.2' })],
        },
        overrides: { postProfile: '100x100' },
      });
      if (roofMaterialValue === 'mixed') {
        expect(selection.values().modules[0].mixedAcrylicBaysMain).not.toBe('');
      }
    },
  );

  it('delegates ordinary fields and overrides to their existing setters', () => {
    const { fields, setModuleField, setModuleOverride } = buildFields();

    fieldById(fields, 'lengthM').onChange?.('6.2');
    fieldById(fields, 'rafterProfileOverride').onChange?.('150x50');

    expect(setModuleField).toHaveBeenCalledWith('lengthM', '6.2');
    expect(setModuleOverride).toHaveBeenCalledWith('rafterProfile', '150x50');
  });
});
