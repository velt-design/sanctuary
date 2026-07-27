import type { RafterCutLengthExplanationV1 } from '@sp/costing';
import { afterEach, describe, expect, it } from 'vitest';

import { renderIntoDocument } from '../../../../../test/reactHarness';
import CalculatorRafterExplanation from './CalculatorRafterExplanation';

function explanation(
  overrides: Partial<RafterCutLengthExplanationV1> = {},
): RafterCutLengthExplanationV1 {
  return {
    version: 1,
    status: 'ready',
    source: '@sp/costing/engine/rafter-takeoff-v1',
    roof_type: 'pitched',
    entered_span_m: 3,
    pitch_deg_used: 30,
    rafter_profile: '150x50',
    rafter_count: 6,
    formula: 'cut length = effective projected run / cos(pitch) + angle-cut allowance',
    rounding: {
      display_increment_mm: 1,
      method: 'nearest',
      engine_values: 'unrounded',
    },
    planes: [
      {
        id: 'single',
        label: 'Rafter',
        diagram_side: 'single',
        base_projected_run_m: 3,
        deductions: [
          { id: 'house_edge', label: 'House-edge allowance', value_m: 0.05 },
          { id: 'outer_edge', label: 'Outer-edge allowance', value_m: 0.1 },
        ],
        effective_projected_run_m: 2.85,
        sloped_length_before_allowance_m: 3.291,
        angle_cut_allowance_m: 0.0866,
        cut_length_m: 3.3776,
      },
    ],
    assumptions: [
      'Displayed values round to the nearest millimetre; costing retains the unrounded metre values.',
    ],
    ...overrides,
  };
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('CalculatorRafterExplanation', () => {
  it('shows the authoritative input-to-result chain and explicit source and rounding', () => {
    renderIntoDocument(
      <CalculatorRafterExplanation
        moduleLabel="Pergola 1 / Module 2"
        explanation={explanation()}
        resultFreshness="current"
      />,
    );

    const card = document.querySelector('[aria-label="Rafter cut length workings"]');
    expect(card?.getAttribute('data-rafter-explanation-status')).toBe('ready');
    expect(card?.getAttribute('data-result-freshness')).toBe('current');
    expect(document.body.textContent).toContain('Pergola 1 / Module 2');
    expect(document.body.textContent).toContain('Entered roof span');
    expect(document.body.textContent).toContain('Effective projected run');
    expect(document.body.textContent).toContain('Pitch adjustment at 30.0 deg');
    expect(document.body.textContent).toContain('angle-cut allowance');
    expect(document.body.textContent).toContain('3,378 mm');
    expect(document.body.textContent).toContain('Rounding: nearest 1 mm');
    expect(document.body.textContent).toContain('@sp/costing/engine/rafter-takeoff-v1');
    expect(
      document.querySelector('[data-rafter-plane="single"]')?.getAttribute('data-rafter-cut-length-mm'),
    ).toBe('3378');
  });

  it('warns that retained inputs may differ when the result is stale or invalid', () => {
    renderIntoDocument(
      <CalculatorRafterExplanation
        moduleLabel="Pergola 1 / Module 1"
        explanation={explanation()}
        resultFreshness="invalid"
      />,
    );

    expect(document.body.textContent).toContain('Last valid result');
    expect(document.body.textContent).toContain(
      'may not match unsaved edits',
    );
  });

  it('keeps distinct gable plane results rather than hiding them behind one average', () => {
    const gable = explanation({
      roof_type: 'gable',
      entered_span_m: 5.55,
      planes: [
        {
          id: 'house',
          label: 'House-side rafter',
          diagram_side: 'left',
          base_projected_run_m: 2.775,
          deductions: [
            { id: 'ridge', label: 'Half ridge width', value_m: 0.025 },
            { id: 'house_edge', label: 'House-side eave allowance', value_m: 0.05 },
          ],
          effective_projected_run_m: 2.7,
          sloped_length_before_allowance_m: 3.118,
          angle_cut_allowance_m: 0.0866,
          cut_length_m: 3.2046,
        },
        {
          id: 'outer',
          label: 'Outer-side rafter',
          diagram_side: 'right',
          base_projected_run_m: 2.775,
          deductions: [
            { id: 'ridge', label: 'Half ridge width', value_m: 0.025 },
            { id: 'outer_edge', label: 'Outer-side eave allowance', value_m: 0.1 },
          ],
          effective_projected_run_m: 2.65,
          sloped_length_before_allowance_m: 3.06,
          angle_cut_allowance_m: 0.0866,
          cut_length_m: 3.1466,
        },
      ],
    });
    renderIntoDocument(
      <CalculatorRafterExplanation
        moduleLabel="Pergola 2 / Module 1"
        explanation={gable}
        resultFreshness="current"
      />,
    );

    expect(document.querySelectorAll('[data-rafter-plane]')).toHaveLength(2);
    expect(document.body.textContent).toContain('House-side rafter');
    expect(document.body.textContent).toContain('Outer-side rafter');
    expect(document.body.textContent).toContain('3,205 mm');
    expect(document.body.textContent).toContain('3,147 mm');
  });

  it('fails closed for unsupported roofs instead of presenting inferred workings', () => {
    renderIntoDocument(
      <CalculatorRafterExplanation
        moduleLabel="Pergola 1 / Module 1"
        explanation={explanation({
          status: 'unsupported_roof',
          roof_type: 'hip_corner',
          planes: [],
          unavailable_reason: 'Hip-corner modules require a two-wing explanation.',
        })}
        resultFreshness="current"
      />,
    );

    expect(document.body.textContent).toContain('Authoritative explanation unavailable');
    expect(document.body.textContent).toContain('two-wing explanation');
    expect(document.body.textContent).not.toContain('Final cut length');
  });
});
