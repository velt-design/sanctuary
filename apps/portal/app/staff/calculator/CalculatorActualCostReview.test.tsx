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

beforeEach(() => {
  apiJson.mockReset();
});

afterEach(() => {
  document.body.innerHTML = '';
});

describe('CalculatorActualCostReview', () => {
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
