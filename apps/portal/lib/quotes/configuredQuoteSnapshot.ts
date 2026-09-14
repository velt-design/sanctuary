import type { Estimate } from '../types/estimate';
import type { QuoteLineItem } from './types';

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const object = record(value);
  if (object) return `{${Object.keys(object).sort().map(key => `${JSON.stringify(key)}:${canonical(object[key])}`).join(',')}}`;
  return JSON.stringify(value) ?? 'undefined';
}

/** Repricing can replace derived metadata, but cannot erase the imported quote's origin. */
export function requiresConfiguredQuoteSnapshot(estimate: Estimate): boolean {
  const snapshot = record(estimate.snapshot);
  return record(estimate.derived)?.pricingMode === 'configured_customer_snapshot'
    || (snapshot?.source === 'marketing_enquiry'
      && ('frozenConfiguratorPrice' in snapshot || 'configuredQuoteInputs' in snapshot));
}

/** Import only the complete frozen selling breakdown, never the partial base costing. */
export function configuredQuoteSnapshotItems(estimate: Estimate): Omit<QuoteLineItem, 'id'>[] | null {
  const snapshot = record(estimate.snapshot);
  const frozen = record(snapshot?.frozenConfiguratorPrice);
  const price = record(frozen?.customerPrice);
  const basis = record(snapshot?.configuredQuoteInputs);
  if (record(estimate.derived)?.pricingMode !== 'configured_customer_snapshot'
    || snapshot?.source !== 'marketing_enquiry' || frozen?.schemaVersion !== 'configurator-pricing.v1'
    || !basis || canonical(basis) !== canonical(estimate.inputs)
    || price?.currency !== 'NZD' || price.includesGst !== true
    || !Number.isSafeInteger(price.amountIncGst) || Number(price.amountIncGst) <= 0
    || !Array.isArray(price.breakdown) || !price.breakdown.length) return null;

  const items: Omit<QuoteLineItem, 'id'>[] = [];
  for (const raw of price.breakdown) {
    const line = record(raw);
    if (typeof line?.label !== 'string' || !line.label.trim()
      || !Number.isSafeInteger(line.amountIncGst) || Number(line.amountIncGst) < 0) return null;
    const cents = Number(line.amountIncGst) * 100;
    if (!Number.isSafeInteger(cents)) return null;
    if (cents === 0) continue;
    items.push({ description: line.label.trim(), qty: 1, unitPriceIncGstCents: cents,
      lineTotalIncGstCents: cents, sortOrder: items.length });
  }
  const total = items.reduce((sum, item) => sum + item.lineTotalIncGstCents, 0);
  if (!items.length || !Number.isSafeInteger(total) || total !== Number(price.amountIncGst) * 100) return null;
  return items;
}
