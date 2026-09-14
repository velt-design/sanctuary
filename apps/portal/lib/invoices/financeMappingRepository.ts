import 'server-only';
import { z } from 'zod';
import { supabaseServiceRole } from '../supabaseClient';
import type { XeroFinanceContact, XeroRevenueAccount, XeroRevenueTax } from '../xero/financeMappingProvider';
const contextSchema = z.object({ invoiceId: z.string().uuid(), invoiceRef: z.string(), customerName: z.string(),
  sourceContactId: z.string().uuid(), subtotalCents: z.number().int().nonnegative(), taxCents: z.number().int().nonnegative() });
export async function financeMappingContext(actor: string, invoiceId: string) {
  const result = await supabaseServiceRole.rpc('xero_finance_mapping_context', { p_actor: actor, p_invoice_id: invoiceId });
  const parsed = contextSchema.safeParse(result.data);
  if (result.error || !parsed.success || parsed.data.invoiceId !== invoiceId) throw new Error('XERO_MAPPING_CONTEXT_UNAVAILABLE');
  return parsed.data;
}
export async function saveFinanceMapping(input: { commandId: string; actor: string; invoiceId: string; tenantId: string; sourceContactId: string;
  proof: { contact: XeroFinanceContact; account: XeroRevenueAccount; tax: XeroRevenueTax } }) {
  const result = await supabaseServiceRole.rpc('xero_finance_save_mapping', { p_command_id: input.commandId, p_actor: input.actor,
    p_invoice_id: input.invoiceId, p_tenant_id: input.tenantId, p_source_contact_id: input.sourceContactId, p_proof: input.proof });
  if (result.error) throw new Error('XERO_MAPPING_SAVE_UNAVAILABLE');
}

export async function resumeFinanceTransfer(actor: string, invoiceId: string, tenantId: string) {
  const result = await supabaseServiceRole.rpc('xero_finance_resume', { p_actor: actor, p_invoice_id: invoiceId, p_tenant_id: tenantId });
  if (result.error) {
    if (['XERO_RECONCILIATION_REQUIRED', 'XERO_TRANSFER_DISABLED', 'XERO_MAPPING_REQUIRED', 'XERO_TRANSFER_NOT_FOUND'].includes(result.error.message)) throw new Error(result.error.message);
    throw new Error('XERO_RESUME_UNAVAILABLE');
  }
  const parsed = z.object({ state: z.enum(['queued', 'already_running']) }).safeParse(result.data);
  if (!parsed.success) throw new Error('XERO_RESUME_UNAVAILABLE');
  return parsed.data;
}
