import { describe, expect, it } from 'vitest';
import { calculateCostV1, calculateJobCostV1 } from './calculate';

describe('calculateCostV1', () => {
  it('fixture: pitched, acrylic, 6m × 3m, black, soffit + deck posts, 2.4m', () => {
    const result = calculateCostV1({
      length_m: 6,
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

      travel_ex_gst: 0,
      extras_allowance_ex_gst: 0,
      quote_discount_pct: 0,
    });

    expect(result.totals.cost_ex_gst).toBeGreaterThan(0);
    expect(result.totals.cost_inc_gst).toBeGreaterThan(0);
    expect(result.materials.totals.materials_ex_gst).toBeGreaterThan(0);
    expect(result.install.totals.install_ex_gst).toBeGreaterThan(0);
    expect(result.overhead.total_ex_gst).toBeGreaterThan(0);

    expect(result.totals).toMatchSnapshot();
  });

  it('fixture: box perimeter 300x50, internal pitched roof, same geometry', () => {
    const result = calculateCostV1({
      length_m: 6,
      projection_m: 3,
      post_cut_height_m: 2.4,
      post_count: 4,

      pergola_style: 'pitched',
      box_perimeter_enabled: true,
      internal_roof_type: 'pitched',
      fall_distance_mm: 200,

      roof_material: 'acrylic',
      extrusion_colour: 'Black',

      house_connection_type: 'soffit',
      post_connection_type: 'deck_bracket',
      access: 'normal',
      height: 'single_storey',

      travel_ex_gst: 0,
      extras_allowance_ex_gst: 0,
      quote_discount_pct: 0,
    });

    expect(result.totals.cost_ex_gst).toBeGreaterThan(0);
    expect(result.totals.cost_inc_gst).toBeGreaterThan(0);

    expect(result.totals).toMatchSnapshot();
  });

  it('house connection drivers: soffit uses bracket_count; fascia/facade use stringer_fixing_count', () => {
    const baseInputs = {
      length_m: 6,
      projection_m: 3,
      post_cut_height_m: 2.4,
      post_count: 4,

      pergola_style: 'pitched' as const,
      box_perimeter_enabled: false,
      roof_material: 'acrylic' as const,
      extrusion_colour: 'Black' as const,

      post_connection_type: 'deck_bracket' as const,
      access: 'normal' as const,
      height: 'single_storey' as const,
    };

    const soffit = calculateCostV1({ ...baseInputs, house_connection_type: 'soffit' as const });
    expect(soffit.derived.bracket_count).toBe(5);
    expect(soffit.derived.stringer_fixing_count).toBe(0);
    expect(soffit.materials.lines.some((l) => l.id === 'bracket_3f6d3c53fa' && l.qty === soffit.derived.bracket_count)).toBe(true);
    expect(soffit.materials.lines.some((l) => l.id === 'powdercoating_199231d91b' && l.qty === soffit.derived.bracket_count)).toBe(true);
    expect(soffit.install.actions.find((a) => a.id === 'house.install_back_stringer_startup')?.minutes).toBeCloseTo(20, 2);
    expect(soffit.install.actions.find((a) => a.id === 'house.install_soffit_bracket')?.minutes).toBeCloseTo(soffit.derived.bracket_count * 5, 2);

    const fascia = calculateCostV1({ ...baseInputs, house_connection_type: 'fascia' as const });
    expect(fascia.derived.bracket_count).toBe(0);
    expect(fascia.derived.stringer_fixing_count).toBe(5);
    expect(fascia.install.actions.some((a) => a.id === 'house.install_soffit_bracket')).toBe(false);
    expect(fascia.materials.lines.some((l) => l.id === 'bracket_3f6d3c53fa')).toBe(false);
    expect(fascia.materials.lines.some((l) => l.id === 'powdercoating_199231d91b')).toBe(false);
    expect(fascia.install.actions.find((a) => a.id === 'house.install_back_stringer_startup')?.minutes).toBeCloseTo(20, 2);
    expect(fascia.install.actions.find((a) => a.id === 'house.install_fascia_connection')?.qty).toBe(5);
    expect(fascia.install.actions.find((a) => a.id === 'house.install_fascia_connection')?.minutes).toBeCloseTo(25, 2);

    const facade = calculateCostV1({ ...baseInputs, house_connection_type: 'facade' as const });
    expect(facade.derived.bracket_count).toBe(0);
    expect(facade.derived.stringer_fixing_count).toBe(5);
    expect(facade.install.actions.some((a) => a.id === 'house.install_soffit_bracket')).toBe(false);
    expect(facade.materials.lines.some((l) => l.id === 'anchor.chem_m12_each')).toBe(false);
    expect(facade.install.actions.find((a) => a.id === 'house.install_back_stringer_startup')?.minutes).toBeCloseTo(20, 2);
    expect(facade.install.actions.find((a) => a.id === 'house.install_facade_connection')?.qty).toBe(5);
    expect(facade.install.actions.find((a) => a.id === 'house.install_facade_connection')?.minutes).toBeCloseTo(25, 2);
  });

  it('fixture: mixed ridge skylight roof uses acrylic area + timber allowance', () => {
    const result = calculateCostV1({
      length_m: 6,
      projection_m: 3,
      post_cut_height_m: 2.4,
      post_count: 4,

      pergola_style: 'gable',
      box_perimeter_enabled: false,
      roof_material: 'mixed',
      mixed_roof: {
        mode: 'ridge_skylight',
        ridge_skylight: {
          strip_count: 1,
          strip_width_m: 0.62,
        },
      },
      extrusion_colour: 'Black',

      house_connection_type: 'soffit',
      post_connection_type: 'deck_bracket',
      access: 'normal',
      height: 'single_storey',

      travel_ex_gst: 0,
      extras_allowance_ex_gst: 0,
      quote_discount_pct: 0,
    });

    expect(result.derived.acrylic_area_m2).toBeCloseTo(3.72, 2);
    expect(result.totals.cost_ex_gst).toBeGreaterThan(0);
  });

  it('mixed: acrylic bays per plane drive derived areas, BOM panels, and labour', () => {
    const result = calculateCostV1({
      length_m: 5,
      projection_m: 3,
      roof_pitch_deg: 5,
      post_cut_height_m: 2.4,
      post_count: 4,

      pergola_style: 'pitched',
      box_perimeter_enabled: false,
      roof_material: 'mixed',
      mixed_roof: {
        mode: 'acrylic_bays',
        acrylic_bays_by_plane: { main: 4 },
      },
      extrusion_colour: 'Black',

      house_connection_type: 'soffit',
      post_connection_type: 'deck_bracket',
      access: 'normal',
      height: 'single_storey',
    });

    expect(result.derived.acrylic_area_m2).toBeGreaterThan(0);
    expect((result.derived as any).timber_area_m2).toBeGreaterThan(0);
    expect(result.derived.roof_surface_area_m2).toBeCloseTo(result.derived.acrylic_area_m2 + (result.derived as any).timber_area_m2, 1);

    const plexiLines = result.materials.lines.filter((l) => l.id.startsWith('roofing-sheet_e1f7673c14'));
    expect(plexiLines.length).toBe(1);
    expect(plexiLines[0].qty).toBe(2);

    const cedarLine = result.materials.lines.find((l) => l.id === 'roofing-timber_cedar_sarking_wrc_110cover_12mm_lm');
    expect(cedarLine?.qty).toBeGreaterThan(0);

    expect(result.install.actions.some((a) => a.id === 'roof.install_acrylic_roof_m2')).toBe(true);
    expect(result.install.actions.some((a) => a.id === 'roof.install_timber_roof_m2')).toBe(true);
  });

  it('mixed: acrylic bays clamp to plane bay count and warn', () => {
    const result = calculateCostV1({
      length_m: 5,
      projection_m: 3,
      roof_pitch_deg: 5,
      post_cut_height_m: 2.4,
      post_count: 4,

      pergola_style: 'pitched',
      box_perimeter_enabled: false,
      roof_material: 'mixed',
      mixed_roof: {
        mode: 'acrylic_bays',
        acrylic_bays_by_plane: { main: 999 },
      },
      extrusion_colour: 'Black',

      house_connection_type: 'soffit',
      post_connection_type: 'deck_bracket',
      access: 'normal',
      height: 'single_storey',
    });

    expect(result.totals.notes_and_warnings.some((w) => w.toLowerCase().includes('clamping'))).toBe(true);
  });

  it('roofing: pitched acrylic uses sheet mode when rafter length <= 3.05m', () => {
    const result = calculateCostV1({
      length_m: 6,
      projection_m: 3,
      roof_pitch_deg: 5,
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
    });

    const plexiLines = result.materials.lines.filter((l) => l.id.startsWith('roofing-sheet_e1f7673c14'));
    expect(plexiLines.length).toBe(1);
    expect(plexiLines[0].qty).toBe(4);

    const crystaliteLines = result.materials.lines.filter((l) => l.id.startsWith('roofing-sheet_d557d79c33'));
    expect(crystaliteLines.length).toBe(0);
  });

  it('roofing: pitched acrylic uses 4m strips when rafter length exceeds sheet length', () => {
    const result = calculateCostV1({
      length_m: 6,
      projection_m: 3.6,
      roof_pitch_deg: 5,
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
    });

    const stripLines = result.materials.lines.filter((l) => l.id.startsWith('roofing-sheet_d557d79c33'));
    expect(stripLines.length).toBe(1);
    expect(stripLines[0].qty).toBe(result.derived.bay_count);
  });

  it('roofing: warns when acrylic slope exceeds 6m', () => {
    const result = calculateCostV1({
      length_m: 6,
      projection_m: 6.2,
      roof_pitch_deg: 5,
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
    });

    expect(result.totals.notes_and_warnings.some((w) => w.toLowerCase().includes('acrylic slope exceeds'))).toBe(true);
  });

  it('roofing: timber cedar takeoff increases with pitch', () => {
    const base = {
      length_m: 6,
      projection_m: 3,
      post_cut_height_m: 2.4,
      post_count: 4,

      pergola_style: 'pitched' as const,
      box_perimeter_enabled: false,
      roof_material: 'timber' as const,
      extrusion_colour: 'Black' as const,

      house_connection_type: 'soffit' as const,
      post_connection_type: 'deck_bracket' as const,
      access: 'normal' as const,
      height: 'single_storey' as const,
    };

    const lowPitch = calculateCostV1({ ...base, roof_pitch_deg: 5 });
    const highPitch = calculateCostV1({ ...base, roof_pitch_deg: 25 });

    const cedarLow = lowPitch.materials.lines.find((l) => l.id === 'roofing-timber_cedar_sarking_wrc_110cover_12mm_lm');
    const cedarHigh = highPitch.materials.lines.find((l) => l.id === 'roofing-timber_cedar_sarking_wrc_110cover_12mm_lm');

    expect(cedarLow?.qty).toBeGreaterThan(0);
    expect(cedarHigh?.qty).toBeGreaterThan(cedarLow?.qty ?? 0);
  });

  it('job rollup: overhead does not double with two modules', () => {
    const moduleInputs = {
      length_m: 6,
      projection_m: 3,
      post_cut_height_m: 2.4,
      post_count: 4,

      pergola_style: 'pitched' as const,
      box_perimeter_enabled: false,
      roof_material: 'acrylic' as const,
      extrusion_colour: 'Black' as const,

      house_connection_type: 'soffit' as const,
      post_connection_type: 'deck_bracket' as const,
      access: 'normal' as const,
      height: 'single_storey' as const,

      travel_ex_gst: 0,
      extras_allowance_ex_gst: 0,
      quote_discount_pct: 0,
    };

    const single = calculateCostV1(moduleInputs);
    const job = calculateJobCostV1({
      modules: [moduleInputs, moduleInputs],
      travel_ex_gst: 0,
      extras_allowance_ex_gst: 0,
    });

    expect(job.module_count).toBe(2);
    expect(job.overhead.total_ex_gst).toBeLessThan(single.overhead.total_ex_gst * 2);
    expect(job.totals.cost_ex_gst).toBeGreaterThan(0);
    expect(job.modules[0].overhead.total_ex_gst).toBe(0);
  });

  it('fixture: hip corner uses two wings + allowance', () => {
    const result = calculateCostV1({
      length_m: 6,
      projection_m: 3,
      hip_corner: { length_b_m: 4, projection_b_m: 2 },
      post_cut_height_m: 2.4,
      post_count: 4,

      pergola_style: 'hip_corner',
      box_perimeter_enabled: false,
      roof_material: 'acrylic',
      extrusion_colour: 'Black',

      house_connection_type: 'soffit',
      post_connection_type: 'deck_bracket',
      access: 'normal',
      height: 'single_storey',
    });

    expect(result.derived.rafter_count).toBe(19);
    expect(result.derived.bracket_count).toBe(9);
    expect(result.install.actions.some((a) => a.id === 'roof.hip_corner_allowance')).toBe(true);
    expect(result.install.actions.find((a) => a.id === 'roof.install_flashing_m')?.qty).toBe(10);
    expect(result.install.actions.find((a) => a.id === 'roof.apply_foam_seal_m')?.qty).toBe(10);
    expect(result.totals.cost_ex_gst).toBeGreaterThan(0);
  });

  it('job rollup: job-scoped actions appear once and scale with module_count', () => {
    const moduleInputs = {
      length_m: 6,
      projection_m: 3,
      post_cut_height_m: 2.4,
      post_count: 4,

      pergola_style: 'pitched' as const,
      box_perimeter_enabled: false,
      roof_material: 'acrylic' as const,
      extrusion_colour: 'Black' as const,

      house_connection_type: 'soffit' as const,
      post_connection_type: 'deck_bracket' as const,
      access: 'normal' as const,
      height: 'single_storey' as const,

      travel_ex_gst: 0,
      extras_allowance_ex_gst: 0,
      quote_discount_pct: 0,
    };

    const job = calculateJobCostV1({
      modules: [moduleInputs, moduleInputs],
      travel_ex_gst: 0,
      extras_allowance_ex_gst: 0,
    });

    const toolSetup = job.install.actions.find((a) => a.id === 'job.mob.tool_setup');
    const survey = job.install.actions.find((a) => a.id === 'job.mob.site_survey');

    expect(toolSetup?.qty).toBe(1);
    expect(survey?.qty).toBe(2);
  });
});
