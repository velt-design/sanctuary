import { z } from 'zod';
import { json, sameOrigin } from '@/lib/xero/http';
import { config } from '@/lib/xero/security';
import { getPaymentPilotSession } from '@/lib/xero/pilotAccess';
import { refreshInvoiceObservation } from '@/lib/xero/refreshInvoiceObservation';
export const runtime = 'nodejs';
export const maxDuration = 60;
export async function POST(request: Request) {
  try {
    const session = await getPaymentPilotSession();
    if (!session || !sameOrigin(request)) return json({ error: 'Finance permission is required.' }, 403);
    if (process.env.XERO_INVOICE_OBSERVATION_ENABLED !== 'true') return json({ error: 'Invoice checks have not been activated.' }, 409);
    const text = await request.text();
    if (text.length > 1024) return json({ error: 'Check the invoice selection.' }, 400);
    let parsed;
    try { parsed = z.object({ invoiceId: z.string().uuid() }).strict().safeParse(JSON.parse(text)); }
    catch { return json({ error: 'Check the invoice selection.' }, 400); }
    if (!parsed.success) return json({ error: 'Check the invoice selection.' }, 400);
    const observation = await refreshInvoiceObservation(parsed.data.invoiceId, config().tenantId);
    return json({ checked: observation.state !== 'unavailable' });
  } catch { return json({ error: 'The Xero check could not be saved. Refresh the invoice and try again.' }, 503); }
}
