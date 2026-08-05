import { describe, expect, it } from 'vitest';
import {
  buildSimpleCoverPlan,
  buildSimpleCoverSiteInputs,
  getSimpleCoverCustomResult,
  parseSimpleCoverInput,
  simpleCoverPostCount,
  simpleCoverRafterLayout,
  toCustomerSafeSimpleCoverResult,
} from './simpleCoverCalculator';

describe('Simple cover calculator contract', () => {
  it.each([
    [1_000, 2],
    [4_000, 2],
    [4_100, 3],
    [8_000, 3],
    [8_100, 4],
    [10_000, 4],
  ])('uses %i mm width with posts no more than 4 m apart', (widthMm, expectedCount) => {
    const count = simpleCoverPostCount(widthMm);
    expect(count).toBe(expectedCount);
    expect(widthMm / (count - 1)).toBeLessThanOrEqual(4_000);
  });

  it('uses the canonical acrylic-rafter layout in customer-safe plans', () => {
    const layout = simpleCoverRafterLayout(4_700);

    expect(layout.rafterCount).toBe(9);
    expect(layout.spacingMm).toBeLessThanOrEqual(642);
    expect(layout.spacingMm).toBe(581.25);
    expect(layout.positions[0]).toBeCloseTo(25 / 4_700);
    expect(layout.positions.at(-1)).toBeCloseTo(4_675 / 4_700);
  });

  it('aligns the outside faces of edge rafters and posts to the overall width', () => {
    const plan = buildSimpleCoverPlan(4_700, 3);

    expect(plan.postPositions[0]).toBeCloseTo(50 / 4_700);
    expect(plan.postPositions.at(-1)).toBeCloseTo(4_650 / 4_700);
    expect(plan.rafterPositions[0]).toBeCloseTo(25 / 4_700);
    expect(plan.rafterPositions.at(-1)).toBeCloseTo(4_675 / 4_700);
  });

  it('accepts only the public ranges and 100 mm increment', () => {
    expect(parseSimpleCoverInput({ widthMm: 1_000, projectionMm: 1_000, level: 'ground', connection: 'fascia' })).not.toBeNull();
    expect(parseSimpleCoverInput({ widthMm: 10_000, projectionMm: 6_000, level: 'elevated', connection: 'soffit' })).not.toBeNull();
    expect(parseSimpleCoverInput({ widthMm: 6_050, projectionMm: 3_000, level: 'ground', connection: 'fascia' })).toBeNull();
    expect(parseSimpleCoverInput({ widthMm: 10_100, projectionMm: 3_000, level: 'ground', connection: 'facade' })).toBeNull();
    expect(parseSimpleCoverInput({ widthMm: 6_000, projectionMm: 900, level: 'ground', connection: 'soffit' })).toBeNull();
    expect(parseSimpleCoverInput({ widthMm: 6_000, projectionMm: 3_000, level: 'ground', connection: 'wall' })).toBeNull();
  });

  it.each(['fascia', 'facade', 'soffit'] as const)('maps %s and every approved fixed choice into canonical costing inputs', (connection) => {
    const site = buildSimpleCoverSiteInputs({ widthMm: 6_000, projectionMm: 3_000, level: 'elevated', connection });
    const module = site.pergolas[0]?.modules[0];

    expect(site).toMatchObject({
      job_type: 'residential',
      travel_ex_gst: 0,
      extras_allowance_ex_gst: 0,
      quote_discount_pct: 0,
    });
    expect(module).toMatchObject({
      length_m: 6,
      roof_span_m: 3,
      post_cut_height_m: 2.4,
      post_count: 3,
      pergola_style: 'pitched',
      roof_material: 'acrylic',
      extrusion_colour: 'Black',
      house_connection_type: connection,
      attachment_length_mm: 6_000,
      post_connection_type: 'deck_bracket',
      access: 'normal',
      height: 'two_storey',
      ground: 'easy',
      infills: [],
    });
  });

  it('keeps the limit inclusive and gives the exact custom reason above it', () => {
    expect(getSimpleCoverCustomResult({ widthMm: 10_000, projectionMm: 3_000, level: 'ground', connection: 'fascia' })).toBeNull();
    expect(getSimpleCoverCustomResult({ widthMm: 5_000, projectionMm: 4_000, level: 'elevated', connection: 'facade' })).toBeNull();

    const ground = getSimpleCoverCustomResult({ widthMm: 10_000, projectionMm: 3_100, level: 'ground', connection: 'soffit' });
    expect(ground).toMatchObject({
      status: 'custom',
      reasonCode: 'ground_area_limit',
      reason: '31.0 m² exceeds the 30 m² ground-level Simple cover limit.',
    });
    expect(ground?.continuation.href).toContain('source_component=public_calculator');

    expect(getSimpleCoverCustomResult({ widthMm: 5_100, projectionMm: 4_000, level: 'elevated', connection: 'fascia' })).toMatchObject({
      reasonCode: 'elevated_area_limit',
      reason: '20.4 m² exceeds the 20 m² elevated Simple cover limit.',
    });
  });

  it('allow-lists the public response fields', () => {
    const safe = toCustomerSafeSimpleCoverResult({
      ok: true,
      status: 'priced',
      input: { widthMm: 6_000, projectionMm: 3_000, level: 'ground', connection: 'fascia' },
      areaM2: 18,
      postCount: 3,
      postSpacingMm: 3_000,
      plan: { postPositions: [0, .5, 1], rafterPositions: [0, 1] },
      price: { fromIncGst: 24_250, currency: 'NZD' },
      configuration: { versionNumber: 7 },
      calculationRef: 'sc1.opaque-reference',
      internalTrueCostExGst: 12_345,
    } as Parameters<typeof toCustomerSafeSimpleCoverResult>[0]);

    expect(safe).not.toHaveProperty('internalTrueCostExGst');
    expect(safe).toMatchObject({
      status: 'priced',
      configuration: { versionNumber: 7 },
      calculationRef: 'sc1.opaque-reference',
    });
  });
});
