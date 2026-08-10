import { jsonError, jsonOk, parseJsonBody, requireAdminSession } from '@/lib/api/adminApi';
import { replacePaymentAllocations } from '@/lib/invoices/paymentLedger';

export const runtime = 'nodejs';

export async function POST(request: Request, context: { params: Promise<{ paymentId: string }> }) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.response;
  const { paymentId } = await context.params;
  if (!paymentId?.trim()) return jsonError('Invalid paymentId', 400);
  const parsed = await parseJsonBody(request);
  if (!parsed.ok) return parsed.response;
  const body = parsed.body ?? {};
  if (!Array.isArray(body.allocations) || typeof body.reason !== 'string') return jsonError('Allocations and reason are required', 400);
  try {
    await replacePaymentAllocations({
      paymentEntryId: paymentId.trim(),
      allocations: body.allocations.map((item: any) => ({
        quoteVersionId: String(item?.quoteVersionId ?? ''),
        paymentTermId: String(item?.paymentTermId ?? ''),
        amountIncGstCents: Number(item?.amountIncGstCents),
      })),
      reason: body.reason,
      actor: auth.session.user.id,
    });
    return jsonOk({ updated: true });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Failed to update payment allocations';
    return jsonError(detail, /not found/i.test(detail) ? 404 : /required|exceed|stage|amount|reversed|positive|included|plan/i.test(detail) ? 400 : 500);
  }
}
