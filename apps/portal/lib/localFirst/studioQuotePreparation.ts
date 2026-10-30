import type { EstimateDetail } from '../estimates/types';
import { buildQuoteLineItemsFromEstimate } from '../quotes/mapping';
import { buildOptimisticQuoteDetail as prepare, buildQuoteHandoffPreviewFromEstimateDetail as preview } from './quotePreparation';

/** Generic Project quote actions retain the same strict Studio source validation as the server. */
export function buildOptimisticQuoteDetail(args: Parameters<typeof prepare>[0]) {
  return prepare(args, buildQuoteLineItemsFromEstimate);
}
export function buildQuoteHandoffPreviewFromEstimateDetail(detail: EstimateDetail) {
  return preview(detail, buildQuoteLineItemsFromEstimate);
}
