import { describe, expect, it } from 'vitest';
import type { Estimate } from '@/lib/types/estimate';
import { buildQuoteHandoffPreviewFromEstimate } from './estimateHandoffPreview';

function estimate(overrides: Partial<Estimate> = {}): Estimate {
  return {
    id: 'est_1',
    projectId: 'proj_1',
    createdAt: '2026-07-01T00:00:00.000Z',
    status: 'draft',
    inputs: {
      schemaVersion: 'v2',
      projectName: 'Preview test',
      quoteRef: '',
      access: 'normal',
      height: 'single_storey',
      jobType: 'residential',
      travelExGst: '0',
      extrasAllowanceExGst: '0',
      quoteDiscountPct: '0',
      pergolas: [{ id: 'pergola-1', label: 'Pergola 1' }],
      modules: [],
      blinds: { items: [] },
    },
    derived: {} as Estimate['derived'],
    outputs: {
      materials: { lines: [], totals: { materials_ex_gst: 0 } },
      install: { actions: [], totals: { crew_minutes: 0, crew_hours: 0, install_ex_gst: 0 } },
      overhead: { method: 'job_rollup', ops_ex_gst: 0, sales_ex_gst: 0, total_ex_gst: 0 },
      totals: { cost_ex_gst: 1000, cost_inc_gst: 1150, warnings: [], notes_and_warnings: [] },
      warnings: [],
    },
    configVersions: { pricebook: '', installActions: '', overheads: '', rules: '', manifest: '' },
    ...overrides,
  } as Estimate;
}

describe('buildQuoteHandoffPreviewFromEstimate', () => {
  it('returns the same quote-ready customer total as estimate mapping', () => {
    const preview = buildQuoteHandoffPreviewFromEstimate(estimate());
    expect(preview.totalIncGstCents).toBe(143_750);
    expect(preview.lineItems).toHaveLength(1);
    expect(preview.blockingIssues).toEqual([]);
  });

  it('preserves blockers so callers cannot present a partial customer total', () => {
    const current = estimate();
    const preview = buildQuoteHandoffPreviewFromEstimate(estimate({
      inputs: {
        ...current.inputs,
        blinds: {
          items: [{
            id: 'blind-1',
            label: 'Pool blind',
            system: 'ZIPTRAK',
            widthMm: '',
            coverLengthMm: '',
            fabric: 'MESH',
            motorised: 'NONE',
            rollCover: 'NONE',
          }],
        },
      },
    }));
    expect(preview.totalIncGstCents).toBe(143_750);
    expect(preview.blockingIssues).toEqual([
      'Pool blind needs valid dimensions and selections before a quote can be created.',
    ]);
  });
});
