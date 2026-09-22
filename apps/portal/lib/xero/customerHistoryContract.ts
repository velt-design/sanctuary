import { z } from 'zod';
import { financeSummaryPeriod } from './financeSummaryContract';

export const customerHistoryQuery = z.object({ projectId: z.string().uuid(), from: z.string(), to: z.string() }).strict()
  .refine(value => financeSummaryPeriod.safeParse({ from: value.from, to: value.to }).success);
export type CustomerHistoryQuery = z.infer<typeof customerHistoryQuery>;
export const customerHistoryBinding = z.object({ projectId: z.string().uuid(), portalContactId: z.string().uuid(),
  tenantId: z.string().uuid(), xeroContactId: z.string().uuid(), mappingVerifiedAt: z.string().datetime({ offset: true }).transform(value => new Date(value).toISOString()) }).strict();
export type CustomerHistoryBinding = z.infer<typeof customerHistoryBinding>;
export type HistoryInvoice = { id: string; number: string; status: string; date: string; dueDate: string | null;
  currency: string; currencyRate: number | null; subtotalCents: number; taxCents: number; totalCents: number;
  paidCents: number; dueCents: number; creditedCents: number; updatedAt: string };
export type HistoryPayment = { id: string; invoiceId: string; status: string; date: string; reference: string;
  invoiceCurrency: string; amountInvoiceCurrencyCents: number; currencyRate: number | null;
  reconciled: boolean | null; updatedAt: string };
export type HistoryDirectReceipt = { id: string; status: string; date: string; reference: string; currency: string;
  currencyRate: number | null; totalCents: number; reconciled: boolean | null; updatedAt: string };
export type CustomerHistory = {
  schemaVersion: 'sanctuary.praxis.finance-history.v1'; query: CustomerHistoryQuery;
  startedAt: string; checkedAt: string; consistency: 'sequential_read_window';
  identity: CustomerHistoryBinding & { contactName: string; scope: 'contact_wide'; projectAttribution: 'not_established' };
  invoices: { coverage: 'complete_contact_invoice_population'; items: HistoryInvoice[] };
  payments: { coverage: 'complete_linked_invoice_payments_in_period'; items: HistoryPayment[] };
  directReceipts: { coverage: 'complete_direct_receive_in_period'; items: HistoryDirectReceipt[] };
  limitations: string[];
};
