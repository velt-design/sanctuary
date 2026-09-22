import 'server-only';
import { z } from 'zod';
import { accountingDate } from './financeSummaryContract';
import { customerHistoryQuery, customerHistoryBinding, type CustomerHistory, type CustomerHistoryBinding, type CustomerHistoryQuery } from './customerHistoryContract';
import { HISTORY_PAGE_SIZE, readHistoryPage, type HistoryRead } from './customerHistoryProvider';

const currency = z.enum(['NZD', 'AUD', 'USD', 'GBP', 'EUR', 'CAD', 'SGD']);
const money = z.number().finite().nonnegative().refine(value => Number.isSafeInteger(Math.round(value * 100))
  && Math.abs(value * 100 - Math.round(value * 100)) < 0.00001).transform(value => Math.round(value * 100));
const rate = z.number().finite().positive().nullish().transform(value => value ?? null);
const text = z.string().max(300);
const contact = z.object({ ContactID: z.string().uuid(), Name: text });
const dated = { DateString: z.string().optional(), Date: z.string().optional(), UpdatedDateUTC: z.string() };
const invoice = z.object({ ...dated, InvoiceID: z.string().uuid(), InvoiceNumber: text.default(''), Type: z.literal('ACCREC'),
  Contact: contact, Status: z.enum(['DRAFT', 'SUBMITTED', 'AUTHORISED', 'PAID', 'VOIDED', 'DELETED']),
  CurrencyCode: currency, CurrencyRate: rate, SubTotal: money, TotalTax: money, Total: money,
  AmountPaid: money, AmountDue: money, AmountCredited: money, DueDateString: z.string().optional(), DueDate: z.string().optional() });
const payment = z.object({ ...dated, PaymentID: z.string().uuid(), PaymentType: z.literal('ACCRECPAYMENT'),
  Status: z.enum(['AUTHORISED', 'DELETED']), Amount: money, CurrencyRate: rate,
  Reference: text.default(''), IsReconciled: z.boolean().nullish().transform(value => value ?? null),
  Invoice: z.object({ InvoiceID: z.string().uuid(), Type: z.literal('ACCREC'), CurrencyCode: currency, Contact: contact.optional() }) });
const receipt = z.object({ ...dated, BankTransactionID: z.string().uuid(), Type: z.literal('RECEIVE'), Contact: contact,
  Status: z.enum(['AUTHORISED', 'DELETED']), CurrencyCode: currency, CurrencyRate: rate, Total: money,
  Reference: text.default(''), IsReconciled: z.boolean().nullish().transform(value => value ?? null),
  PrepaymentID: z.null().optional(), OverpaymentID: z.null().optional() });
function instant(value: string): string {
  const legacy = /^\/Date\((-?\d+)(?:[+-]\d{4})?\)\/$/.exec(value);
  const time = legacy ? Number(legacy[1]) : Date.parse(value);
  if (!Number.isFinite(time)) throw new Error('HISTORY_UNAVAILABLE');
  return new Date(time).toISOString();
}
function date(value: string | undefined): string {
  if (!value) throw new Error('HISTORY_UNAVAILABLE');
  if (value.startsWith('/Date(')) { const converted = instant(value); if (converted.slice(11) !== '00:00:00.000Z') throw new Error('HISTORY_UNAVAILABLE'); return accountingDate.parse(converted.slice(0, 10)); }
  if (!/^\d{4}-\d{2}-\d{2}(?:T00:00:00(?:\.000)?Z?)?$/.test(value)) throw new Error('HISTORY_UNAVAILABLE');
  return accountingDate.parse(value.slice(0, 10));
}
const same = (left: string, right: string) => left.toLowerCase() === right.toLowerCase();
export type HistoryDependencies = {
  read: typeof readHistoryPage; now: () => Date;
  /** Revalidates current configured actor, confirmed identity, existing grant and mapping before each provider read and publication. */
  binding: (signal: AbortSignal) => Promise<CustomerHistoryBinding>;
};
export async function readCustomerHistory(raw: CustomerHistoryQuery, deps: HistoryDependencies, signal?: AbortSignal): Promise<CustomerHistory> {
  const query = customerHistoryQuery.parse(raw), startedAt = deps.now().toISOString();
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Pacific/Auckland', year: 'numeric', month: '2-digit', day: '2-digit' }).format(deps.now());
  if (query.to > today) throw new Error('HISTORY_INVALID_QUERY');
  const deadline = AbortSignal.any([AbortSignal.timeout(75000), ...(signal ? [signal] : [])]);
  deadline.throwIfAborted();
  const binding = customerHistoryBinding.parse(await deps.binding(deadline));
  if (binding.projectId !== query.projectId) throw new Error('HISTORY_IDENTITY_CHANGED');
  let requests = 0;
  const recheck = async () => {
    deadline.throwIfAborted();
    const current = customerHistoryBinding.parse(await deps.binding(deadline));
    if (JSON.stringify(current) !== JSON.stringify(binding)) throw new Error('HISTORY_IDENTITY_CHANGED');
  };
  async function read(resource: HistoryRead['resource'], page: number, invoiceId?: string) {
    await recheck(); if (++requests > 60) throw new Error('HISTORY_LIMIT');
    return deps.read({ resource, page, invoiceId, tenantId: binding.tenantId, contactId: binding.xeroContactId, period: query }, deadline);
  }
  async function population(resource: HistoryRead['resource'], key: string, invoiceId?: string): Promise<unknown[]> {
    const all: unknown[] = []; const seen = new Set<string>();
    for (let page = 1; page <= 10; page++) {
      const rows = await read(resource, page, invoiceId);
      if (rows.length > HISTORY_PAGE_SIZE) throw new Error('HISTORY_UNAVAILABLE');
      for (const raw of rows) {
        const id = z.object({ [key]: z.string().uuid() }).parse(raw)[key]!.toLowerCase();
        if (seen.has(id)) throw new Error('HISTORY_CHANGED_DURING_READ'); seen.add(id); all.push(raw);
      }
      if (rows.length < HISTORY_PAGE_SIZE) return all;
    }
    throw new Error('HISTORY_LIMIT');
  }
  const contactRows = await read('Contacts', 1);
  const exactContact = z.object({ ContactID: z.string().uuid(), Name: text, ContactStatus: z.literal('ACTIVE'), MergedToContactID: z.null().optional() });
  if (contactRows.length !== 1) throw new Error('HISTORY_IDENTITY_CHANGED');
  const identity = exactContact.parse(contactRows[0]);
  if (!same(identity.ContactID, binding.xeroContactId)) throw new Error('HISTORY_IDENTITY_CHANGED');
  const invoices = (await population('Invoices', 'InvoiceID')).map(raw => {
    const row = invoice.parse(raw);
    if (!same(row.Contact.ContactID, binding.xeroContactId) || row.SubTotal + row.TotalTax !== row.Total) throw new Error('HISTORY_IDENTITY_CHANGED');
    return { id: row.InvoiceID, number: row.InvoiceNumber, status: row.Status, date: date(row.DateString ?? row.Date),
      dueDate: row.DueDateString || row.DueDate ? date(row.DueDateString ?? row.DueDate) : null,
      currency: row.CurrencyCode, currencyRate: row.CurrencyRate, subtotalCents: row.SubTotal, taxCents: row.TotalTax,
      totalCents: row.Total, paidCents: row.AmountPaid, dueCents: row.AmountDue, creditedCents: row.AmountCredited, updatedAt: instant(row.UpdatedDateUTC) };
  });
  const inPeriod = (day: string) => { if (day < query.from || day > query.to) throw new Error('HISTORY_UNAVAILABLE'); return day; };
  const payments: CustomerHistory['payments']['items'] = []; const paymentIds = new Set<string>();
  for (const inv of invoices) {
    for (const raw of await population('Payments', 'PaymentID', inv.id)) {
      const row = payment.parse(raw);
      if (!same(row.Invoice.InvoiceID, inv.id) || row.Invoice.CurrencyCode !== inv.currency
        || row.Invoice.Contact && !same(row.Invoice.Contact.ContactID, binding.xeroContactId)
        || paymentIds.has(row.PaymentID.toLowerCase())) throw new Error('HISTORY_IDENTITY_CHANGED');
      paymentIds.add(row.PaymentID.toLowerCase());
      payments.push({ id: row.PaymentID, invoiceId: inv.id, status: row.Status, date: inPeriod(date(row.DateString ?? row.Date)),
        reference: row.Reference, invoiceCurrency: inv.currency, amountInvoiceCurrencyCents: row.Amount,
        currencyRate: row.CurrencyRate, reconciled: row.IsReconciled, updatedAt: instant(row.UpdatedDateUTC) });
    }
  }
  const directReceipts = (await population('BankTransactions', 'BankTransactionID')).map(raw => {
    const row = receipt.parse(raw); if (!same(row.Contact.ContactID, binding.xeroContactId)) throw new Error('HISTORY_IDENTITY_CHANGED');
    return { id: row.BankTransactionID, status: row.Status, date: inPeriod(date(row.DateString ?? row.Date)), reference: row.Reference,
      currency: row.CurrencyCode, currencyRate: row.CurrencyRate, totalCents: row.Total, reconciled: row.IsReconciled, updatedAt: instant(row.UpdatedDateUTC) };
  });
  // Re-read provider identity as well as local authority; no result survives revoked/changed mapping.
  const finalContact = await read('Contacts', 1);
  if (finalContact.length !== 1 || JSON.stringify(exactContact.parse(finalContact[0])) !== JSON.stringify(identity)) throw new Error('HISTORY_IDENTITY_CHANGED');
  await recheck();
  return { schemaVersion: 'sanctuary.praxis.finance-history.v1', query, startedAt, checkedAt: deps.now().toISOString(), consistency: 'sequential_read_window',
    identity: { ...binding, contactName: identity.Name, scope: 'contact_wide', projectAttribution: 'not_established' },
    invoices: { coverage: 'complete_contact_invoice_population', items: invoices },
    payments: { coverage: 'complete_linked_invoice_payments_in_period', items: payments },
    directReceipts: { coverage: 'complete_direct_receive_in_period', items: directReceipts },
    limitations: ['Sequential provider reads are not an atomic snapshot. Completeness applies only to the listed families and periods.',
      'Contact-wide records are not proven allocations to this project. Invoice numbers, names and matching amounts do not establish identity.',
      'Invoice paid/due/credited balances and Portal recorded receipts must not be added to provider receipts as additional money.',
      'Credit notes, prepayments, overpayments, refunds and other contacts are not covered. No combined cash or profit total is supplied.',
      'Payment amounts use invoice currency, not bank-account currency. Currencies are not converted or combined.',
      'Deleted, voided and draft records are history, not collectible balances or new cash. Reconciled status does not establish project attribution.'] };
}
