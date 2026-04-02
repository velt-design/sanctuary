import { describe, expect, it } from 'vitest';
import { buildQuoteLineItemsFromEstimate } from './mapping';

function makeModule(overrides: Record<string, unknown> = {}) {
  return {
    pergolaId: 'pergola-1',
    pergolaStyle: 'pitched',
    roofMaterial: 'acrylic',
    extrusionColour: 'Black',
    powdercoatStandardColour: '',
    powdercoatIsCustom: false,
    powdercoatCustomColour: '',
    roofPitchDeg: '',
    postCount: '4',
    lengthM: '6',
    projectionM: '3',
    hipCornerLengthBM: '0',
    hipCornerProjectionBM: '0',
    houseConnectionType: 'soffit',
    postConnectionType: 'deck_bracket',
    ...overrides,
  };
}

function makeEstimate(overrides: Record<string, unknown> = {}) {
  return {
    id: 'est-1',
    projectId: 'proj-1',
    createdAt: '2026-02-13T00:00:00Z',
    status: 'draft',
    inputs: {
      schemaVersion: 'v2',
      projectName: 'Test project',
      quoteRef: '',
      access: 'normal',
      height: 'single_storey',
      travelExGst: '0',
      extrasAllowanceExGst: '0',
      quoteDiscountPct: '0',
      pergolas: [{ id: 'pergola-1', label: 'Pergola 1' }],
      modules: [makeModule()],
      blinds: { items: [] },
    },
    derived: {},
    outputs: {
      materials: { lines: [], totals: { materials_ex_gst: 0 } },
      install: { actions: [], totals: { crew_minutes: 0, crew_hours: 0, install_ex_gst: 0 } },
      overhead: { method: 'job_rollup', ops_ex_gst: 0, sales_ex_gst: 0, total_ex_gst: 0 },
      totals: { cost_ex_gst: 0, cost_inc_gst: 0, warnings: [], notes_and_warnings: [] },
      warnings: [],
    },
    configVersions: {
      pricebook: 'v',
      installActions: 'v',
      overheads: 'v',
      rules: 'v',
      manifest: 'v',
    },
    ...overrides,
  } as any;
}

describe('buildQuoteLineItemsFromEstimate', () => {
  it('prices pergola + site snapshot lines using cost * 1.25 then GST', () => {
    const estimate = makeEstimate({
      inputs: {
        schemaVersion: 'v2',
        projectName: 'Test project',
        quoteRef: '',
        access: 'normal',
        height: 'single_storey',
        travelExGst: '0',
        extrasAllowanceExGst: '0',
        quoteDiscountPct: '0',
        pergolas: [
          { id: 'pergola-1', label: 'Pergola A' },
          { id: 'pergola-2', label: 'Pergola B' },
        ],
        modules: [
          makeModule({ pergolaId: 'pergola-1', lengthM: '6', projectionM: '3' }),
          makeModule({ pergolaId: 'pergola-2', lengthM: '4', projectionM: '2.5' }),
        ],
        blinds: { items: [] },
      },
      outputs: {
        materials: { lines: [], totals: { materials_ex_gst: 0 } },
        install: { actions: [], totals: { crew_minutes: 0, crew_hours: 0, install_ex_gst: 0 } },
        overhead: { method: 'site_rollup', ops_ex_gst: 0, sales_ex_gst: 0, total_ex_gst: 0 },
        totals: { cost_ex_gst: 340, cost_inc_gst: 391, warnings: [], notes_and_warnings: [] },
        warnings: [],
        cost_snapshot_version: 'v2',
        pergolas: [
          { id: 'pergola-1', label: 'Pergola A', totals: { cost_ex_gst: 100 } },
          { id: 'pergola-2', label: 'Pergola B', totals: { cost_ex_gst: 200 } },
        ],
        siteShared: {
          totals: { cost_ex_gst: 40 },
        },
      },
    });

    const result = buildQuoteLineItemsFromEstimate(estimate as any);
    expect(result.items).toHaveLength(3);
    expect(result.items[0]?.unitPriceIncGstCents).toBe(14375);
    expect(result.items[1]?.unitPriceIncGstCents).toBe(28750);
    expect(result.items[2]?.unitPriceIncGstCents).toBe(5750);
    expect(result.items[2]?.description).toContain('Site costs');
    expect(result.coreTotalIncCents).toBe(48875);
  });

  it('folds shared site costs into pergola when only one pergola exists', () => {
    const estimate = makeEstimate({
      inputs: {
        schemaVersion: 'v2',
        projectName: 'Single pergola',
        quoteRef: '',
        access: 'normal',
        height: 'single_storey',
        travelExGst: '0',
        extrasAllowanceExGst: '0',
        quoteDiscountPct: '0',
        pergolas: [{ id: 'pergola-1', label: 'Pergola 1' }],
        modules: [makeModule({ pergolaId: 'pergola-1' })],
        blinds: { items: [] },
      },
      outputs: {
        materials: { lines: [], totals: { materials_ex_gst: 0 } },
        install: { actions: [], totals: { crew_minutes: 0, crew_hours: 0, install_ex_gst: 0 } },
        overhead: { method: 'site_rollup', ops_ex_gst: 0, sales_ex_gst: 0, total_ex_gst: 0 },
        totals: { cost_ex_gst: 140, cost_inc_gst: 161, warnings: [], notes_and_warnings: [] },
        warnings: [],
        cost_snapshot_version: 'v2',
        pergolas: [{ id: 'pergola-1', label: 'Pergola 1', totals: { cost_ex_gst: 100 } }],
        siteShared: {
          totals: { cost_ex_gst: 40 },
        },
      },
    });

    const result = buildQuoteLineItemsFromEstimate(estimate as any);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.description).toContain('Pergola 1');
    expect(result.items[0]?.description).not.toContain('Site costs');
    expect(result.items[0]?.unitPriceIncGstCents).toBe(20125);
    expect(result.coreTotalIncCents).toBe(20125);
  });

  it('falls back to one legacy line item and includes a warning note', () => {
    const estimate = makeEstimate({
      inputs: {
        schemaVersion: 'v2',
        projectName: 'Legacy project',
        quoteRef: '',
        access: 'normal',
        height: 'single_storey',
        travelExGst: '0',
        extrasAllowanceExGst: '0',
        quoteDiscountPct: '0',
        modules: [makeModule(), makeModule({ lengthM: '4' })],
        blinds: { items: [] },
      },
      outputs: {
        materials: { lines: [], totals: { materials_ex_gst: 0 } },
        install: { actions: [], totals: { crew_minutes: 0, crew_hours: 0, install_ex_gst: 0 } },
        overhead: { method: 'job_rollup', ops_ex_gst: 0, sales_ex_gst: 0, total_ex_gst: 0 },
        totals: { cost_ex_gst: 300, cost_inc_gst: 345, warnings: [], notes_and_warnings: [] },
        warnings: [],
      },
    });

    const result = buildQuoteLineItemsFromEstimate(estimate as any);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.unitPriceIncGstCents).toBe(43125);
    expect(result.items[0]?.description).toContain('Legacy estimate');
    expect(result.items[0]?.description).toContain('Regenerate estimate');
    expect(result.coreTotalIncCents).toBe(43125);
  });

  it('uses a combined heading for pergolas with mixed module styles', () => {
    const estimate = makeEstimate({
      inputs: {
        schemaVersion: 'v2',
        projectName: 'Mixed pergola',
        quoteRef: '',
        access: 'normal',
        height: 'single_storey',
        travelExGst: '0',
        extrasAllowanceExGst: '0',
        quoteDiscountPct: '0',
        pergolas: [{ id: 'pergola-1', label: 'Pergola 1' }],
        modules: [
          makeModule({ pergolaId: 'pergola-1', pergolaStyle: 'gable' }),
          makeModule({ pergolaId: 'pergola-1', pergolaStyle: 'perimeter', lengthM: '4.2', projectionM: '2.6' }),
        ],
        blinds: { items: [] },
      },
      outputs: {
        materials: { lines: [], totals: { materials_ex_gst: 0 } },
        install: { actions: [], totals: { crew_minutes: 0, crew_hours: 0, install_ex_gst: 0 } },
        overhead: { method: 'site_rollup', ops_ex_gst: 0, sales_ex_gst: 0, total_ex_gst: 0 },
        totals: { cost_ex_gst: 240, cost_inc_gst: 276, warnings: [], notes_and_warnings: [] },
        warnings: [],
        cost_snapshot_version: 'v2',
        pergolas: [{ id: 'pergola-1', label: 'Pergola 1', totals: { cost_ex_gst: 240 } }],
      },
    });

    const result = buildQuoteLineItemsFromEstimate(estimate as any);

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.description.startsWith('Pergola 1: Gable + Perimeter modules')).toBe(true);
    expect(result.items[0]?.description).toContain('Style: Gable');
    expect(result.items[0]?.description).toContain('Style: Perimeter');
  });
});
