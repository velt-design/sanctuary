import { z } from 'zod';
import { json, sameOrigin } from '@/lib/xero/http';
import { getPaymentPilotSession } from '@/lib/xero/pilotAccess';
import { config } from '@/lib/xero/security';
import { invoiceRecoveryRepository } from '@/lib/invoices/xeroInvoiceTransferRepository';
import { recoverInvoiceTransfer } from '@/lib/xero/invoiceRecovery';
import { invoiceTransferProvider } from '@/lib/xero/invoiceTransferProvider';
export const runtime = 'nodejs';
export const maxDuration = 60;
const schema = z.object({ invoiceId: z.string().uuid(), confirmed: z.literal(true) }).strict();
export async function POST(request: Request) {
  try {
    const session = await getPaymentPilotSession();
    if (!session || !sameOrigin(request)) return json({ error: 'Finance permission is required.' }, 403);
    const text = await request.text(); if (text.length > 512) return json({ error: 'Check the invoice selection.' }, 400);
    let parsed; try { parsed = schema.safeParse(JSON.parse(text)); } catch { return json({ error: 'Check the invoice selection.' }, 400); }
    if (!parsed.success) return json({ error: 'Confirm the invoice recovery check.' }, 400);
    return json(await recoverInvoiceTransfer(invoiceRecoveryRepository(session.user.id, parsed.data.invoiceId, config().tenantId), invoiceTransferProvider));
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    if (code === 'XERO_TRANSFER_STILL_RUNNING') return json({ error: 'This transfer is still owned by the worker. Wait for its outcome before checking recovery.' }, 409);
    if (code === 'XERO_NO_DISPATCH_TO_RECOVER') return json({ error: 'This transfer has no recorded attempt to contact Xero. Check its mapping and resume the existing transfer.' }, 409);
    if (code === 'XERO_RECOVERY_NOT_FOUND') return json({ error: 'The expected invoice was not found in Xero. Nothing was resent; finance needs to investigate the saved request.' }, 409);
    if (['XERO_INVOICE_CONFLICT', 'XERO_CANCELLED_TRANSFER_REVIEW', 'XERO_ALREADY_BOUND_REVIEW'].includes(code)) return json({ error: 'This transfer needs finance investigation. The existing Xero record was not changed or adopted.' }, 409);
    return json({ error: 'The transfer outcome could not be verified. Nothing was resent. Retry the recovery check when the connection is available.' }, 503);
  }
}
