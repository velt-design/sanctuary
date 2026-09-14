import { z } from 'zod';
import { json, sameOrigin } from '@/lib/xero/http';
import { getPaymentPilotSession } from '@/lib/xero/pilotAccess';
import { reviewInvoicePayments, approveInvoicePayment } from '@/lib/xero/invoicePaymentReview';
import { findPilotMatch } from '@/lib/invoices/xeroMatchRepository';
export const runtime = 'nodejs';
export const maxDuration = 60;
const command = z.discriminatedUnion('action', [
  z.object({ action: z.literal('review'), invoiceId: z.string().uuid() }).strict(),
  z.object({ action: z.literal('approve'), confirmed: z.literal(true), approvalToken: z.string().min(1).max(10000) }).strict(),
  z.object({ action: z.literal('status'), approvalId: z.string().uuid() }).strict(),
]);
export async function POST(request: Request) {
  if (process.env.XERO_INVOICE_PAYMENTS_ENABLED !== 'true') return json({ error: 'Not found' }, 404);
  try {
    const session = await getPaymentPilotSession();
    if (!session || !sameOrigin(request)) return json({ error: 'Finance permission is required.' }, 403);
    const text = await request.text();
    if (text.length > 12000) return json({ error: 'Invalid payment request.' }, 400);
    let parsed;
    try { parsed = command.safeParse(JSON.parse(text)); } catch { return json({ error: 'Invalid payment request.' }, 400); }
    if (!parsed.success) return json({ error: 'Check the invoice and required confirmation.' }, 400);
    const action = parsed.data;
    if (action.action === 'review') return json(await reviewInvoicePayments(action.invoiceId, session.user.id));
    if (action.action === 'approve') return json(await approveInvoicePayment(action.approvalToken, session.user.id));
    const match = await findPilotMatch(action.approvalId);
    return json({ match: match?.approvedBy === session.user.id && match.sourceKind === 'INVOICE_PAYMENT' ? match : null });
  } catch {
    return json({ error: 'The payment could not be confirmed. Check approval status before reviewing again; do not record a manual duplicate.' }, 409);
  }
}
