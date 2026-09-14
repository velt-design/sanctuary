import 'server-only';
import type { InvoiceContentSnapshot } from '@sp/quote-format';

/** The repository supplies immutable issued values, never browser-edited amounts. */
export type IssuedInvoiceForXero = {
  invoiceId: string;
  invoiceRef: string;
  status: 'DRAFT' | 'OPEN' | 'PAID' | 'VOID';
  kind: 'QUOTE_LINKED' | 'STANDALONE';
  issueDate: string;
  dueDate: string;
  quoteRef: string | null;
  paymentTermLabel: string;
  totalIncGstCents: number;
  totalExGstCents: number;
  gstCents: number;
  content: InvoiceContentSnapshot | null;
};

/** Supplied by the verified mapping owner; names must never resolve identity here. */
export type XeroInvoiceMapping = {
  tenantId: string;
  contactId: string;
  accountCode: string;
  taxType: string;
};

export type XeroDraftLine = {
  Description: string;
  Quantity: number;
  UnitAmount: number;
  LineAmount: number;
  TaxAmount: number;
  AccountCode: string;
  TaxType: string;
};

export type XeroDraftInvoice = {
  Type: 'ACCREC';
  Status: 'DRAFT';
  Contact: { ContactID: string };
  InvoiceNumber: string;
  Reference: string;
  Date: string;
  DueDate: string;
  CurrencyCode: 'NZD';
  LineAmountTypes: 'Inclusive';
  LineItems: XeroDraftLine[];
};

export class InvoiceMappingError extends Error {
  constructor(readonly code: 'NOT_ISSUED' | 'INVALID_INVOICE' | 'MISSING_MAPPING' | 'MISSING_CONTENT' | 'TOTAL_MISMATCH') {
    super(code);
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const validText = (value: string, maximum: number) =>
  typeof value === 'string' && value.trim().length > 0 && value.length <= maximum && !/[\u0000-\u001f]/.test(value);
const cents = (value: number) => Number.isSafeInteger(value) && value >= 0 && value <= 2147483647;
function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value;
}

export function mapIssuedInvoiceToXeroDraft(invoice: IssuedInvoiceForXero, mapping: XeroInvoiceMapping): XeroDraftInvoice {
  if (invoice.status !== 'OPEN' && invoice.status !== 'PAID') throw new InvoiceMappingError('NOT_ISSUED');
  if (!UUID.test(mapping.tenantId) || !UUID.test(mapping.contactId)
    || !validText(mapping.accountCode, 10) || !validText(mapping.taxType, 50)) {
    throw new InvoiceMappingError('MISSING_MAPPING');
  }
  if (!UUID.test(invoice.invoiceId) || !validText(invoice.invoiceRef, 255)
    || !validDate(invoice.issueDate) || !validDate(invoice.dueDate)
    || !cents(invoice.totalIncGstCents) || invoice.totalIncGstCents === 0
    || !cents(invoice.totalExGstCents) || !cents(invoice.gstCents)
    || !Number.isSafeInteger(invoice.totalExGstCents + invoice.gstCents)
    || invoice.totalExGstCents + invoice.gstCents !== invoice.totalIncGstCents) {
    throw new InvoiceMappingError('INVALID_INVOICE');
  }

  let amounts: Array<{ description: string; quantity: number; unitCents: number; lineCents: number }>;
  if (invoice.kind === 'QUOTE_LINKED') {
    if (!validText(invoice.paymentTermLabel, 200) || !invoice.quoteRef || !validText(invoice.quoteRef, 100)) {
      throw new InvoiceMappingError('INVALID_INVOICE');
    }
    // The saved content lists the whole quote for reference. Billing those items
    // would export the whole contract again for each deposit/stage invoice.
    amounts = [{ description: `${invoice.paymentTermLabel} - ${invoice.quoteRef}`,
      quantity: 1, unitCents: invoice.totalIncGstCents, lineCents: invoice.totalIncGstCents }];
  } else if (invoice.kind === 'STANDALONE') {
    if (!invoice.content || invoice.content.version !== 1 || !Array.isArray(invoice.content.items)
      || invoice.content.items.length === 0 || invoice.content.items.length > 100) {
      throw new InvoiceMappingError('MISSING_CONTENT');
    }
    amounts = invoice.content.items.map(item => {
      if (!validText(item.description, 4000) || !Number.isFinite(item.qty) || item.qty <= 0
        || !cents(item.unitPriceIncGstCents) || !cents(item.lineTotalIncGstCents)
        || Math.round(item.qty * item.unitPriceIncGstCents) !== item.lineTotalIncGstCents) {
        throw new InvoiceMappingError('INVALID_INVOICE');
      }
      return { description: item.description, quantity: item.qty, unitCents: item.unitPriceIncGstCents,
        lineCents: item.lineTotalIncGstCents };
    });
  } else {
    throw new InvoiceMappingError('INVALID_INVOICE');
  }
  const sum = amounts.reduce((total, item) => total + item.lineCents, 0);
  if (!Number.isSafeInteger(sum) || sum !== invoice.totalIncGstCents) throw new InvoiceMappingError('TOTAL_MISMATCH');

  // Apportion the already-issued tax using integer arithmetic. Recomputing each
  // line independently can change the invoice tax by a cent. Provider confirmation
  // must still prove the tax type accepts these exact issued amounts.
  let cumulative = BigInt(0);
  let previousTax = BigInt(0);
  const two = BigInt(2);
  const total = BigInt(invoice.totalIncGstCents);
  const tax = BigInt(invoice.gstCents);
  const lines = amounts.map(item => {
    cumulative += BigInt(item.lineCents);
    const cumulativeTax = (cumulative * tax * two + total) / (two * total);
    const lineTax = Number(cumulativeTax - previousTax);
    previousTax = cumulativeTax;
    return { Description: item.description, Quantity: item.quantity, UnitAmount: item.unitCents / 100,
      LineAmount: item.lineCents / 100, TaxAmount: lineTax / 100,
      AccountCode: mapping.accountCode, TaxType: mapping.taxType };
  });
  return {
    Type: 'ACCREC', Status: 'DRAFT', Contact: { ContactID: mapping.contactId },
    InvoiceNumber: invoice.invoiceRef, Reference: `Sanctuary portal ${invoice.invoiceId}`,
    Date: invoice.issueDate, DueDate: invoice.dueDate, CurrencyCode: 'NZD',
    LineAmountTypes: 'Inclusive', LineItems: lines,
  };
}
