import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { renderIntoDocument } from '../../../../../test/reactHarness';
import CalculatorLightingEditor from './CalculatorLightingEditor';
import { makeDefaultCalculatorInputs } from './calculatorInputs';
import {
  buildCalculatorLightingUi,
  updateCalculatorPergolaLighting,
} from './calculatorLightingUi';

afterEach(() => {
  document.body.innerHTML = '';
});

describe('CalculatorLightingEditor', () => {
  it('shows the per-pergola driver and GST-inclusive price breakdown', () => {
    const values = updateCalculatorPergolaLighting(
      makeDefaultCalculatorInputs(),
      'pergola-1',
      { lightCount: '17', dimmer: false },
    );
    const onChange = vi.fn();
    const ui = buildCalculatorLightingUi(values, 'pergola-1');

    renderIntoDocument(<CalculatorLightingEditor ui={ui} onChange={onChange} />);

    expect(document.body.textContent).toContain('17 lights · 2 drivers');
    expect(document.body.textContent).toContain('1 × additional drivers');
    expect(document.body.textContent).toContain('$4,530.00');

    const dimmer = document.querySelector<HTMLInputElement>('#lighting-pergola-1-dimmer');
    act(() => {
      dimmer?.click();
    });
    expect(onChange).toHaveBeenCalledWith({ dimmer: true });
  });

  it('keeps configured lighting visible and blocking after acrylic eligibility is removed', () => {
    let values = updateCalculatorPergolaLighting(
      makeDefaultCalculatorInputs(),
      'pergola-1',
      { lightCount: '4' },
    );
    values = {
      ...values,
      modules: values.modules.map((module) => ({ ...module, roofMaterial: 'timber' })),
    };
    const ui = buildCalculatorLightingUi(values, 'pergola-1');

    expect(ui.visible).toBe(true);
    expect(ui.eligible).toBe(false);
    expect(ui.pricing.errors).toHaveLength(1);
  });
});
