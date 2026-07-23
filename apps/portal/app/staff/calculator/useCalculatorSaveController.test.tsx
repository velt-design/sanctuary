import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { renderIntoDocument } from '../../../../../test/reactHarness';
import type { CalculatorEstimateSaveOutcome } from './calculatorEstimateSave';
import {
  useCalculatorSaveController,
  type CalculatorSaveContext,
} from './useCalculatorSaveController';

type SaveControllerArgs = Parameters<typeof useCalculatorSaveController>[0];
type SaveController = ReturnType<typeof useCalculatorSaveController>;
type SaveEstimate = NonNullable<SaveControllerArgs['saveEstimate']>;

let latest: SaveController | null = null;

function controller(): SaveController {
  if (!latest) throw new Error('Save controller probe has not rendered.');
  return latest;
}

function Probe({ args }: { args: SaveControllerArgs }) {
  latest = useCalculatorSaveController(args);
  return null;
}

function makeOutcome(): CalculatorEstimateSaveOutcome {
  return {
    estimateId: 'estimate-1',
    projectId: 'project-1',
    versionLabel: 'Draft v1',
    operation: 'created',
    saveMode: 'reprice_latest',
    pricingChanged: false,
    quotePreview: {
      lineItems: [],
      totalIncGstCents: 0,
      blockingIssues: [],
    },
  };
}

function makeArgs(overrides: Partial<SaveControllerArgs> = {}) {
  const onError = vi.fn();
  const onSaved = vi.fn();
  const setLoadedEstimateDetail = vi.fn();
  const saveEstimate = vi.fn().mockResolvedValue(makeOutcome()) as unknown as SaveEstimate;
  const args: SaveControllerArgs = {
    saveContext: { isEditingDesign: false } as CalculatorSaveContext,
    suggestedDesignRequestTier: 'TIER_2',
    preflight: {
      projectId: 'project-1',
      hasProject: true,
      readyToCalculate: true,
      hasStatusBlockers: false,
      resultFreshness: 'current',
    },
    setLoadedEstimateDetail,
    onError,
    onSaved,
    saveEstimate,
    ...overrides,
  };
  return { args, onError, onSaved, saveEstimate, setLoadedEstimateDetail };
}

afterEach(() => {
  latest = null;
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('useCalculatorSaveController', () => {
  it('reports preflight errors without opening confirmation', () => {
    const setup = makeArgs({
      preflight: {
        projectId: '',
        hasProject: false,
        readyToCalculate: true,
        hasStatusBlockers: false,
        resultFreshness: 'current',
      },
    });
    const rendered = renderIntoDocument(<Probe args={setup.args} />);

    act(() => controller().openSaveConfirmation());

    expect(controller().confirmOpen).toBe(false);
    expect(controller().generateError).toBe('Select a project before saving design.');
    expect(setup.saveEstimate).not.toHaveBeenCalled();
    rendered.unmount();
  });

  it('opens and closes confirmation with the suggested request tier', () => {
    const setup = makeArgs();
    const rendered = renderIntoDocument(<Probe args={setup.args} />);

    act(() => controller().openSaveConfirmation());
    expect(controller().confirmOpen).toBe(true);
    expect(controller().confirmRequestDesignPriority).toBe('TIER_2');

    act(() => {
      controller().setPricingPreserveReason('Approved variance');
      controller().setConfirmRequestDesignChecked(true);
    });
    expect(controller().pricingPreserveReason).toBe('Approved variance');
    expect(controller().confirmRequestDesign).toBe(true);

    act(() => controller().closeSaveConfirmation());
    expect(controller().confirmOpen).toBe(false);
    expect(controller().pricingPreserveReason).toBe('');
    rendered.unmount();
  });

  it('owns confirmed save requests, outcomes, and successful handoff', async () => {
    const outcome = makeOutcome();
    const saveEstimate = vi.fn(async (input: Parameters<SaveEstimate>[0]) => {
      input.callbacks.setGenerating(true);
      input.callbacks.setGenerating(false);
      return outcome;
    }) as unknown as SaveEstimate;
    const setup = makeArgs({
      saveContext: { isEditingDesign: true } as CalculatorSaveContext,
      saveEstimate,
    });
    const rendered = renderIntoDocument(<Probe args={setup.args} />);

    act(() => controller().openSaveConfirmation());
    act(() => {
      controller().setPricingPreserveReason('Approved variance');
      controller().setConfirmRequestDesignChecked(true);
    });
    await act(async () => {
      await controller().saveConfirmed();
    });

    expect(saveEstimate).toHaveBeenCalledWith(expect.objectContaining({
      request: {
        createDesignRequest: { priorityTier: 'TIER_2' },
        preserveReason: 'Approved variance',
        saveMode: 'preserve_current',
      },
    }));
    expect(controller().confirmOpen).toBe(false);
    expect(controller().saveOutcome).toEqual(outcome);
    expect(setup.onSaved).toHaveBeenCalledWith(outcome);

    act(() => controller().dismissSaveOutcome());
    expect(controller().saveOutcome).toBeNull();
    rendered.unmount();
  });

  it('keeps save failures in the controller and forwards the error notification', async () => {
    const saveEstimate = vi.fn(async (input: Parameters<SaveEstimate>[0]) => {
      input.callbacks.fail('Save failed.');
      return null;
    }) as unknown as SaveEstimate;
    const setup = makeArgs({ saveEstimate });
    const rendered = renderIntoDocument(<Probe args={setup.args} />);

    await act(async () => {
      await controller().repriceLatest();
    });

    expect(controller().generateError).toBe('Save failed.');
    expect(setup.onError).toHaveBeenCalledWith('Save failed.');
    expect(setup.onSaved).not.toHaveBeenCalled();
    rendered.unmount();
  });
});
