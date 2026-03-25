import { jsonError, jsonOk, parseJsonBody, requireStaffSession } from '@/lib/api/staffApi';
import { createDepositInvoiceFromQuote } from '@/lib/invoices/server';

export const runtime = 'nodejs';

export async function POST(req: Request, ctx: { params: Promise<{ quoteId: string }> }) {
  const session = await requireStaffSession();
  if (!session) return jsonError('Unauthorized', 401);

  const { quoteId } = await ctx.params;
  const quoteVersionIdRaw = typeof quoteId === 'string' ? quoteId.trim() : '';
  if (!quoteVersionIdRaw) return jsonError('Invalid quoteId', 400);

  const parsed = await parseJsonBody(req);
  if (!parsed.ok) return jsonError(parsed.error, 400);

  const body = parsed.body as {
    depositPercent?: number;
    dueDate?: string | null;
    reference?: string | null;
    sendNow?: boolean;
  };

  const actor = typeof session.user?.email === 'string' ? session.user.email.trim() : null;

  try {
    const result = await createDepositInvoiceFromQuote({
      quoteVersionId: quoteVersionIdRaw,
      actor,
      depositPercent: body?.depositPercent,
      dueDate: body?.dueDate,
      reference: body?.reference,
      sendNow: Boolean(body?.sendNow),
    });
    return jsonOk(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create invoice';
    return jsonError(message, 500);
  }
}

