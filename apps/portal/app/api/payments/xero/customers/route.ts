import { z } from 'zod';
import { json, sameOrigin } from '@/lib/xero/http';
import { getPaymentPilotSession } from '@/lib/xero/pilotAccess';
import { config } from '@/lib/xero/security';
import { financeMappingContext, customerCreationRepository } from '@/lib/invoices/financeMappingRepository';
import { executeCustomerCreation } from '@/lib/xero/customerCreation';
import { customerCreationProvider, requireCustomerCreationAccess } from '@/lib/xero/customerCreationProvider';
export const runtime = 'nodejs';
export const maxDuration = 60;
const schema = z.object({ invoiceId: z.string().uuid(), sourceContactId: z.string().uuid(),
  name: z.string().trim().min(1).max(240), confirmed: z.literal(true) }).strict();
export async function POST(request: Request) {
  try {
    const session = await getPaymentPilotSession();
    if (!session || !sameOrigin(request)) return json({ error: 'Finance permission is required.' }, 403);
    if (process.env.XERO_CUSTOMER_CREATION_ENABLED !== 'true') return json({ error: 'Creating Xero customers from the portal has not been activated.' }, 409);
    const text = await request.text(); if (text.length > 2048) return json({ error: 'Check the customer details.' }, 400);
    let parsed; try { parsed = schema.safeParse(JSON.parse(text)); } catch { return json({ error: 'Check the customer details.' }, 400); }
    if (!parsed.success) return json({ error: 'Check the customer details and confirm creation.' }, 400);
    const input = parsed.data; const context = await financeMappingContext(session.user.id, input.invoiceId);
    if (input.sourceContactId !== context.sourceContactId) return json({ error: 'The portal customer changed. Review again.' }, 409);
    const tenantId = config().tenantId;
    // Do not start the durable retry window while finance is still awaiting consent.
    await requireCustomerCreationAccess(tenantId);
    const result = await executeCustomerCreation({ tenantId, sourceContactId: context.sourceContactId, name: input.name },
      customerCreationRepository(session.user.id, input.invoiceId), customerCreationProvider);
    return json({ contact: { id: result.contactId, name: input.name.replace(/\s+/g, ' '), email: '' } });
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    if (code === 'INSUFFICIENT_SCOPE') return json({ error: 'The Xero connection needs permission to create customers before this can continue.' }, 409);
    if (code === 'INVALID_CUSTOMER_NAME') return json({ error: 'Use a customer name without angle brackets or line breaks.' }, 400);
    if (code === 'XERO_EXISTING_CUSTOMER_REVIEW') return json({ error: 'An existing Xero customer or mapping needs review. Select the existing customer rather than creating another.' }, 409);
    if (code === 'XERO_CUSTOMER_INTENT_CONFLICT') return json({ error: 'This portal customer already has a saved creation request. Retry from its original invoice with the original name, or ask finance to investigate.' }, 409);
    if (code === 'CUSTOMER_IDEMPOTENCY_WINDOW_EXPIRED' || code === 'XERO_CUSTOMER_CONFLICT') return json({ error: 'The saved request could not be safely completed. Finance needs to check the existing Xero customer; no replacement request was sent.' }, 409);
    return json({ error: 'The customer result could not be verified. Retry with the same name: the portal checks the saved request before creating anything.' }, 503);
  }
}
