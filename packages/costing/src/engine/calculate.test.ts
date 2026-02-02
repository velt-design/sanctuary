import { describe, expect, it } from 'vitest';
import { calculateCostV1, calculateJobCostV1 } from './calculate';
import { loadCostingConfigV1 } from './config';

function roundMoney(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
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
    expect(result.materials.lines.some((l) => l.id === 'placeholder.flashing_material_m')).toBe(true);
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
    expect(result.materials.lines.some((l) => l.id === 'placeholder.flashing_material_m')).toBe(true);
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
    expect(soffit.install.actions.find((a) => a.id === 'house.install_back_stringer_startup')?.minutes).toBeCloseTo(30, 2);
    expect(soffit.install.actions.find((a) => a.id === 'house.install_soffit_bracket')?.minutes).toBeCloseTo(soffit.derived.bracket_count * 20, 2);

    const fascia = calculateCostV1({ ...baseInputs, house_connection_type: 'fascia' as const });
    expect(fascia.derived.bracket_count).toBe(0);
    expect(fascia.derived.stringer_fixing_count).toBe(5);
    expect(fascia.install.actions.some((a) => a.id === 'house.install_soffit_bracket')).toBe(false);
    expect(fascia.materials.lines.some((l) => l.id === 'bracket_3f6d3c53fa')).toBe(false);
    expect(fascia.materials.lines.some((l) => l.id === 'powdercoating_199231d91b')).toBe(false);
    expect(fascia.install.actions.find((a) => a.id === 'house.install_back_stringer_startup')?.minutes).toBeCloseTo(30, 2);
    expect(fascia.install.actions.find((a) => a.id === 'house.install_fascia_connection')?.qty).toBe(5);
    expect(fascia.install.actions.find((a) => a.id === 'house.install_fascia_connection')?.minutes).toBeCloseTo(25, 2);

    const facade = calculateCostV1({ ...baseInputs, house_connection_type: 'facade' as const });
    expect(facade.derived.bracket_count).toBe(0);
    expect(facade.derived.stringer_fixing_count).toBe(5);
    expect(facade.install.actions.some((a) => a.id === 'house.install_soffit_bracket')).toBe(false);
    expect(facade.materials.lines.some((l) => l.id === 'anchor.chem_m12_each')).toBe(false);
    expect(facade.install.actions.find((a) => a.id === 'house.install_back_stringer_startup')?.minutes).toBeCloseTo(30, 2);
    expect(facade.install.actions.find((a) => a.id === 'house.install_facade_connection')?.qty).toBe(5);
    expect(facade.install.actions.find((a) => a.id === 'house.install_facade_connection')?.minutes).toBeCloseTo(25, 2);
  });

  it('gable acrylic: 6×3 @ 5° matches pitched 6×3 @ 5° for mode + sheet count (no plane doubling)', () => {
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
    const stripQty = (r: ReturnType<typeof calculateCostV1>) =>
      r.materials.lines
        .filter((l) => String(l.profile ?? '') === 'Crystalite 620mm')
        .reduce((sum, l) => sum + (typeof l.qty === 'number' ? l.qty : 0), 0);
    const acrylicMode = (r: ReturnType<typeof calculateCostV1>) => (plexiQty(r) > 0 ? 'sheet' : stripQty(r) > 0 ? 'strip' : 'none');

    const foamQty = (r: ReturnType<typeof calculateCostV1>) =>
      r.materials.lines.find((l) => l.id === 'consumable_04259b1a85')?.qty ?? 0;
    const flashingQty = (r: ReturnType<typeof calculateCostV1>) =>
      r.materials.lines.find((l) => l.id === 'placeholder.flashing_material_m')?.qty ?? 0;
    const joinerScrewsQty = (r: ReturnType<typeof calculateCostV1>) =>
      r.materials.lines.find((l) => l.id === 'fixing.joiner_screw_each')?.qty ?? 0;

    expect(pitched.derived.roof_plane_count).toBe(1);
    expect(gable.derived.roof_plane_count).toBe(2);

    expect(acrylicMode(gable)).toBe(acrylicMode(pitched));
    expect(acrylicMode(gable)).toBe('sheet');
    expect(plexiQty(gable)).toBe(plexiQty(pitched));

    // Joiner system + edge consumables exist on both planes.
    expect(joinerScrewsQty(gable)).toBe(joinerScrewsQty(pitched) * 2);
    expect(foamQty(gable)).toBe(foamQty(pitched) * 2);
    expect(flashingQty(gable)).toBe(flashingQty(pitched) * 2);
  });

  it('gable acrylic: 6×6 @ 5° behaves like 2× pitched 6×3 @ 5° (area-based sheets)', () => {
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
    const stripQty = (r: ReturnType<typeof calculateCostV1>) =>
      r.materials.lines
        .filter((l) => String(l.profile ?? '') === 'Crystalite 620mm')
        .reduce((sum, l) => sum + (typeof l.qty === 'number' ? l.qty : 0), 0);
    const acrylicMode = (r: ReturnType<typeof calculateCostV1>) => (plexiQty(r) > 0 ? 'sheet' : stripQty(r) > 0 ? 'strip' : 'none');

    const joinerScrewsQty = (r: ReturnType<typeof calculateCostV1>) =>
      r.materials.lines.find((l) => l.id === 'fixing.joiner_screw_each')?.qty ?? 0;

    expect(acrylicMode(gable6x6)).toBe(acrylicMode(pitched6x3));
    expect(acrylicMode(gable6x6)).toBe('sheet');
    expect(plexiQty(gable6x6)).toBe(plexiQty(pitched6x3) * 2);
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

  it('mixed: joiner fixings include +1 run per acrylic plane', () => {
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
    expect(joinerFixings).toBe((3 + 2) * 6);
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
    expect(plexiLines[0].qty).toBe(3);

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
    expect(result.derived.cut_rafter_length_m).toBeCloseTo(5.87235, 4);

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

    // Acrylic sheets should be length-based: ceil(6/2.03)=3, down-slope <=3.05 => 1.
    const plexi = result.materials.lines.find((l) => l.id.startsWith('roofing-sheet_e1f7673c14'));
    expect(plexi?.qty).toBe(3);

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

describe('timber roof system', () => {
  it('pitched timber derives rafter/purlin counts and mill finish', () => {
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
    const mill200 = lines.find((l) => l.profile === '200x50' && /\(Mill\)/i.test(l.label));
    expect(mill50).toBeTruthy();
    expect(mill80).toBeTruthy();
    expect(mill200).toBeTruthy();

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
      extrusion_colour: 'White',
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
    const mill200 = result.materials.lines.find((l) => l.profile === '200x50' && /\(Mill\)/i.test(l.label));
    expect(mill100).toBeTruthy();
    expect(mill200).toBeTruthy();
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
