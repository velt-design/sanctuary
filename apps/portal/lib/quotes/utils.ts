import type { QuoteLineItem, QuoteTotals } from './types';

export const GST_RATE = 0.15;

export function toCents(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100);
}

export function fromCents(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value) / 100;
}

export function lineTotalCents(qty: number, unitPriceIncCents: number): number {
  const q = Number.isFinite(qty) ? qty : 0;
  const unit = Number.isFinite(unitPriceIncCents) ? unitPriceIncCents : 0;
  return Math.round(q * unit);
}

export function totalsFromIncGstCents(values: readonly number[]): QuoteTotals {
  const totalInc = values.reduce((sum, value) => sum + (Number.isFinite(value) ? value : 0), 0);
  const totalEx = Math.round(totalInc / (1 + GST_RATE));
  const gst = totalInc - totalEx;
  return {
    totalIncGstCents: totalInc,
    totalExGstCents: totalEx,
    gstCents: gst,
  };
}

export function totalsFromLineItems(items: QuoteLineItem[]): QuoteTotals {
  return totalsFromIncGstCents(items.map((item) => item.lineTotalIncGstCents));
}

