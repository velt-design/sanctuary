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
      'pricing-basis',
      'connections-site',
      'structure',
      'flashings',
      'overrides',
      'lighting',
      'blinds',
      'infills',
      'allowances',
    ]);
  });

  it('preserves section order while filtering absent fields', () => {
    const sections = buildCalculatorConfigurationSections(
      [
        field('project-context'),
        field('houseConnectionType'),
        field('lengthM'),
        field('flashings'),
        field('lightingEditor'),
        field('blindsList'),
        field('infillsEditor'),
      ],
    );

    expect(sections.map((section) => section.id)).toEqual([
      'context',
      'connections-site',
      'structure',
      'flashings',
      'lighting',
      'blinds',
      'infills',
    ]);
    expect(sections.flatMap((section) => section.fields.map((item) => item.id))).toEqual([
      'project-context',
      'houseConnectionType',
      'lengthM',
      'flashings',
      'lightingEditor',
      'blindsList',
      'infillsEditor',
    ]);
  });

  it('adds specialist disclosures without inventing missing controls or legacy footprint fields', () => {
    const sections = buildCalculatorConfigurationSections(
      [field('flashings'), field('ledgerProfileOverride'), field('houseFootprintPreset')],
    );

    expect(sections.map((section) => section.id)).toEqual(['flashings', 'overrides']);
    expect(sections.every((section) => section.collapsible)).toBe(true);
  });

  it('assigns standard, wide, and full presentation spans', () => {
    expect(calculatorConfigurationFieldLayout('lengthM')).toBe('standard');
    expect(calculatorConfigurationFieldLayout('timberNoteRafters')).toBe('wide');
    expect(calculatorConfigurationFieldLayout('flashings')).toBe('full');
    expect(calculatorConfigurationFieldLayout('lightingEditor')).toBe('full');
    expect(calculatorConfigurationFieldLayout('blindsList')).toBe('full');
    expect(calculatorConfigurationFieldLayout('infillsEditor')).toBe('full');
  });

});
