import { config, equalSecret } from '@/lib/xero/security';
import { json } from '@/lib/xero/http';
import { invoiceObservationTargets } from '@/lib/invoices/invoiceObservationRepository';
import { refreshInvoiceObservation } from '@/lib/xero/refreshInvoiceObservation';
import { synchronizeInvoicePayment } from '@/lib/xero/synchronizeInvoicePayment';
export const runtime = 'nodejs';
export const maxDuration = 90;
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 32 || !equalSecret(request.headers.get('authorization') ?? '', `Bearer ${secret}`)) return json({ error: 'Unauthorized' }, 401);
  if (process.env.XERO_ENABLED !== 'true' || process.env.XERO_INVOICE_OBSERVATION_ENABLED !== 'true') return json({ enabled: false });
  try {
    const tenantId = config().tenantId;
    const ids = await invoiceObservationTargets(tenantId);
    const results = await Promise.allSettled(ids.map(async id => {
      const observation = await refreshInvoiceObservation(id, tenantId);
      if (process.env.XERO_AUTOMATIC_PAYMENTS_ENABLED === 'true' && observation.state !== 'unavailable') {
        await synchronizeInvoicePayment(id, tenantId);
      }
      return observation;
    }));
    const checked = results.filter(result => result.status === 'fulfilled' && result.value.state !== 'unavailable').length;
    return json({ checked, unavailable: ids.length - checked }, checked === ids.length ? 200 : 503);
  } catch { return json({ error: 'Invoice checks require attention' }, 503); }
}
