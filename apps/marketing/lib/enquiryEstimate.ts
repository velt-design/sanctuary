export type EnquiryType = 'residential' | 'commercial';

export type MoneyRange = {
  lowIncGst: number;
  highIncGst: number;
};

// 2026-06-26: marketing-email quote multiplier set to 1.25 (25% markup). The
// portal-side `QUOTE_MARGIN_MULTIPLIER` in `EstimatesTab.tsx` also stays at
// 1.25; that's the staff-quote markup, a different surface.
export const QUOTE_MULTIPLIER = 1.25;
const UPLIFT_MAX = 1.15; // baseline -> +15%

function roundTo(n: number, step: number) {
  if (!Number.isFinite(n)) return 0;
  if (!Number.isFinite(step) || step <= 0) return Math.round(n);
  return Math.round(n / step) * step;
}

function roundingStep(enquiryType: EnquiryType) {
  return enquiryType === 'commercial' ? 500 : 250;
}

/**
 * Convert true cost (incl. GST) into a customer-facing indicative investment range
 * (installed, incl. GST), one-sided:
 * - low = baseline
 * - high = baseline * 1.15
 */
export function toIndicativeRangeOneSided(trueCostIncGst: number, enquiryType: EnquiryType): MoneyRange {
  if (!Number.isFinite(trueCostIncGst) || trueCostIncGst <= 0) {
    return { lowIncGst: 0, highIncGst: 0 };
  }

  const baseline = trueCostIncGst * QUOTE_MULTIPLIER;
  const low = baseline;
  const high = baseline * UPLIFT_MAX;

  const step = roundingStep(enquiryType);

  return {
    lowIncGst: roundTo(low, step),
    highIncGst: roundTo(high, step),
  };
}

export function toIndicativeSingleAmount(trueCostIncGst: number, enquiryType: EnquiryType): MoneyRange {
  if (!Number.isFinite(trueCostIncGst) || trueCostIncGst <= 0) {
    return { lowIncGst: 0, highIncGst: 0 };
  }

  const baseline = trueCostIncGst * QUOTE_MULTIPLIER;
  const rounded = roundTo(baseline, roundingStep(enquiryType));

  return {
    lowIncGst: rounded,
    highIncGst: rounded,
  };
}
