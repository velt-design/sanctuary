import 'server-only';
import { z } from 'zod';
import { supabaseServiceRole } from '../supabaseClient';
import type { XeroFinanceContact, XeroRevenueAccount, XeroRevenueTax } from '../xero/financeMappingProvider';
import { validateCustomerRequest, type CustomerCreationRepository } from '../xero/customerCreation';
import { customerHistoryBinding } from '../xero/customerHistoryContract';

/** App-owned read RPC retains current confirmed-user/finance-grant checks; no broad private-table access. */
export async function financeCustomerHistoryBinding(actor: string, projectId: string, tenantId: string,
  source: { sourceKey: string; connectionId: string; environment: string }, signal: AbortSignal) {
  const result = await supabaseServiceRole.rpc('xero_customer_history_binding', { p_actor: actor, p_project_id: projectId, p_tenant_id: tenantId,
    p_source_key: source.sourceKey, p_connection_id: source.connectionId, p_environment: source.environment }).abortSignal(signal);
  const parsed = customerHistoryBinding.safeParse(result.data);
  if (result.error || !parsed.success || parsed.data.projectId !== projectId || parsed.data.tenantId !== tenantId) throw new Error('HISTORY_AUTHORITY_UNAVAILABLE');
  return parsed.data;
}
const contextSchema = z.object({ invoiceId: z.string().uuid(), invoiceRef: z.string(), customerName: z.string(),
  sourceContactId: z.string().uuid(), subtotalCents: z.number().int().nonnegative(), taxCents: z.number().int().nonnegative() });
export async function financeMappingContext(actor: string, invoiceId: string) {
  const result = await supabaseServiceRole.rpc('xero_finance_mapping_context', { p_actor: actor, p_invoice_id: invoiceId });
  if (result.error?.message === 'XERO_MAPPING_CONTEXT_UNAVAILABLE') throw new Error('XERO_MAPPING_DETAILS_REQUIRED');
  const parsed = contextSchema.safeParse(result.data);
  if (result.error || !parsed.success || parsed.data.invoiceId !== invoiceId) throw new Error('XERO_MAPPING_CONTEXT_UNAVAILABLE');
  return parsed.data;
}
const mappingStatusSchema = z.object({ sourceContactId: z.string().uuid(),
  link: z.object({ contactId: z.string().uuid(), verifiedAt: z.string() }).nullable(),
  defaults: z.object({ accountCode: z.string(), taxType: z.string(), effectiveRate: z.number() }).nullable() });
export async function financeMappingStatus(actor: string, invoiceId: string, tenantId: string, sourceContactId: string) {
  const result = await supabaseServiceRole.rpc('xero_finance_mapping_status', { p_actor: actor, p_invoice_id: invoiceId, p_tenant_id: tenantId });
  const parsed = mappingStatusSchema.safeParse(result.data);
  if (result.error || !parsed.success || parsed.data.sourceContactId !== sourceContactId) throw new Error('XERO_MAPPING_STATUS_UNAVAILABLE');
  return parsed.data;
}
export async function saveFinanceSetup(input: { commandId: string; actor: string; invoiceId: string; tenantId: string; sourceContactId: string;
  kind: 'customer' | 'defaults'; proof: XeroFinanceContact | { account: XeroRevenueAccount; tax: XeroRevenueTax } }) {
  const result = await supabaseServiceRole.rpc('xero_finance_save_setup', { p_command_id: input.commandId, p_actor: input.actor,
    p_invoice_id: input.invoiceId, p_tenant_id: input.tenantId, p_source_contact_id: input.sourceContactId, p_kind: input.kind, p_proof: input.proof });
  if (result.error) throw new Error('XERO_MAPPING_SAVE_UNAVAILABLE');
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

const customerRequestSchema = z.object({ tenantId: z.string().uuid(), sourceContactId: z.string().uuid(),
  customer: z.object({ Name: z.string(), ContactNumber: z.string() }).strict(), body: z.string(), bodyHash: z.string(),
  idempotencyKey: z.string(), preparedAt: z.number().int(), expiresAt: z.number().int(),
  dispatchStarted: z.boolean(), providerContactId: z.string().uuid().nullable() }).strict();
export function customerCreationRepository(actor: string, invoiceId: string): CustomerCreationRepository {
  async function command(action: string, tenantId: string, sourceContactId: string, body: string, contactId: string | null = null) {
    const result = await supabaseServiceRole.rpc('xero_customer_creation_command', { p_actor: actor, p_invoice_id: invoiceId,
      p_tenant_id: tenantId, p_source_contact_id: sourceContactId, p_action: action, p_body: body, p_provider_contact_id: contactId });
    if (result.error) {
      if (['XERO_CUSTOMER_INTENT_CONFLICT', 'XERO_EXISTING_CUSTOMER_REVIEW', 'CUSTOMER_IDEMPOTENCY_WINDOW_EXPIRED'].includes(result.error.message)) throw new Error(result.error.message);
      throw new Error('XERO_CUSTOMER_SAVE_UNAVAILABLE');
    }
    const parsed = customerRequestSchema.safeParse(result.data);
    if (!parsed.success || parsed.data.tenantId !== tenantId || parsed.data.sourceContactId !== sourceContactId
      || parsed.data.body !== body) throw new Error('INVALID_FROZEN_CUSTOMER_REQUEST');
    validateCustomerRequest(parsed.data);
    return parsed.data;
  }
  return {
    prepare: (input, customer) => command('prepare', input.tenantId, input.sourceContactId, JSON.stringify({ Contacts: [customer] })),
    beginDispatch: request => command('dispatch', request.tenantId, request.sourceContactId, request.body),
    async finalise(request, contactId) {
      const result = await command('finalise', request.tenantId, request.sourceContactId, request.body, contactId);
      if (result.providerContactId !== contactId) throw new Error('XERO_CUSTOMER_SAVE_UNAVAILABLE');
    },
  };
}
