import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { renderIntoDocument } from '../../../../../test/reactHarness';
import CalculatorMaterialsDebugPanel from './CalculatorMaterialsDebugPanel';
import type { CalculatorMaterialsDebugController } from './useCalculatorMaterialsDebug';

function makeController(
  overrides: Partial<CalculatorMaterialsDebugController> = {},
): CalculatorMaterialsDebugController {
  return {
    available: true,
    enabled: true,
    setEnabled: vi.fn(),
    detail: 'summary',
    setDetail: vi.fn(),
    focusLineIndex: null,
    setFocusLineIndex: vi.fn(),
    loading: false,
    error: null,
    materialsExplain: { lines: {} },
    materialsLines: [
      {
        id: 'beam-1',
        label: 'Beam',
        unit: 'ea',
        qty: 2,
        unit_cost_ex_gst: 100,
        line_cost_ex_gst: 200,
      },
    ],
    selectedExplainLine: null,
    selectedMaterialLine: null,
    selectedExplainJson: '',
    copyJson: vi.fn(),
    downloadJson: vi.fn(),
    ...overrides,
  } as unknown as CalculatorMaterialsDebugController;
}

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('CalculatorMaterialsDebugPanel', () => {
  it('renders trace rows and forwards debug controls to the controller', () => {
    const controller = makeController();
    renderIntoDocument(<CalculatorMaterialsDebugPanel controller={controller} />);

    expect(document.body.textContent).toContain('0. Beam');
    expect(document.body.textContent).toContain('2.00 ea');

    const traceRow = Array.from(document.querySelectorAll('button')).find((button) => button.textContent?.includes('0. Beam'));
    act(() => traceRow?.click());
    expect(controller.setFocusLineIndex).toHaveBeenCalledWith(0);

    const copy = Array.from(document.querySelectorAll('button')).find((button) => button.textContent === 'Copy JSON');
    act(() => copy?.click());
    expect(controller.copyJson).toHaveBeenCalledTimes(1);
  });

  it('renders the existing unavailable explanation', () => {
    renderIntoDocument(
      <CalculatorMaterialsDebugPanel
        controller={makeController({ available: false, enabled: false, materialsExplain: null, materialsLines: [] })}
      />,
    );

    expect(document.body.textContent).toContain('Available only outside production');
    expect(document.querySelector('input[type="checkbox"]')).toBeNull();
  });
});
