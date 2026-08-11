import { describe, expect, it } from 'vitest';
import { calculateCostV1, calculateJobCostV1, calculateSiteCostV1 } from './calculate';
import { loadCostingConfigV1 } from './config';
import { DAY_CYCLE_ACTION_IDS } from './install';

function roundMoney(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

function multipliedFactors(factors: Record<string, number> | undefined): number {
  return Object.values(factors ?? {}).reduce((acc, value) => acc * (Number.isFinite(value) ? value : 1), 1);
}

function inferredBaseMinutesPerUnit(action: { qty: number; minutes: number; applied_multipliers: Record<string, number> }): number {
  const factor = multipliedFactors(action.applied_multipliers);
  if (!Number.isFinite(action.qty) || action.qty <= 0 || !Number.isFinite(factor) || factor <= 0) return 0;
  return action.minutes / action.qty / factor;
}

function findPowdercoatForBar(config: ReturnType<typeof loadCostingConfigV1>, barId: string) {
  const barItem = config.materials.items.find((it) => it.id === barId);
  if (!barItem) return null;
  const attrs = barItem.attributes as Record<string, unknown> | undefined;
  if (!attrs) return null;
  const profile = attrs.profile;
  const length = attrs.length_m;
  if (typeof profile !== 'string' || typeof length !== 'number') return null;
  const powderItem = config.materials.items.find((it) => {
    if (it.category !== 'powdercoating' || it.unit !== 'bar') return false;
    const attrsPowder = it.attributes as Record<string, unknown> | undefined;
    return attrsPowder?.profile === profile && attrsPowder?.length_m === length;
  });
  return { barItem, powderItem };
}

function buildTestConfig(baseMinutes: number, baseScope: 'module' | 'job' = 'module') {
  const cfg = loadCostingConfigV1();
  const dayCycleActions = cfg.installActions.actions.filter((action) =>
    (DAY_CYCLE_ACTION_IDS as readonly string[]).includes(action.id),
  );
  if (dayCycleActions.length !== DAY_CYCLE_ACTION_IDS.length) {
    throw new Error('Day cycle actions missing from config.');
  }

  const baseAction = {
    id: 'test.base_action',
    category: 'Test',
    label: 'Test base action',
    unit: 'job',
    quantity: { type: 'fixed', value: 1 },
    base_minutes: baseMinutes,
    applies_to: {},
    apply_multipliers: [],
    notes: '',
    scope: baseScope,
  } as const;

  return {
    ...cfg,
    installActions: {
      ...cfg.installActions,
      actions: [baseAction, ...dayCycleActions],
    },
  };
}

describe('calculateCostV1', () => {
  it('prices additional aluminium as full bars with module finish and no added labour', () => {
    const baseInput = {
      length_m: 6,
      projection_m: 3,
      post_cut_height_m: 2.4,
      post_count: 4,
      pergola_style: 'pitched' as const,
      roof_material: 'acrylic' as const,
      extrusion_colour: 'Mill' as const,
      powdercoat_is_custom: true,
      powdercoat_custom_colour: 'Special Bronze',
      house_connection_type: 'soffit' as const,
      post_connection_type: 'deck_bracket' as const,
      access: 'normal' as const,
      height: 'single_storey' as const,
    };
    const baseline = calculateCostV1(baseInput);
    const result = calculateCostV1({
      ...baseInput,
      additional_aluminium: [{ id: 'odd-member', profile: '200x50', stock_length_m: 6, quantity: 2 }],
    });

    const additionalLine = result.materials.lines.find((line) =>
      line.profile === '200x50' && line.notes?.includes('Additional aluminium'),
    );
    expect(additionalLine).toMatchObject({ qty: 2, unit: 'bar', profile: '200x50' });
    expect(additionalLine?.unit_cost_ex_gst).toBeCloseTo(170.4174 + (40.4853 * 1.2), 2);
    expect(result.install).toEqual(baseline.install);
    expect(result.totals.cost_ex_gst).toBeGreaterThan(baseline.totals.cost_ex_gst);
    expect(result.totals.warnings.some((warning) => warning.message.includes('Powdercoat pricebook item not found'))).toBe(false);
  });
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
    expect(result.overhead.method).toBe('fixed_plus_variable');
    expect(result.overhead.ops_ex_gst).toBeGreaterThan(2000);
    expect(result.overhead.sales_ex_gst).toBeGreaterThan(0);
    expect(result.overhead.total_ex_gst).toBeGreaterThan(2000);

    expect(result.totals).toMatchSnapshot();
  });

  it('acrylic overhead stays flat when sloped rafter length is at or below 3m', () => {
    const result = calculateCostV1({
      length_m: 6,
      projection_m: 3,
      roof_pitch_deg: 0,
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

    expect(result.derived.rafter_length_m).toBeCloseTo(3, 6);
    expect(result.overhead.method).toBe('flat_acrylic_total');
    expect(result.overhead.ops_ex_gst).toBe(2000);
    expect(result.overhead.sales_ex_gst).toBe(0);
    expect(result.overhead.total_ex_gst).toBe(2000);
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

  it('box perimeter: gutter materials + install action apply', () => {
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
    });

    const gutterLine = result.materials.lines.find((l) => l.profile === 'Box Gutter 100x100x3');
    expect(gutterLine?.qty).toBeGreaterThan(0);
    const gutterAction = result.install.actions.find((a) => a.id === 'drain.install_box_gutter_m');
    expect(gutterAction?.qty).toBe(result.derived.our_gutter_length_m);
  });

  it('box perimeter pitched: auto pitch within fall envelope (no INVALID warnings)', () => {
    const result = calculateCostV1({
      length_m: 3,
      projection_m: 3,
      post_cut_height_m: 2.4,
      post_count: 4,

      pergola_style: 'pitched',
      box_perimeter_enabled: true,
      internal_roof_type: 'pitched',

      roof_material: 'acrylic',
      extrusion_colour: 'Black',

      house_connection_type: 'soffit',
      post_connection_type: 'deck_bracket',
      access: 'normal',
      height: 'single_storey',
    });

    const hasInvalid = result.totals.warnings.some((w) => w.message.includes('INVALID'));
    expect(hasInvalid).toBe(false);
    expect(result.derived.box_pitch_deg_used).toBeGreaterThanOrEqual(3);
    expect(result.derived.box_rise_mm).toBeLessThanOrEqual(200.01);
  });

  it('box perimeter pitched: span too large triggers INVALID warning', () => {
    const result = calculateCostV1({
      length_m: 3,
      projection_m: 4.5,
      post_cut_height_m: 2.4,
      post_count: 4,

      pergola_style: 'pitched',
      box_perimeter_enabled: true,
      internal_roof_type: 'pitched',

      roof_material: 'acrylic',
      extrusion_colour: 'Black',

      house_connection_type: 'soffit',
      post_connection_type: 'deck_bracket',
      access: 'normal',
      height: 'single_storey',
    });

    const hasInvalid = result.totals.warnings.some((w) => w.message.includes('INVALID'));
    expect(hasInvalid).toBe(true);
  });

  it('box perimeter gable: larger span passes when pitched fails', () => {
    const pitched = calculateCostV1({
      length_m: 3,
      projection_m: 4.5,
      post_cut_height_m: 2.4,
      post_count: 4,

      pergola_style: 'pitched',
      box_perimeter_enabled: true,
      internal_roof_type: 'pitched',

      roof_material: 'acrylic',
      extrusion_colour: 'Black',

      house_connection_type: 'soffit',
      post_connection_type: 'deck_bracket',
      access: 'normal',
      height: 'single_storey',
    });

    const gable = calculateCostV1({
      length_m: 3,
      projection_m: 4.5,
      post_cut_height_m: 2.4,
      post_count: 4,

      pergola_style: 'pitched',
      box_perimeter_enabled: true,
      internal_roof_type: 'gable',

      roof_material: 'acrylic',
      extrusion_colour: 'Black',

      house_connection_type: 'soffit',
      post_connection_type: 'deck_bracket',
      access: 'normal',
      height: 'single_storey',
    });

    expect(pitched.totals.warnings.some((w) => w.message.includes('INVALID'))).toBe(true);
    expect(gable.totals.warnings.some((w) => w.message.includes('INVALID'))).toBe(false);
    expect(gable.derived.box_pitch_deg_used).toBeGreaterThanOrEqual(3);
  });

  it('box perimeter gable: defaults to house + our gutters when fixed to house', () => {
    const result = calculateCostV1({
      length_m: 6,
      projection_m: 3,
      post_cut_height_m: 2.4,
      post_count: 4,

      pergola_style: 'pitched',
      box_perimeter_enabled: true,
      internal_roof_type: 'gable',

      roof_material: 'acrylic',
      extrusion_colour: 'Black',

      house_connection_type: 'soffit',
      post_connection_type: 'deck_bracket',
      access: 'normal',
      height: 'single_storey',
    });

    expect(result.derived.our_gutter_length_m).toBeCloseTo(6, 4);
    expect(result.inputs_normalized.gutter_type).toBe('box_gutter_100x100_cut');
    const gutterLine = result.materials.lines.find((l) => l.profile === 'Box Gutter 100x100x3');
    expect(gutterLine?.qty).toBeGreaterThan(0);
    const gutterAction = result.install.actions.find((a) => a.id === 'drain.install_box_gutter_m');
    expect(gutterAction?.qty).toBeCloseTo(result.derived.our_gutter_length_m, 4);
  });

  it('overhang: adds support beam, stringer, extra brackets, end caps, and gutter stock', () => {
    const base = calculateCostV1({
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
    });

    const result = calculateCostV1({
      length_m: 6,
      projection_m: 3,
      post_cut_height_m: 2.4,
      post_count: 4,

      pergola_style: 'pitched',
      box_perimeter_enabled: false,
      roof_material: 'acrylic',
      extrusion_colour: 'Black',

      overhang_enabled: true,
      overhang_amount_m: 0.2,
      overhang_support_beam_profile: '150x50',

      house_connection_type: 'soffit',
      post_connection_type: 'deck_bracket',
      access: 'normal',
      height: 'single_storey',
    });

    expect(result.derived.overhang_support_beam_profile_used).toBe('150x50');
    expect(result.derived.overhang_stringer_profile_used).toBe(result.inputs_normalized.rafter_profile);
    expect(result.derived.rafter_cut_length_m).toBeCloseTo(base.derived.rafter_cut_length_m, 6);
    expect(result.materials.totals.bars_by_profile['Overhang Gutter 100x100']).toBeTruthy();
    const midBracket = result.materials.lines.find((l) => l.id === 'bracket_mid_support_rafters');
    expect(midBracket?.qty).toBe(result.derived.rafter_count);
    const endCapBeam = result.materials.lines.find((l) => l.id === 'end_cap_overhang_support_beam');
    const endCapStringer = result.materials.lines.find((l) => l.id === 'end_cap_overhang_stringer');
    expect(endCapBeam?.qty).toBe(2);
    expect(endCapStringer?.qty).toBe(2);
  });

  it('overhang + inverted + house gutter: no gutters, but flashing/foam remain', () => {
    const result = calculateCostV1({
      length_m: 6,
      projection_m: 3,
      post_cut_height_m: 2.4,
      post_count: 4,

      pergola_style: 'pitched',
      box_perimeter_enabled: false,
      roof_material: 'acrylic',
      extrusion_colour: 'Black',

      overhang_enabled: true,
      overhang_amount_m: 0.2,
      overhang_support_beam_profile: '150x50',
      inverted_enabled: true,
      inverted_house_gutter: true,

      house_connection_type: 'soffit',
      post_connection_type: 'deck_bracket',
      access: 'normal',
      height: 'single_storey',
    });

    expect(result.inputs_normalized.gutter_type).toBeNull();
    expect(result.materials.lines.some((l) => l.profile === 'SP Gutter')).toBe(false);
    expect(result.materials.lines.some((l) => l.profile === 'Overhang Gutter 100x100')).toBe(false);
    expect(result.materials.lines.some((l) => String(l.label ?? '').includes('Foam'))).toBe(true);
    expect(result.materials.lines.some((l) => String(l.id).startsWith('roof.flashing_'))).toBe(true);
  });

  it('front beam override disables integrated gutter unless SP gutter selected', () => {
    const result = calculateCostV1({
      length_m: 6,
      projection_m: 3,
      post_cut_height_m: 2.4,
      post_count: 4,

      pergola_style: 'pitched',
      box_perimeter_enabled: false,
      roof_material: 'acrylic',
      extrusion_colour: 'Black',

      overrides: {
        front_beam_profile: '150x50',
      },

      house_connection_type: 'soffit',
      post_connection_type: 'deck_bracket',
      access: 'normal',
      height: 'single_storey',
    });

    expect(result.derived.integrated_gutter_beam).toBe(false);
    expect(result.derived.gutter_assembly_mode).toBe('none');
    expect(result.materials.totals.bars_by_profile['SP Gutter']).toBeUndefined();
    expect(result.materials.totals.bars_by_profile['150x50']).toBeTruthy();
    expect(result.install.actions.find((a) => a.id === 'frame.install_front_beam_m')?.qty).toBeCloseTo(6, 6);
  });

  it('separate gutter adds 100x100 cut stock when front beam is not a gutter', () => {
    const result = calculateCostV1({
      length_m: 6,
      projection_m: 3,
      post_cut_height_m: 2.4,
      post_count: 4,

      pergola_style: 'pitched',
      box_perimeter_enabled: false,
      roof_material: 'acrylic',
      extrusion_colour: 'Black',

      separate_gutter_enabled: true,
      overrides: {
        front_beam_profile: '150x50',
      },

      house_connection_type: 'soffit',
      post_connection_type: 'deck_bracket',
      access: 'normal',
      height: 'single_storey',
    });

    expect(result.derived.gutter_assembly_mode).toBe('separate');
    expect(result.materials.totals.bars_by_profile['SP Gutter']).toBeUndefined();
    expect(result.materials.totals.bars_by_profile['Box Gutter 100x100x3']).toBeTruthy();
  });

  it('ledger override is independent of rafter override', () => {
    const result = calculateCostV1({
      length_m: 6,
      projection_m: 3,
      post_cut_height_m: 2.4,
      post_count: 4,

      pergola_style: 'pitched',
      box_perimeter_enabled: false,
      roof_material: 'acrylic',
      extrusion_colour: 'Black',

      overrides: {
        ledger_profile: '150x50',
        rafter_profile: '100x50',
      },

      house_connection_type: 'soffit',
      post_connection_type: 'deck_bracket',
      access: 'normal',
      height: 'single_storey',
    });

    expect(result.inputs_normalized.rafter_profile).toBe('100x50');
    expect(result.derived.ledger_profile_used).toBe('150x50');
  });

  it('steel beam overrides add hiab and apply 2.5x install minutes per steel beam action', () => {
    const baseInput = {
      length_m: 6,
      projection_m: 3,
      post_cut_height_m: 2.4,
      post_count: 4,
      overhang_enabled: true,
      overhang_amount_m: 0.2,
      gable_end_frames_mode: 'both_ends' as const,

      pergola_style: 'gable' as const,
      box_perimeter_enabled: false,
      roof_material: 'acrylic' as const,
      extrusion_colour: 'Black' as const,

      house_connection_type: 'soffit' as const,
      post_connection_type: 'deck_bracket' as const,
      access: 'normal' as const,
      height: 'single_storey' as const,
    };

    const alloy = calculateCostV1({
      ...baseInput,
      overrides: {
        front_beam_profile: '150x50',
        tie_beam_profile: '150x50',
        ridge_beam_profile: '150x50',
        overhang_support_beam_profile: '150x50',
      },
    });

    const steel = calculateCostV1({
      ...baseInput,
      overrides: {
        front_beam_profile: 'RHS 150x50x3',
        tie_beam_profile: 'RHS 150x50x3',
        ridge_beam_profile: 'RHS 150x50x3',
        overhang_support_beam_profile: 'RHS 150x50x3',
      },
    });

    expect(alloy.materials.lines.some((l) => l.id === 'hire.hiab_day')).toBe(false);
    const hiab = steel.materials.lines.find((l) => l.id === 'hire.hiab_day');
    expect(hiab?.qty).toBe(1);
    expect(hiab?.line_cost_ex_gst ?? 0).toBeCloseTo(695.65, 2);
    expect(alloy.install.actions.some((a) => a.id === 'frame.steel_beam_labour_m')).toBe(false);

    const actionIds = [
      'frame.install_front_beam_m',
      'frame.install_tie_beam_m',
      'roof.install_ridge_beam_m',
      'frame.overhang_support_beam_m',
    ] as const;
    for (const actionId of actionIds) {
      const alloyAction = alloy.install.actions.find((a) => a.id === actionId);
      const steelAction = steel.install.actions.find((a) => a.id === actionId);
      expect(alloyAction?.minutes).toBeGreaterThan(0);
      expect(steelAction?.minutes).toBeGreaterThan(0);
      expect((steelAction?.minutes ?? 0) / Math.max(alloyAction?.minutes ?? 0, 1e-6)).toBeCloseTo(2.5, 2);
    }

    const expectedSteelInstalledLength = actionIds.reduce((sum, actionId) => {
      const action = steel.install.actions.find((candidate) => candidate.id === actionId);
      return sum + (action?.qty ?? 0);
    }, 0);
    const steelBeamLabour = steel.install.actions.find((a) => a.id === 'frame.steel_beam_labour_m');
    expect(steelBeamLabour?.qty ?? 0).toBeCloseTo(expectedSteelInstalledLength, 6);
    expect(steelBeamLabour?.minutes ?? 0).toBeCloseTo(expectedSteelInstalledLength * 30, 6);
  });

  it('steel RHS front beam can select 8m stock', () => {
    const result = calculateCostV1({
      length_m: 7.2,
      projection_m: 3,
      post_cut_height_m: 2.4,
      post_count: 4,

      pergola_style: 'pitched',
      box_perimeter_enabled: false,
      roof_material: 'acrylic',
      extrusion_colour: 'Black',
      overrides: { front_beam_profile: 'RHS 150x50x3' },

      house_connection_type: 'soffit',
      post_connection_type: 'deck_bracket',
      access: 'normal',
      height: 'single_storey',
    });

    expect(result.materials.totals.bars_by_profile['RHS 150x50x3']).toEqual({
      stock_length_m: 8,
      bars_used: 1,
    });
    const steelBeamLabour = result.install.actions.find((a) => a.id === 'frame.steel_beam_labour_m');
    expect(steelBeamLabour?.qty ?? 0).toBeCloseTo(result.derived.front_beam_length_m ?? 0, 6);
    expect(steelBeamLabour?.minutes ?? 0).toBeCloseTo((result.derived.front_beam_length_m ?? 0) * 30, 6);
  });

  it('inverted + house gutter ignores separate gutter selection', () => {
    const result = calculateCostV1({
      length_m: 6,
      projection_m: 3,
      post_cut_height_m: 2.4,
      post_count: 4,

      pergola_style: 'pitched',
      box_perimeter_enabled: false,
      roof_material: 'acrylic',
      extrusion_colour: 'Black',

      inverted_enabled: true,
      inverted_house_gutter: true,
      separate_gutter_enabled: true,
      overrides: {
        front_beam_profile: '150x50',
      },

      house_connection_type: 'soffit',
      post_connection_type: 'deck_bracket',
      access: 'normal',
      height: 'single_storey',
    });

    expect(result.derived.separate_gutter_enabled).toBe(false);
    expect(result.derived.gutter_assembly_mode).toBe('none');
    expect(result.materials.totals.bars_by_profile['Box Gutter 100x100x3']).toBeUndefined();
  });

  it('inverted pitched + house gutter: no gutters, outer posts higher', () => {
    const result = calculateCostV1({
      length_m: 6,
      projection_m: 3,
      post_cut_height_m: 2.4,
      post_count: 4,

      pergola_style: 'pitched',
      box_perimeter_enabled: false,
      roof_material: 'acrylic',
      extrusion_colour: 'Black',

      inverted_enabled: true,
      inverted_house_gutter: true,

      house_connection_type: 'soffit',
      post_connection_type: 'deck_bracket',
      access: 'normal',
      height: 'single_storey',
    });

    expect(result.inputs_normalized.gutter_type).toBeNull();
    expect(result.materials.lines.some((l) => l.profile === 'SP Gutter')).toBe(false);
    expect(result.derived.post_cut_height_outer_side_m).toBeGreaterThan(result.derived.post_cut_height_house_side_m ?? 0);
    expect(result.materials.lines.some((l) => String(l.id).startsWith('roof.flashing_'))).toBe(true);
  });

  it('inverted pitched + our gutter: SP gutter at house edge', () => {
    const result = calculateCostV1({
      length_m: 6,
      projection_m: 3,
      post_cut_height_m: 2.4,
      post_count: 4,

      pergola_style: 'pitched',
      box_perimeter_enabled: false,
      roof_material: 'acrylic',
      extrusion_colour: 'Black',

      inverted_enabled: true,
      inverted_house_gutter: false,

      house_connection_type: 'soffit',
      post_connection_type: 'deck_bracket',
      access: 'normal',
      height: 'single_storey',
    });

    expect(result.inputs_normalized.gutter_type).toBe('sp_gutter');
    expect(result.materials.lines.some((l) => l.profile === 'SP Gutter')).toBe(true);
    expect(result.derived.post_cut_height_outer_side_m).toBeGreaterThan(result.derived.post_cut_height_house_side_m ?? 0);
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
    expect(soffit.install.actions.find((a) => a.id === 'house.install_back_stringer_startup')?.minutes).toBeCloseTo(36, 2);
    expect(soffit.install.actions.find((a) => a.id === 'house.install_soffit_bracket')?.minutes).toBeCloseTo(soffit.derived.bracket_count * 24, 2);

    const fascia = calculateCostV1({ ...baseInputs, house_connection_type: 'fascia' as const });
    expect(fascia.derived.bracket_count).toBe(0);
    expect(fascia.derived.stringer_fixing_count).toBe(5);
    expect(fascia.install.actions.some((a) => a.id === 'house.install_soffit_bracket')).toBe(false);
    expect(fascia.materials.lines.some((l) => l.id === 'bracket_3f6d3c53fa')).toBe(false);
    expect(fascia.materials.lines.some((l) => l.id === 'powdercoating_199231d91b')).toBe(false);
    expect(fascia.install.actions.find((a) => a.id === 'house.install_back_stringer_startup')?.minutes).toBeCloseTo(36, 2);
    expect(fascia.install.actions.find((a) => a.id === 'house.install_fascia_connection')?.qty).toBe(5);
    expect(fascia.install.actions.find((a) => a.id === 'house.install_fascia_connection')?.minutes).toBeCloseTo(30, 2);

    const facade = calculateCostV1({ ...baseInputs, house_connection_type: 'facade' as const });
    expect(facade.derived.bracket_count).toBe(0);
    expect(facade.derived.stringer_fixing_count).toBe(5);
    expect(facade.install.actions.some((a) => a.id === 'house.install_soffit_bracket')).toBe(false);
    expect(facade.materials.lines.some((l) => l.id === 'anchor.chem_m12_each')).toBe(false);
    expect(facade.install.actions.find((a) => a.id === 'house.install_back_stringer_startup')?.minutes).toBeCloseTo(36, 2);
    expect(facade.install.actions.find((a) => a.id === 'house.install_facade_connection')?.qty).toBe(5);
    expect(facade.install.actions.find((a) => a.id === 'house.install_facade_connection')?.minutes).toBeCloseTo(30, 2);
  });

  it('attachment_length_mm switches house-connection drivers from length-driven to span-driven edges', () => {
    const baseInputs = {
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
    };

    const rear = calculateCostV1({ ...baseInputs, attachment_length_mm: 6000 });
    const left = calculateCostV1({ ...baseInputs, attachment_length_mm: 3000 });

    expect(rear.derived.attachment_length_m).toBeCloseTo(6, 6);
    expect(left.derived.attachment_length_m).toBeCloseTo(3, 6);
    expect(rear.derived.bracket_count).toBe(5);
    expect(left.derived.bracket_count).toBe(3);
    expect(rear.derived.stringer_fixing_count).toBe(0);
    expect(left.derived.stringer_fixing_count).toBe(0);
    expect(left.install.actions.find((action) => action.id === 'house.install_soffit_bracket')?.minutes).toBeCloseTo(72, 2);
  });

  it('gable acrylic: 6×3 @ 5° stays sheet-mode but can use plan vs strip-yield', () => {
    const base = {
      length_m: 6,
      projection_m: 3,
      roof_pitch_deg: 5,
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
    };

    const pitched = calculateCostV1({ ...base, pergola_style: 'pitched' });
    const gable = calculateCostV1({ ...base, pergola_style: 'gable' });

    const plexiQty = (r: ReturnType<typeof calculateCostV1>) =>
      r.materials.lines.find((l) => String(l.profile ?? '') === 'Plexi sheet 3050×2030')?.qty ?? 0;
    const plexiNote = (r: ReturnType<typeof calculateCostV1>) =>
      r.materials.lines.find((l) => String(l.profile ?? '') === 'Plexi sheet 3050×2030')?.notes ?? '';
    const stripQty = (r: ReturnType<typeof calculateCostV1>) =>
      r.materials.lines
        .filter((l) => String(l.profile ?? '') === 'Crystalite 620mm')
        .reduce((sum, l) => sum + (typeof l.qty === 'number' ? l.qty : 0), 0);
    const acrylicMode = (r: ReturnType<typeof calculateCostV1>) => (plexiQty(r) > 0 ? 'sheet' : stripQty(r) > 0 ? 'strip' : 'none');

    const foamQty = (r: ReturnType<typeof calculateCostV1>) =>
      r.materials.lines.find((l) => l.id === 'consumable_04259b1a85')?.qty ?? 0;
    const flashingQty = (r: ReturnType<typeof calculateCostV1>) =>
      r.materials.lines
        .filter((l) => String(l.id).startsWith('roof.flashing_'))
        .reduce((sum, l) => sum + (typeof l.qty === 'number' ? l.qty : 0), 0);
    const joinerScrewsQty = (r: ReturnType<typeof calculateCostV1>) =>
      r.materials.lines.find((l) => l.id === 'fixing.joiner_screw_each')?.qty ?? 0;

    expect(pitched.derived.roof_plane_count).toBe(1);
    expect(gable.derived.roof_plane_count).toBe(2);

    expect(acrylicMode(gable)).toBe('sheet');
    expect(acrylicMode(pitched)).toBe('sheet');
    expect(plexiNote(gable)).toContain('plan');
    expect(plexiNote(pitched)).toContain('forced strip-yield');

    const sheetAreaM2 = 3.05 * 2.03;
    const gableAreaM2 = Number(gable.derived.acrylic_area_m2 ?? 0);
    const expectedGableSheets = Math.ceil(gableAreaM2 / sheetAreaM2);
    const pitchedBays = Math.max(0, Math.round(Number(pitched.derived.bay_count ?? 0)));
    const expectedPitchedSheets = Math.ceil(pitchedBays / 3);
    expect(plexiQty(gable)).toBe(expectedGableSheets);
    expect(plexiQty(pitched)).toBe(expectedPitchedSheets);

    // Joiner fixings are based on 300mm spacing + end allowance per run.
    expect(joinerScrewsQty(gable)).toBe(gable.derived.acrylic_joiner_bottom_fixings_each);
    expect(joinerScrewsQty(pitched)).toBe(pitched.derived.acrylic_joiner_bottom_fixings_each);
    expect(joinerScrewsQty(gable)).toBeGreaterThan(joinerScrewsQty(pitched));
    expect(foamQty(gable)).toBe(foamQty(pitched) * 2);
    expect(flashingQty(gable)).toBe(flashingQty(pitched));
  });

  it('gable acrylic: 6×6 @ 5° uses strip-yield from total bays', () => {
    const base = {
      length_m: 6,
      roof_pitch_deg: 5,
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
    };

    const pitched6x3 = calculateCostV1({ ...base, pergola_style: 'pitched', projection_m: 3 });
    const gable6x6 = calculateCostV1({ ...base, pergola_style: 'gable', projection_m: 6 });

    const plexiQty = (r: ReturnType<typeof calculateCostV1>) =>
      r.materials.lines.find((l) => String(l.profile ?? '') === 'Plexi sheet 3050×2030')?.qty ?? 0;
    const plexiNote = (r: ReturnType<typeof calculateCostV1>) =>
      r.materials.lines.find((l) => String(l.profile ?? '') === 'Plexi sheet 3050×2030')?.notes ?? '';
    const stripQty = (r: ReturnType<typeof calculateCostV1>) =>
      r.materials.lines
        .filter((l) => String(l.profile ?? '') === 'Crystalite 620mm')
        .reduce((sum, l) => sum + (typeof l.qty === 'number' ? l.qty : 0), 0);
    const acrylicMode = (r: ReturnType<typeof calculateCostV1>) => (plexiQty(r) > 0 ? 'sheet' : stripQty(r) > 0 ? 'strip' : 'none');

    const joinerScrewsQty = (r: ReturnType<typeof calculateCostV1>) =>
      r.materials.lines.find((l) => l.id === 'fixing.joiner_screw_each')?.qty ?? 0;

    expect(acrylicMode(gable6x6)).toBe('sheet');
    expect(acrylicMode(pitched6x3)).toBe('sheet');
    expect(plexiNote(gable6x6)).toContain('forced strip-yield');
    const gableBays = Math.max(0, Math.round(Number(gable6x6.derived.bay_count ?? 0)));
    const gablePlaneCount = Math.max(1, Math.round(Number(gable6x6.derived.roof_plane_count ?? 1)));
    const expectedSheets = Math.ceil((gableBays * gablePlaneCount) / 3);
    expect(plexiQty(gable6x6)).toBe(expectedSheets);
    expect(joinerScrewsQty(gable6x6)).toBe(joinerScrewsQty(pitched6x3) * 2);
  });

  it('gable sheet/strip boundary uses per-plane downslope (gable 6×6 matches pitched 6×3)', () => {
    const projection = 3;
    const effectiveRun = projection - 0.15;
    const targetRequired = 3.06;
    const pitchBoundary = (Math.acos(effectiveRun / (targetRequired - 0.02)) * 180) / Math.PI;

    const base = {
      length_m: 6,
      roof_pitch_deg: pitchBoundary,
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
    };

    const pitched6x3 = calculateCostV1({ ...base, pergola_style: 'pitched', projection_m: projection });
    const gable6x6 = calculateCostV1({ ...base, pergola_style: 'gable', projection_m: 6 });

    const acrylicMode = (r: ReturnType<typeof calculateCostV1>) => {
      const hasSheet = r.materials.lines.some((l) => String(l.profile ?? '') === 'Plexi sheet 3050×2030' && l.qty > 0);
      const hasStrip = r.materials.lines.some((l) => String(l.profile ?? '') === 'Crystalite 620mm' && l.qty > 0);
      return hasSheet ? 'sheet' : hasStrip ? 'strip' : 'none';
    };

    expect(acrylicMode(pitched6x3)).toBe('strip');
    expect(acrylicMode(gable6x6)).toBe('strip');
  });

  it('inputs: roof_span_m is accepted as alias for projection_m', () => {
    const base = {
      length_m: 6,
      roof_pitch_deg: 5,
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
    };

    const legacy = calculateCostV1({ ...base, projection_m: 3 });
    const canonical = calculateCostV1({ ...base, roof_span_m: 3 });

    expect(canonical.derived.roof_span_m).toBeCloseTo(legacy.derived.roof_span_m, 6);
    expect(canonical.materials.totals.materials_ex_gst).toBeCloseTo(legacy.materials.totals.materials_ex_gst, 2);
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

  it('mixed: defaults acrylic bays to 2 when missing', () => {
    const result = calculateCostV1({
      length_m: 6,
      projection_m: 3,
      roof_pitch_deg: 5,
      post_cut_height_m: 2.4,
      post_count: 4,

      pergola_style: 'pitched',
      box_perimeter_enabled: false,
      roof_material: 'mixed',
      mixed_roof: {
        mode: 'acrylic_bays',
      },
      extrusion_colour: 'Black',

      house_connection_type: 'soffit',
      post_connection_type: 'deck_bracket',
      access: 'normal',
      height: 'single_storey',
    });

    expect(result.derived.acrylic_bays_total).toBe(2);
    expect(result.derived.acrylic_area_m2).toBeGreaterThan(0);
    expect(result.derived.timber_area_m2).toBeGreaterThan(0);
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

    expect(result.install.actions.some((a) => a.id === 'roof.install_joiner_bottom_m')).toBe(true);
    expect(result.install.actions.some((a) => a.id === 'roof.fix_joiner_bottom_each')).toBe(true);
    expect(result.install.actions.some((a) => a.id === 'roof.install_joiner_top_m')).toBe(true);
    expect(result.install.actions.some((a) => a.id === 'roof.install_acrylic_panels_m2')).toBe(true);
    expect(result.install.actions.some((a) => a.id === 'roof.install_acrylic_roof_m2')).toBe(false);
    expect(result.install.actions.some((a) => a.id === 'roof.install_timber_roof_m2')).toBe(true);
    expect(result.install.actions.some((a) => a.id === 'roof.install_purlins_m')).toBe(true);
  });

  it('mixed: timber purlins scale with timber portion', () => {
    const mixed = calculateCostV1({
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

    const timber = calculateCostV1({
      length_m: 5,
      projection_m: 3,
      roof_pitch_deg: 5,
      post_cut_height_m: 2.4,
      post_count: 4,

      pergola_style: 'pitched',
      box_perimeter_enabled: false,
      roof_material: 'timber',
      extrusion_colour: 'Mill',
      powdercoat_standard_colour: 'Ironsands',
      powdercoat_is_custom: false,

      house_connection_type: 'soffit',
      post_connection_type: 'deck_bracket',
      access: 'normal',
      height: 'single_storey',
    });

    const fraction = mixed.derived.timber_area_m2 / mixed.derived.roof_surface_area_m2;
    expect(mixed.derived.timber_purlin_total_m).toBeCloseTo(timber.derived.timber_purlin_total_m * fraction, 4);
  });

  it('mixed: steel roof above adds covertek + polystyrene', () => {
    const base = {
      length_m: 6,
      projection_m: 3,
      roof_pitch_deg: 5,
      post_cut_height_m: 2.4,
      post_count: 4,

      pergola_style: 'pitched',
      box_perimeter_enabled: false,
      roof_material: 'mixed' as const,
      mixed_roof: {
        mode: 'acrylic_bays' as const,
        acrylic_bays_by_plane: { main: 2 },
      },
      extrusion_colour: 'Black',

      house_connection_type: 'soffit',
      post_connection_type: 'deck_bracket',
      access: 'normal',
      height: 'single_storey',
    };

    const steel = calculateCostV1({ ...base, timber_roof_above_type: 'steel_corrugated' as const });
    expect(steel.derived.timber_roof_above_area_m2).toBeCloseTo(steel.derived.timber_area_m2, 4);
    expect(steel.materials.lines.find((l) => l.id === 'underlay.covertek_407_m2')?.qty ?? 0).toBeGreaterThan(0);
    expect(steel.materials.lines.find((l) => l.id === 'insulation.polystyrene_m2')?.qty ?? 0).toBeGreaterThan(0);

    const insulated = calculateCostV1({ ...base, timber_roof_above_type: 'insulated_panels' as const });
    expect(insulated.materials.lines.find((l) => l.id === 'underlay.covertek_407_m2')).toBeUndefined();
    expect(insulated.materials.lines.find((l) => l.id === 'insulation.polystyrene_m2')).toBeUndefined();
  });

  it('mixed: joiner fixings follow 300mm spacing rule on acrylic joiner runs', () => {
    const result = calculateCostV1({
      length_m: 6,
      projection_m: 3,
      roof_pitch_deg: 5,
      post_cut_height_m: 2.4,
      post_count: 4,

      pergola_style: 'gable',
      box_perimeter_enabled: false,
      roof_material: 'mixed',
      mixed_roof: {
        mode: 'acrylic_bays',
        acrylic_bays_by_plane: { A: 2, B: 1 },
      },
      extrusion_colour: 'Black',

      house_connection_type: 'soffit',
      post_connection_type: 'deck_bracket',
      access: 'normal',
      height: 'single_storey',
    });

    const joinerFixings = result.materials.lines.find((l) => l.id === 'fixing.joiner_screw_each')?.qty ?? 0;
    expect(result.derived.acrylic_bays_total).toBe(3);
    expect(result.derived.acrylic_plane_count_used).toBe(2);
    expect(joinerFixings).toBe(result.derived.acrylic_joiner_bottom_fixings_each);
    expect(result.derived.acrylic_joiner_top_total_m).toBeCloseTo(result.derived.acrylic_joiner_bottom_total_m ?? 0, 6);
  });

  it('acrylic: joiner fixing count uses ceil(length/0.3)+1 per run', () => {
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

    const runs = Math.max(0, Math.round(result.derived.joiner_runs_total ?? 0));
    const runLength = Math.max(0, Number(result.derived.joiner_piece_length_m ?? 0));
    const expectedFixings = runs * (Math.ceil(runLength / 0.3) + 1);
    const joinerFixings = result.materials.lines.find((l) => l.id === 'fixing.joiner_screw_each')?.qty ?? 0;

    expect(result.derived.acrylic_joiner_bottom_fixings_each).toBe(expectedFixings);
    expect(joinerFixings).toBe(expectedFixings);
  });

  it('mixed: area override skips acrylic split labour drivers with warning', () => {
    const result = calculateCostV1({
      length_m: 6,
      projection_m: 3,
      roof_pitch_deg: 5,
      post_cut_height_m: 2.4,
      post_count: 4,

      pergola_style: 'pitched',
      box_perimeter_enabled: false,
      roof_material: 'mixed',
      mixed_roof: {
        mode: 'area_override',
        acrylic_area_m2: 6,
      },
      extrusion_colour: 'Black',

      house_connection_type: 'soffit',
      post_connection_type: 'deck_bracket',
      access: 'normal',
      height: 'single_storey',
    });

    expect(result.totals.notes_and_warnings.some((w) => w.includes('excluded from acrylic split labour'))).toBe(true);
    expect(result.derived.acrylic_joiner_bottom_total_m ?? 0).toBe(0);
    expect(result.derived.acrylic_joiner_top_total_m ?? 0).toBe(0);
    expect(result.derived.acrylic_joiner_bottom_fixings_each ?? 0).toBe(0);
    expect(result.derived.acrylic_install_area_m2 ?? 0).toBe(0);
    expect(result.install.actions.some((a) => a.id === 'roof.install_joiner_bottom_m')).toBe(false);
    expect(result.install.actions.some((a) => a.id === 'roof.fix_joiner_bottom_each')).toBe(false);
    expect(result.install.actions.some((a) => a.id === 'roof.install_joiner_top_m')).toBe(false);
    expect(result.install.actions.some((a) => a.id === 'roof.install_acrylic_panels_m2')).toBe(false);
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
    expect(plexiLines[0].notes ?? '').toContain('forced strip-yield');

    const crystaliteLines = result.materials.lines.filter((l) => l.id.startsWith('roofing-sheet_d557d79c33'));
    expect(crystaliteLines.length).toBe(0);
  });

  it('roofing: pitched acrylic uses joiner-based downslope (no 6m warning at 6x6 @ 5°)', () => {
    const result = calculateCostV1({
      length_m: 6,
      projection_m: 6,
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

    expect(result.derived.acrylic_required_downslope_m).toBeCloseTo(5.89235, 4);
    expect(result.derived.joiner_piece_length_m).toBeCloseTo(result.derived.acrylic_required_downslope_m, 6);
    expect(result.derived.cut_rafter_length_m).toBeCloseTo(5.88547, 4);

    const warnings = result.totals.notes_and_warnings.filter((w) => w.toLowerCase().includes('acrylic slope exceeds'));
    expect(warnings.length).toBe(0);
  });

  it('roofing: acrylic 6m warning boundary uses joiner downslope', () => {
    const projection = 6;
    const effectiveRun = projection - 0.15;
    const targetUnder = 5.999;
    const targetOver = 6.001;
    const pitchUnder = (Math.acos(effectiveRun / (targetUnder - 0.02)) * 180) / Math.PI;
    const pitchOver = (Math.acos(effectiveRun / (targetOver - 0.02)) * 180) / Math.PI;

    const under = calculateCostV1({
      length_m: 6,
      projection_m: projection,
      roof_pitch_deg: pitchUnder,
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

    const over = calculateCostV1({
      length_m: 6,
      projection_m: projection,
      roof_pitch_deg: pitchOver,
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

    const underWarnings = under.totals.notes_and_warnings.filter((w) => w.toLowerCase().includes('acrylic slope exceeds'));
    const overWarnings = over.totals.notes_and_warnings.filter((w) => w.toLowerCase().includes('acrylic slope exceeds'));

    expect(under.derived.acrylic_required_downslope_m).toBeLessThan(6);
    expect(underWarnings.length).toBe(0);

    expect(over.derived.acrylic_required_downslope_m).toBeGreaterThan(6);
    expect(overWarnings.length).toBe(1);
  });

  it('roofing: pitched acrylic defaults to 5° when pitch is unset', () => {
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
    });

    expect(result.derived.roof_pitch_deg_used).toBeCloseTo(5, 6);
  });

  it('takeoff: pitched acrylic uses 4/5/6m stock options and picks optimal (6m) for joiners/rafters/gutter', () => {
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

      house_connection_type: 'fascia',
      post_connection_type: 'deck_bracket',
      access: 'normal',
      height: 'single_storey',
    });

    // Acrylic sheets should use strip-yield when downslope exceeds 2.03m (3 strips/sheet).
    const plexi = result.materials.lines.find((l) => l.id.startsWith('roofing-sheet_e1f7673c14'));
    expect(plexi?.qty).toBe(4);

    // No soffit brackets for fascia/facade.
    expect(result.materials.lines.some((l) => l.id === 'bracket_3f6d3c53fa')).toBe(false);
    expect(result.materials.lines.some((l) => l.id === 'powdercoating_199231d91b')).toBe(false);

    // Joiners: should select a valid stock length (4/5/6m) and allocate bars.
    const joiner = result.materials.lines.find((l) => l.profile === 'Joiners');
    expect(joiner?.qty).toBeGreaterThan(0);
    const joinerBars = result.materials.totals.bars_by_profile['Joiners'];
    expect([4, 5, 6]).toContain(joinerBars?.stock_length_m);

    // Rafters: should select a valid stock length (4/5/6m) and allocate bars.
    const rafterProfile = result.inputs_normalized.rafter_profile;
    const rafters = result.materials.lines.find((l) => l.profile === rafterProfile);
    expect(rafters?.qty).toBeGreaterThan(0);
    const rafterBars = result.materials.totals.bars_by_profile[rafterProfile];
    expect([4, 5, 6]).toContain(rafterBars?.stock_length_m);

    // SP gutter: required length should use one of the stock lengths.
    const gutter = result.materials.lines.find((l) => l.profile === 'SP Gutter');
    expect(gutter?.qty).toBeGreaterThan(0);
    const gutterBars = result.materials.totals.bars_by_profile['SP Gutter'];
    expect([4, 5, 6]).toContain(gutterBars?.stock_length_m);
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

  it('mill extrusion adds powdercoat surcharge (standard colour)', () => {
    const config = loadCostingConfigV1();
    const result = calculateCostV1(
      {
        length_m: 6,
        projection_m: 3,
        roof_pitch_deg: 5,
        post_cut_height_m: 2.4,
        post_count: 4,

        pergola_style: 'pitched',
        box_perimeter_enabled: false,
        roof_material: 'acrylic',
        extrusion_colour: 'Mill',
        powdercoat_standard_colour: 'Ironsands',
        powdercoat_is_custom: false,

        house_connection_type: 'soffit',
        post_connection_type: 'deck_bracket',
        access: 'normal',
        height: 'single_storey',
      },
      config,
    );

    const line = result.materials.lines.find((l) => String(l.id).startsWith('aluminium-extrusion_'));
    expect(line).toBeTruthy();
    if (!line) return;
    const found = findPowdercoatForBar(config, line.id);
    expect(found?.barItem).toBeTruthy();
    expect(found?.powderItem).toBeTruthy();
    if (!found?.barItem || !found.powderItem) return;

    const base = Number((found.barItem as any).cost_ex_gst ?? 0);
    const powder = Number((found.powderItem as any).cost_ex_gst ?? 0);
    const expected = roundMoney(base + powder * 1.0);
    expect(line.unit_cost_ex_gst).toBeCloseTo(expected, 2);
    expect(String(line.label).toLowerCase()).toContain('powdercoated');
  });

  it('mill extrusion adds 1.2x powdercoat surcharge for custom colour', () => {
    const config = loadCostingConfigV1();
    const result = calculateCostV1(
      {
        length_m: 6,
        projection_m: 3,
        roof_pitch_deg: 5,
        post_cut_height_m: 2.4,
        post_count: 4,

        pergola_style: 'pitched',
        box_perimeter_enabled: false,
        roof_material: 'acrylic',
        extrusion_colour: 'Mill',
        powdercoat_is_custom: true,
        powdercoat_custom_colour: 'Custom Grey',

        house_connection_type: 'soffit',
        post_connection_type: 'deck_bracket',
        access: 'normal',
        height: 'single_storey',
      },
      config,
    );

    const line = result.materials.lines.find((l) => String(l.id).startsWith('aluminium-extrusion_'));
    expect(line).toBeTruthy();
    if (!line) return;
    const found = findPowdercoatForBar(config, line.id);
    expect(found?.barItem).toBeTruthy();
    expect(found?.powderItem).toBeTruthy();
    if (!found?.barItem || !found.powderItem) return;

    const base = Number((found.barItem as any).cost_ex_gst ?? 0);
    const powder = Number((found.powderItem as any).cost_ex_gst ?? 0);
    const expected = roundMoney(base + powder * 1.2);
    expect(line.unit_cost_ex_gst).toBeCloseTo(expected, 2);
    expect(String(line.label)).toContain('Custom');
  });

  it('warns when powdercoat pricebook item is missing for mill finish', () => {
    const config = loadCostingConfigV1();
    const baseInputs = {
      length_m: 6,
      projection_m: 3,
      roof_pitch_deg: 5,
      post_cut_height_m: 2.4,
      post_count: 4,

      pergola_style: 'pitched' as const,
      box_perimeter_enabled: false,
      roof_material: 'acrylic' as const,
      extrusion_colour: 'Mill' as const,
      powdercoat_standard_colour: 'Ironsands',
      powdercoat_is_custom: false,

      house_connection_type: 'soffit' as const,
      post_connection_type: 'deck_bracket' as const,
      access: 'normal' as const,
      height: 'single_storey' as const,
    };

    const baseline = calculateCostV1(baseInputs, config);
    const line = baseline.materials.lines.find((l) => String(l.id).startsWith('aluminium-extrusion_'));
    expect(line).toBeTruthy();
    if (!line) return;
    const found = findPowdercoatForBar(config, line.id);
    expect(found?.powderItem).toBeTruthy();
    if (!found?.powderItem) return;

    const configMissing = {
      ...config,
      materials: {
        ...config.materials,
        items: config.materials.items.filter((it) => it.id !== found.powderItem?.id),
      },
    };

    const result = calculateCostV1(baseInputs, configMissing as any);
    expect(result.totals.notes_and_warnings.some((w) => w.includes('INVALID') && w.includes('Powdercoat'))).toBe(true);
  });

  it('box perimeter 250x50 override uses 250x50 materials and install action', () => {
    const config = loadCostingConfigV1();
    const result = calculateCostV1(
      {
        length_m: 6,
        projection_m: 3,
        post_cut_height_m: 2.4,
        post_count: 4,
        pergola_style: 'pitched',
        box_perimeter_enabled: true,
        internal_roof_type: 'pitched',
        fall_distance_mm: 200,
        roof_material: 'acrylic',
        extrusion_colour: 'Mill',
        powdercoat_standard_colour: 'Ironsands',
        powdercoat_is_custom: false,
        overrides: {
          box_perimeter_beam_profile: '250x50',
        },
        house_connection_type: 'soffit',
        post_connection_type: 'deck_bracket',
        access: 'normal',
        height: 'single_storey',
      },
      config,
    );

    expect(result.derived.box_perimeter_beam_profile_used).toBe('250x50');
    const line = result.materials.lines.find((l) => l.profile === '250x50');
    expect(line).toBeTruthy();
    if (!line) return;
    const found = findPowdercoatForBar(config, String(line.id));
    expect(found?.barItem).toBeTruthy();
    expect(found?.powderItem).toBeTruthy();
    if (!found?.barItem || !found.powderItem) return;

    const base = Number((found.barItem as any).cost_ex_gst ?? 0);
    const powder = Number((found.powderItem as any).cost_ex_gst ?? 0);
    const expected = roundMoney(base + powder);
    expect(line.unit_cost_ex_gst).toBeCloseTo(expected, 2);
    expect(String(line.label).toLowerCase()).toContain('powdercoated');
    expect(result.install.actions.some((a) => a.id === 'frame.box_perimeter_beam_250_install_m')).toBe(true);
    expect(result.totals.notes_and_warnings.some((w) => w.includes('INVALID') && w.includes('Powdercoat'))).toBe(false);
  });

  it('rafter override labour tiers apply across pitched, low gable, gable, and hip roofs', () => {
    const baseInputs = {
      length_m: 4,
      projection_m: 3,
      post_cut_height_m: 2.4,
      post_count: 4,
      roof_material: 'acrylic' as const,
      extrusion_colour: 'Black' as const,
      house_connection_type: 'soffit' as const,
      post_connection_type: 'deck_bracket' as const,
      access: 'normal' as const,
      height: 'single_storey' as const,
      ground: 'easy' as const,
    };

    const actionIdByRoof = {
      pitched: 'rafters.install_rafter_pitched',
      low_gable: 'rafters.install_rafter_low_gable',
      gable: 'rafters.install_rafter_gable',
      hip: 'rafters.install_rafter_hip',
    } as const;

    const buildScenario = (roofKind: keyof typeof actionIdByRoof, profile: string) => {
      if (roofKind === 'low_gable') {
        return calculateCostV1({
          ...baseInputs,
          pergola_style: 'pitched',
          box_perimeter_enabled: true,
          internal_roof_type: 'low_gable',
          fall_distance_mm: 200,
          overrides: { rafter_profile: profile },
        });
      }

      return calculateCostV1({
        ...baseInputs,
        pergola_style: roofKind,
        box_perimeter_enabled: false,
        overrides: { rafter_profile: profile },
      });
    };

    const getRafterAction = (roofKind: keyof typeof actionIdByRoof, profile: string) => {
      const result = buildScenario(roofKind, profile);
      const action = result.install.actions.find((candidate) => candidate.id === actionIdByRoof[roofKind]);
      expect(action).toBeTruthy();
      if (!action) throw new Error(`Missing rafter action for ${roofKind}/${profile}`);
      return action;
    };

    const standardProfiles = [
      ['100x50', 14.4],
      ['200x50', 24],
      ['250x50', 30],
      ['300x50', 36],
      ['custom', 30],
    ] as const;
    const lowGableProfiles = [
      ['100x50', 13.2],
      ['200x50', 21.6],
      ['250x50', 26.4],
      ['300x50', 31.2],
      ['custom', 26.4],
    ] as const;

    for (const roofKind of ['pitched', 'gable', 'hip'] as const) {
      for (const [profile, expectedBaseMinutes] of standardProfiles) {
        const action = getRafterAction(roofKind, profile);
        expect(inferredBaseMinutesPerUnit(action)).toBeCloseTo(expectedBaseMinutes, 0);
      }
    }

    for (const [profile, expectedBaseMinutes] of lowGableProfiles) {
      const action = getRafterAction('low_gable', profile);
      expect(inferredBaseMinutesPerUnit(action)).toBeCloseTo(expectedBaseMinutes, 0);
    }

    const pitched100 = getRafterAction('pitched', '100x50');
    const pitched200 = getRafterAction('pitched', '200x50');
    const pitched250 = getRafterAction('pitched', '250x50');
    const pitched300 = getRafterAction('pitched', '300x50');
    const pitchedCustom = getRafterAction('pitched', 'custom');

    expect(pitched200.minutes).toBeGreaterThan(pitched100.minutes);
    expect(pitched250.minutes).toBeGreaterThan(pitched200.minutes);
    expect(pitchedCustom.minutes).toBeGreaterThan(pitched200.minutes);
    expect(pitchedCustom.minutes).toBeLessThan(pitched300.minutes);

    const lowGable200 = getRafterAction('low_gable', '200x50');
    expect(inferredBaseMinutesPerUnit(lowGable200)).toBeLessThan(inferredBaseMinutesPerUnit(pitched200));
  });

  it('additional rafter length loading ramps steeply from short to long rafters', () => {
    const baseInputs = {
      length_m: 6,
      post_cut_height_m: 2.4,
      post_count: 4,
      pergola_style: 'pitched' as const,
      roof_material: 'acrylic' as const,
      extrusion_colour: 'Black' as const,
      house_connection_type: 'soffit' as const,
      post_connection_type: 'deck_bracket' as const,
      access: 'normal' as const,
      height: 'single_storey' as const,
      ground: 'easy' as const,
    };

    const short = calculateCostV1({
      ...baseInputs,
      projection_m: 2,
    });
    const long = calculateCostV1({
      ...baseInputs,
      projection_m: 6,
    });

    const shortAction = short.install.actions.find((action) => action.id === 'rafters.rafter_length_loading_m');
    const longAction = long.install.actions.find((action) => action.id === 'rafters.rafter_length_loading_m');

    expect(shortAction).toBeTruthy();
    expect(longAction).toBeTruthy();
    if (!shortAction || !longAction) throw new Error('Missing rafter length loading action.');

    expect(shortAction.qty).toBeCloseTo(short.derived.total_installed_rafter_length_m, 6);
    expect(longAction.qty).toBeCloseTo(long.derived.total_installed_rafter_length_m, 6);
    expect(shortAction.applied_multipliers.rafter_length_loading_curve).toBeCloseTo(0.5, 2);
    expect(longAction.applied_multipliers.rafter_length_loading_curve).toBeGreaterThan(7.5);
    expect(longAction.minutes / Math.max(longAction.qty, 1e-6)).toBeGreaterThan(
      (shortAction.minutes / Math.max(shortAction.qty, 1e-6)) * 10,
    );
  });

  it('additional rafter length loading quantity matches installed metres for gable and hip roofs', () => {
    const baseInputs = {
      length_m: 6,
      projection_m: 6,
      post_cut_height_m: 2.4,
      post_count: 4,
      roof_material: 'acrylic' as const,
      extrusion_colour: 'Black' as const,
      house_connection_type: 'soffit' as const,
      post_connection_type: 'deck_bracket' as const,
      access: 'normal' as const,
      height: 'single_storey' as const,
      ground: 'easy' as const,
    };

    const gable = calculateCostV1({
      ...baseInputs,
      pergola_style: 'gable',
      gable_house_edge_gutter: 'house',
      gable_outer_edge_gutter: 'our',
    });
    const gableAction = gable.install.actions.find((action) => action.id === 'rafters.rafter_length_loading_m');
    expect(gableAction).toBeTruthy();
    if (!gableAction) throw new Error('Missing gable rafter length loading action.');

    const gableExpectedQty =
      Number(gable.derived.total_rafter_pieces ?? 0) *
      ((Number(gable.derived.rafter_cut_length_house_side_m ?? 0) + Number(gable.derived.rafter_cut_length_outer_side_m ?? 0)) / 2);
    expect(gable.derived.total_installed_rafter_length_m).toBeCloseTo(gableExpectedQty, 6);
    expect(gableAction.qty).toBeCloseTo(gableExpectedQty, 6);

    const hip = calculateCostV1({
      ...baseInputs,
      pergola_style: 'hip',
    });
    const hipAction = hip.install.actions.find((action) => action.id === 'rafters.rafter_length_loading_m');
    expect(hipAction).toBeTruthy();
    if (!hipAction) throw new Error('Missing hip rafter length loading action.');

    const hipExpectedQty =
      Number(hip.derived.total_rafter_pieces ?? 0) * Number(hip.derived.rafter_cut_length_m ?? 0) +
      Number(hip.derived.hip_rafter_count ?? 0) * Number(hip.derived.hip_rafter_cut_length_m ?? 0);
    expect(hip.derived.total_installed_rafter_length_m).toBeCloseTo(hipExpectedQty, 6);
    expect(hipAction.qty).toBeCloseTo(hipExpectedQty, 6);
    expect(hipAction.qty).toBeGreaterThan(Number(hip.derived.total_rafter_pieces ?? 0) * Number(hip.derived.rafter_cut_length_m ?? 0));
  });

  it('infills: no infills keeps infill labour actions disabled', () => {
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
    });

    expect(result.derived.infill_instance_count ?? 0).toBe(0);
    expect(result.derived.infill_joiner_total_m ?? 0).toBe(0);
    expect(result.derived.infill_joiner_fixings_each ?? 0).toBe(0);
    expect(result.derived.infill_sheet_area_m2 ?? 0).toBe(0);
    expect(result.derived.infill_strip_panel_count ?? 0).toBe(0);
    expect(result.derived.infill_extra_supports_each ?? 0).toBe(0);
    expect(result.install.actions.some((a) => a.id.startsWith('infill.'))).toBe(false);
  });

  it('infills: sheet-panel infill drives sheet labour actions and drivers', () => {
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
      infills: [
        {
          id: 'infill-sheet-1',
          qty: 2,
          location: 'front',
          acrylic_source: 'sheet_panels',
          panel_orientation: 'vertical',
          width_mode: 'target_width',
          support: {
            has_top: true,
            has_bottom: true,
            has_left: true,
            has_right: true,
            internal_support_mode: 'none',
          },
          shape: {
            type: 'rect',
            width_m: 2.4,
            height_m: 1.8,
          },
        },
      ],
    });

    expect(result.derived.infill_instance_count).toBe(2);
    expect(result.derived.infill_sheet_area_m2 ?? 0).toBeGreaterThan(0);
    expect(result.derived.infill_strip_panel_count ?? 0).toBe(0);

    const setup = result.install.actions.find((a) => a.id === 'infill.setup_setout_each');
    const finish = result.install.actions.find((a) => a.id === 'infill.finish_clean_each');
    const panels = result.install.actions.find((a) => a.id === 'infill.install_sheet_panels_m2');
    const stripPanels = result.install.actions.find((a) => a.id === 'infill.install_strip_panels_each');
    const joiners = result.install.actions.find((a) => a.id === 'infill.install_joiner_m');
    const fixings = result.install.actions.find((a) => a.id === 'infill.fix_joiner_each');

    expect(setup?.qty).toBe(2);
    expect(finish?.qty).toBe(2);
    expect(panels?.qty).toBeCloseTo(Number(result.derived.infill_sheet_area_m2 ?? 0), 6);
    expect(stripPanels).toBeFalsy();
    expect(joiners?.qty).toBeCloseTo(Number(result.derived.infill_joiner_total_m ?? 0), 6);
    expect(fixings?.qty).toBe(Number(result.derived.infill_joiner_fixings_each ?? 0));
  });

  it('infills: strip infill drives strip labour actions and sheet labour stays off', () => {
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
      infills: [
        {
          id: 'infill-strip-1',
          qty: 1,
          location: 'side',
          acrylic_source: 'strip_620',
          panel_orientation: 'vertical',
          width_mode: 'target_width',
          support: {
            has_top: true,
            has_bottom: true,
            has_left: true,
            has_right: true,
            internal_support_mode: 'none',
          },
          shape: {
            type: 'rect',
            width_m: 2.4,
            height_m: 1.8,
          },
        },
      ],
    });

    expect(result.derived.infill_strip_panel_count ?? 0).toBeGreaterThan(0);
    expect(result.derived.infill_sheet_area_m2 ?? 0).toBe(0);

    const stripPanels = result.install.actions.find((a) => a.id === 'infill.install_strip_panels_each');
    const sheetPanels = result.install.actions.find((a) => a.id === 'infill.install_sheet_panels_m2');
    expect(stripPanels?.qty).toBe(Number(result.derived.infill_strip_panel_count ?? 0));
    expect(sheetPanels).toBeFalsy();
  });

  it('infills: extra support driver includes missing jambs and unsupported internals', () => {
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
      infills: [
        {
          id: 'infill-supports-1',
          qty: 1,
          location: 'side',
          acrylic_source: 'sheet_panels',
          panel_orientation: 'vertical',
          width_mode: 'target_width',
          support: {
            has_top: true,
            has_bottom: true,
            has_left: false,
            has_right: false,
            internal_support_mode: 'none',
          },
          shape: {
            type: 'rect',
            width_m: 2.4,
            height_m: 1.8,
          },
        },
      ],
    });

    // 2 missing jambs (left+right) + 1 unsupported internal boundary.
    expect(result.derived.infill_extra_supports_each).toBe(3);
    const extraSupports = result.install.actions.find((a) => a.id === 'infill.install_extra_supports_each');
    expect(extraSupports?.qty).toBe(3);
  });

  it('infills: sheet vs strip variants produce different install labour totals', () => {
    const base = {
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
    };

    const sheet = calculateCostV1({
      ...base,
      infills: [
        {
          id: 'infill-compare',
          qty: 1,
          location: 'front',
          acrylic_source: 'sheet_panels',
          panel_orientation: 'vertical',
          width_mode: 'target_width',
          support: {
            has_top: true,
            has_bottom: true,
            has_left: true,
            has_right: true,
            internal_support_mode: 'none',
          },
          shape: {
            type: 'rect',
            width_m: 2.4,
            height_m: 1.8,
          },
        },
      ],
    });
    const strip = calculateCostV1({
      ...base,
      infills: [
        {
          id: 'infill-compare',
          qty: 1,
          location: 'front',
          acrylic_source: 'strip_620',
          panel_orientation: 'vertical',
          width_mode: 'target_width',
          support: {
            has_top: true,
            has_bottom: true,
            has_left: true,
            has_right: true,
            internal_support_mode: 'none',
          },
          shape: {
            type: 'rect',
            width_m: 2.4,
            height_m: 1.8,
          },
        },
      ],
    });

    expect(roundMoney(sheet.install.totals.install_ex_gst)).not.toBe(roundMoney(strip.install.totals.install_ex_gst));
    expect(roundMoney(sheet.install.totals.crew_hours)).not.toBe(roundMoney(strip.install.totals.crew_hours));
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

  it('job rollup: pure acrylic modules keep the flat acrylic overhead total', () => {
    const moduleInputs = {
      length_m: 6,
      projection_m: 3,
      roof_pitch_deg: 0,
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

    expect(job.overhead.method).toBe('flat_acrylic_total');
    expect(job.overhead.ops_ex_gst).toBe(2000);
    expect(job.overhead.sales_ex_gst).toBe(0);
    expect(job.overhead.total_ex_gst).toBe(2000);
  });

  it('job rollup: any acrylic module over 3m switches the whole acrylic job to variable overhead', () => {
    const shortModule = {
      length_m: 6,
      projection_m: 3,
      roof_pitch_deg: 0,
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
    const longModule = {
      ...shortModule,
      roof_pitch_deg: 5,
    };

    const job = calculateJobCostV1({
      modules: [shortModule, longModule],
      travel_ex_gst: 0,
      extras_allowance_ex_gst: 0,
    });

    expect(job.overhead.method).toBe('fixed_plus_variable');
    expect(job.overhead.sales_ex_gst).toBeGreaterThan(0);
    expect(job.overhead.total_ex_gst).toBeGreaterThan(2000);
  });

  it('box perimeter: adds startup labour allowance (180 minutes) once per pergola', () => {
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

    const startup = result.install.actions.find((a) => a.id === 'mob.box_perimeter_startup');
    expect(startup).toBeTruthy();
    expect(startup?.scope).toBe('job');
    expect(startup?.minutes).toBe(180);
    expect(startup?.qty).toBe(1);
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
    expect(result.install.actions.find((a) => a.id === 'roof.install_flashing_201_300_m')?.qty).toBe(10);
    expect(result.install.actions.find((a) => a.id === 'roof.apply_foam_seal_m')?.qty).toBe(10);
    expect(result.totals.cost_ex_gst).toBeGreaterThan(0);
  });

  it('flashings: default row override can disable a flashing (no startup when total flashing is zero)', () => {
    const result = calculateCostV1({
      length_m: 6,
      projection_m: 3,
      post_cut_height_m: 2.4,
      post_count: 4,
      pergola_style: 'pitched',
      box_perimeter_enabled: false,
      roof_material: 'acrylic',
      extrusion_colour: 'Black',
      flashings: {
        default_overrides: [{ key: 'pitched_primary', band: 'none' }],
      },
      house_connection_type: 'soffit',
      post_connection_type: 'deck_bracket',
      access: 'normal',
      height: 'single_storey',
    });

    expect(result.derived.flashing_total_m).toBe(0);
    expect(result.materials.lines.some((line) => String(line.id).startsWith('roof.flashing_'))).toBe(false);
    expect(result.install.actions.some((a) => a.id.startsWith('roof.install_flashing_'))).toBe(false);
    expect(result.install.actions.some((a) => a.id === 'roof.flashing_startup')).toBe(false);
  });

  it('flashings: extras add banded material/labour and startup applies once', () => {
    const result = calculateCostV1({
      length_m: 6,
      projection_m: 3,
      post_cut_height_m: 2.4,
      post_count: 4,
      pergola_style: 'pitched',
      box_perimeter_enabled: false,
      roof_material: 'acrylic',
      extrusion_colour: 'Black',
      flashings: {
        extras: [{ band: '301-400', length_m: 2 }],
      },
      house_connection_type: 'soffit',
      post_connection_type: 'deck_bracket',
      access: 'normal',
      height: 'single_storey',
    });

    const band201 = result.materials.lines.find((line) => line.id === 'roof.flashing_201_300_m');
    const band301 = result.materials.lines.find((line) => line.id === 'roof.flashing_301_400_m');
    expect(band201?.qty).toBeCloseTo(6, 6);
    expect(band301?.qty).toBeCloseTo(2, 6);
    expect(band201?.line_cost_ex_gst).toBeCloseTo(150, 6);
    expect(band301?.line_cost_ex_gst).toBeCloseTo(70, 6);

    expect(result.install.actions.find((a) => a.id === 'roof.install_flashing_201_300_m')?.qty).toBeCloseTo(6, 6);
    expect(result.install.actions.find((a) => a.id === 'roof.install_flashing_301_400_m')?.qty).toBeCloseTo(2, 6);
    expect(result.install.actions.find((a) => a.id === 'roof.flashing_startup')?.qty).toBe(1);
  });

  it('gable: house edge our + outer edge our removes ledger and adds two SP gutter runs', () => {
    const result = calculateCostV1({
      length_m: 8.5,
      projection_m: 3,
      post_cut_height_m: 2.4,
      post_count: 4,

      pergola_style: 'gable',
      box_perimeter_enabled: false,
      roof_material: 'acrylic',
      extrusion_colour: 'Black',
      gable_house_edge_gutter: 'our',
      gable_outer_edge_gutter: 'our',

      house_connection_type: 'soffit',
      post_connection_type: 'deck_bracket',
      access: 'normal',
      height: 'single_storey',
    });

    expect(result.derived.has_ledger).toBe(false);
    expect(result.derived.ledger_length_m).toBe(0);
    expect(result.derived.sp_gutter_run_count).toBe(2);
    expect(result.derived.our_gutter_length_m).toBeCloseTo(17, 6);

    const hasLedgerLine = result.materials.lines.some((line) => line.notes?.includes('Ledger'));
    expect(hasLedgerLine).toBe(false);

    const spGutterLine = result.materials.lines.find((line) => line.profile === 'SP Gutter');
    expect(spGutterLine).toBeTruthy();

    const stringerInstall = result.install.actions.find((a) => a.id === 'frame.house_stringer_install_m');
    expect(stringerInstall).toBeFalsy();

    const spGutterInstall = result.install.actions.find((a) => a.id === 'frame.front_beam_sp_gutter_install_m');
    expect(spGutterInstall?.qty).toBeCloseTo(17, 6);
  });

  it('gable: house edge house + outer edge our keeps ledger and one SP gutter run', () => {
    const result = calculateCostV1({
      length_m: 8.5,
      projection_m: 3,
      post_cut_height_m: 2.4,
      post_count: 4,

      pergola_style: 'gable',
      box_perimeter_enabled: false,
      roof_material: 'acrylic',
      extrusion_colour: 'Black',
      gable_house_edge_gutter: 'house',
      gable_outer_edge_gutter: 'our',

      house_connection_type: 'soffit',
      post_connection_type: 'deck_bracket',
      access: 'normal',
      height: 'single_storey',
    });

    expect(result.derived.has_ledger).toBe(true);
    expect(result.derived.ledger_length_m).toBeCloseTo(8.5, 6);
    expect(result.derived.sp_gutter_run_count).toBe(1);
    expect(result.derived.our_gutter_length_m).toBeCloseTo(8.5, 6);

    const hasLedgerLine = result.materials.lines.some((line) => line.notes?.includes('Ledger'));
    expect(hasLedgerLine).toBe(true);
  });

  it('gable: freestanding defaults to two SP gutter runs and no ledger', () => {
    const result = calculateCostV1({
      length_m: 8.5,
      projection_m: 3,
      post_cut_height_m: 2.4,
      post_count: 4,

      pergola_style: 'gable',
      box_perimeter_enabled: false,
      roof_material: 'acrylic',
      extrusion_colour: 'Black',

      house_connection_type: 'none',
      post_connection_type: 'deck_bracket',
      access: 'normal',
      height: 'single_storey',
    });

    expect(result.derived.has_ledger).toBe(false);
    expect(result.derived.sp_gutter_run_count).toBe(2);
    expect(result.derived.our_gutter_length_m).toBeCloseTo(17, 6);

    const hasLedgerLine = result.materials.lines.some((line) => line.notes?.includes('Ledger'));
    expect(hasLedgerLine).toBe(false);
  });

  it('pitched inverted + our gutter removes ledger', () => {
    const result = calculateCostV1({
      length_m: 6,
      projection_m: 3,
      post_cut_height_m: 2.4,
      post_count: 4,

      pergola_style: 'pitched',
      box_perimeter_enabled: false,
      roof_material: 'acrylic',
      extrusion_colour: 'Black',
      inverted_enabled: true,
      inverted_house_gutter: false,

      house_connection_type: 'soffit',
      post_connection_type: 'deck_bracket',
      access: 'normal',
      height: 'single_storey',
    });

    expect(result.derived.has_ledger).toBe(false);
    expect(result.derived.ledger_length_m).toBe(0);

    const hasLedgerLine = result.materials.lines.some((line) => line.notes?.includes('Ledger'));
    expect(hasLedgerLine).toBe(false);

    const spGutterLine = result.materials.lines.find((line) => line.profile === 'SP Gutter');
    expect(spGutterLine).toBeTruthy();
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

  it('site rollup: unified commercial overhead is calculated once per site', () => {
    const moduleInputs = {
      length_m: 6,
      projection_m: 3,
      roof_pitch_deg: 0,
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

    const onePergola = calculateSiteCostV1({
      pergolas: [{ id: 'pergola-1', modules: [moduleInputs, moduleInputs] }],
      travel_ex_gst: 0,
      extras_allowance_ex_gst: 0,
    });
    const twoPergolas = calculateSiteCostV1({
      pergolas: [
        { id: 'pergola-1', modules: [moduleInputs] },
        { id: 'pergola-2', modules: [moduleInputs] },
      ],
      travel_ex_gst: 0,
      extras_allowance_ex_gst: 0,
    });

    expect(onePergola.pergola_count).toBe(1);
    expect(twoPergolas.pergola_count).toBe(2);
    expect(onePergola.overhead.method).toBe('unified_commercial_v5');
    expect(twoPergolas.overhead.method).toBe('site_rollup');
    expect(twoPergolas.pergolas.every((pergola) => pergola.overhead.method === 'unified_commercial_v5')).toBe(true);
    expect(onePergola.overhead.sales_ex_gst).toBe(1500);
    expect(twoPergolas.overhead.sales_ex_gst).toBe(2000);
    expect(twoPergolas.overhead.total_ex_gst).toBeLessThan(onePergola.overhead.total_ex_gst * 2);
    expect(twoPergolas.shared.install.totals.install_ex_gst).toBeGreaterThan(0);
    expect(roundMoney(twoPergolas.shared.install.totals.install_ex_gst)).toBe(roundMoney(onePergola.shared.install.totals.install_ex_gst));
  });

  it('site rollup: mixed acrylic rafter lengths retain unified commercial overhead', () => {
    const shortModule = {
      length_m: 6,
      projection_m: 3,
      roof_pitch_deg: 0,
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
    const longModule = {
      ...shortModule,
      roof_pitch_deg: 5,
    };

    const site = calculateSiteCostV1({
      pergolas: [{ id: 'pergola-1', modules: [shortModule, longModule] }],
      travel_ex_gst: 0,
      extras_allowance_ex_gst: 0,
    });

    expect(site.pergolas[0]?.overhead.method).toBe('unified_commercial_v5');
    expect(site.pergolas[0]?.overhead.sales_ex_gst).toBe(1500);
    expect(site.overhead.method).toBe('unified_commercial_v5');
    expect(site.overhead.total_ex_gst).toBeGreaterThan(2000);
  });

  it('site rollup: box perimeter startup labour is charged once per pergola', () => {
    const boxModule = {
      length_m: 6,
      projection_m: 3,
      post_cut_height_m: 2.4,
      post_count: 4,

      pergola_style: 'pitched' as const,
      box_perimeter_enabled: true,
      internal_roof_type: 'pitched' as const,
      fall_distance_mm: 200,
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

    const site = calculateSiteCostV1({
      pergolas: [
        { id: 'pergola-1', modules: [boxModule] },
        { id: 'pergola-2', modules: [boxModule] },
      ],
      travel_ex_gst: 0,
      extras_allowance_ex_gst: 0,
    });

    const perPergolaStartups = site.pergolas
      .map((p) => p.install.actions.find((a) => a.id === 'job.mob.box_perimeter_startup'))
      .filter(Boolean);
    expect(perPergolaStartups.length).toBe(2);
    expect(perPergolaStartups.every((a) => a?.minutes === 180)).toBe(true);

    const siteStartups = site.install.actions.filter((a) => String(a.id).endsWith('.job.mob.box_perimeter_startup'));
    expect(siteStartups.length).toBe(2);
    expect(siteStartups.every((a) => a.minutes === 180)).toBe(true);
  });

  it('site rollup: shared install and add-ons are site-level', () => {
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
    };

    const site = calculateSiteCostV1({
      pergolas: [
        { id: 'pergola-1', modules: [moduleInputs] },
        { id: 'pergola-2', modules: [moduleInputs] },
      ],
      travel_ex_gst: 120,
      extras_allowance_ex_gst: 80,
    });

    expect(site.add_ons.travel_ex_gst).toBe(120);
    expect(site.add_ons.extras_allowance_ex_gst).toBe(80);
    expect(site.shared.add_ons.travel_ex_gst).toBe(120);
    expect(site.shared.add_ons.extras_allowance_ex_gst).toBe(80);

    const sumPergolas = site.pergolas.reduce((acc, pergola) => acc + pergola.totals.cost_ex_gst, 0);
    expect(roundMoney(sumPergolas + site.shared.totals.cost_ex_gst)).toBe(roundMoney(site.totals.cost_ex_gst));

    expect(site.shared.install.actions.some((action) => action.id.startsWith('job.day_cycle.'))).toBe(true);
    expect(site.pergolas.some((pergola) => pergola.install.actions.some((action) => action.id.includes('day_cycle')))).toBe(false);
  });
});

describe('timber roof system', () => {
  it('pitched timber derives rafter/purlin counts with visible edge rafters', () => {
    const result = calculateCostV1({
      length_m: 6,
      projection_m: 3,
      roof_pitch_deg: 10,
      post_cut_height_m: 2.4,
      post_count: 4,

      pergola_style: 'pitched',
      box_perimeter_enabled: false,
      roof_material: 'timber',
      extrusion_colour: 'Mill',
      powdercoat_standard_colour: 'Ironsands',
      powdercoat_is_custom: false,
      timber_roof_above_type: 'insulated_panels',
      timber_insulated_panel_thickness_mm: 50,

      house_connection_type: 'soffit',
      post_connection_type: 'deck_bracket',
      access: 'normal',
      height: 'single_storey',
    });

    expect(result.derived.timber_plane_count).toBe(1);
    expect(result.derived.timber_common_rafter_count_per_plane).toBe(13);
    expect(result.derived.timber_edge_rafter_count_total).toBe(2);

    const slopeMm = result.derived.timber_slope_len_per_plane_m * 1000;
    const expectedPurlinLines = Math.ceil(Math.max(slopeMm - 200, 0) / 500) + 1;
    expect(result.derived.timber_purlin_lines_per_plane).toBe(expectedPurlinLines);

    const lines = result.materials.lines;
    const mill50 = lines.find((l) => l.profile === '50x50' && /\(Mill\)/i.test(l.label));
    const mill80 = lines.find((l) => l.profile === '80x50' && /\(Mill\)/i.test(l.label));
    const edge150 = lines.find((l) => l.profile === '150x50' && /powdercoated/i.test(l.label));
    expect(mill50).toBeTruthy();
    expect(mill80).toBeTruthy();
    expect(edge150).toBeTruthy();

    const insulated = lines.find((l) => l.id === 'roof.insulated_panel_50mm_m2');
    const covertek = lines.find((l) => l.id === 'underlay.covertek_407_m2');
    const poly = lines.find((l) => l.id === 'insulation.polystyrene_m2');
    expect(insulated).toBeTruthy();
    expect(covertek).toBeUndefined();
    expect(poly).toBeUndefined();
  });

  it('gable timber doubles per-plane counts', () => {
    const result = calculateCostV1({
      length_m: 6,
      projection_m: 3,
      roof_pitch_deg: 10,
      post_cut_height_m: 2.4,
      post_count: 4,

      pergola_style: 'gable',
      box_perimeter_enabled: false,
      roof_material: 'timber',
      extrusion_colour: 'Mill',
      powdercoat_standard_colour: 'Ironsands',
      powdercoat_is_custom: false,
      timber_roof_above_type: 'steel_corrugated',

      house_connection_type: 'soffit',
      post_connection_type: 'deck_bracket',
      access: 'normal',
      height: 'single_storey',
    });

    expect(result.derived.timber_plane_count).toBe(2);
    expect(result.derived.timber_common_rafter_count_total).toBe(result.derived.timber_common_rafter_count_per_plane * 2);
    expect(result.derived.timber_edge_rafter_count_total).toBe(4);
    expect(result.derived.timber_purlin_total_m).toBe(
      result.derived.timber_purlin_lines_per_plane * result.derived.length_m * 2,
    );
    expect(result.materials.lines.find((l) => l.profile === '150x50' && /powdercoated/i.test(l.label))).toBeTruthy();
  });

  it('steel roof above adds covertek + polystyrene', () => {
    const result = calculateCostV1({
      length_m: 6,
      projection_m: 3,
      roof_pitch_deg: 10,
      post_cut_height_m: 2.4,
      post_count: 4,

      pergola_style: 'pitched',
      box_perimeter_enabled: false,
      roof_material: 'timber',
      extrusion_colour: 'Black',
      timber_roof_above_type: 'steel_corrugated',

      house_connection_type: 'soffit',
      post_connection_type: 'deck_bracket',
      access: 'normal',
      height: 'single_storey',
    });

    const lines = result.materials.lines;
    expect(lines.find((l) => l.id === 'roof.steel_corrugated_m2')).toBeTruthy();
    expect(lines.find((l) => l.id === 'underlay.covertek_407_m2')).toBeTruthy();
    expect(lines.find((l) => l.id === 'insulation.polystyrene_m2')).toBeTruthy();

    const covertekAction = result.install.actions.find((a) => a.id === 'roof.install_covertek_m2');
    const polyAction = result.install.actions.find((a) => a.id === 'roof.install_polystyrene_m2');
    expect(covertekAction?.qty).toBe(result.derived.covertek_area_m2);
    expect(polyAction?.qty).toBe(result.derived.polystyrene_area_m2);
  });

  it('timber rafter override uses specified profile', () => {
    const result = calculateCostV1({
      length_m: 6,
      projection_m: 3,
      roof_pitch_deg: 10,
      post_cut_height_m: 2.4,
      post_count: 4,

      pergola_style: 'pitched',
      box_perimeter_enabled: false,
      roof_material: 'timber',
      extrusion_colour: 'Black',
      timber_roof_above_type: 'insulated_panels',
      overrides: { rafter_profile: '100x50' },

      house_connection_type: 'soffit',
      post_connection_type: 'deck_bracket',
      access: 'normal',
      height: 'single_storey',
    });

    expect(result.inputs_normalized.rafter_profile).toBe('100x50');
    const mill100 = result.materials.lines.find((l) => l.profile === '100x50' && /\(Mill\)/i.test(l.label));
    const edge150 = result.materials.lines.find((l) => l.profile === '150x50');
    expect(mill100).toBeTruthy();
    expect(edge150).toBeTruthy();
  });

  it('tray width impacts sheet counts (reporting only)', () => {
    const base = {
      length_m: 6,
      projection_m: 3,
      roof_pitch_deg: 10,
      post_cut_height_m: 2.4,
      post_count: 4,
      pergola_style: 'pitched' as const,
      box_perimeter_enabled: false,
      roof_material: 'timber' as const,
      extrusion_colour: 'Black' as const,
      timber_roof_above_type: 'steel_tray' as const,
      house_connection_type: 'soffit' as const,
      post_connection_type: 'deck_bracket' as const,
      access: 'normal' as const,
      height: 'single_storey' as const,
    };

    const tray400 = calculateCostV1({ ...base, timber_tray_width_mm: 400 });
    const tray500 = calculateCostV1({ ...base, timber_tray_width_mm: 500 });
    const tray600 = calculateCostV1({ ...base, timber_tray_width_mm: 600 });

    expect(tray400.derived.timber_tray_sheet_count_per_plane).toBe(15);
    expect(tray500.derived.timber_tray_sheet_count_per_plane).toBe(12);
    expect(tray600.derived.timber_tray_sheet_count_per_plane).toBe(10);
  });
});

describe('downpipe allowances', () => {
  it('no our gutter: elbows forced to 0 and gutter startup skipped', () => {
    const module = calculateCostV1({
      length_m: 6,
      projection_m: 3,
      roof_pitch_deg: 5,
      post_cut_height_m: 2.4,
      post_count: 4,

      pergola_style: 'pitched',
      box_perimeter_enabled: false,
      roof_material: 'acrylic',
      extrusion_colour: 'Black',
      inverted_enabled: true,
      inverted_house_gutter: true,

      downpipe_join_count: 2,
      downpipe_elbow_count: 3,

      house_connection_type: 'soffit',
      post_connection_type: 'deck_bracket',
      access: 'normal',
      height: 'single_storey',
    });

    expect((module.derived as any).has_our_gutter).toBe(false);
    expect((module.derived as any).downpipe_elbow_count_used).toBe(0);

    const joinAction = module.install.actions.find((a) => a.id === 'drain.dp_join_each');
    const elbowAction = module.install.actions.find((a) => a.id === 'drain.dp_elbow_each');
    expect(joinAction?.qty).toBe(2);
    expect(elbowAction).toBeUndefined();

    const job = calculateJobCostV1({
      modules: [
        {
          length_m: 6,
          projection_m: 3,
          roof_pitch_deg: 5,
          post_cut_height_m: 2.4,
          post_count: 4,

          pergola_style: 'pitched',
          box_perimeter_enabled: false,
          roof_material: 'acrylic',
          extrusion_colour: 'Black',
          inverted_enabled: true,
          inverted_house_gutter: true,

          downpipe_join_count: 2,
          downpipe_elbow_count: 3,

          house_connection_type: 'soffit',
          post_connection_type: 'deck_bracket',
          access: 'normal',
          height: 'single_storey',
        },
      ],
      travel_ex_gst: 0,
      extras_allowance_ex_gst: 0,
    });

    expect(job.install.actions.find((a) => a.id === 'job.drain.gutter_startup_job')).toBeUndefined();
  });

  it('our gutter: elbows allowed and gutter startup applies once', () => {
    const job = calculateJobCostV1({
      modules: [
        {
          length_m: 6,
          projection_m: 3,
          roof_pitch_deg: 5,
          post_cut_height_m: 2.4,
          post_count: 4,

          pergola_style: 'pitched',
          box_perimeter_enabled: false,
          roof_material: 'acrylic',
          extrusion_colour: 'Black',

          downpipe_join_count: 1,
          downpipe_elbow_count: 4,

          house_connection_type: 'soffit',
          post_connection_type: 'deck_bracket',
          access: 'normal',
          height: 'single_storey',
        },
      ],
      travel_ex_gst: 0,
      extras_allowance_ex_gst: 0,
    });

    const moduleActions = job.install.actions.filter((a) => a.id.startsWith('m1.'));
    expect(moduleActions.find((a) => a.id === 'm1.drain.dp_elbow_each')?.qty).toBe(4);

    const gutterStartup = job.install.actions.find((a) => a.id === 'job.drain.gutter_startup_job');
    expect(gutterStartup?.qty).toBe(1);
  });

  it('multi-module: gutter startup appears once when any module has our gutter', () => {
    const job = calculateJobCostV1({
      modules: [
        {
          length_m: 6,
          projection_m: 3,
          roof_pitch_deg: 5,
          post_cut_height_m: 2.4,
          post_count: 4,

          pergola_style: 'pitched',
          box_perimeter_enabled: false,
          roof_material: 'acrylic',
          extrusion_colour: 'Black',
          inverted_enabled: true,
          inverted_house_gutter: true,

          house_connection_type: 'soffit',
          post_connection_type: 'deck_bracket',
          access: 'normal',
          height: 'single_storey',
        },
        {
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
        },
      ],
      travel_ex_gst: 0,
      extras_allowance_ex_gst: 0,
    });

    const gutterStartup = job.install.actions.filter((a) => a.id === 'job.drain.gutter_startup_job');
    expect(gutterStartup.length).toBe(1);
  });
});

describe('install day cycle', () => {
  const baseInputs = {
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

  const dayCycleMinutesPerDay = 30 + 30 + 18;

  it('single-module: site days clamps to 1 and day-cycle qty is 1', () => {
    const cfg = buildTestConfig(300);
    const result = calculateCostV1(baseInputs, cfg);

    expect(result.derived.site_days).toBe(1);
    for (const id of DAY_CYCLE_ACTION_IDS) {
      expect(result.install.actions.find((a) => a.id === id)?.qty).toBe(1);
    }

    const dayCycleMinutes = result.install.actions
      .filter((a) => (DAY_CYCLE_ACTION_IDS as readonly string[]).includes(a.id))
      .reduce((acc, a) => acc + a.minutes, 0);
    expect(dayCycleMinutes).toBe(dayCycleMinutesPerDay);
    expect(result.install.totals.crew_minutes).toBe(300 + dayCycleMinutesPerDay);
  });

  it('single-module: multi-day job scales day-cycle qty', () => {
    const cfg = buildTestConfig(1250);
    const result = calculateCostV1(baseInputs, cfg);

    expect(result.derived.site_days).toBe(4);
    for (const id of DAY_CYCLE_ACTION_IDS) {
      expect(result.install.actions.find((a) => a.id === id)?.qty).toBe(4);
    }
    expect(result.install.totals.crew_minutes).toBe(1250 + dayCycleMinutesPerDay * 4);
  });

  it('single-module: boundary iteration bumps site days', () => {
    const cfg = buildTestConfig(1070);
    const result = calculateCostV1(baseInputs, cfg);

    expect(result.derived.site_days).toBe(3);
    for (const id of DAY_CYCLE_ACTION_IDS) {
      expect(result.install.actions.find((a) => a.id === id)?.qty).toBe(3);
    }
    expect(result.install.totals.crew_minutes).toBe(1070 + dayCycleMinutesPerDay * 3);
  });

  it('multi-module job: day-cycle actions appear once at job scope', () => {
    const cfg = buildTestConfig(300);
    const job = calculateJobCostV1(
      {
        modules: [baseInputs, baseInputs],
        travel_ex_gst: 0,
        extras_allowance_ex_gst: 0,
      },
      cfg,
    );

    const dayCycleIds = DAY_CYCLE_ACTION_IDS.map((id) => `job.${id}`);
    for (const id of dayCycleIds) {
      expect(job.install.actions.find((a) => a.id === id)?.qty).toBe(2);
    }
    expect(job.install.actions.some((a) => a.id.startsWith('m1.day_cycle.'))).toBe(false);
    expect(job.install.actions.some((a) => a.id.startsWith('m2.day_cycle.'))).toBe(false);
    expect(job.modules[0].derived.site_days).toBe(2);
  });
});

describe('steep pitch and scaffolding', () => {
  const baseModule = {
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

  it('steep pitch multiplier tiers apply at >20 and >30 degrees', () => {
    const baseCfg = buildTestConfig(60);
    const cfg = {
      ...baseCfg,
      installActions: {
        ...baseCfg.installActions,
        actions: baseCfg.installActions.actions.map((action) =>
          action.id === 'test.base_action' ? { ...action, apply_multipliers: ['pitch_steep_roof'] } : action,
        ),
      },
    };

    const at20 = calculateCostV1({ ...baseModule, roof_pitch_deg: 20 }, cfg);
    const over20 = calculateCostV1({ ...baseModule, roof_pitch_deg: 21 }, cfg);
    const over30 = calculateCostV1({ ...baseModule, roof_pitch_deg: 31 }, cfg);

    const action20 = at20.install.actions.find((a) => a.id === 'test.base_action');
    const actionOver20 = over20.install.actions.find((a) => a.id === 'test.base_action');
    const actionOver30 = over30.install.actions.find((a) => a.id === 'test.base_action');

    expect(action20?.applied_multipliers.pitch_steep_roof).toBe(1);
    expect(actionOver20?.applied_multipliers.pitch_steep_roof).toBe(1.2);
    expect(actionOver30?.applied_multipliers.pitch_steep_roof).toBe(1.3);
    expect(actionOver20?.minutes ?? 0).toBeCloseTo((action20?.minutes ?? 0) * 1.2, 6);
    expect(actionOver30?.minutes ?? 0).toBeCloseTo((action20?.minutes ?? 0) * 1.3, 6);
  });

  it('acrylic panel install includes steep pitch multiplier', () => {
    const result = calculateCostV1({ ...baseModule, roof_pitch_deg: 31 });
    const acrylicInstall = result.install.actions.find((a) => a.id === 'roof.install_acrylic_panels_m2');

    expect(acrylicInstall).toBeTruthy();
    expect(acrylicInstall?.applied_multipliers.pitch_steep_roof).toBe(1.3);
  });

  it('residential pergola at 30 degrees auto-adds scaffolding startup and day rate', () => {
    const site = calculateSiteCostV1({
      job_type: 'residential',
      pergolas: [{ id: 'p1', modules: [{ ...baseModule, roof_pitch_deg: 30 }] }],
      travel_ex_gst: 0,
      extras_allowance_ex_gst: 0,
    });

    const startupAction = site.shared.install.actions.find((a) => a.id === 'job.mob.scaffolding_startup');
    const extraPergolaAction = site.shared.install.actions.find((a) => a.id === 'job.mob.scaffolding_additional_per_pergola');
    const dayRateLine = site.pergolas[0].materials.lines.find((line) => line.id === 'job.hire.scaffolding_day_rate');

    expect(startupAction?.minutes).toBe(150);
    expect(extraPergolaAction).toBeUndefined();
    expect(dayRateLine?.unit_cost_ex_gst).toBe(50);
    expect(dayRateLine?.qty).toBe(site.pergolas[0].modules[0].derived.site_days);
    expect(dayRateLine?.line_cost_ex_gst).toBe(roundMoney((dayRateLine?.qty ?? 0) * 50));
  });

  it('residential pergola below 30 degrees does not auto-add scaffolding', () => {
    const site = calculateSiteCostV1({
      job_type: 'residential',
      pergolas: [{ id: 'p1', modules: [{ ...baseModule, roof_pitch_deg: 29 }] }],
      travel_ex_gst: 0,
      extras_allowance_ex_gst: 0,
    });

    const startupAction = site.shared.install.actions.find((a) => a.id === 'job.mob.scaffolding_startup');
    const dayRateLine = site.pergolas[0].materials.lines.find((line) => line.id === 'job.hire.scaffolding_day_rate');
    expect(startupAction).toBeUndefined();
    expect(dayRateLine).toBeUndefined();
  });

  it('commercial site auto-adds scaffolding with area-based day rates and extra pergola labour', () => {
    const site = calculateSiteCostV1({
      job_type: 'commercial',
      pergolas: [
        { id: 'p1', modules: [{ ...baseModule, length_m: 4, projection_m: 4, roof_pitch_deg: 10 }] },
        { id: 'p2', modules: [{ ...baseModule, length_m: 5, projection_m: 4, roof_pitch_deg: 10 }] },
      ],
      travel_ex_gst: 0,
      extras_allowance_ex_gst: 0,
    });

    const startupAction = site.shared.install.actions.find((a) => a.id === 'job.mob.scaffolding_startup');
    const extraPergolaAction = site.shared.install.actions.find((a) => a.id === 'job.mob.scaffolding_additional_per_pergola');
    const p1Line = site.pergolas[0].materials.lines.find((line) => line.id === 'job.hire.scaffolding_day_rate');
    const p2Line = site.pergolas[1].materials.lines.find((line) => line.id === 'job.hire.scaffolding_day_rate');

    expect(startupAction?.minutes).toBe(150);
    expect(extraPergolaAction?.qty).toBe(1);
    expect(extraPergolaAction?.minutes).toBe(60);
    expect(p1Line?.unit_cost_ex_gst).toBe(100);
    expect(p2Line?.unit_cost_ex_gst).toBe(200);
    expect(p1Line?.qty).toBe(site.pergolas[0].modules[0].derived.site_days);
    expect(p2Line?.qty).toBe(site.pergolas[1].modules[0].derived.site_days);
  });

  it('commercial job rollup applies one-per-job scaffolding startup and day rate', () => {
    const job = calculateJobCostV1({
      job_type: 'commercial',
      modules: [{ ...baseModule, length_m: 4, projection_m: 4, roof_pitch_deg: 10 }],
      travel_ex_gst: 0,
      extras_allowance_ex_gst: 0,
    });

    const startupAction = job.install.actions.find((a) => a.id === 'job.mob.scaffolding_startup');
    const extraPergolaAction = job.install.actions.find((a) => a.id === 'job.mob.scaffolding_additional_per_pergola');
    const dayRateLine = job.materials.lines.find((line) => line.id === 'job.hire.scaffolding_day_rate');

    expect(startupAction?.minutes).toBe(150);
    expect(extraPergolaAction).toBeUndefined();
    expect(dayRateLine?.unit_cost_ex_gst).toBe(100);
    expect(dayRateLine?.qty).toBe(job.modules[0].derived.site_days);
  });
});
