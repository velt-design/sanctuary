import { z } from 'zod';
import { json, sameOrigin } from '@/lib/xero/http';
import { getPaymentPilotSession } from '@/lib/xero/pilotAccess';
import { config } from '@/lib/xero/security';
import { financeMappingContext, saveFinanceMapping } from '@/lib/invoices/financeMappingRepository';
import { financeMappingProvider } from '@/lib/xero/financeMappingProvider';
export const runtime = 'nodejs';
export const maxDuration = 60;
const bodySchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('inspect'), invoiceId: z.string().uuid(), contactName: z.string().trim().min(1).max(240).optional() }).strict(),
  z.object({ action: z.literal('confirm'), commandId: z.string().uuid(), invoiceId: z.string().uuid(), sourceContactId: z.string().uuid(),
    contactId: z.string().uuid(), accountCode: z.string().min(1).max(10), taxType: z.string().min(1).max(50), confirmed: z.literal(true) }).strict(),
]);
export async function POST(request: Request) {
  try {
    const session = await getPaymentPilotSession();
    if (!session || !sameOrigin(request)) return json({ error: 'Finance permission is required.' }, 403);
    const text = await request.text();
    if (text.length > 4096) return json({ error: 'Check the mapping selection.' }, 400);
    let parsed;
    try { parsed = bodySchema.safeParse(JSON.parse(text)); } catch { return json({ error: 'Check the mapping selection.' }, 400); }
    if (!parsed.success) return json({ error: 'Check the mapping selection.' }, 400);
    const body = parsed.data; const tenantId = config().tenantId;
    const context = await financeMappingContext(session.user.id, body.invoiceId);
    const accounting = await financeMappingProvider.accounting(tenantId);
    if (body.action === 'inspect') {
      const contacts = await financeMappingProvider.contacts(tenantId, body.contactName ?? context.customerName);
      return json({ context, ...accounting, ...contacts, checkedAt: new Date().toISOString() });
    }
    if (body.sourceContactId !== context.sourceContactId) return json({ error: 'The portal customer changed. Review again.' }, 409);
    const account = accounting.accounts.find(row => row.code === body.accountCode);
    const tax = accounting.taxes.find(row => row.type === body.taxType);
    if (!account || !tax || Math.abs(Math.round(context.subtotalCents * tax.effectiveRate / 100) - context.taxCents) > 1)
      return json({ error: 'The selected account or tax no longer matches this invoice. Review with finance.' }, 409);
    const contact = await financeMappingProvider.contact(tenantId, body.contactId);
    await saveFinanceMapping({ commandId: body.commandId, actor: session.user.id, invoiceId: body.invoiceId, tenantId,
      sourceContactId: context.sourceContactId, proof: { contact, account, tax } });
    return json({ saved: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'INSUFFICIENT_SCOPE') return json({ error: 'Xero needs the additional finance connection permission before these details can be checked.' }, 409);
    return json({ error: 'Mapping could not be confirmed. Review the current details before retrying.' }, 503);
  }
}
