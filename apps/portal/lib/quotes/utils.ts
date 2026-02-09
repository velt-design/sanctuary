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

export function totalsFromLineItems(items: QuoteLineItem[]): QuoteTotals {
  const totalInc = items.reduce((sum, item) => sum + (Number.isFinite(item.lineTotalIncGstCents) ? item.lineTotalIncGstCents : 0), 0);
  const totalEx = Math.round(totalInc / (1 + GST_RATE));
  const gst = totalInc - totalEx;
  return {
    totalIncGstCents: totalInc,
    totalExGstCents: totalEx,
    gstCents: gst,
  };
}

export function parseDateInput(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  return trimmed;
}
