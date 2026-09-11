import 'server-only';
import { parseInvoiceContent } from '@sp/quote-format';
import type { SupabaseClient } from '@supabase/supabase-js';
import { appIdFromUuid, uuidFromAppId } from '../supabase/mappers';
import { supabaseServiceRole } from '../supabaseClient';
import { paymentDetailsText } from '../payments/paymentDetails';
import { sendDepositInvoiceNow } from './server';
import type { InvoiceDraft } from './draftTypes';
import { generateDepositInvoicePdfBytes } from './pdf';

import { invoiceDraftCreationEnabled } from './draftFeature';
export { invoiceDraftCreationEnabled } from './draftFeature';

function mapDraft(row: Record<string, any>): InvoiceDraft {
  const content = parseInvoiceContent(row.content_snapshot);
  if (!content || row.status !== 'DRAFT') throw new Error('Editable draft not found');
  return {
    id: appIdFromUuid('inv', row.id), projectId: appIdFromUuid('proj', row.project_id),
    quoteVersionId: row.quote_version_id ? appIdFromUuid('qv', row.quote_version_id) : null,
    revision: Number(row.draft_revision), content, options: row.draft_options,
    scopeTotalIncGstCents: Number(row.quote_total_inc_gst_cents), amountIncGstCents: Number(row.total_inc_gst_cents),
  };
}

/** Call only after requireAdminSession: draft reads use the existing invoice storage owner. */
export async function listInvoiceDrafts(projectId: string) {
  const result = await supabaseServiceRole.from('deposit_invoices').select('*')
    .eq('project_id', uuidFromAppId(projectId, 'proj')).eq('status', 'DRAFT').order('created_at', { ascending: false });
  if (result.error) throw result.error;
  return (result.data ?? []).map(mapDraft);
}

export async function previewInvoiceDraft(projectId: string, invoiceId: string) {
  const result = await supabaseServiceRole.from('deposit_invoices').select('*')
    .eq('project_id', uuidFromAppId(projectId, 'proj')).eq('id', uuidFromAppId(invoiceId, 'inv')).eq('status', 'DRAFT').single();
  if (result.error || !result.data) throw new Error('Invoice draft not found');
  const row = result.data;
  const draft = mapDraft(row);
  return generateDepositInvoicePdfBytes({
    draft: true, contentSnapshot: draft.content, invoiceKind: draft.quoteVersionId ? 'QUOTE_LINKED' : 'STANDALONE',
    invoiceRef: 'DRAFT', quoteRef: row.quote_ref ?? '', quoteVersionNumber: row.quote_version_number ?? 0,
    customerName: draft.content.billingName, projectName: row.project_name, projectAddress: row.project_address,
    issueDate: new Date().toISOString().slice(0,10), dueDate: row.due_date, depositPercent: row.deposit_percent,
    paymentTermLabel: row.payment_term_label, paymentTermCalculation: 'fixed',
    quoteTotalIncGstCents: row.quote_total_inc_gst_cents, totalIncGstCents: row.total_inc_gst_cents,
    totalExGstCents: row.total_ex_gst_cents, gstCents: row.gst_cents,
  }, { paymentLines: ['DRAFT PREVIEW ONLY — do not pay. No invoice has been issued.'] });
}

export async function runInvoiceDraftCommand(supabase: SupabaseClient, projectId: string, body: Record<string, any>, actor: string) {
  if (!invoiceDraftCreationEnabled()) throw new Error('Invoice draft creation is not enabled');
  const projectUuid = uuidFromAppId(projectId, 'proj');
  if (typeof body.invoiceId !== 'string') throw new Error('Invoice draft identifier is required');
  const invoiceUuid = uuidFromAppId(body.invoiceId, 'inv');
  if (!Number.isSafeInteger(body.expectedRevision) || body.expectedRevision < 0) throw new Error('Expected draft revision is required');
  if (!['save', 'issue', 'delete'].includes(body.action)) throw new Error('Invalid invoice draft action');
  // Bind issue/delete to the project route as well as the globally unique invoice.
  if (body.action !== 'save') {
    const existing = await supabaseServiceRole.from('deposit_invoices').select('project_id').eq('id', invoiceUuid).single();
    if (existing.error || existing.data?.project_id !== projectUuid) throw new Error('Invoice not found in this project');
  }
  if (body.action === 'save') {
    const result = await supabase.rpc('commercial_invoice_save_draft', {
      p_invoice_id: invoiceUuid, p_project_id: projectUuid, p_expected_revision: body.expectedRevision,
      p_quote_version_id: body.quoteVersionId ? uuidFromAppId(body.quoteVersionId, 'qv') : null,
      p_snapshot: body.content ?? null, p_options: body.options,
    });
    if (result.error) throw result.error;
    return { draft: mapDraft(Array.isArray(result.data) ? result.data[0] : result.data) };
  }
  if (body.action === 'delete') {
    const result = await supabase.rpc('commercial_invoice_delete_draft', { p_invoice_id: invoiceUuid, p_expected_revision: body.expectedRevision });
    if (result.error) throw result.error;
    return { deleted: true };
  }
  const result = await supabase.rpc('commercial_invoice_issue_draft', {
    p_invoice_id: invoiceUuid, p_expected_revision: body.expectedRevision,
    p_command_id: body.commandId, p_payment_instructions: paymentDetailsText('invoice'),
  });
  if (result.error) throw result.error;
  const row = Array.isArray(result.data) ? result.data[0] : result.data;
  const invoiceId = appIdFromUuid('inv', row.id);
  // Issuance committed before delivery. A send failure is an issued success with
  // an explicit retry instruction, never a reason to recreate the invoice.
  let sendError: string | null = null;
  if (body.send === true) {
    try { await sendDepositInvoiceNow(invoiceId, actor); }
    catch (error) { sendError = error instanceof Error ? error.message : 'Invoice issued, but sending failed'; }
  }
  return { issued: true, invoiceId, invoiceRef: row.invoice_ref, sendError };
}
