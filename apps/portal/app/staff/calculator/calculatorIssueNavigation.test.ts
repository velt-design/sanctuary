import { describe, expect, it } from 'vitest';

import {
  buildCalculatorIssues,
  calculatorIssueSectionId,
  labelForCalculatorIssueField,
} from './calculatorIssueNavigation';

describe('calculator issue navigation', () => {
  it('maps rendered fields to their configuration section owner', () => {
    expect(calculatorIssueSectionId('lengthM')).toBe('structure');
    expect(calculatorIssueSectionId('flashings')).toBe('flashings');
    expect(calculatorIssueSectionId('ledgerProfileOverride')).toBe('overrides');
    expect(calculatorIssueSectionId('houseFootprintPreset')).toBe('house-footprint');
    expect(calculatorIssueSectionId('fallDistanceMm')).toBeNull();
  });

  it('preserves the established issue labels and unknown-field fallback', () => {
    expect(labelForCalculatorIssueField('projectionM')).toBe('Roof Span (Eave‑to‑Eave) (m)');
    expect(labelForCalculatorIssueField('powdercoatCustomColour')).toBe('Custom powdercoat colour');
    expect(labelForCalculatorIssueField('futureField')).toBe('futureField');
  });

  it('builds issues in the existing module and field order', () => {
    expect(
      buildCalculatorIssues({
        errorsByModule: [
          { lengthM: 'Length is required.', projectionM: undefined },
          { flashings: 'Check flashing lengths.', roofPitchDeg: 'Pitch is required.' },
        ],
        moduleLabels: ['Pergola 1 · Module 1'],
      }),
    ).toEqual([
      {
        moduleIndex: 0,
        moduleLabel: 'Pergola 1 · Module 1',
        fieldId: 'lengthM',
        sectionId: 'structure',
        label: 'Roof Length (m)',
        message: 'Length is required.',
      },
      {
        moduleIndex: 1,
        moduleLabel: 'Module 2',
        fieldId: 'flashings',
        sectionId: 'flashings',
        label: 'Flashings',
        message: 'Check flashing lengths.',
      },
      {
        moduleIndex: 1,
        moduleLabel: 'Module 2',
        fieldId: 'roofPitchDeg',
        sectionId: 'structure',
        label: 'Roof pitch (deg)',
        message: 'Pitch is required.',
      },
    ]);
  });
});
