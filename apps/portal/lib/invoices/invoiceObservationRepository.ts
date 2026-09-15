import 'server-only';
import { z } from 'zod';
import { supabaseServiceRole } from '../supabaseClient';
import type { InvoiceObservation } from '../xero/invoiceObservation';
const contextSchema = z.object({ invoiceId: z.string().uuid(), tenantId: z.string().uuid(), providerInvoiceId: z.string().uuid(),
  generation: z.number().int().positive(), portalStatus: z.enum(['OPEN', 'PAID', 'VOID']), body: z.string() });
export async function invoiceObservationContext(invoiceId: string, tenantId: string) {
  const result = await supabaseServiceRole.rpc('xero_invoice_observation_context', { p_invoice_id: invoiceId, p_tenant_id: tenantId });
  const parsed = contextSchema.safeParse(result.data);
  if (result.error || !parsed.success || parsed.data.invoiceId !== invoiceId || parsed.data.tenantId !== tenantId) throw new Error('XERO_OBSERVATION_UNAVAILABLE');
  return parsed.data;
}
export type ObservationContext = Awaited<ReturnType<typeof invoiceObservationContext>>;
export type ObservationResult = InvoiceObservation | { state: 'unavailable'; reason: 'XERO_READ_FAILED'; amountPaidCents: null };
export async function recordInvoiceObservation(context: ObservationContext, observation: ObservationResult) {
  const result = await supabaseServiceRole.rpc('xero_invoice_record_observation', { p_invoice_id: context.invoiceId, p_tenant_id: context.tenantId,
    p_generation: context.generation, p_portal_status: context.portalStatus, p_result: observation });
  if (result.error) throw new Error('XERO_OBSERVATION_CHANGED');
}
export async function invoiceObservationTargets(tenantId: string) {
  const result = await supabaseServiceRole.rpc('xero_invoice_observation_targets', { p_tenant_id: tenantId });
  const parsed = z.array(z.string().uuid()).max(3).safeParse(result.data);
  if (result.error || !parsed.success) throw new Error('XERO_OBSERVATION_UNAVAILABLE');
  return parsed.data;
}
