import { z } from 'zod';
import { json, sameOrigin } from '@/lib/xero/http';
import { getPaymentPilotSession } from '@/lib/xero/pilotAccess';
import { config } from '@/lib/xero/security';
import { financeMappingContext, financeMappingStatus, saveFinanceMapping, resumeFinanceTransfer } from '@/lib/invoices/financeMappingRepository';
import { financeMappingProvider } from '@/lib/xero/financeMappingProvider';
export const runtime = 'nodejs';
export const maxDuration = 60;
const bodySchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('resume'), invoiceId: z.string().uuid(), confirmed: z.literal(true) }).strict(),
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
    if (body.action === 'resume') {
      if (process.env.XERO_INVOICE_TRANSFERS_ENABLED !== 'true') return json({ error: 'Automatic draft transfers have not been activated.' }, 409);
      return json(await resumeFinanceTransfer(session.user.id, body.invoiceId, tenantId));
    }
    const context = await financeMappingContext(session.user.id, body.invoiceId);
    const accounting = await financeMappingProvider.accounting(tenantId);
    if (body.action === 'inspect') {
      const link = await financeMappingStatus(session.user.id, body.invoiceId, tenantId, context.sourceContactId);
      const contacts = await financeMappingProvider.contacts(tenantId, body.contactName ?? context.customerName);
      let linkedContact = null;
      if (link) {
        try { linkedContact = await financeMappingProvider.contact(tenantId, link.contactId); } catch { /* A failed provider read must not be shown as an absent saved link. */ }
      }
      if (linkedContact && !contacts.contacts.some(item => item.id === linkedContact.id)) contacts.contacts.unshift(linkedContact);
      return json({ context, ...accounting, ...contacts, savedLink: link ? { ...link, contact: linkedContact } : null,
        customerCreationEnabled: !link && process.env.XERO_CUSTOMER_CREATION_ENABLED === 'true',
        checkedAt: new Date().toISOString() });
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
    if (error instanceof Error && error.message === 'XERO_MAPPING_DETAILS_REQUIRED') return json({ error: 'Open the project and check that this invoice has a linked portal customer, is open or paid, and is in NZD. Then check Xero records again.' }, 409);
    if (error instanceof Error && error.message === 'XERO_RECONCILIATION_REQUIRED') return json({ error: 'This transfer may already have reached Xero. Check its outcome in finance review before another transfer.' }, 409);
    if (error instanceof Error && error.message === 'XERO_TRANSFER_NOT_FOUND') return json({ error: 'This invoice was not captured for automatic transfer. Resuming does not import historical invoices.' }, 409);
    if (error instanceof Error && error.message === 'INSUFFICIENT_SCOPE') return json({ error: 'Xero needs the additional finance connection permission before these details can be checked.' }, 409);
    return json({ error: 'Mapping could not be confirmed. Review the current details before retrying.' }, 503);
  }
}
