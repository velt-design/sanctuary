import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { renderIntoDocument } from '../../../../../test/reactHarness';
import CalculatorPreviewDetails from './CalculatorPreviewDetails';
import type { CalculatorMaterialsDebugController } from './useCalculatorMaterialsDebug';
import type { UiWarning } from './warnings';

const materialsDebug = {
  available: false,
  enabled: false,
  setEnabled: vi.fn(),
  detail: 'summary',
  setDetail: vi.fn(),
  focusLineIndex: null,
  setFocusLineIndex: vi.fn(),
  loading: false,
  error: null,
  materialsExplain: null,
  materialsLines: [],
  selectedExplainLine: null,
  selectedMaterialLine: null,
  selectedExplainJson: '',
  copyJson: vi.fn(),
  downloadJson: vi.fn(),
} as unknown as CalculatorMaterialsDebugController;

const warnings: UiWarning[] = [
  { id: 'engine-1', severity: 'review', message: 'Check roof inputs', source: 'engine' },
  {
    id: 'infill-1',
    severity: 'critical',
    message: 'Front infill: enter width',
    source: 'infill',
    infillId: 'infill-1',
    warning: {
      id: 'width',
      severity: 'error',
      message: 'Enter width',
      target: { section: 'basic', fieldKey: 'shape-width' },
    },
  },
];

const bomLines = [
  {
    id: 'beam-1',
    label: 'Beam',
    unit: 'ea',
    qty: 2,
    unit_cost_ex_gst: 100,
    line_cost_ex_gst: 200,
  },
];

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('CalculatorPreviewDetails', () => {
  it('renders warnings and customer-safe BOM rows while forwarding infill jumps', () => {
    const onJumpToWarning = vi.fn();
    renderIntoDocument(
      <CalculatorPreviewDetails
        warnings={warnings}
        onJumpToWarning={onJumpToWarning}
        bomLines={bomLines}
        canViewInternalCosts={false}
        materialsEx={200}
        isAdvancedUi={false}
        materialsDebug={materialsDebug}
        labourActions={[]}
        structureRows={[]}
      />,
    );

    expect(document.body.textContent).toContain('Check roof inputs');
    expect(document.body.textContent).toContain('Front infill: enter width');
    expect(document.body.textContent).toContain('Beam');
    expect(document.body.textContent).not.toContain('$200.00');
    expect(document.body.textContent).not.toContain('Structure outputs');

    act(() => (Array.from(document.querySelectorAll('button')).find((button) => button.textContent === 'Jump'))?.click());
    expect(onJumpToWarning).toHaveBeenCalledWith(warnings[1]);
  });

  it('keeps internal advanced breakdowns together', () => {
    renderIntoDocument(
      <CalculatorPreviewDetails
        warnings={[]}
        onJumpToWarning={() => undefined}
        bomLines={bomLines}
        canViewInternalCosts
        materialsEx={200}
        isAdvancedUi
        materialsDebug={materialsDebug}
        labourActions={[
          {
            id: 'install-1',
            category: 'Install',
            label: 'Fit beam',
            unit: 'ea',
            qty: 2,
            minutes: 30,
            applied_multipliers: {},
            cost_ex_gst: 100,
          },
        ]}
        structureRows={[{ label: 'Area (m²)', value: '12.00' }]}
      />,
    );

    expect(document.body.textContent).toContain('$200.00');
    expect(document.body.textContent).toContain('Labour breakdown');
    expect(document.body.textContent).toContain('Fit beam');
    expect(document.body.textContent).toContain('Structure outputs');
    expect(document.body.textContent).toContain('12.00');
  });
});
