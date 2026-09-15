import 'server-only';
import { z } from 'zod';
import { supabaseServiceRole } from '../supabaseClient';
const cents = z.number().int().nonnegative().max(2147483647);
const schema = z.object({ invoice: z.object({ id: z.string().uuid(), projectId: z.string().uuid(), invoiceRef: z.string(),
  status: z.string(), totalIncGstCents: cents }), recordedCents: cents, customerWon: z.boolean(), hasUnmatchedPaymentHistory: z.boolean(),
  checkedAt: z.string(), matches: z.array(z.object({ id: z.string().uuid(), sourceKind: z.enum(['BANK_TRANSACTION', 'INVOICE_PAYMENT']),
    amountCents: cents, receiptDate: z.string(), approvedAt: z.string(), approvedBy: z.string(), recordingMethod: z.enum(['MANUAL', 'AUTOMATIC']).optional(), reversedAt: z.string().nullable(),
    reversalReason: z.string().nullable(), reversedBy: z.string().nullable(), reference: z.string().nullable() })).max(51) });
export async function loadInvoicePaymentHistory(actor: string, invoiceId: string, tenantId: string, offset: number) {
  const result = await supabaseServiceRole.rpc('xero_invoice_payment_history', { p_actor: actor, p_invoice_id: invoiceId, p_tenant_id: tenantId, p_offset: offset });
  const parsed = schema.safeParse(result.data);
  if (result.error || !parsed.success || parsed.data.invoice.id !== invoiceId) throw new Error('PAYMENT_HISTORY_UNAVAILABLE');
  return { ...parsed.data, matches: parsed.data.matches.slice(0, 50), hasMore: parsed.data.matches.length > 50 };
}
