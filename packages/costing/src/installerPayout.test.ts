import { describe, expect, it } from 'vitest';
import { calculateInstallerPayoutV1, calculateLegacyInstallerBenchmarkV1, type InstallerPayoutRequestV1 } from './installerPayout';
import { COSTING_CONTROL_PREVIEW_SCENARIOS_V1 } from './controlConfig';
import { calculateSiteCostV1 } from './engine/calculate';
import { publishedLabourFixture } from './__fixtures__/installerPublishedLabourV11';

function request(): InstallerPayoutRequestV1 {
  return {
    site: structuredClone(COSTING_CONTROL_PREVIEW_SCENARIOS_V1[0].inputs),
    config: publishedLabourFixture(), pricingVersionReference: 'published-version-11',
    scopeId: 'erection-only-v1', gstRegistered: true,
    benchmark: { status: 'matched', scopeId: 'erection-only-v1', evidenceReference: 'contractor-rates-2023-12', amountExGst: calculateLegacyInstallerBenchmarkV1(18, 'pitched') },
  };
}

describe('installer transition proposals', () => {
  it('reproduces the four published Version 11 labour reference totals', () => {
    expect(COSTING_CONTROL_PREVIEW_SCENARIOS_V1.map(s => calculateSiteCostV1(s.inputs, publishedLabourFixture()).install.totals.install_ex_gst))
      .toEqual([1743.61, 6311.07, 4348.38, 3747.77]);
  });
  it('normalises the old GST-inclusive formula and protects the live example', () => {
    const result = calculateInstallerPayoutV1(request());
    expect(result.modelAllowanceExGst).toBe(1743.61);
    expect(result.proposal).toEqual({ evidenceReference: 'contractor-rates-2023-12', benchmarkExGst: 1886.96, transitionTopUpExGst: 143.35, payoutExGst: 1886.96, gst: 283.04, totalPayable: 2170 });
  });
  it('reconciles the August invoice erection subtotal separately from cable work', () => {
    // Invoice 25: 28.98m²; erection $2883.70 incl GST, six cables $150 incl GST.
    expect(calculateLegacyInstallerBenchmarkV1(8.4 * 3.45, 'pitched')).toBe(2507.57);
    expect(Math.round((2883.7 + 150) * 100)).toBe(303370);
  });
  it('preserves a higher model allowance rather than reducing it to the floor', () => {
    const r = request();
    r.benchmark = { status: 'matched', scopeId: r.scopeId, evidenceReference: 'approved-scope', amountExGst: 1000 };
    const p = calculateInstallerPayoutV1(r).proposal!;
    expect(p.transitionTopUpExGst).toBe(0);
    expect(p.payoutExGst).toBe(1743.61);
  });
  it('requires review for missing or mismatched scope rather than promising protection', () => {
    const r = request();
    r.benchmark = { status: 'unmatched', reason: 'Invoice is week two only.' };
    expect(calculateInstallerPayoutV1(r)).toMatchObject({ status: 'review_required', proposal: null });
    r.benchmark = { status: 'matched', scopeId: 'different', evidenceReference: '#417', amountExGst: 3225 };
    expect(calculateInstallerPayoutV1(r).proposal).toBeNull();
  });
  it('does not apply GST to an unregistered installer', () => {
    const r = request(); r.gstRegistered = false;
    expect(calculateInstallerPayoutV1(r).proposal).toMatchObject({ gst: 0, totalPayable: 1886.96 });
  });
  it('does not mutate the inputs, rate snapshot or scope comparison', () => {
    const r = request(), before = structuredClone(r);
    calculateInstallerPayoutV1(r);
    expect(r).toEqual(before);
  });
  it('customer discount does not change the installer proposal', () => {
    const r = request(), before = calculateInstallerPayoutV1(r).proposal;
    for (const pergola of r.site.pergolas) for (const m of pergola.modules) m.quote_discount_pct = 25;
    expect(calculateInstallerPayoutV1(r).proposal).toEqual(before);
  });
  it.each([NaN, Infinity, -1, 1e12])('rejects invalid monetary evidence %s', amountExGst => {
    const r = request(); r.benchmark = { status: 'matched', scopeId: r.scopeId, evidenceReference: 'invoice', amountExGst };
    expect(() => calculateInstallerPayoutV1(r)).toThrow();
  });
  it('requires explicit pricing provenance and config, with no default-rate fallback', () => {
    const r = request(); r.pricingVersionReference = '';
    expect(() => calculateInstallerPayoutV1(r)).toThrow('Pricing version');
    const missing = { ...request(), config: undefined } as unknown as InstallerPayoutRequestV1;
    expect(() => calculateInstallerPayoutV1(missing)).toThrow('configuration');
  });
  it('includes historical roof adjustments before removing GST', () => {
    expect(calculateLegacyInstallerBenchmarkV1(18, 'gable')).toBe(2582.61);
    expect(calculateLegacyInstallerBenchmarkV1(18, 'box_perimeter')).toBe(2264.35);
  });
});
