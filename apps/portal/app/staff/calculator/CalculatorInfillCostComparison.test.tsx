import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { renderIntoDocument } from '../../../../../test/reactHarness';
import CalculatorInfillCostComparison from './CalculatorInfillCostComparison';
import type { CalculatorInfillCostComparison as InfillCostComparisonModel } from './useCalculatorInfillCostComparison';

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('CalculatorInfillCostComparison', () => {
  it('renders cost deltas and forwards acrylic option choices', () => {
    const onApply = vi.fn();
    const comparison = {
      moduleBaselineLoading: false,
      moduleBaselineError: null,
      optionLoading: false,
      optionError: null,
      marginalDelta: { total_ex: 20, total_inc: 22, materials_ex: 12, install_ex: 6 },
      sheetDelta: { total_ex: 10, materials_ex: 7, install_ex: 2 },
      stripDelta: { total_ex: -5, materials_ex: -3, install_ex: -1 },
      sheetComplexityEstimate: { panelCountTotal: 3, estimatedMullionsTotal: 2 },
      stripComplexityEstimate: { panelCountTotal: 5, estimatedMullionsTotal: 4 },
    } as unknown as InfillCostComparisonModel;

    renderIntoDocument(<CalculatorInfillCostComparison comparison={comparison} onApply={onApply} />);

    expect(document.body.textContent).toContain('+$20.00');
    expect(document.body.textContent).toContain('Delta total -$5.00');
    expect(document.body.textContent).toContain('Complexity: panels ~3, 50x50 ~2');

    const applyButtons = Array.from(document.querySelectorAll('button')).filter((button) => button.textContent === 'Apply');
    act(() => applyButtons[0]?.click());
    act(() => applyButtons[1]?.click());
    expect(onApply).toHaveBeenNthCalledWith(1, 'sheet_panels');
    expect(onApply).toHaveBeenNthCalledWith(2, 'strip_620');
  });
});
