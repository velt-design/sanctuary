import 'server-only';

import { supabaseServiceRole } from '../supabaseClient';
import { appIdFromUuid } from '../supabase/mappers';

export type InvoiceScopeAssignment = {
  treatment: 'QUOTE_PAYMENT' | 'SEPARATE_CHARGE';
  quoteId: string | null;
  quoteRef: string | null;
};

export async function loadInvoiceScopeAssignments(projectUuid: string) {
  const result = await supabaseServiceRole.from('commercial_invoice_scope_assignments')
    .select('invoice_id,treatment,quote_id,quotes(quote_ref)').eq('project_id', projectUuid);
  if (result.error) throw new Error('Invoice scope reconciliation could not be loaded. Refresh before billing.');
  const assignments = new Map<string, InvoiceScopeAssignment>();
  for (const row of result.data ?? []) {
    if (row.treatment !== 'QUOTE_PAYMENT' && row.treatment !== 'SEPARATE_CHARGE') continue;
    const quote = Array.isArray(row.quotes) ? row.quotes[0] : row.quotes;
    assignments.set(String(row.invoice_id), {
      treatment: row.treatment,
      quoteId: row.quote_id ? appIdFromUuid('quote', String(row.quote_id)) : null,
      quoteRef: quote && typeof quote === 'object' && 'quote_ref' in quote ? String(quote.quote_ref) : null,
    });
  }
  return assignments;
}

export async function loadQuoteScopeFunding(versionUuid: string) {
  const result = await supabaseServiceRole.rpc('commercial_quote_scope_funding', { p_quote_version_id: versionUuid });
  const row = Array.isArray(result.data) ? result.data[0] : result.data;
  if (result.error || !row) throw new Error('Quote payment history could not be reconciled. Refresh before billing.');
  const paid = Number(row.paid_inc_gst_cents), open = Number(row.open_inc_gst_cents), carried = Number(row.carried_paid_inc_gst_cents);
  if (![paid, open, carried].every(Number.isSafeInteger)) throw new Error('Quote payment history returned invalid totals.');
  return { paidIncGstCents: paid, openIncGstCents: open, carriedPaidIncGstCents: carried };
}
