import type { CostInputsV1 } from '@sp/costing';
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { renderIntoDocument } from '../../../../../test/reactHarness';
import { useCalculatorMaterialsDebug } from './useCalculatorMaterialsDebug';

type ControllerArgs = Parameters<typeof useCalculatorMaterialsDebug>[0];
type Controller = ReturnType<typeof useCalculatorMaterialsDebug>;

let latest: Controller | null = null;

function controller(): Controller {
  if (!latest) throw new Error('Materials debug probe has not rendered.');
  return latest;
}

function Probe({ args }: { args: ControllerArgs }) {
  latest = useCalculatorMaterialsDebug(args);
  return null;
}

function makeArgs(overrides: Partial<ControllerArgs> = {}): ControllerArgs {
  return {
    available: true,
    isAdvancedUi: true,
    activeModuleIndex: 0,
    readyToCalculate: true,
    activeModulePayload: { id: 'module-1' } as unknown as CostInputsV1,
    onSuccess: vi.fn(),
    onError: vi.fn(),
    ...overrides,
  };
}

const response = {
  output: {
    materials: {
      lines: [
        {
          id: 'beam-1',
          label: 'Beam',
          unit: 'ea',
          qty: 1,
          unit_cost_ex_gst: 100,
          line_cost_ex_gst: 100,
        },
      ],
    },
  },
  materials_explain: {
    lines: {
      '0': {
        line_index: 0,
        kind: 'simple',
        formula: 'qty * cost',
        deps: {},
      },
    },
  },
};

afterEach(() => {
  latest = null;
  document.body.innerHTML = '';
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('useCalculatorMaterialsDebug', () => {
  it('owns the debounced trace request, focus selection, and mode lifecycle', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => response });
    vi.stubGlobal('fetch', fetchMock);
    const args = makeArgs();
    const rendered = renderIntoDocument(<Probe args={args} />);

    act(() => controller().setEnabled(true));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(220);
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/staff/costing/v1/materials-explain?detail=summary',
      expect.objectContaining({ method: 'POST', body: JSON.stringify(args.activeModulePayload) }),
    );
    expect(controller().materialsLines[0]?.label).toBe('Beam');

    act(() => controller().setFocusLineIndex(0));
    expect(controller().selectedExplainLine?.line_index).toBe(0);
    expect(controller().selectedMaterialLine?.id).toBe('beam-1');

    rendered.rerender(<Probe args={{ ...args, activeModuleIndex: 1 }} />);
    expect(controller().focusLineIndex).toBeNull();

    rendered.rerender(<Probe args={{ ...args, isAdvancedUi: false }} />);
    expect(controller().enabled).toBe(false);
    expect(controller().materialsExplain).toBeNull();
    rendered.unmount();
  });
});
