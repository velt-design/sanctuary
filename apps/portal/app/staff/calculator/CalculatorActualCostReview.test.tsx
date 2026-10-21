import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../../test/reactHarness';
import type { EstimateCostCalibrationComparison } from '@/lib/estimateActuals/types';

const { apiJson } = vi.hoisted(() => ({ apiJson: vi.fn() }));

vi.mock('@/lib/repo/apiClient', () => ({ apiJson }));

import CalculatorActualCostReview from './CalculatorActualCostReview';

const comparison: EstimateCostCalibrationComparison = {
  estimated: {
    materialsExGst: 100,
    installExGst: 50,
    overheadExGst: 25,
    travelExGst: 10,
    extrasExGst: 0,
    crewHours: 8,
    totalExGst: 185,
  },
  actual: null,
  variance: {
    materialsExGst: null,
    installExGst: null,
    overheadExGst: null,
    travelExGst: null,
    extrasExGst: null,
    crewHours: null,
    totalExGst: null,
  },
};

const recorded: EstimateCostCalibrationComparison = {
  ...comparison,
  actual: {
    estimateId: 'est_1', materialsExGst: 920, installExGst: 80, overheadExGst: 30,
    travelExGst: 20, extrasExGst: 10, crewHours: 14, notes: 'Retain supplier invoice',
    isComplete: true, updatedAt: '2026-10-20T00:00:00Z', updatedByEmail: 'ops@example.com',
  },
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function button(text: string) {
  return Array.from(document.querySelectorAll('button')).find(candidate => candidate.textContent?.trim() === text)!;
}

function enterNotes(value: string) {
  const input = document.querySelector('textarea')!;
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

beforeEach(() => {
  apiJson.mockReset();
});

afterEach(() => {
  document.body.innerHTML = '';
});

describe('CalculatorActualCostReview', () => {
  it('cannot overwrite a preexisting record after failed load and explicitly retries the read', async () => {
    apiJson.mockRejectedValueOnce(Error('Read unavailable')).mockResolvedValueOnce({ comparison: recorded });
    const rendered = renderIntoDocument(<CalculatorActualCostReview estimateId="est_1" />);
    await act(async () => Promise.resolve());
    expect(button('Save actual costs').disabled).toBe(true);
    expect(document.querySelector('textarea')!.disabled).toBe(true);
    act(() => button('Save actual costs').click());
    expect(apiJson).toHaveBeenCalledTimes(1);
    await act(async () => { button('Retry loading actual costs').click(); await Promise.resolve(); });
    expect(apiJson.mock.calls.every((call) => !call[1]?.method)).toBe(true);
    expect((document.querySelector('input[type="number"]') as HTMLInputElement).value).toBe('920');
    expect(document.querySelector('textarea')!.value).toBe('Retain supplier invoice');
    expect((document.querySelector('input[type="checkbox"]') as HTMLInputElement).checked).toBe(true);
    expect(button('Save actual costs').disabled).toBe(false);
    expect(document.body.textContent).not.toContain('Read unavailable');
    rendered.unmount();
  });

  it('keeps edited notes after save rejection and retries the same authorised draft', async () => {
    apiJson.mockResolvedValueOnce({ comparison: recorded }).mockRejectedValueOnce(Error('Write unavailable'))
      .mockResolvedValueOnce({ comparison: { ...recorded, actual: { ...recorded.actual!, notes: 'New supplier detail' } } });
    const rendered = renderIntoDocument(<CalculatorActualCostReview estimateId="est_1" />);
    await act(async () => Promise.resolve());
    enterNotes('New supplier detail');
    await act(async () => { button('Save actual costs').click(); await Promise.resolve(); });
    expect(document.querySelector('textarea')!.value).toBe('New supplier detail');
    expect(button('Save actual costs').disabled).toBe(false);
    expect(document.body.textContent).not.toContain('Retry loading actual costs');
    await act(async () => { button('Save actual costs').click(); await Promise.resolve(); });
    expect(apiJson.mock.calls[1][1]).toEqual(apiJson.mock.calls[2][1]);
    expect(JSON.parse(apiJson.mock.calls[2][1].body)).toMatchObject({ notes: 'New supplier detail', materialsExGst: 920, isComplete: true });
    rendered.unmount();
  });

  it.each(['resolve', 'reject'] as const)('ignores an old estimate read that later %ss', async (outcome) => {
    const old = deferred<{ comparison: EstimateCostCalibrationComparison }>();
    const current = deferred<{ comparison: EstimateCostCalibrationComparison }>();
    apiJson.mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise);
    const rendered = renderIntoDocument(<CalculatorActualCostReview estimateId="est_1" />);
    act(() => rendered.rerender(<CalculatorActualCostReview estimateId="est_2" />));
    await act(async () => {
      if (outcome === 'resolve') old.resolve({ comparison: recorded });
      else old.reject(Error('Old failure'));
      await Promise.resolve();
    });
    expect(button('Save actual costs').disabled).toBe(true);
    expect(document.querySelector('textarea')!.value).toBe('');
    expect(document.body.textContent).not.toContain('Old failure');
    await act(async () => { current.resolve({ comparison }); await Promise.resolve(); });
    expect(button('Save actual costs').disabled).toBe(false);
    expect(document.querySelector('textarea')!.value).toBe('');
    rendered.unmount();
  });

  it.each(['resolve', 'reject'] as const)('does not apply an old save that later %ss to another estimate', async (outcome) => {
    const saving = deferred<{ comparison: EstimateCostCalibrationComparison }>();
    apiJson.mockResolvedValueOnce({ comparison: recorded }).mockReturnValueOnce(saving.promise)
      .mockRejectedValueOnce(Error('Current read unavailable')).mockResolvedValueOnce({ comparison });
    const rendered = renderIntoDocument(<CalculatorActualCostReview estimateId="est_1" />);
    await act(async () => Promise.resolve());
    enterNotes('Pending old save');
    await act(async () => { button('Save actual costs').click(); await Promise.resolve(); });
    act(() => rendered.rerender(<CalculatorActualCostReview estimateId="est_2" />));
    await act(async () => {
      if (outcome === 'resolve') saving.resolve({ comparison: recorded });
      else saving.reject(Error('Old save failed'));
      await Promise.resolve();
    });
    expect(button('Save actual costs').disabled).toBe(true);
    expect(document.querySelector('textarea')!.value).toBe('');
    expect(document.body.textContent).toContain('Current read unavailable');
    expect(document.body.textContent).not.toContain('Old save failed');
    expect(document.body.textContent).not.toContain('Actual costs saved.');
    await act(async () => { button('Retry loading actual costs').click(); await Promise.resolve(); });
    expect(apiJson).toHaveBeenLastCalledWith('/api/staff/v1/estimates/est_2/actual-costs');
    expect(document.querySelector('textarea')!.value).toBe('');
    rendered.unmount();
  });
  it('loads frozen estimates and saves an explicit staff actual-cost draft', async () => {
    apiJson.mockResolvedValueOnce({ comparison }).mockResolvedValueOnce({
      comparison: {
        ...comparison,
        actual: {
          estimateId: 'est_1',
          materialsExGst: 120,
          installExGst: null,
          overheadExGst: null,
          travelExGst: null,
          extrasExGst: null,
          crewHours: null,
          notes: '',
          isComplete: false,
          updatedAt: '2026-07-22T00:00:00.000Z',
          updatedByEmail: 'ops@example.com',
        },
        variance: { ...comparison.variance, materialsExGst: 20 },
      },
    });

    renderIntoDocument(<CalculatorActualCostReview estimateId="est_1" />);
    await act(async () => Promise.resolve());

    expect(apiJson).toHaveBeenCalledWith('/api/staff/v1/estimates/est_1/actual-costs');
    expect(document.querySelector('details')?.textContent).toContain('Post-job margin calibration');
    expect(document.querySelector('details')?.textContent).toContain('Estimated $100.00');

    const materialsInput = document.querySelector('input[type="number"]') as HTMLInputElement;
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      setter?.call(materialsInput, '120');
      materialsInput.dispatchEvent(new Event('input', { bubbles: true }));
      materialsInput.dispatchEvent(new Event('change', { bubbles: true }));
    });
    const saveButton = Array.from(document.querySelectorAll('button')).find((candidate) =>
      candidate.textContent?.trim() === 'Save actual costs',
    ) as HTMLButtonElement;
    await act(async () => {
      saveButton.click();
      await Promise.resolve();
    });

    expect(apiJson).toHaveBeenLastCalledWith(
      '/api/staff/v1/estimates/est_1/actual-costs',
      expect.objectContaining({
        method: 'PUT',
        body: expect.stringContaining('"materialsExGst":120'),
      }),
    );
    expect(document.querySelector('details')?.textContent).toContain('Actual costs saved.');
  });
});
