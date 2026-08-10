import { jsonError, jsonOk, parseJsonBody, requireAdminSession } from '@/lib/api/adminApi';
import { voidInvoice } from '@/lib/invoices/adminPayments';

export const runtime = 'nodejs';

export async function POST(request: Request, context: { params: Promise<{ invoiceId: string }> }) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.response;
  const { invoiceId } = await context.params;
  if (!invoiceId?.trim()) return jsonError('Invalid invoiceId', 400);
  const parsed = await parseJsonBody(request);
  if (!parsed.ok) return parsed.response;
  const reason = typeof parsed.body?.reason === 'string' ? parsed.body.reason.trim() : '';
  if (reason.length < 3) return jsonError('A void reason is required', 400);
  try {
    return jsonOk({ invoice: await voidInvoice({
      invoiceId: invoiceId.trim(),
      actor: auth.session.user.id,
      reason,
    }) });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Failed to void invoice';
    return jsonError(detail, /not found/i.test(detail) ? 404 : /only open|required/i.test(detail) ? 400 : 500);
  }
}
