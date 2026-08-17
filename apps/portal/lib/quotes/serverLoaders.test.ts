import { describe, expect, it } from 'vitest';
import { buildQuoteLineItemsFromEstimate } from './mapping';
import { mapQuoteSourceEstimateRow } from './serverLoaders';

describe('quote estimate loader', () => {
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
