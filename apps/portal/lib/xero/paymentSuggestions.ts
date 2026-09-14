import type { DepositInvoiceSummary, ProjectPaymentEntrySummary } from '../invoices/types';

export type ReceiptCandidate = {
  id: string; contact: string; reference: string; status: string; date: string;
  total: number | null; currency: string; reconciled: boolean | null;
};
export type PaymentSuggestion = {
  receipt: ReceiptCandidate;
  amountCents: number | null;
  assessment: 'review' | 'blocked';
  reasons: string[];
  blockers: string[];
  depositRemainingIfApprovedCents: number | null;
  customerWonIfApproved: boolean;
};

function cents(value: number | null): number | null {
  if (value === null || !Number.isFinite(value)) return null;
  const rounded = Math.round(value * 100);
  return Number.isSafeInteger(rounded) && Math.abs(value * 100 - rounded) < 0.000001 ? rounded : null;
}
const normal = (value: string) => value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-NZ');

/** Review evidence only: never infer project ownership or persist money from an amount/name match. */
export type MatchInvoice = Pick<DepositInvoiceSummary, 'id' | 'projectId' | 'invoiceRef' | 'status' | 'invoiceKind' | 'paymentTermPosition' | 'customerName' | 'projectName' | 'totalIncGstCents' | 'reference'>;
export function suggestDepositMatches(invoice: MatchInvoice, entries: Pick<ProjectPaymentEntrySummary, 'id'>[], receipts: ReceiptCandidate[], matchedCents = 0): PaymentSuggestion[] {
  return receipts.map(receipt => {
    const amount = cents(receipt.total);
    const blockers: string[] = [];
    const reasons: string[] = [];
    const remaining = invoice.totalIncGstCents - matchedCents;
    if (!Number.isSafeInteger(matchedCents) || matchedCents < 0 || remaining < 0) blockers.push('Recorded deposit balance needs investigation.');
    if (invoice.status !== 'OPEN') blockers.push(`Portal invoice is ${invoice.status.toLowerCase()}; review its existing history.`);
    if (invoice.paymentTermPosition !== 1 || invoice.invoiceKind === 'STANDALONE') blockers.push('This is not a first-stage quote deposit invoice. Confirm its business purpose separately.');
    if (receipt.status !== 'AUTHORISED' || receipt.reconciled !== true) blockers.push('Xero has not confirmed an authorised, reconciled receipt.');
    if (receipt.currency !== 'NZD') blockers.push('Currency is not NZD. Currency conversion requires separate review.');
    if (amount === null || amount <= 0) blockers.push('Receipt must have a positive, valid amount in cents.');
    if (!/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(receipt.date) || !Number.isFinite(Date.parse(receipt.date))) blockers.push('Receipt date could not be verified.');
    if (amount !== null && amount > remaining) blockers.push('Receipt exceeds the remaining deposit. It may cover more than one payment or project.');
    if (!invoice.customerName || normal(invoice.customerName) !== normal(receipt.contact)) blockers.push('Customer names differ. Confirm who paid and which project the receipt belongs to.');
    else reasons.push('Xero contact matches the invoice customer name.');
    if (amount === remaining) reasons.push(matchedCents ? 'Receipt covers the remaining requested deposit.' : 'Receipt equals the requested deposit.');
    else if (amount !== null && amount > 0 && amount < remaining) reasons.push('Receipt is part of the requested deposit; any verified deposit counts as a customer win.');
    if (receipt.reference && (normal(receipt.reference) === normal(invoice.invoiceRef) || (invoice.reference && normal(receipt.reference) === normal(invoice.reference)))) reasons.push('Payment reference matches the invoice reference.');
    else reasons.push('No exact invoice reference match. Check the bank reference and customer correspondence.');
    if (entries.length) blockers.push('This project already has payment history. Check for an existing receipt, reversal or credit before recording more money.');
    if (receipts.length > 1) reasons.push('Multiple Xero receipts were found. Review each separately; they have not been added together.');
    return { receipt, amountCents: amount, assessment: blockers.length ? 'blocked' : 'review', reasons, blockers,
      depositRemainingIfApprovedCents: blockers.length || amount === null ? null : remaining - amount,
      customerWonIfApproved: blockers.length === 0 };
  });
}
