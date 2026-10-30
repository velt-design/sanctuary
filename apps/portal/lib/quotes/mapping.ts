import { readStudioQuoteHandoff } from '@/lib/designStudio/quoteSnapshot';
import type { Estimate } from '@/lib/types/estimate';
import { buildQuoteLineItemsFromEstimate as buildCalculatorMapping, studioReviewRequiredMapping, type QuoteEstimateMapping } from './calculatorMapping';
export { assertQuoteEstimateMappingReady, isQuoteHandoffBlockedError, QuoteHandoffBlockedError } from './calculatorMapping';
export type { QuoteEstimateMapping } from './calculatorMapping';

/** Canonical generic handoff validates Studio's complete frozen source before accepting its price. */
export function buildQuoteLineItemsFromEstimate(estimate: Estimate): QuoteEstimateMapping {
  if (estimate.outputs && Object.hasOwn(estimate.outputs, 'studio_authored')) {
    const handoff = readStudioQuoteHandoff(estimate.outputs);
    return handoff ? { items: handoff.lines, coreTotalIncCents: handoff.totalIncGstCents - handoff.approvalIncGstCents,
      blockingIssues: [], approvalRequirement: handoff.approvalRequirement, approvalIncGstCents: handoff.approvalIncGstCents }
      : studioReviewRequiredMapping();
  }
  return buildCalculatorMapping(estimate);
}
