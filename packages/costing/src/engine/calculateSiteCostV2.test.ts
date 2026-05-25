import { describe, expect, it } from 'vitest';
import { calculateSiteCostV1, calculateSiteCostV2 } from './calculate';
import type { CostInputsV1, SiteInputsV1, SiteInputsV2, PergolaModuleCostInputV2 } from './types';

// PR-2B.4 (2026-05-22): the V2 entry accepts scene-derived input. The
// pricing pipeline is unchanged — V2 adapts to V1 internally and delegates.
// These tests pin down the equivalence: a V2 input must produce the same
// SiteOutputV1 (modulo rounding) as an equivalent V1 input.

function baseModuleFields(overrides: Partial<CostInputsV1> = {}): Omit<CostInputsV1, 'access' | 'height'> {
  return {
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
    ...overrides,
  };
}

function makeV1Module(overrides: Partial<CostInputsV1> = {}): CostInputsV1 {
  return {
    ...baseModuleFields(),
    access: 'normal',
    height: 'single_storey',
    ...overrides,
  };
}

function makeV2Module(id: string, overrides: Partial<PergolaModuleCostInputV2> = {}): PergolaModuleCostInputV2 {
  return {
    id,
    ...baseModuleFields(overrides),
  } as PergolaModuleCostInputV2;
}

describe('calculateSiteCostV2', () => {
  it('produces the same SiteOutputV1 as the equivalent SiteInputsV1 for a single-pergola single-module job', () => {
    const v1Input: SiteInputsV1 = {
      pergolas: [{ id: 'pergola-1', label: 'Pergola 1', modules: [makeV1Module()] }],
      job_type: 'residential',
      travel_ex_gst: 12,
      extras_allowance_ex_gst: 45,
      quote_discount_pct: 0,
    };
    const v2Input: SiteInputsV2 = {
      schema_version: 'v2',
      pergolas: [
        {
          id: 'pergola-1',
          label: 'Pergola 1',
          modules: [makeV2Module('pergola-1')],
          accessories: [],
        },
      ],
      job_type: 'residential',
      access: 'normal',
      height: 'single_storey',
      travel_ex_gst: 12,
      extras_allowance_ex_gst: 45,
      quote_discount_pct: 0,
    };

    const v1Out = calculateSiteCostV1(v1Input);
    const v2Out = calculateSiteCostV2(v2Input);

    expect(v2Out.totals.cost_ex_gst).toBeCloseTo(v1Out.totals.cost_ex_gst, 2);
    expect(v2Out.totals.cost_inc_gst).toBeCloseTo(v1Out.totals.cost_inc_gst, 2);
    expect(v2Out.pergola_count).toBe(v1Out.pergola_count);
    expect(v2Out.pergolas).toHaveLength(v1Out.pergolas.length);
    expect(v2Out.materials.totals.materials_ex_gst).toBeCloseTo(v1Out.materials.totals.materials_ex_gst, 2);
    expect(v2Out.install.totals.install_ex_gst).toBeCloseTo(v1Out.install.totals.install_ex_gst, 2);
  });

  it('produces the same output as V1 for two snapped pergolas treated as one logical pergola with two modules', () => {
    // V2 caller groups two snap-connected pergolas as one logical pergola
    // (modules of the same logical entity). The cost engine should produce
    // the same totals as if a V1 caller had built a single pergola with
    // two CostInputsV1 modules.
    const v1Input: SiteInputsV1 = {
      pergolas: [
        {
          id: 'pergola-1',
          label: 'Pergola 1',
          modules: [
            makeV1Module({ length_m: 6, projection_m: 3 }),
            makeV1Module({ length_m: 4, projection_m: 3 }),
          ],
        },
      ],
      job_type: 'residential',
      travel_ex_gst: 0,
      extras_allowance_ex_gst: 0,
      quote_discount_pct: 0,
    };
    const v2Input: SiteInputsV2 = {
      schema_version: 'v2',
      pergolas: [
        {
          id: 'pergola-1',
          label: 'Pergola 1',
          modules: [
            makeV2Module('pergola-1', { length_m: 6, projection_m: 3 }),
            makeV2Module('pergola-2', { length_m: 4, projection_m: 3 }),
          ],
          accessories: [],
        },
      ],
      job_type: 'residential',
      access: 'normal',
      height: 'single_storey',
      travel_ex_gst: 0,
      extras_allowance_ex_gst: 0,
      quote_discount_pct: 0,
    };

    const v1Out = calculateSiteCostV1(v1Input);
    const v2Out = calculateSiteCostV2(v2Input);

    expect(v2Out.totals.cost_ex_gst).toBeCloseTo(v1Out.totals.cost_ex_gst, 2);
    expect(v2Out.pergola_count).toBe(1);
    expect(v2Out.pergolas[0]?.module_count).toBe(2);
  });

  it('produces the same output as V1 for two unconnected pergolas treated as separate logical pergolas', () => {
    const v1Input: SiteInputsV1 = {
      pergolas: [
        { id: 'pergola-1', label: 'Pergola 1', modules: [makeV1Module({ length_m: 6 })] },
        { id: 'pergola-2', label: 'Pergola 2', modules: [makeV1Module({ length_m: 4 })] },
      ],
      job_type: 'residential',
      travel_ex_gst: 0,
      extras_allowance_ex_gst: 0,
      quote_discount_pct: 0,
    };
    const v2Input: SiteInputsV2 = {
      schema_version: 'v2',
      pergolas: [
        {
          id: 'pergola-1',
          label: 'Pergola 1',
          modules: [makeV2Module('pergola-1', { length_m: 6 })],
          accessories: [],
        },
        {
          id: 'pergola-2',
          label: 'Pergola 2',
          modules: [makeV2Module('pergola-2', { length_m: 4 })],
          accessories: [],
        },
      ],
      job_type: 'residential',
      access: 'normal',
      height: 'single_storey',
      travel_ex_gst: 0,
      extras_allowance_ex_gst: 0,
      quote_discount_pct: 0,
    };

    const v1Out = calculateSiteCostV1(v1Input);
    const v2Out = calculateSiteCostV2(v2Input);

    expect(v2Out.totals.cost_ex_gst).toBeCloseTo(v1Out.totals.cost_ex_gst, 2);
    expect(v2Out.pergola_count).toBe(2);
    expect(v2Out.pergolas[0]?.id).toBe('pergola-1');
    expect(v2Out.pergolas[1]?.id).toBe('pergola-2');
  });

  it('lifts site-level access and height onto each module before pricing', () => {
    // Two-storey + difficult access raises install hours. The V2 builder
    // puts these at the site level; the adapter must propagate them to
    // each module so the legacy pricing logic sees them.
    const v2Input: SiteInputsV2 = {
      schema_version: 'v2',
      pergolas: [
        {
          id: 'pergola-1',
          label: 'Pergola 1',
          modules: [makeV2Module('pergola-1')],
          accessories: [],
        },
      ],
      job_type: 'residential',
      access: 'hard',
      height: 'two_storey',
      travel_ex_gst: 0,
      extras_allowance_ex_gst: 0,
      quote_discount_pct: 0,
    };

    const v1Equivalent: SiteInputsV1 = {
      pergolas: [
        {
          id: 'pergola-1',
          label: 'Pergola 1',
          modules: [makeV1Module({ access: 'hard', height: 'two_storey' })],
        },
      ],
      job_type: 'residential',
      travel_ex_gst: 0,
      extras_allowance_ex_gst: 0,
      quote_discount_pct: 0,
    };

    const v2Out = calculateSiteCostV2(v2Input);
    const v1Out = calculateSiteCostV1(v1Equivalent);

    expect(v2Out.totals.cost_ex_gst).toBeCloseTo(v1Out.totals.cost_ex_gst, 2);
  });

  it('throws when the V2 input has no pergolas (matches V1 behaviour)', () => {
    const v2Input: SiteInputsV2 = {
      schema_version: 'v2',
      pergolas: [],
      access: 'normal',
      height: 'single_storey',
    };
    expect(() => calculateSiteCostV2(v2Input)).toThrow(/at least one pergola/);
  });

  it('throws when a V2 logical pergola has no modules (matches V1 behaviour)', () => {
    const v2Input: SiteInputsV2 = {
      schema_version: 'v2',
      pergolas: [{ id: 'pergola-1', label: 'Pergola 1', modules: [], accessories: [] }],
      access: 'normal',
      height: 'single_storey',
    };
    expect(() => calculateSiteCostV2(v2Input)).toThrow(/at least one module/);
  });

  it('passes through job_type, travel_ex_gst, extras_allowance_ex_gst, quote_discount_pct from site level', () => {
    const v2Input: SiteInputsV2 = {
      schema_version: 'v2',
      pergolas: [
        {
          id: 'pergola-1',
          label: 'Pergola 1',
          modules: [makeV2Module('pergola-1')],
          accessories: [],
        },
      ],
      job_type: 'commercial',
      access: 'normal',
      height: 'single_storey',
      travel_ex_gst: 100,
      extras_allowance_ex_gst: 200,
      quote_discount_pct: 5,
    };
    const v1Equivalent: SiteInputsV1 = {
      pergolas: [{ id: 'pergola-1', label: 'Pergola 1', modules: [makeV1Module()] }],
      job_type: 'commercial',
      travel_ex_gst: 100,
      extras_allowance_ex_gst: 200,
      quote_discount_pct: 5,
    };

    const v2Out = calculateSiteCostV2(v2Input);
    const v1Out = calculateSiteCostV1(v1Equivalent);

    expect(v2Out.totals.cost_ex_gst).toBeCloseTo(v1Out.totals.cost_ex_gst, 2);
  });

  it('ignores the empty accessories slot (forward-compatible no-op pass-through)', () => {
    const withoutAccessories: SiteInputsV2 = {
      schema_version: 'v2',
      pergolas: [
        {
          id: 'pergola-1',
          label: 'Pergola 1',
          modules: [makeV2Module('pergola-1')],
          accessories: [],
        },
      ],
      access: 'normal',
      height: 'single_storey',
    };
    expect(() => calculateSiteCostV2(withoutAccessories)).not.toThrow();
  });
});
