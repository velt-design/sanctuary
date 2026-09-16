export type PayoutMoney = { payoutExGst: number; gst: number; totalPayable: number };
export type PayoutAgreement = PayoutMoney & {
  installer: string; scope: string; exclusions: string; paymentTerms: string;
  acceptanceReference: string; gstRegistered: boolean;
  sourceQuoteId: string; sourceEstimateId: string;
};
export type PayoutEvent = {
  id: string; sequence: number; kind: 'agreement' | 'variation' | 'invoice';
  created_at: string; created_by: string;
  payload: Record<string, unknown>;
};

export function textField(value: unknown, label: string, max = 3000): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) throw new Error(`${label} is required (maximum ${max} characters).`);
  return value.trim();
}
export function amountField(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1_000_000) throw new Error('Enter a valid non-negative amount.');
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
export function money(exGst: number, registered: boolean): PayoutMoney {
  const cents = Math.round(amountField(exGst) * 100), gst = registered ? Math.round(cents * 0.15) : 0;
  return { payoutExGst: cents / 100, gst: gst / 100, totalPayable: (cents + gst) / 100 };
}
export function payoutSummary(events: PayoutEvent[]) {
  const agreement = events.find(e => e.kind === 'agreement')?.payload as PayoutAgreement | undefined;
  if (!agreement) return null;
  const variations = events.filter(e => e.kind === 'variation');
  const expectedCents = Math.round(agreement.totalPayable * 100) + variations.reduce((sum, e) => sum + Math.round(Number(e.payload.totalPayable) * 100), 0);
  const invoices = events.filter(e => e.kind === 'invoice');
  const invoicedCents = invoices.reduce((sum, e) => sum + Math.round(Number(e.payload.amount) * 100), 0);
  return { agreement, expected: expectedCents / 100, invoiced: invoicedCents / 100, difference: (invoicedCents - expectedCents) / 100, hasInvoices: invoices.length > 0 };
}

/** Approved additions only. Credits/reductions need a separate agreement workflow. */
export function buildPayoutEvent(kind: 'variation' | 'invoice', body: Record<string, unknown>, events: PayoutEvent[]) {
  const current = payoutSummary(events);
  if (!current) throw new Error('Confirm an agreement first.');
  const reference = textField(body.reference, kind === 'variation' ? 'Approval reference' : 'Invoice reference', 200);
  if (events.some(e => e.kind === kind && String(e.payload.reference).toLowerCase() === reference.toLowerCase())) throw new Error('This reference is already recorded.');
  if (kind === 'variation') {
    if (body.approved !== true) throw new Error('Confirm that this variation was agreed with the installer.');
    const ex = amountField(body.amount);
    if (ex === 0) throw new Error('Variation amount must be greater than zero.');
    return { reference, reason: textField(body.reason, 'Variation scope and reason'), ...money(ex, current.agreement.gstRegistered) };
  }
  return { reference, amount: amountField(body.amount), note: textField(body.reason, 'Invoice scope note') };
}
