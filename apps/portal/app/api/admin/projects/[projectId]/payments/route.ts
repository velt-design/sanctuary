import { jsonError, jsonOk, parseJsonBody, requireAdminSession } from '@/lib/api/adminApi';
import { recordProjectPaymentEntry } from '@/lib/invoices/paymentLedger';

export const runtime = 'nodejs';

export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.response;
  const { projectId } = await context.params;
  if (!projectId?.trim()) return jsonError('Invalid projectId', 400);
  const parsed = await parseJsonBody(request);
  if (!parsed.ok) return parsed.response;
  const body = parsed.body ?? {};
  const entryType = body.entryType === 'ADJUSTMENT' ? 'ADJUSTMENT' : body.entryType === 'PAYMENT' ? 'PAYMENT' : null;
  const clientIntentId = typeof body.clientIntentId === 'string' ? body.clientIntentId.trim() : '';
  if (!entryType || typeof body.amountIncGstCents !== 'number') return jsonError('Payment type and amount are required', 400);
  if (clientIntentId.length < 8 || clientIntentId.length > 128) return jsonError('Payment client intent is invalid', 400);
  try {
    const paymentEntryId = await recordProjectPaymentEntry({
      projectId: projectId.trim(),
      entryType,
      amountIncGstCents: body.amountIncGstCents,
      occurredAt: typeof body.occurredAt === 'string' ? body.occurredAt : null,
      paymentMethod: typeof body.paymentMethod === 'string' ? body.paymentMethod : null,
      reference: typeof body.reference === 'string' ? body.reference : null,
      note: typeof body.note === 'string' ? body.note : null,
      reason: typeof body.reason === 'string' ? body.reason : null,
      clientIntentId,
      actor: auth.session.user.id,
    });
    return jsonOk({ paymentEntryId }, 201);
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Failed to record payment';
    return jsonError(detail, /required|amount|invalid|zero|allocation|negative|lowering/i.test(detail) ? 400 : 500);
  }
}
