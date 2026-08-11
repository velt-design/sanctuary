import { describe, expect, it } from 'vitest';
import { calculateSiteCostV1 } from './calculate';
import { loadCostingConfigV1 } from './config';
import type { CostInputsV1, InfillInputV1 } from './types';

function infill(id: string, overrides: Partial<InfillInputV1> = {}): InfillInputV1 {
  return {
    id,
    label: `Infill ${id.toUpperCase()}`,
    qty: 1,
    location: 'side',
    acrylic_source: 'sheet_panels',
    panel_orientation: 'vertical',
    width_mode: 'target_width',
    target_panel_width_m: 1.2,
    max_panel_width_m: 1.2,
    support: {
      has_top: true,
      has_bottom: true,
      has_left: true,
      has_right: true,
      internal_support_mode: 'none',
    },
    shape: { type: 'rect', width_m: 1, height_m: 1 },
    ...overrides,
  };
}

function moduleWithInfills(infills: InfillInputV1[]): CostInputsV1 {
  return {
    length_m: 6,
    roof_span_m: 3,
    post_cut_height_m: 2.4,
    post_count: 4,
    pergola_style: 'pitched',
    box_perimeter_enabled: false,
    roof_material: 'acrylic',
    extrusion_colour: 'Black',
    house_connection_type: 'soffit',
    post_connection_type: 'deck_bracket',
    access: 'normal',
    height: 'single_storey',
    infills,
  };
}

describe('pergola infill cost attribution', () => {
  it('allocates pooled purchases, labour and overhead and reconciles every component', () => {
    const result = calculateSiteCostV1({
      pergolas: [{
        id: 'pergola-1',
        label: 'Front patio',
        modules: [moduleWithInfills([infill('a'), infill('b')])],
      }],
    });
    const pergola = result.pergolas[0]!;
    const breakdown = pergola.infill_cost_breakdown!;
    const baselinePergola = calculateSiteCostV1({
      pergolas: [{
        id: 'pergola-1',
        modules: [moduleWithInfills([])],
      }],
    }).pergolas[0]!;

    expect(pergola.infill_takeoff?.purchases.find((purchase) => purchase.material === 'acrylic_sheet')?.qty).toBe(1);
    expect(breakdown).toMatchObject({
      schema_version: 'infill_cost_breakdown_v2',
      source: '@sp/costing/engine/infill-incremental-baseline-v2',
      status: 'ready',
      scope_id: 'pergola-1',
      allocation: {
        baseline: 'site_rerun_without_infills',
        pooled_materials: 'stock_piece_usage',
        install: 'infill_labour_drivers',
        overhead: 'proportional_direct_cost',
      },
    });
    expect(breakdown.items).toHaveLength(2);
    expect(breakdown.items.every((item) =>
      item.materials_ex_gst > 0
      && item.install_ex_gst > 0
      && item.overhead_ex_gst > 0
      && item.total_ex_gst > 0,
    )).toBe(true);

    for (const field of ['materials_ex_gst', 'install_ex_gst', 'overhead_ex_gst', 'total_ex_gst'] as const) {
      if (breakdown.schema_version !== 'infill_cost_breakdown_v2') throw new Error('Expected v2 breakdown.');
      const attributed = breakdown.items.reduce((sum, item) => sum + item[field], 0) + breakdown.baseline[field];
      expect(Math.round(attributed * 100)).toBe(Math.round(breakdown.totals[field] * 100));
    }
    if (breakdown.schema_version !== 'infill_cost_breakdown_v2') throw new Error('Expected v2 breakdown.');
    expect(breakdown.baseline).toEqual({
      materials_ex_gst: baselinePergola.materials.totals.materials_ex_gst,
      install_ex_gst: baselinePergola.install.totals.install_ex_gst,
      overhead_ex_gst: Math.round((
        baselinePergola.totals.cost_ex_gst
        - baselinePergola.materials.totals.materials_ex_gst
        - baselinePergola.install.totals.install_ex_gst
      ) * 100) / 100,
      total_ex_gst: baselinePergola.totals.cost_ex_gst,
    });
    expect(breakdown.totals.materials_ex_gst).toBe(pergola.materials.totals.materials_ex_gst);
    expect(breakdown.totals.install_ex_gst).toBe(pergola.install.totals.install_ex_gst);
    expect(breakdown.totals.total_ex_gst).toBe(pergola.totals.cost_ex_gst);
  });

  it('keeps configured quantities grouped under their stable infill id', () => {
    const result = calculateSiteCostV1({
      pergolas: [{
        id: 'pergola-1',
        modules: [moduleWithInfills([infill('repeated', { qty: 2 })])],
      }],
    });

    expect(result.pergolas[0]?.infill_cost_breakdown?.items).toEqual([
      expect.objectContaining({
        module_id: 'pergola-1.module-1',
        infill_id: 'repeated',
        quantity: 2,
      }),
    ]);
  });

  it('keeps the single-installer rate and applies the Bespoke productive-time allowance', () => {
    const result = calculateSiteCostV1({
      pergolas: [{
        id: 'pergola-1',
        modules: [moduleWithInfills([infill('labour', {
          shape: { type: 'rect', width_m: 1.2, height_m: 1 },
          support: {
            has_top: false,
            has_bottom: false,
            has_left: false,
            has_right: false,
            internal_support_mode: 'none',
          },
        })])],
      }],
    });
    const actions = result.pergolas[0]!.modules[0]!.install.actions
      .filter((action) => action.id.startsWith('infill.'));

    expect(loadCostingConfigV1().installActions.basis.crew_hour_rate_ex_gst).toBe(75);
    expect(actions.reduce((sum, action) => sum + action.minutes, 0)).toBeCloseTo(270.48, 2);
    expect(actions.reduce((sum, action) => sum + action.cost_ex_gst, 0)).toBe(338.1);
    expect(actions.find((action) => action.id === 'infill.install_sheet_panels_m2')?.label)
      .toContain('Cut, prepare and install');
    expect(actions.find((action) => action.id === 'infill.install_extra_supports_each')).toMatchObject({
      qty: 4,
      minutes: 134.4,
      cost_ex_gst: 168,
    });
  });
});
