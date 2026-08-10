import { jsonError, jsonOk, parseJsonBody, requireAdminSession } from '@/lib/api/adminApi';
import { reversePaymentEntry } from '@/lib/invoices/paymentLedger';

export const runtime = 'nodejs';

export async function POST(request: Request, context: { params: Promise<{ paymentId: string }> }) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.response;
  const { paymentId } = await context.params;
  if (!paymentId?.trim()) return jsonError('Invalid paymentId', 400);
  const parsed = await parseJsonBody(request);
  if (!parsed.ok) return parsed.response;
  const body = parsed.body ?? {};
  if (typeof body.reason !== 'string') return jsonError('A reversal reason is required', 400);
  try {
    await reversePaymentEntry({ paymentEntryId: paymentId.trim(), reason: body.reason, actor: auth.session.user.id });
    return jsonOk({ reversed: true });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Failed to reverse payment';
    return jsonError(detail, /not found/i.test(detail) ? 404 : /required|cannot|reversed|balance|reduce|negative/i.test(detail) ? 400 : 500);
  }
}
