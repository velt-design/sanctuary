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
