import { describe, expect, it } from 'vitest';
import { loadCostingConfigV1 } from './config';
import { normalizeAndDeriveV1 } from './derive';

const baseInputs = {
  length_m: 3,
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

describe('normalizeAndDeriveV1 (rafter spacing)', () => {
  it('acrylic roofs use clear length and never exceed 642mm spacing', () => {
    const cfg = loadCostingConfigV1();
    const lengths = [0.05, 1.285, 2.5, 6];

    for (const length_m of lengths) {
      const result = normalizeAndDeriveV1({ ...baseInputs, length_m }, cfg);
      const lengthMm = Math.round(length_m * 1000);
      const clearLenMm = Math.max(0, lengthMm - 50);
      const bays = Math.max(1, Math.ceil(clearLenMm / 642));
      const expectedRafterCount = bays + 1;

      expect(result.derived.rafter_count).toBe(expectedRafterCount);
      expect(result.derived.rafter_clear_len_mm).toBe(clearLenMm);

      const spacing = clearLenMm / Math.max(1, expectedRafterCount - 1);
      expect(spacing).toBeLessThanOrEqual(642 + 1e-6);
    }
  });

  it('acrylic clear length boundary: 50mm -> rafter_count 2', () => {
    const cfg = loadCostingConfigV1();
    const result = normalizeAndDeriveV1({ ...baseInputs, length_m: 0.05 }, cfg);

    expect(result.derived.rafter_count).toBe(2);
    expect(result.derived.rafter_clear_len_mm).toBe(0);
  });

  it('non-acrylic roofs keep rafter_count behavior (snapshot)', () => {
    const cfg = loadCostingConfigV1();
    const result = normalizeAndDeriveV1({ ...baseInputs, roof_material: 'mixed' }, cfg);

    expect({ rafter_count: result.derived.rafter_count }).toMatchSnapshot();
  });
});

describe('rafter_cut_length_m takeoff (edge allowances + LengthA)', () => {
  it('pitched: subtracts ledger + (SP gutter) and adds LengthA', () => {
    const cfg = loadCostingConfigV1();
    const result = normalizeAndDeriveV1(
      {
        ...baseInputs,
        pergola_style: 'pitched',
        roof_pitch_deg: 30,
        projection_m: 3,
        overrides: { rafter_profile: '150x50' },
      },
      cfg,
    );

    // expected:
    // run = 3.0 - ledger(0.05) - SP(0.10) = 2.85
    // slope = run / cos30 + lengthA(0.15*tan30)
    const cos30 = Math.cos((30 * Math.PI) / 180);
    const tan30 = Math.tan((30 * Math.PI) / 180);
    const expected = (2.85 / cos30) + (0.15 * tan30);

    expect(result.derived.rafter_cut_length_m).toBeCloseTo(expected, 6);
  });

  it('pitched + separate gutter: uses 150mm far-side allowance', () => {
    const cfg = loadCostingConfigV1();
    const result = normalizeAndDeriveV1(
      {
        ...baseInputs,
        pergola_style: 'pitched',
        roof_pitch_deg: 30,
        projection_m: 3,
        separate_gutter_enabled: true,
        overrides: {
          rafter_profile: '150x50',
          front_beam_profile: '150x50', // disables SP gutter profile
        },
      },
      cfg,
    );

    const cos30 = Math.cos((30 * Math.PI) / 180);
    const tan30 = Math.tan((30 * Math.PI) / 180);
    // run = 3.0 - ledger(0.05) - beam+gutter(0.15) = 2.80
    const expected = (2.80 / cos30) + (0.15 * tan30);

    expect(result.derived.rafter_cut_length_m).toBeCloseTo(expected, 6);
  });

  it('pitched inverted + house gutter: uses 50mm on gutter side', () => {
    const cfg = loadCostingConfigV1();
    const result = normalizeAndDeriveV1(
      {
        ...baseInputs,
        pergola_style: 'pitched',
        roof_pitch_deg: 30,
        projection_m: 3,
        inverted_enabled: true,
        inverted_house_gutter: true,
        overrides: { rafter_profile: '150x50' },
      },
      cfg,
    );

    const cos30 = Math.cos((30 * Math.PI) / 180);
    const tan30 = Math.tan((30 * Math.PI) / 180);
    // inverted: house side = beam only 0.05; far side beam only 0.05
    // run = 3.0 - 0.05 - 0.05 = 2.90
    const expected = (2.90 / cos30) + (0.15 * tan30);

    expect(result.derived.rafter_cut_length_m).toBeCloseTo(expected, 6);
  });

  it('gable: halves span, subtracts half ridge, and exposes per-side rafter lengths', () => {
    const cfg = loadCostingConfigV1();
    const result = normalizeAndDeriveV1(
      {
        ...baseInputs,
        pergola_style: 'gable',
        roof_pitch_deg: 30,
        projection_m: 5.55,
        gable_house_edge_gutter: 'house',
        gable_outer_edge_gutter: 'our',
        overrides: {
          rafter_profile: '150x50',
          ridge_beam_profile: '100x50',
          front_beam_profile: 'SP Gutter',
        },
      },
      cfg,
    );

    const cos30 = Math.cos((30 * Math.PI) / 180);
    const tan30 = Math.tan((30 * Math.PI) / 180);

    const halfSpan = 5.55 / 2;
    const ridgeHalf = 0.05 / 2; // 100x50 => width 50mm => half 25mm
    const houseEave = 0.05; // house gutter => beam only
    const outerEave = 0.10; // our gutter => SP (integrated)

    const expectedHouse = ((halfSpan - ridgeHalf - houseEave) / cos30) + (0.15 * tan30);
    const expectedOuter = ((halfSpan - ridgeHalf - outerEave) / cos30) + (0.15 * tan30);

    expect((result.derived as any).rafter_cut_length_house_side_m).toBeCloseTo(expectedHouse, 6);
    expect((result.derived as any).rafter_cut_length_outer_side_m).toBeCloseTo(expectedOuter, 6);
    expect(result.derived.rafter_cut_length_m).toBeCloseTo(Math.max(expectedHouse, expectedOuter), 6);
  });
});
