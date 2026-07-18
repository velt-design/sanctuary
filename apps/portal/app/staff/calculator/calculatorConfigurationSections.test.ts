import { describe, expect, it } from 'vitest';

import {
  CALCULATOR_CONFIGURATION_SECTIONS,
  buildCalculatorConfigurationSections,
  calculatorConfigurationFieldLayout,
  type CalculatorConfigurationField,
} from './calculatorConfigurationSections';

function field(id: string): CalculatorConfigurationField {
  return { id, label: id, type: 'text', value: '' };
}

describe('calculator configuration sections', () => {
  it('keeps every configured field id in one ordered section', () => {
    const ids = CALCULATOR_CONFIGURATION_SECTIONS.flatMap((section) => section.fieldIds);
    expect(new Set(ids).size).toBe(ids.length);
    expect(CALCULATOR_CONFIGURATION_SECTIONS.map((section) => section.id)).toEqual([
      'context',
      'connections-site',
      'structure',
      'flashings',
      'overrides',
      'blinds',
      'infills',
      'allowances',
      'house-footprint',
    ]);
  });

  it('preserves Basic order while filtering absent and Advanced-only fields', () => {
    const sections = buildCalculatorConfigurationSections(
      [
        field('project-context'),
        field('houseConnectionType'),
        field('lengthM'),
        field('flashings'),
        field('blindsList'),
        field('infillsEditor'),
      ],
      false,
    );

    expect(sections.map((section) => section.id)).toEqual([
      'context',
      'connections-site',
      'structure',
      'blinds',
      'infills',
    ]);
    expect(sections.flatMap((section) => section.fields.map((item) => item.id))).toEqual([
      'project-context',
      'houseConnectionType',
      'lengthM',
      'blindsList',
      'infillsEditor',
    ]);
  });

  it('adds existing Advanced fields without inventing missing controls', () => {
    const sections = buildCalculatorConfigurationSections(
      [field('flashings'), field('ledgerProfileOverride'), field('houseFootprintPreset')],
      true,
    );

    expect(sections.map((section) => section.id)).toEqual(['flashings', 'overrides', 'house-footprint']);
  });

  it('assigns standard, wide, and full presentation spans', () => {
    expect(calculatorConfigurationFieldLayout('lengthM')).toBe('standard');
    expect(calculatorConfigurationFieldLayout('timberNoteRafters')).toBe('wide');
    expect(calculatorConfigurationFieldLayout('flashings')).toBe('full');
    expect(calculatorConfigurationFieldLayout('blindsList')).toBe('full');
    expect(calculatorConfigurationFieldLayout('infillsEditor')).toBe('full');
  });
});
