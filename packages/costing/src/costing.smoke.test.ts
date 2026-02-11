import { describe, expect, it } from 'vitest';
import { calculateCostV1, loadCostingConfigV1 } from '@sp/costing';

describe('costing package smoke', () => {
  it('loads config and calculates a minimal acrylic job', () => {
    const config = loadCostingConfigV1();
    const result = calculateCostV1(
      {
        length_m: 3,
        projection_m: 3,
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
      },
      config,
    );

    expect(result.totals.cost_ex_gst).toBeGreaterThan(0);
    expect(result.inputs_normalized.roof_material).toBe('acrylic');
  });
});
