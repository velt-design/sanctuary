import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { renderIntoDocument } from '../../../../../test/reactHarness';
import CalculatorConfigurationForm from './CalculatorConfigurationForm';
import type { CalculatorConfigurationField } from './calculatorConfigurationSections';

afterEach(() => {
  document.body.innerHTML = '';
});

describe('CalculatorConfigurationForm', () => {
  it('renders existing Basic sections, flat field appearance, and working controls', () => {
    const onChange = vi.fn();
    const fields: CalculatorConfigurationField[] = [
      { id: 'project-context', label: 'Project', type: 'readOnly', value: 'Agent Project' },
      {
        id: 'houseConnectionType',
        label: 'House connection',
        type: 'select',
        value: 'soffit',
        options: [
          { label: 'Soffit', value: 'soffit' },
          { label: 'Fascia', value: 'fascia' },
        ],
        onChange,
      },
      {
        id: 'lengthM',
        label: 'Roof Length (m)',
        type: 'number',
        value: 'invalid',
        error: 'Enter a valid roof length between the supported limits.',
      },
      { id: 'roofOrientation', label: 'Orientation', type: 'custom', content: <span>Diagram</span> },
      { id: 'blindsList', label: 'Blinds', type: 'custom', content: <button type="button">Configure</button> },
      { id: 'flashings', label: 'Flashings', type: 'custom', content: <span>Advanced content</span> },
    ];

    renderIntoDocument(<CalculatorConfigurationForm fields={fields} isAdvancedUi={false} />);

    expect(document.querySelector('[data-calculator-configuration-section="context"]')).not.toBeNull();
    expect(document.querySelector('[data-calculator-configuration-section="connections-site"]')).not.toBeNull();
    expect(document.querySelector('[data-calculator-configuration-section="structure"]')).not.toBeNull();
    expect(document.querySelector('[data-calculator-configuration-section="add-ons"]')).not.toBeNull();
    expect(document.querySelector('[aria-label="Flashings"]')).toBeNull();
    expect(document.querySelector('[data-calculator-field="roofOrientation"]')?.getAttribute('data-field-layout')).toBe('wide');
    expect(document.querySelector('[data-calculator-field="blindsList"]')?.getAttribute('data-field-layout')).toBe('full');
    expect(document.querySelector('[data-field-tile-appearance="configuration"]')).not.toBeNull();

    const lengthInput = document.querySelector('#lengthM') as HTMLInputElement;
    expect(lengthInput.getAttribute('aria-describedby')).toBe('lengthM-error');
    expect(document.querySelector('[data-field-part="error"]')?.textContent).toBe(
      'Enter a valid roof length between the supported limits.',
    );

    const select = document.querySelector('#houseConnectionType') as HTMLSelectElement;
    act(() => {
      select.value = 'fascia';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(onChange).toHaveBeenCalledWith('fascia');
  });

  it('renders Advanced sections in the existing order with full-width specialist fields', () => {
    const fields: CalculatorConfigurationField[] = [
      { id: 'lengthM', label: 'Length', type: 'number', value: '6' },
      { id: 'flashings', label: 'Flashings', type: 'custom', content: <span>Flashing editor</span> },
      { id: 'ledgerProfileOverride', label: 'Ledger profile', type: 'select', value: '', options: [] },
      { id: 'houseFootprintPreset', label: 'Footprint', type: 'select', value: 'rectangle', options: [] },
    ];

    renderIntoDocument(<CalculatorConfigurationForm fields={fields} isAdvancedUi />);

    expect(
      Array.from(document.querySelectorAll('[data-calculator-configuration-section]')).map((section) =>
        section.getAttribute('data-calculator-configuration-section'),
      ),
    ).toEqual(['structure', 'flashings', 'overrides', 'house-footprint']);
    expect(document.querySelector('[data-calculator-field="flashings"]')?.getAttribute('data-field-layout')).toBe('full');
  });
});
