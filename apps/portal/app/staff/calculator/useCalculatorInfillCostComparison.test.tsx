import type { CostInputsV1, CostOutputV1 } from '@sp/costing';
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { renderIntoDocument } from '../../../../../test/reactHarness';
import { makeDefaultInfillItem } from './calculatorInputs';
import { useCalculatorInfillCostComparison } from './useCalculatorInfillCostComparison';

type HookArgs = Parameters<typeof useCalculatorInfillCostComparison>[0];
type Controller = ReturnType<typeof useCalculatorInfillCostComparison>;

let latest: Controller | null = null;

function controller(): Controller {
  if (!latest) throw new Error('Infill comparison probe has not rendered.');
  return latest;
}

function Probe({ args }: { args: HookArgs }) {
  latest = useCalculatorInfillCostComparison(args);
  return null;
}

function cost(totalEx: number): CostOutputV1 {
  return {
    totals: { cost_ex_gst: totalEx, cost_inc_gst: totalEx * 1.1 },
    materials: { totals: { materials_ex_gst: totalEx * 0.5 } },
    install: { totals: { install_ex_gst: totalEx * 0.3, crew_hours: 2 } },
    overhead: { total_ex_gst: totalEx * 0.2 },
  } as unknown as CostOutputV1;
}

afterEach(() => {
  latest = null;
  document.body.innerHTML = '';
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('useCalculatorInfillCostComparison', () => {
  it('owns baseline and option costing requests and resets when details close', async () => {
    vi.useFakeTimers();
    const fetchCost = vi
      .fn()
      .mockResolvedValueOnce(cost(100))
      .mockResolvedValueOnce(cost(80))
      .mockResolvedValueOnce(cost(110))
      .mockResolvedValueOnce(cost(90));
    const activeModulePayload = {
      infills: [{ id: 'infill-1', acrylic_source: 'auto', support: {}, shape: {} }],
    } as unknown as CostInputsV1;
    const args: HookArgs = {
      canViewInternalCosts: true,
      infillsOpen: true,
      detailsOpen: true,
      activeModulePayload,
      readyToCalculate: true,
      isCalculating: false,
      engineError: null,
      selectedInfill: makeDefaultInfillItem({ id: 'infill-1' }),
      moduleLengthM: '6',
      roofRafterSpacingM: 0.9,
      selectedInfillDraft: undefined,
      fetchCost,
    };
    const rendered = renderIntoDocument(<Probe args={args} />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    expect(fetchCost).toHaveBeenCalledTimes(4);
    expect(controller().marginalDelta?.total_ex).toBe(20);
    expect(controller().sheetDelta?.total_ex).toBe(10);
    expect(controller().stripDelta?.total_ex).toBe(-10);
    expect((fetchCost.mock.calls[2]?.[0] as CostInputsV1).infills?.[0]?.acrylic_source).toBe('sheet_panels');
    expect((fetchCost.mock.calls[3]?.[0] as CostInputsV1).infills?.[0]?.acrylic_source).toBe('strip_620');

    rendered.rerender(<Probe args={{ ...args, detailsOpen: false }} />);
    expect(controller().marginalDelta).toBeNull();
    expect(controller().moduleBaselineError).toBeNull();
    expect(controller().optionError).toBeNull();
    rendered.unmount();
  });
});
