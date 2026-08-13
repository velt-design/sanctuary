import { createHash } from 'node:crypto';

import { jsonError, jsonOk, parseJsonBody, requireAdminSession } from '@/lib/api/adminApi';
import { createAdminInvoice, getProjectInvoiceSchedule } from '@/lib/invoices/adminPayments';
import { sendDepositInvoiceNow } from '@/lib/invoices/server';
import { getQuoteVersionDetail } from '@/lib/quotes/server';

export const runtime = 'nodejs';

function message(error: unknown): string {
  return error instanceof Error ? error.message : 'Failed to create invoice';
}

function firstStageIntentId(quoteVersionId: string, paymentTermId: string): string {
  const digest = createHash('sha256')
    .update(`${quoteVersionId}:${paymentTermId}`)
    .digest('hex');
  return `legacy-first-stage-${digest}`;
}

export async function POST(req: Request, ctx: { params: Promise<{ quoteId: string }> }) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.response;

  const { quoteId } = await ctx.params;
  const quoteVersionId = typeof quoteId === 'string' ? quoteId.trim() : '';
  if (!quoteVersionId) return jsonError('Invalid quoteId', 400);

  const parsed = await parseJsonBody(req);
  if (!parsed.ok) return parsed.response;
  const body = parsed.body as {
    dueDate?: string | null;
    reference?: string | null;
    sendNow?: boolean;
  };
  const actor = auth.session.user.id;

  try {
    const quote = await getQuoteVersionDetail(quoteVersionId);
    if (!quote) return jsonError('Quote not found', 404);
    if (quote.status !== 'ACCEPTED') return jsonError('Only accepted quotes can create an invoice', 400);
    const firstTerm = quote.paymentTerms?.[0];
    if (!firstTerm) return jsonError('Quote payment schedule is missing', 400);

    const schedule = await getProjectInvoiceSchedule(quote.projectId);
    const scheduledTerm = schedule.terms.find((term) => (
      term.quoteVersionId === quoteVersionId && term.paymentTermId === firstTerm.id
    ));
    if (scheduledTerm?.invoice) {
      let invoice = scheduledTerm.invoice;
      const alreadySent = invoice.lastDeliveryStatus === 'SENT';
      let sent = false;
      if (body.sendNow === true && !alreadySent) {
        invoice = await sendDepositInvoiceNow(invoice.id, actor);
        sent = true;
      }
      return jsonOk({
        invoice,
        created: false,
        sent,
        alreadySent,
        sendError: null,
      });
    }

    const result = await createAdminInvoice({
      projectId: quote.projectId,
      quoteVersionId,
      mode: 'next_stage',
      paymentTermId: firstTerm.id,
      amountIncGstCents: null,
      splitCount: null,
      label: firstTerm.label,
      dueDate: typeof body.dueDate === 'string' ? body.dueDate : null,
      reference: typeof body.reference === 'string' ? body.reference : null,
      sendNow: body.sendNow === true,
      allowOverInvoice: false,
      overrideReason: null,
      calculationBasis: firstTerm.calculationType,
      percentage: firstTerm.percentageOfRemainder,
      clientIntentId: firstStageIntentId(quoteVersionId, firstTerm.id),
      actor,
    });
    return jsonOk(result);
  } catch (error) {
    const detail = message(error);
    const status = /not found/i.test(detail) ? 404 : /only accepted|missing|required|invalid|exceeds|already|no remaining/i.test(detail) ? 400 : 500;
    return jsonError(detail, status);
  }
}
