import type { DepositInvoiceSummary } from './types';

export function summarizeQuoteVersionInvoices(
  invoices: readonly DepositInvoiceSummary[],
  quoteVersionId: string,
): { active: DepositInvoiceSummary[]; invoicedIncGstCents: number; paidIncGstCents: number; outstandingIncGstCents: number } {
  const active = invoices.filter(
    (invoice) => invoice.quoteVersionId === quoteVersionId && invoice.status !== 'VOID',
  );
  return {
    active,
    invoicedIncGstCents: active.reduce((sum, invoice) => sum + invoice.totalIncGstCents, 0),
    paidIncGstCents: active.filter((invoice) => invoice.status === 'PAID')
      .reduce((sum, invoice) => sum + invoice.totalIncGstCents, 0),
    outstandingIncGstCents: active.filter((invoice) => invoice.status === 'OPEN')
      .reduce((sum, invoice) => sum + invoice.totalIncGstCents, 0),
  };
}
