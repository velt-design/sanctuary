import { developer, json, sameOrigin } from '@/lib/xero/http';
import { readAccounting } from '@/lib/xero/store';
import { reviewQuery } from '@/lib/xero/review';
import { suggestDepositMatches } from '@/lib/xero/paymentSuggestions';
import { loadInvoiceForPaymentReview } from '@/lib/invoices/paymentMatchReview';

export const runtime = 'nodejs';
export const maxDuration = 60;
export async function POST(request: Request) {
  if (!await developer()) return json({ error: 'Forbidden' }, 403);
  try {
    if (!sameOrigin(request)) return json({ error: 'Forbidden' }, 403);
    const body = await request.json().catch(() => null);
    if (!body || typeof body.invoiceRef !== 'string' || !/^INV-[\d]{1,12}$/.test(body.invoiceRef.trim())) return json({ error: 'Enter an exact portal invoice number, such as INV-0033.' }, 400);
    if (body.contactName !== undefined && typeof body.contactName !== 'string') return json({ error: 'Invalid customer name.' }, 400);
    const { invoice, entries } = await loadInvoiceForPaymentReview(body.invoiceRef.trim());
    const query = reviewQuery('receipt', body.contactName?.trim() || invoice.customerName || '');
    const receipts = await readAccounting(query.resource, query.where);
    return json({ invoice, suggestions: suggestDepositMatches(invoice, entries, receipts),
      checkedAt: new Date().toISOString(), limited: receipts.length === 20,
      note: 'Review only. No match has been approved or saved. No payment, invoice or project status has changed. Before approval, verify the receipt belongs to this project and has not already been recorded elsewhere.' });
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    if (code === 'INVOICE_NOT_FOUND') return json({ error: 'Portal invoice not found. Check its exact number.' }, 404);
    if (code === 'AMBIGUOUS_INVOICE') return json({ error: 'More than one invoice has this number. Resolve the duplicate before matching.' }, 409);
    if (code === 'INVALID_QUERY') return json({ error: 'Enter the exact Xero contact name (3–100 characters).' }, 400);
    return json({ error: 'Payment review is unavailable. Nothing was changed. Check the connection and retry.' }, 503);
  }
}
