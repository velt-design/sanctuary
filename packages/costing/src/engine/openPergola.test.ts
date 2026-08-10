import { describe, expect, it } from 'vitest';
import { calculateCostV1 } from './calculate';

describe('open pergola costing', () => {
  it('costs a flat 150x50 pitched frame without roofing or drainage', () => {
    const result = calculateCostV1({
      length_m: 6,
      projection_m: 3,
      roof_pitch_deg: 12,
      rafter_spacing_mm: 700,
      post_cut_height_m: 2.4,
      post_count: 4,
      pergola_style: 'gable',
      box_perimeter_enabled: true,
      roof_material: 'none',
      extrusion_colour: 'Black',
      house_connection_type: 'soffit',
      post_connection_type: 'deck_bracket',
      access: 'normal',
      height: 'single_storey',
      downpipe_count: 2,
      downpipe_join_count: 2,
      downpipe_elbow_count: 2,
      separate_gutter_enabled: true,
      overhang_enabled: true,
      inverted_enabled: true,
      flashings: { extras: [{ band: '301-400', length_m: 2 }] },
      overrides: {
        ledger_profile: '100x50',
        rafter_profile: '80x50',
        front_beam_profile: 'SP Gutter',
        post_profile: '150x150',
      },
    });

    expect(result.inputs_normalized).toMatchObject({
      structure_type: 'pitched',
      pergola_style_ui: 'pitched',
      roof_type: 'pitched',
      roof_material: 'none',
      roof_pitch_deg: 0,
      rafter_profile: '150x50',
      gutter_length_m: 0,
      downpipe_count: 0,
      downpipe_join_count: 0,
      downpipe_elbow_count: 0,
      foam_length_m: 0,
    });
    expect(result.derived).toMatchObject({
      roof_pitch_deg_used: 0,
      rafter_count: 10,
      ledger_profile_used: '150x50',
      front_beam_profile_used: '150x50',
      post_profile_used: '150x150',
      flashing_total_m: 0,
      our_gutter_length_m: 0,
    });
    expect(result.derived.rafter_spacing_mm).toBeCloseTo(6000 / 9, 6);
    expect(result.install.actions.some((action) => action.id.startsWith('roof.'))).toBe(false);
    expect(result.install.actions.some((action) => action.id === 'rafters.install_rafter_pitched')).toBe(true);
    expect(result.install.actions.some((action) => action.id === 'frame.install_front_beam_m')).toBe(true);
    expect(result.materials.lines.some((line) => /acrylic|cedar|flashing|gutter|foam/i.test(`${line.id} ${line.label}`))).toBe(false);
  });
});
