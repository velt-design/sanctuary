import 'server-only';
import { supabaseServiceRole } from '../supabaseClient';
import { uuidFromAppId, appIdFromUuid } from '../supabase/mappers';
import { refreshInvoiceObservation } from '../xero/refreshInvoiceObservation';
import { listDepositInvoicesForProject } from './server';

export async function restoreInvoice(input: {
  invoiceId: string;
  expectedVoidedAt: string;
  commandId: string;
  reason: string;
  actor: string;
}) {
  const id = uuidFromAppId(input.invoiceId, 'inv');
  const context = await supabaseServiceRole.rpc('commercial_restore_invoice_context', { p_invoice_id: id });
  if (context.error) throw new Error('Invoice restoration is unavailable. Try again shortly.');
  if (context.data?.tenantId) {
    try {
      await refreshInvoiceObservation(id, context.data.tenantId);
    } catch {
      throw new Error('Xero could not be checked. Try restoring again shortly, or review the invoice in Finance.');
    }
  }
  const result = await supabaseServiceRole.rpc('commercial_restore_invoice', {
    p_invoice_id: id,
    p_expected_voided_at: input.expectedVoidedAt,
    p_command_id: input.commandId,
    p_reason: input.reason,
    p_actor: input.actor,
  });
  if (result.error) throw new Error(result.error.message);
  const row = await supabaseServiceRole.from('deposit_invoices').select('project_id').eq('id', id).single();
  if (row.error || !row.data) throw new Error('Invoice restored but could not be reloaded. Refresh the page.');
  const invoices = await listDepositInvoicesForProject(appIdFromUuid('proj', row.data.project_id));
  const invoice = invoices.find((value) => value.id === input.invoiceId);
  if (!invoice) throw new Error('Invoice restored but could not be reloaded. Refresh the page.');
  if (invoice.status === 'VOID') throw new Error('This invoice was voided again after restoration. Refresh before making another change.');
  return invoice;
}
