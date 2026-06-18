import type { QuoteLineItem, QuoteVersionDetail } from './types';
import { totalsFromLineItems } from './utils';

export type QuoteRefreshMode = 'pricing_only' | 'generated_content' | 'full_rebuild';

export type QuoteRefreshPreview = {
  mode: QuoteRefreshMode;
  summary: string[];
  proposedQuote: QuoteVersionDetail;
};

function cloneLineItems(items: QuoteLineItem[]): QuoteLineItem[] {
  return items.map((item, index) => ({
    ...item,
    sortOrder: index,
    lineTotalIncGstCents: Math.round((Number.isFinite(item.qty) ? item.qty : 0) * (Number.isFinite(item.unitPriceIncGstCents) ? item.unitPriceIncGstCents : 0)),
  }));
}

function mergeQuoteLineItemsForRefresh(
  currentItems: QuoteLineItem[],
  generatedItems: QuoteLineItem[],
  mode: QuoteRefreshMode,
): QuoteLineItem[] {
  if (mode === 'full_rebuild') {
    return cloneLineItems(generatedItems);
  }

  const merged: QuoteLineItem[] = [];
  for (let index = 0; index < generatedItems.length; index += 1) {
    const incoming = generatedItems[index]!;
    const existing = currentItems[index];

    if (!existing) {
      merged.push({ ...incoming, sortOrder: index });
      continue;
    }

    if (mode === 'pricing_only') {
      merged.push({
        ...existing,
        qty: incoming.qty,
        unitPriceIncGstCents: incoming.unitPriceIncGstCents,
        lineTotalIncGstCents: Math.round(incoming.qty * incoming.unitPriceIncGstCents),
        sortOrder: index,
      });
      continue;
    }

    merged.push({
      ...incoming,
      id: existing.id,
      sortOrder: index,
    });
  }

  for (let index = generatedItems.length; index < currentItems.length; index += 1) {
    merged.push({
      ...currentItems[index]!,
      sortOrder: merged.length,
    });
  }

  return cloneLineItems(merged);
}

export function buildQuoteRefreshPreview(params: {
  current: QuoteVersionDetail;
  generated: QuoteVersionDetail;
  mode: QuoteRefreshMode;
}): QuoteRefreshPreview {
  const { current, generated, mode } = params;
  const nextLineItems = mergeQuoteLineItemsForRefresh(current.lineItems, generated.lineItems, mode);

  const proposedQuote: QuoteVersionDetail = {
    ...current,
    sourceEstimateVersionId: generated.sourceEstimateVersionId,
    sourceEstimateVersionLabel: generated.sourceEstimateVersionLabel,
    lineItems: nextLineItems,
    totals: totalsFromLineItems(nextLineItems),
    pdfFileId: null,
    renderHash: null,
  };

  if (mode === 'full_rebuild') {
    proposedQuote.reference = null;
    proposedQuote.introText = generated.introText;
    proposedQuote.termsText = generated.termsText;
    proposedQuote.depositPercent = generated.depositPercent;
    proposedQuote.expiresAt = null;
  }

  const summary: string[] = [];

  const lineDescriptionsChanged = current.lineItems.some((item, index) => item.description !== proposedQuote.lineItems[index]?.description)
    || current.lineItems.length !== proposedQuote.lineItems.length;
  const pricingChanged = current.lineItems.some(
    (item, index) =>
      item.qty !== proposedQuote.lineItems[index]?.qty ||
      item.unitPriceIncGstCents !== proposedQuote.lineItems[index]?.unitPriceIncGstCents ||
      item.lineTotalIncGstCents !== proposedQuote.lineItems[index]?.lineTotalIncGstCents,
  );

  if (lineDescriptionsChanged) summary.push('Line items changed');
  if (lineDescriptionsChanged && proposedQuote.lineItems.some((item) => /\bmodule\b/i.test(item.description))) {
    summary.push('Pergola wording changed');
  }
  if (pricingChanged) summary.push('Pricing changed');
  if (
    current.totals.totalIncGstCents !== proposedQuote.totals.totalIncGstCents ||
    current.totals.totalExGstCents !== proposedQuote.totals.totalExGstCents ||
    current.totals.gstCents !== proposedQuote.totals.gstCents
  ) {
    summary.push('Totals changed');
  }
  if (current.introText !== proposedQuote.introText) summary.push('Intro changed');
  if (current.termsText !== proposedQuote.termsText) summary.push('Terms changed');
  if (current.depositPercent !== proposedQuote.depositPercent) summary.push('Deposit changed');
  if (current.expiresAt !== proposedQuote.expiresAt) summary.push(proposedQuote.expiresAt ? 'Expiry changed' : 'Expiry reset');
  if (current.reference !== proposedQuote.reference) summary.push(proposedQuote.reference ? 'Reference changed' : 'Reference reset');

  return {
    mode,
    summary,
    proposedQuote,
  };
}
