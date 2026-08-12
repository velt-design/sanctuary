import { describe, expect, it } from 'vitest';
import { applyCostingControlConfigV1, snapshotCostingControlConfigV1 } from '../controlConfig';
import { calculateCostV1, calculateSiteCostV1 } from './calculate';
import { loadCostingConfigV1 } from './config';
import {
  INFILL_JOB_SETUP_ACTION_ID,
  INFILL_SHAPED_OPENING_ACTION_ID,
} from './infillLabourPolicy';
import type { CostInputsV1, InfillInputV1 } from './types';

function infill(id: string, shape: InfillInputV1['shape'], qty = 1): InfillInputV1 {
  return {
    id,
    qty,
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
    shape,
  };
}

function moduleWithInfills(infills: InfillInputV1[]): CostInputsV1 {
  return {
    length_m: 6,
    projection_m: 3,
    post_cut_height_m: 2.4,
    post_count: 4,
    pergola_style: 'pitched',
    roof_material: 'acrylic',
    extrusion_colour: 'Black',
    house_connection_type: 'facade',
    post_connection_type: 'deck_bracket',
    access: 'normal',
    height: 'single_storey',
    infills,
  };
}

describe('manifest v2.6 infill labour policy', () => {
  it('adds one hour once and thirty minutes for each shaped opening', () => {
    const result = calculateCostV1(moduleWithInfills([
      infill('rect', { type: 'rect', width_m: 1.2, height_m: 1 }),
      infill('slope', { type: 'mono_slope', width_m: 1.2, height_low_m: 0.4, height_high_m: 1 }, 2),
    ]));

    expect(result.install.actions.find((action) => action.id === INFILL_JOB_SETUP_ACTION_ID)).toMatchObject({
      qty: 1,
      minutes: 60,
      cost_ex_gst: 75,
    });
    expect(result.install.actions.find((action) => action.id === INFILL_SHAPED_OPENING_ACTION_ID)).toMatchObject({
      qty: 2,
      minutes: 60,
      cost_ex_gst: 75,
    });
  });

  it('charges job setup only once across pergolas and modules', () => {
    const result = calculateSiteCostV1({
      pergolas: [
        {
          id: 'pergola-1',
          modules: [
            moduleWithInfills([infill('one', { type: 'rect', width_m: 1, height_m: 1 })]),
            moduleWithInfills([infill('two', { type: 'rect', width_m: 1, height_m: 1 })]),
          ],
        },
        {
          id: 'pergola-2',
          modules: [moduleWithInfills([infill('three', { type: 'rect', width_m: 1, height_m: 1 })])],
        },
      ],
    });
    const setupActions = result.install.actions.filter((action) => action.id.endsWith(INFILL_JOB_SETUP_ACTION_ID));

    expect(setupActions).toHaveLength(1);
    expect(setupActions[0]).toMatchObject({ minutes: 72, cost_ex_gst: 90 });
    expect(result.pergolas[0]?.infill_cost_breakdown?.status).toBe('ready');
  });

  it('does not double-charge setup when module and standalone infills coexist', () => {
    const result = calculateSiteCostV1({
      pergolas: [{
        id: 'pergola-1',
        modules: [moduleWithInfills([infill('new', { type: 'rect', width_m: 1, height_m: 1 })])],
      }],
      standalone_infills: {
        extrusion_colour: 'Black',
        access: 'normal',
        height: 'single_storey',
        infills: [infill('existing', { type: 'mono_slope', width_m: 1, height_low_m: 0, height_high_m: 1 })],
      },
    });

    expect(result.install.actions.filter((action) => action.id.endsWith(INFILL_JOB_SETUP_ACTION_ID))).toHaveLength(1);
    expect(result.standalone_infills?.install.actions.some((action) => action.id === INFILL_JOB_SETUP_ACTION_ID)).toBe(false);
    expect(result.standalone_infills?.install.actions.find((action) => action.id === INFILL_SHAPED_OPENING_ACTION_ID))
      .toMatchObject({ qty: 1, minutes: 36, cost_ex_gst: 45 });
  });

  it('keeps published v2.5 infill labour unchanged', () => {
    const active = loadCostingConfigV1();
    const historicalControl = snapshotCostingControlConfigV1(active);
    historicalControl.baseManifestVersion = 'v2.5';
    const historical = applyCostingControlConfigV1(active, historicalControl);
    const result = calculateCostV1(moduleWithInfills([
      infill('slope', { type: 'mono_slope', width_m: 1.2, height_low_m: 0, height_high_m: 1 }),
    ]), historical);

    expect(result.install.actions.some((action) =>
      action.id === INFILL_JOB_SETUP_ACTION_ID || action.id === INFILL_SHAPED_OPENING_ACTION_ID,
    )).toBe(false);
  });
});
