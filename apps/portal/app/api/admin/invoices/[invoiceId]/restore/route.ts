import { z } from 'zod';
import { jsonError, jsonOk, parseJsonBody, requireAdminSession } from '@/lib/api/adminApi';
import { restoreInvoice } from '@/lib/invoices/restoreInvoice';

export const runtime = 'nodejs';
const schema = z
  .object({
    reason: z.string().trim().min(3).max(1000),
    expectedVoidedAt: z.string().datetime({ offset: true }),
    commandId: z.string().uuid(),
  })
  .strict();

export async function POST(request: Request, context: { params: Promise<{ invoiceId: string }> }) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.response;
  const { invoiceId } = await context.params;
  if (!invoiceId.startsWith('inv_') || !z.string().uuid().safeParse(invoiceId.slice(4)).success) return jsonError('Invalid invoiceId', 400);
  const parsed = await parseJsonBody(request);
  if (!parsed.ok) return parsed.response;
  const input = schema.safeParse(parsed.body);
  if (!input.success)
    return jsonError('A reason and current invoice details are required. Refresh and try again.', 400);
  try {
    return jsonOk({ invoice: await restoreInvoice({ ...input.data, invoiceId, actor: auth.session.user.id }) });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Failed to restore invoice';
    return jsonError(detail, /not found/i.test(detail) ? 404 : 409);
  }
}
