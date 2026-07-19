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
      { id: 'blindsList', label: 'Blinds', type: 'custom', content: <button type="button">Configure</button> },
      { id: 'infillsEditor', label: 'Infills', type: 'custom', content: <button type="button">Edit infills</button> },
      { id: 'flashings', label: 'Flashings', type: 'custom', content: <span>Advanced content</span> },
    ];

    renderIntoDocument(<CalculatorConfigurationForm fields={fields} isAdvancedUi={false} />);

    expect(document.querySelector('[data-calculator-configuration-section="context"]')?.getAttribute('data-section-density')).toBe('compact');
    expect(document.querySelector('#project-context')?.textContent).toBe('Agent Project');
    expect(document.querySelector('[data-calculator-configuration-section="connections-site"]')).not.toBeNull();
    expect(document.querySelector('[data-calculator-configuration-section="structure"]')).not.toBeNull();
    const blindsSection = document.querySelector('[data-calculator-configuration-section="blinds"]');
    const infillsSection = document.querySelector('[data-calculator-configuration-section="infills"]');
    expect(blindsSection?.getAttribute('aria-label')).toBe('Blinds');
    expect(infillsSection?.getAttribute('aria-label')).toBe('Infills');
    expect(blindsSection?.getAttribute('data-section-surface')).toBe('card');
    expect(infillsSection?.getAttribute('data-section-surface')).toBe('card');
    expect(document.querySelectorAll('[data-calculator-configuration-sheet]')).toHaveLength(1);
    expect(document.querySelector('[data-calculator-configuration-section="context"]')?.parentElement?.hasAttribute('data-calculator-configuration-sheet')).toBe(true);
    expect(blindsSection?.querySelector('h2')).toBeNull();
    expect(infillsSection?.querySelector('h2')).toBeNull();
    expect(blindsSection?.querySelector('[data-field-part="label"]')?.textContent).toBe('Blinds');
    expect(infillsSection?.querySelector('[data-field-part="label"]')?.textContent).toBe('Infills');
    expect(document.querySelector('[aria-label="Flashings"]')).toBeNull();
    expect(document.querySelector('[data-calculator-field="roofOrientation"]')).toBeNull();
    expect(document.querySelector('[data-calculator-field="blindsList"]')?.getAttribute('data-field-layout')).toBe('full');
    expect(document.querySelector('[data-field-tile-appearance="configuration"]')).not.toBeNull();
    expect(document.querySelector('[data-field-part="toggle"]')).toBeNull();

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
      { id: 'blindsList', label: 'Blinds', type: 'custom', content: <span>Blind editor</span> },
      { id: 'infillsEditor', label: 'Infills', type: 'custom', content: <span>Infill editor</span> },
      { id: 'houseFootprintPreset', label: 'Footprint', type: 'select', value: 'rectangle', options: [] },
    ];

    renderIntoDocument(<CalculatorConfigurationForm fields={fields} isAdvancedUi />);

    expect(
      Array.from(document.querySelectorAll('[data-calculator-configuration-section]')).map((section) =>
        section.getAttribute('data-calculator-configuration-section'),
      ),
    ).toEqual(['structure', 'flashings', 'overrides', 'blinds', 'infills', 'house-footprint']);
    expect(document.querySelector('[data-calculator-field="flashings"]')?.getAttribute('data-field-layout')).toBe('full');
    expect(document.querySelectorAll('[data-calculator-configuration-sheet]')).toHaveLength(2);
    expect(document.querySelector('[data-calculator-configuration-section="structure"]')?.getAttribute('data-section-surface')).toBe('quiet');
  });

  it('keeps toggles inside the existing configuration field contract', () => {
    renderIntoDocument(
      <CalculatorConfigurationForm
        fields={[{ id: 'boxPerimeterEnabled', label: 'Box perimeter', type: 'toggle', value: false }]}
        isAdvancedUi={false}
      />,
    );

    const toggle = document.querySelector('[data-field-part="toggle"]');
    expect(toggle).not.toBeNull();
    expect(toggle?.textContent).toBe('Off');
    expect(toggle?.closest('[data-calculator-configuration-sheet]')).not.toBeNull();
  });
});
