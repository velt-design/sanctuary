import { calculateSiteCostV1 } from './engine/calculate';
import type { CostingConfigV1 } from './engine/config';
import type { SiteInputsV1 } from './engine/types';

/** A staff-reviewed, erection-only comparison. Materials, tax and extras are not labour. */
export type InstallerBenchmarkV1 =
  | { status: 'unmatched'; reason: string }
  | { status: 'matched'; scopeId: string; evidenceReference: string; amountExGst: number };

export type InstallerPayoutRequestV1 = {
  site: SiteInputsV1;
  /** Required resolved published configuration; never silently use repository defaults. */
  config: CostingConfigV1;
  pricingVersionReference: string;
  scopeId: string;
  benchmark: InstallerBenchmarkV1;
  gstRegistered: boolean;
};

function cents(value: number): number {
  if (!Number.isFinite(value) || value < 0 || value > 1_000_000_000) {
    throw new Error('Installer amounts must be finite, non-negative and within supported limits.');
  }
  return Math.round((value + Number.EPSILON) * 100);
}

function required(value: string, label: string): void {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} is required.`);
}

/** Historical December 2023 schedule, GST inclusive. Only apply after matching scope. */
export function calculateLegacyInstallerBenchmarkV1(areaM2: number, roof: 'pitched' | 'gable' | 'box_perimeter'): number {
  if (!Number.isFinite(areaM2) || areaM2 <= 0 || areaM2 > 10_000) throw new Error('Invalid benchmark area.');
  if (!['pitched', 'gable', 'box_perimeter'].includes(roof)) throw new Error('Unsupported benchmark roof.');
  const baseIncGst = 1_000 + 65 * areaM2;
  const totalIncGst = roof === 'box_perimeter' ? baseIncGst * 1.2 : baseIncGst + (roof === 'gable' ? 800 : 0);
  return cents(totalIncGst / 1.15) / 100;
}

/** Proposal only: no agreement mutation, publication, invoice or customer-price side effects. */
export function calculateInstallerPayoutV1(request: InstallerPayoutRequestV1) {
  const { site, config, benchmark, scopeId, pricingVersionReference, gstRegistered } = request;
  if (!config) throw new Error('Resolved costing configuration is required.');
  if (typeof gstRegistered !== 'boolean') throw new Error('Installer GST status is required.');
  required(scopeId, 'Scope reference');
  required(pricingVersionReference, 'Pricing version reference');
  const output = calculateSiteCostV1(site, config);
  const modelCents = cents(output.install.totals.install_ex_gst);
  const context = {
    policyVersion: 'installer-transition.v1' as const,
    scopeId,
    pricingVersionReference,
    modelAllowanceExGst: modelCents / 100,
  };
  if (!site.pergolas.length || !site.pergolas.some(p => p.modules.length)) {
    return { ...context, status: 'review_required' as const, reason: 'No erection scope is available for comparison.', proposal: null };
  }
  if (benchmark.status === 'unmatched') {
    required(benchmark.reason, 'Review reason');
    return { ...context, status: 'review_required' as const, reason: benchmark.reason, proposal: null };
  }
  if (benchmark.status !== 'matched') throw new Error('Invalid benchmark status.');
  required(benchmark.evidenceReference, 'Benchmark evidence');
  if (benchmark.scopeId !== scopeId) {
    return { ...context, status: 'review_required' as const, reason: 'Benchmark scope does not match the proposed work.', proposal: null };
  }
  const benchmarkCents = cents(benchmark.amountExGst);
  const topUpCents = Math.max(0, benchmarkCents - modelCents);
  const payoutCents = modelCents + topUpCents;
  const gstCents = gstRegistered ? Math.round(payoutCents * 0.15) : 0;
  return {
    ...context,
    status: 'ready_for_review' as const,
    proposal: {
      evidenceReference: benchmark.evidenceReference,
      benchmarkExGst: benchmarkCents / 100,
      transitionTopUpExGst: topUpCents / 100,
      payoutExGst: payoutCents / 100,
      gst: gstCents / 100,
      totalPayable: (payoutCents + gstCents) / 100,
    },
  };
}
