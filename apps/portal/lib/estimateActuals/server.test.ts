import { describe, expect, it } from 'vitest';
import {
  buildEstimateCostCalibrationComparison,
  parseEstimateActualCostInput,
} from './server';

describe('estimate actual cost calibration', () => {
  it('rejects negative actuals and normalises blank optional fields', () => {
    expect(parseEstimateActualCostInput({ materialsExGst: -1 })).toBeNull();
    expect(parseEstimateActualCostInput({
      materialsExGst: '120.125',
      installExGst: '',
      overheadExGst: null,
      travelExGst: '0',
      extrasExGst: undefined,
      crewHours: '8.5',
      notes: '  Supplier invoice reviewed.  ',
      isComplete: false,
    })).toEqual({
      materialsExGst: 120.13,
      installExGst: null,
      overheadExGst: null,
      travelExGst: 0,
      extrasExGst: null,
      crewHours: 8.5,
      notes: 'Supplier invoice reviewed.',
      isComplete: false,
    });
  });

  it('compares frozen estimate categories with completed actuals', () => {
    const comparison = buildEstimateCostCalibrationComparison(
      'est_1',
      {
        inputs: { travelExGst: '40', extrasAllowanceExGst: '10' },
        outputs: {
          materials: { totals: { materials_ex_gst: 100 } },
          install: { totals: { install_ex_gst: 50, crew_hours: 8 } },
          overhead: { total_ex_gst: 20 },
          totals: { cost_ex_gst: 220 },
        },
      },
      {
        materials_ex_gst: 110,
        install_ex_gst: 55,
        overhead_ex_gst: 20,
        travel_ex_gst: 45,
        extras_ex_gst: 15,
        crew_hours: 9,
        notes: 'Final invoices entered.',
        is_complete: true,
        updated_at: '2026-07-22T00:00:00Z',
        updated_by_email: 'ops@example.com',
      },
    );

    expect(comparison.estimated).toEqual({
      materialsExGst: 100,
      installExGst: 50,
      overheadExGst: 20,
      travelExGst: 40,
      extrasExGst: 10,
      crewHours: 8,
      totalExGst: 220,
    });
    expect(comparison.variance).toEqual({
      materialsExGst: 10,
      installExGst: 5,
      overheadExGst: 0,
      travelExGst: 5,
      extrasExGst: 5,
      crewHours: 1,
      totalExGst: 25,
    });
  });

  it('keeps total variance unknown while required actual categories are incomplete', () => {
    const comparison = buildEstimateCostCalibrationComparison(
      'est_1',
      {
        inputs: {},
        outputs: {
          materials: { totals: { materials_ex_gst: 100 } },
          install: { totals: { install_ex_gst: 50, crew_hours: 8 } },
          overhead: { total_ex_gst: 25 },
          totals: { cost_ex_gst: 175 },
        },
      },
      {
        materials_ex_gst: 110,
        install_ex_gst: null,
        overhead_ex_gst: null,
        travel_ex_gst: null,
        extras_ex_gst: null,
        crew_hours: null,
        notes: null,
        is_complete: false,
        updated_at: '2026-07-22T00:00:00.000Z',
        updated_by_email: 'ops@example.com',
      },
    );

    expect(comparison.variance.materialsExGst).toBe(10);
    expect(comparison.variance.totalExGst).toBeNull();
  });
});
