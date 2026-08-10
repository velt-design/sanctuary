import { jsonError, jsonOk, parseJsonBody, requireAdminSession } from '@/lib/api/adminApi';
import { markInvoicePaid } from '@/lib/invoices/adminPayments';

export const runtime = 'nodejs';

export async function POST(request: Request, context: { params: Promise<{ invoiceId: string }> }) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.response;
  const { invoiceId } = await context.params;
  if (!invoiceId?.trim()) return jsonError('Invalid invoiceId', 400);
  const parsed = await parseJsonBody(request);
  if (!parsed.ok) return parsed.response;
  const body = parsed.body ?? {};
  try {
    const invoice = await markInvoicePaid({
      invoiceId: invoiceId.trim(),
      actor: auth.session.user.id,
      paidAt: typeof body.paidAt === 'string' ? body.paidAt : null,
      reference: typeof body.reference === 'string' ? body.reference : null,
      method: typeof body.method === 'string' ? body.method : null,
      note: typeof body.note === 'string' ? body.note : null,
    });
    return jsonOk({ invoice });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Failed to mark invoice paid';
    return jsonError(detail, /not found/i.test(detail) ? 404 : /only open|invalid/i.test(detail) ? 400 : 500);
  }
}
