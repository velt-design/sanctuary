import type { Estimate } from '@/lib/types/estimate';
import { buildQuoteLineItemsFromEstimate } from './mapping';

export type QuoteHandoffPreview = {
  lineItems: Array<{
    description: string;
    qty: number;
    unitPriceIncGstCents: number;
    lineTotalIncGstCents: number;
  }>;
  totalIncGstCents: number;
  blockingIssues: string[];
};

export function buildQuoteHandoffPreviewFromEstimate(estimate: Estimate): QuoteHandoffPreview {
  const mapping = buildQuoteLineItemsFromEstimate(estimate);
  return {
    lineItems: mapping.items.map((item) => ({
      description: item.description,
      qty: item.qty,
      unitPriceIncGstCents: item.unitPriceIncGstCents,
      lineTotalIncGstCents: item.lineTotalIncGstCents,
    })),
    totalIncGstCents: mapping.items.reduce((sum, item) => sum + item.lineTotalIncGstCents, 0),
    blockingIssues: mapping.blockingIssues.map((issue) => issue.message),
  };
}
