import { describe, expect, it } from 'vitest';
import { assertQuoteEstimateMappingReady, buildQuoteLineItemsFromEstimate } from './mapping';
import { buildQuoteHandoffPreviewFromEstimate } from './estimateHandoffPreview';
import { mapQuoteSourceEstimateRow } from './serverLoaders';

describe('quote estimate loader', () => {
  it('blocks a configured enquiry from becoming a base-only quote after database loading', () => {
    const estimate = mapQuoteSourceEstimateRow({
      id: '742b51d5-5f31-479b-8e5d-2276e53d5139',
      project_id: 'a05305f5-55ea-44d6-ab0d-6818b8bac8bf',
      inputs: {},
      outputs: {
        derived: {pricingMode: 'configured_customer_snapshot', pricingSource: 'configurator_verified'},
        totals: {cost_ex_gst: 10000, cost_inc_gst: 11500},
        snapshot: {submittedPrice: {baseRange: {low: 20000, high: 20000}, includesGst: true}},
      },
    });
    const mapping = buildQuoteLineItemsFromEstimate(estimate);
    expect(mapping.items).toEqual([]);
    expect(mapping.blockingIssues[0]?.code).toBe('CONFIGURED_COSTING_REVIEW_REQUIRED');
    expect(() => assertQuoteEstimateMappingReady(mapping)).toThrow('not a complete quote');
    const preview = buildQuoteHandoffPreviewFromEstimate(estimate);
    expect(preview.lineItems).toEqual([]);
    expect(preview.totalIncGstCents).toBe(0);
    expect(preview.blockingIssues).toHaveLength(1);
  });
  it('preserves standalone infill output for a zero-pergola quote handoff', () => {
    const estimate = mapQuoteSourceEstimateRow({
      id: '742b51d5-5f31-479b-8e5d-2276e53d5139',
      project_id: 'a05305f5-55ea-44d6-ab0d-6818b8bac8bf',
      created_at: '2026-08-13T00:00:00.000Z',
      status: 'draft',
      inputs: {
        schemaVersion: 'v2',
        pergolas: [],
        modules: [],
        quoteDiscountPct: '0',
        standaloneInfills: {
          extrusionColour: 'Black',
          items: [{
            id: 'infill-1',
            label: 'Existing side infill',
            qty: '1',
            location: 'wall',
            shape: { type: 'rect', widthM: '2.4', heightM: '1.2' },
          }],
        },
      },
      outputs: {
        cost_snapshot_version: 'v2',
        totals: { cost_ex_gst: 150, cost_inc_gst: 172.5, warnings: [], notes_and_warnings: [] },
        shared: { totals: { cost_ex_gst: 50 } },
        standalone_infills: { totals: { cost_ex_gst: 100 } },
      },
      warnings: [],
      pricing_source: 'calculator_live',
    });

    expect(estimate.outputs.standalone_infills).toEqual({ totals: { cost_ex_gst: 100 } });
    expect(buildQuoteLineItemsFromEstimate(estimate).items.map((item) => item.description.split('\n')[0])).toEqual([
      'Custom infills for existing pergola',
      'Project delivery and site costs',
    ]);
  });

  it('also preserves estimate-level additional aluminium output', () => {
    const estimate = mapQuoteSourceEstimateRow({
      id: '742b51d5-5f31-479b-8e5d-2276e53d5139',
      project_id: 'a05305f5-55ea-44d6-ab0d-6818b8bac8bf',
      inputs: {},
      outputs: { additional_aluminium: { item_count: 1, totals: { cost_ex_gst: 80 } } },
    });

    expect(estimate.outputs.additional_aluminium).toEqual({ item_count: 1, totals: { cost_ex_gst: 80 } });
  });
});
