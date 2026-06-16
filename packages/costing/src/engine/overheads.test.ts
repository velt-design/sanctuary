import { describe, expect, it } from 'vitest';
import { loadCostingConfigV1 } from './config';
import { buildOverheadV1 } from './overheads';

function roundMoney(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

describe('buildOverheadV1', () => {
  it('uses a flat pitched-acrylic overhead total when max rafter length is at or below 3m', () => {
    const cfg = loadCostingConfigV1();

    const result = buildOverheadV1(cfg, {
      module_count: 1,
      total_crew_hours: 18,
      has_acrylic_only: true,
      all_pitched_acrylic: true,
      max_acrylic_rafter_length_m: 3,
    });

    expect(result.overhead.method).toBe('flat_acrylic_total');
    expect(result.overhead.ops_ex_gst).toBe(2000);
    expect(result.overhead.sales_ex_gst).toBe(0);
    expect(result.overhead.total_ex_gst).toBe(2000);
  });

  it('falls back to variable overhead when pitched-acrylic rafters exceed 3m', () => {
    const cfg = loadCostingConfigV1();

    const result = buildOverheadV1(cfg, {
      module_count: 1,
      total_crew_hours: 18,
      has_acrylic_only: true,
      all_pitched_acrylic: true,
      max_acrylic_rafter_length_m: 3.001,
    });

    expect(result.overhead.method).toBe('fixed_plus_variable');
    expect(result.overhead.ops_ex_gst).toBeGreaterThan(2000);
    expect(result.overhead.sales_ex_gst).toBeGreaterThan(0);
    expect(result.overhead.total_ex_gst).toBeGreaterThan(2000);
  });

  it('PR-PE2: gable / box-perimeter acrylic with short rafters does NOT get the flat $2000 cap', () => {
    const cfg = loadCostingConfigV1();

    // Acrylic-only, short rafters, but pergola style is NOT pitched →
    // flat cap must not fire. Falls back to fixed_plus_variable, picks up
    // the gable startup, and lands well above the $2000 cap.
    const gableAcrylic = buildOverheadV1(cfg, {
      module_count: 1,
      total_crew_hours: 18,
      has_gable: true,
      has_acrylic_only: true,
      all_pitched_acrylic: false,
      max_acrylic_rafter_length_m: 3,
    });

    const boxPerimeterAcrylic = buildOverheadV1(cfg, {
      module_count: 1,
      total_crew_hours: 18,
      has_box_perimeter: true,
      has_acrylic_only: true,
      all_pitched_acrylic: false,
      max_acrylic_rafter_length_m: 3,
    });

    expect(gableAcrylic.overhead.method).toBe('fixed_plus_variable');
    expect(gableAcrylic.overhead.total_ex_gst).toBeGreaterThan(2000);

    expect(boxPerimeterAcrylic.overhead.method).toBe('fixed_plus_variable');
    expect(boxPerimeterAcrylic.overhead.total_ex_gst).toBeGreaterThan(2000);
  });

  it('uses new ops base + variable formula and keeps sales scaling', () => {
    const cfg = loadCostingConfigV1();

    const result = buildOverheadV1(cfg, {
      module_count: 2,
      total_crew_hours: 18,
    });

    // Ops: 500 + 1000*(18/8) = 2750.
    expect(result.overhead.ops_ex_gst).toBe(2750);
    // Sales unchanged: per_job * (1 + 0.3*(2-1)).
    expect(result.overhead.sales_ex_gst).toBe(1973.21);
    expect(result.overhead.total_ex_gst).toBe(4723.21);
  });

  it('applies one startup when gable and/or box perimeter is present (no double-charge)', () => {
    const cfg = loadCostingConfigV1();

    const gableOnly = buildOverheadV1(cfg, {
      module_count: 1,
      total_crew_hours: 9,
      has_gable: true,
    });
    const boxOnly = buildOverheadV1(cfg, {
      module_count: 1,
      total_crew_hours: 9,
      has_box_perimeter: true,
    });
    const both = buildOverheadV1(cfg, {
      module_count: 1,
      total_crew_hours: 9,
      has_gable: true,
      has_box_perimeter: true,
    });

    expect(gableOnly.overhead.ops_ex_gst).toBe(2125);
    expect(boxOnly.overhead.ops_ex_gst).toBe(2125);
    expect(both.overhead.ops_ex_gst).toBe(2125);
  });

  it('applies timber surcharge by rounded crew-days for timber and mixed roofs', () => {
    const cfg = loadCostingConfigV1();

    const dayOne = buildOverheadV1(cfg, {
      module_count: 1,
      total_crew_hours: 13.4, // 13.4/8 = 1.675 -> round = 2
      has_timber_or_mixed: true,
    });
    const dayTwo = buildOverheadV1(cfg, {
      module_count: 1,
      total_crew_hours: 13.6, // 13.6/8 = 1.7 -> round = 2
      has_timber_or_mixed: true,
    });

    expect(roundMoney(dayTwo.overhead.ops_ex_gst - dayOne.overhead.ops_ex_gst)).toBe(25);
    expect(roundMoney(dayTwo.overhead.total_ex_gst - dayOne.overhead.total_ex_gst)).toBe(25);
  });

  it('does not apply the acrylic flat total to mixed roofs', () => {
    const cfg = loadCostingConfigV1();

    const acrylic = buildOverheadV1(cfg, {
      module_count: 1,
      total_crew_hours: 18,
      has_acrylic_only: true,
      all_pitched_acrylic: true,
      max_acrylic_rafter_length_m: 3,
    });
    const mixed = buildOverheadV1(cfg, {
      module_count: 1,
      total_crew_hours: 18,
      has_timber_or_mixed: true,
      max_acrylic_rafter_length_m: 5,
    });

    expect(acrylic.overhead.total_ex_gst).toBe(2000);
    expect(mixed.overhead.method).toBe('fixed_plus_variable');
    expect(mixed.overhead.total_ex_gst).toBeGreaterThan(acrylic.overhead.total_ex_gst);
  });

  it('does not cap overhead totals at the previous flat-multiple cap', () => {
    const cfg = loadCostingConfigV1();
    const flatTotal = Number((cfg.overheads as any)?.computed_per_won_job?.total ?? 0);
    const priorCap = roundMoney(flatTotal * 1.75);

    const highHours = buildOverheadV1(cfg, {
      module_count: 1,
      total_crew_hours: 120,
    });

    expect(highHours.overhead.total_ex_gst).toBeGreaterThan(priorCap);
    expect(highHours.notes_and_warnings.some((w) => w.toLowerCase().includes('capped'))).toBe(false);
  });
});
