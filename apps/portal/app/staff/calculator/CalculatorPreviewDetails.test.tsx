import { act } from 'react';
import type {
  TrustedLabourBreakdownV1,
  TrustedMaterialsBreakdownV1,
} from '@sp/costing';
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

const materialsBreakdown: TrustedMaterialsBreakdownV1 = {
  version: 1,
  status: 'ready',
  source: '@sp/costing/materials-v1',
  scope: 'whole_job',
  row_count: 1,
  assumptions: [],
  groups: [{
    id: 'structure',
    label: 'Structure & framing',
    rows: [{
      instance_id: 'beam-1#1',
      id: 'beam-1',
      label: 'Beam',
      owner: { scope: 'module', label: 'Pergola 1 / Module 1' },
      quantity: 2,
      unit: 'bar',
      internal_cost_ex_gst: 200,
      explanation: {
        version: 1,
        source: '@sp/costing/materials-v1',
        summary: 'Two stock bars cover the calculated beam cuts.',
        facts: [{ label: 'Bars purchased', value: 2, unit: 'bar' }],
        assumptions: [],
        rounding: 'Purchased in whole bars.',
      },
    }],
  }],
};

const labourBreakdown: TrustedLabourBreakdownV1 = {
  version: 1,
  status: 'ready',
  source: '@sp/costing/install-actions-v1',
  scope: 'whole_job',
  action_count: 1,
  total_crew_minutes: 30,
  total_crew_hours: 0.5,
  assumptions: [],
  groups: [{
    id: 'structure',
    label: 'Structure installation',
    crew_minutes: 30,
    crew_hours: 0.5,
    rows: [{
      instance_id: 'install-1#1',
      id: 'install-1',
      label: 'Fit beam',
      owner: { scope: 'module', label: 'Pergola 1 / Module 1' },
      quantity: 2,
      unit: 'beam',
      minutes: 30,
      crew_hours: 0.5,
      internal_cost_ex_gst: 100,
      relevant_multipliers: [],
      explanation: {
        version: 1,
        source: '@sp/costing/install-actions-v1',
        summary: 'The calculated beam count drives this activity.',
        facts: [{ label: 'Activity quantity', value: 2, unit: 'beam' }],
        assumptions: [],
      },
    }],
  }],
};

function buildProps(
  view: CalculatorPreviewDetailsProps['view'],
  overrides: Partial<CalculatorPreviewDetailsProps> = {},
): CalculatorPreviewDetailsProps {
  return {
    view,
    warnings,
    onJumpToWarning: vi.fn(),
    materialsBreakdown,
    canViewInternalCosts: false,
    materialsEx: 200,
    isAdvancedUi: false,
    materialsDebug,
    labourBreakdown,
    resultFreshness: 'current',
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
    expect(document.body.textContent).toContain('$100.00');
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
