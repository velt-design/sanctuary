/** Versioned customer content owned by an invoice, independent of its source quote. */
export type InvoiceContentSnapshot = {
  version: 1;
  items: Array<{
    id: string;
    description: string;
    qty: number;
    unitPriceIncGstCents: number;
    lineTotalIncGstCents: number;
  }>;
  billingName: string;
  billingEmail: string;
  billingAddress: string;
  notes: string;
};

export function parseInvoiceContent(value: unknown): InvoiceContentSnapshot | null {
  if (value == null) return null; // Explicit legacy compatibility; never backfill issued content.
  if (typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid invoice content');
  const input = value as Record<string, unknown>;
  if (input.version !== 1 || !Array.isArray(input.items)
    || !['billingName', 'billingEmail', 'billingAddress', 'notes'].every((key) => typeof input[key] === 'string')) {
    throw new Error('Unsupported invoice content');
  }
  for (const value of input.items) {
    if (!value || typeof value !== 'object') throw new Error('Invalid invoice item');
    const item = value as Record<string, unknown>;
    if (typeof item.id !== 'string' || typeof item.description !== 'string'
      || typeof item.qty !== 'number' || !Number.isFinite(item.qty)
      || !Number.isSafeInteger(item.unitPriceIncGstCents) || !Number.isSafeInteger(item.lineTotalIncGstCents)) {
      throw new Error('Invalid invoice item');
    }
  }
  return input as InvoiceContentSnapshot;
}
