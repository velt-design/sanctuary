import { jsonError, jsonOk, requireStaffSession } from '@/lib/api/staffApi';
import { sendDepositInvoiceNow } from '@/lib/invoices/server';

export const runtime = 'nodejs';

export async function POST(_req: Request, ctx: { params: Promise<{ invoiceId: string }> }) {
  const session = await requireStaffSession();
  if (!session) return jsonError('Unauthorized', 401);

  const { invoiceId } = await ctx.params;
  const invoiceIdRaw = typeof invoiceId === 'string' ? invoiceId.trim() : '';
  if (!invoiceIdRaw) return jsonError('Invalid invoiceId', 400);

  const actor = typeof session.user?.email === 'string' ? session.user.email.trim() : null;

  try {
    const invoice = await sendDepositInvoiceNow(invoiceIdRaw, actor);
    return jsonOk({ invoice });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to send invoice';
    return jsonError(message, 500);
  }
}

