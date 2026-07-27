import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { renderIntoDocument } from '../../../../../test/reactHarness';
import CalculatorPreviewDetails, {
  type CalculatorPreviewDetailsProps,
} from './CalculatorPreviewDetails';
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

const labourActions = [
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
];

function buildProps(
  view: CalculatorPreviewDetailsProps['view'],
  overrides: Partial<CalculatorPreviewDetailsProps> = {},
): CalculatorPreviewDetailsProps {
  return {
    view,
    warnings,
    onJumpToWarning: vi.fn(),
    bomLines,
    canViewInternalCosts: false,
    materialsEx: 200,
    isAdvancedUi: false,
    materialsDebug,
    labourActions,
    structureRows: [{ label: 'Area (m2)', value: '12.00' }],
    ...overrides,
  };
}

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('CalculatorPreviewDetails', () => {
  it('renders the Issues view and forwards infill warning jumps', () => {
    const onJumpToWarning = vi.fn();
    renderIntoDocument(
      <CalculatorPreviewDetails {...buildProps('issues', { onJumpToWarning })} />,
    );

    expect(document.body.textContent).toContain('Check roof inputs');
    expect(document.body.textContent).toContain('Front infill: enter width');
    expect(document.body.textContent).not.toContain('Beam');

    act(() => (Array.from(document.querySelectorAll('button')).find((button) => button.textContent === 'Jump'))?.click());
    expect(onJumpToWarning).toHaveBeenCalledWith(warnings[1]);
  });

  it('keeps material quantities customer-safe while retaining admin-only costs and debug', () => {
    const rendered = renderIntoDocument(
      <CalculatorPreviewDetails {...buildProps('materials')} />,
    );

    expect(document.body.textContent).toContain('Whole job');
    expect(document.body.textContent).toContain('Beam');
    expect(document.body.textContent).not.toContain('$200.00');
    expect(document.body.textContent).not.toContain('Materials debug');

    act(() => rendered.rerender(
      <CalculatorPreviewDetails
        {...buildProps('materials', { canViewInternalCosts: true, isAdvancedUi: true })}
      />,
    ));

    expect(document.body.textContent).toContain('$200.00');
    expect(document.body.textContent).toContain('Materials debug');
  });

  it('preserves the existing admin and Advanced gates for labour details', () => {
    const rendered = renderIntoDocument(
      <CalculatorPreviewDetails {...buildProps('labour')} />,
    );

    expect(document.body.textContent).toContain('available to administrators');
    expect(document.body.textContent).not.toContain('Fit beam');

    act(() => rendered.rerender(
      <CalculatorPreviewDetails
        {...buildProps('labour', { canViewInternalCosts: true })}
      />,
    ));
    expect(document.body.textContent).toContain('Switch the Calculator to Advanced');
    expect(document.body.textContent).not.toContain('Fit beam');

    act(() => rendered.rerender(
      <CalculatorPreviewDetails
        {...buildProps('labour', { canViewInternalCosts: true, isAdvancedUi: true })}
      />,
    ));
    expect(document.body.textContent).toContain('Fit beam');
    expect(document.body.textContent).toContain('30 min');
  });

  it('shows selected-module structure outputs only in Advanced mode', () => {
    const rendered = renderIntoDocument(
      <CalculatorPreviewDetails {...buildProps('workings')} />,
    );

    expect(document.body.textContent).toContain('Switch the Calculator to Advanced');
    expect(document.body.textContent).not.toContain('12.00');

    act(() => rendered.rerender(
      <CalculatorPreviewDetails {...buildProps('workings', { isAdvancedUi: true })} />,
    ));
    expect(document.body.textContent).toContain('Selected module');
    expect(document.body.textContent).toContain('12.00');
  });
});
