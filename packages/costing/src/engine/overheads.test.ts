import { describe, expect, it } from 'vitest';
import { loadCostingConfigV1 } from './config';
import { buildOverheadV1 } from './overheads';

function roundMoney(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

describe('buildOverheadV1', () => {
  it('uses new ops base + variable formula and keeps sales scaling', () => {
    const cfg = loadCostingConfigV1();

    const result = buildOverheadV1(cfg, {
      module_count: 2,
      total_crew_hours: 18,
    });

    // Ops: 500 + 1000*(18/9) = 2500.
    expect(result.overhead.ops_ex_gst).toBe(2500);
    // Sales unchanged: per_job * (1 + 0.3*(2-1)).
    expect(result.overhead.sales_ex_gst).toBe(1973.21);
    expect(result.overhead.total_ex_gst).toBe(4473.21);
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

    expect(gableOnly.overhead.ops_ex_gst).toBe(2000);
    expect(boxOnly.overhead.ops_ex_gst).toBe(2000);
    expect(both.overhead.ops_ex_gst).toBe(2000);
  });

  it('applies timber surcharge by rounded crew-days for timber and mixed roofs', () => {
    const cfg = loadCostingConfigV1();

    const dayOne = buildOverheadV1(cfg, {
      module_count: 1,
      total_crew_hours: 13.4, // 13.4/9 = 1.49 -> round = 1
      has_timber_or_mixed: true,
    });
    const dayTwo = buildOverheadV1(cfg, {
      module_count: 1,
      total_crew_hours: 13.6, // 13.6/9 = 1.51 -> round = 2
      has_timber_or_mixed: true,
    });

    expect(roundMoney(dayTwo.overhead.ops_ex_gst - dayOne.overhead.ops_ex_gst)).toBe(522.22);
    expect(roundMoney(dayTwo.overhead.total_ex_gst - dayOne.overhead.total_ex_gst)).toBe(522.22);
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
