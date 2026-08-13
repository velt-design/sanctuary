import 'server-only';

import { insertCommercialAuditEvent } from '../commercial/audit';
import { paymentDetailsText } from '../payments/paymentDetails';
import { normalizeStoredQuotePaymentSchedule } from '../quotes/paymentSchedule';
import { appIdFromUuid, uuidFromAppId } from '../supabase/mappers';
import { supabaseServiceRole } from '../supabaseClient';
import { loadProjectPaymentLedger } from './paymentLedger';
import { projectInvoiceSchedule } from './paymentScheduleProjection';
import { listDepositInvoicesForProject, sendDepositInvoiceNow } from './server';
import type {
  AdminInvoiceCreateInput,
  DepositInvoiceSummary,
  ProjectInvoiceSchedule,
  QuoteInvoiceCreateResult,
} from './types';

function errorMessage(error: unknown, fallback: string): string {
  return typeof (error as { message?: unknown })?.message === 'string'
    ? String((error as { message: string }).message)
    : fallback;
}

function optionalText(value: unknown, maxLength: number): string | null {
  const text = typeof value === 'string' ? value.trim() : '';
  return text ? text.slice(0, maxLength) : null;
}

async function latestAcceptedQuoteVersions(projectUuid: string) {
  const quoteRes = await supabaseServiceRole
    .from('quotes')
    .select('id,quote_ref,commercial_scope_id')
    .eq('project_id', projectUuid);
  if (quoteRes.error) throw new Error(errorMessage(quoteRes.error, 'Failed to load project quotes'));
  const quotes = Array.isArray(quoteRes.data) ? quoteRes.data : [];
  const quoteIds = quotes.map((quote) => String(quote.id ?? '')).filter(Boolean);
  if (!quoteIds.length) return [];
  const versionRes = await supabaseServiceRole.from('quote_versions').select('*')
    .in('quote_id', quoteIds)
    .eq('status', 'ACCEPTED')
    .order('version_number', { ascending: false })
    .order('created_at', { ascending: false });
  if (versionRes.error) throw new Error(errorMessage(versionRes.error, 'Failed to load accepted quotes'));
  const quoteById = new Map(quotes.map((quote) => [String(quote.id), quote]));
  const seen = new Set<string>();
  return (Array.isArray(versionRes.data) ? versionRes.data : []).flatMap((version) => {
    const quoteId = String((version as any).quote_id ?? '');
    if (!quoteId || seen.has(quoteId)) return [];
    const quote = quoteById.get(quoteId);
    if (!quote) return [];
    seen.add(quoteId);
    return [{ quote: quote as any, version: version as any }];
  });
}

function emptySchedule(): ProjectInvoiceSchedule {
  return {
    acceptedQuoteVersionId: null,
    acceptedQuoteRef: null,
    acceptedQuoteVersionNumber: null,
    acceptedQuoteTotalIncGstCents: 0,
    invoicedIncGstCents: 0,
    paidIncGstCents: 0,
    outstandingIncGstCents: 0,
    remainingToInvoiceIncGstCents: 0,
    unallocatedCreditIncGstCents: 0,
    acceptedQuotes: [],
    terms: [],
  };
}

export async function getProjectInvoiceSchedule(
  projectId: string,
  options: { includePaymentEntries?: boolean } = {},
): Promise<ProjectInvoiceSchedule> {
  const projectUuid = uuidFromAppId(projectId, 'proj');
  const [acceptedQuotes, invoices] = await Promise.all([
    latestAcceptedQuoteVersions(projectUuid),
    listDepositInvoicesForProject(projectId),
  ]);
  if (!acceptedQuotes.length) return emptySchedule();

  const primary = acceptedQuotes.find((accepted) => !(accepted.quote as any).commercial_scope_id) ?? acceptedQuotes[0];
  const versionUuid = String(primary.version.id);
  const versionId = appIdFromUuid('qv', versionUuid);
  const invoiceRefsByUuid = new Map(
    invoices.map((invoice) => [uuidFromAppId(invoice.id, 'inv'), invoice.invoiceRef]),
  );
  const ledger = await loadProjectPaymentLedger({
    projectUuid,
    quoteVersionUuids: acceptedQuotes.map((accepted) => String(accepted.version.id)),
    invoiceRefsByUuid,
  });
  const acceptedScheduleQuotes = acceptedQuotes.map((accepted) => {
    const total = Number(accepted.version.total_inc_gst_cents ?? 0) || 0;
    const terms = normalizeStoredQuotePaymentSchedule(
      accepted.version.payment_terms,
      total,
      Number(accepted.version.deposit_percent ?? 50),
    );
    return {
      quoteVersionId: appIdFromUuid('qv', String(accepted.version.id)),
      quoteRef: String(accepted.quote.quote_ref ?? ''),
      quoteVersionNumber: Number(accepted.version.version_number ?? 0) || 0,
      commercialScopeKind: accepted.quote.commercial_scope_id ? 'add_on' as const : 'base' as const,
      totalIncGstCents: total,
      terms: terms.map((term) => ({
        id: term.id,
        label: term.label,
        amountIncGstCents: term.resolvedAmountIncGstCents,
      })),
    };
  });
  const primarySchedule = acceptedScheduleQuotes.find((quote) => quote.quoteVersionId === versionId)!;
  return projectInvoiceSchedule({
    acceptedQuotes: acceptedScheduleQuotes,
    acceptedQuoteVersionId: versionId,
    acceptedQuoteRef: primarySchedule.quoteRef,
    acceptedQuoteVersionNumber: primarySchedule.quoteVersionNumber,
    acceptedQuoteTotalIncGstCents: primarySchedule.totalIncGstCents,
    quoteTerms: primarySchedule.terms,
    planItems: ledger.planItems,
    invoices,
    paymentEntries: ledger.entries,
    allocations: ledger.allocations,
    includePaymentEntries: options.includePaymentEntries === true,
  });
}

export async function createAdminInvoice(
  params: Omit<AdminInvoiceCreateInput, 'clientIntentId'> & { clientIntentId: string; actor: string | null },
): Promise<QuoteInvoiceCreateResult> {
  const projectUuid = uuidFromAppId(params.projectId, 'proj');
  const quoteVersionUuid = uuidFromAppId(params.quoteVersionId, 'qv');
  const label = params.label.trim().slice(0, 240);
  if (label.length < 2) throw new Error('Invoice label is required');
  const dueDate = optionalText(params.dueDate, 10);
  if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) throw new Error('Due date must be YYYY-MM-DD');
  const rpc = await supabaseServiceRole.rpc('commercial_create_admin_invoice_idempotent', {
    p_project_id: projectUuid,
    p_quote_version_id: quoteVersionUuid,
    p_mode: params.mode,
    p_payment_term_id: optionalText(params.paymentTermId, 160),
    p_amount_inc_gst_cents: params.amountIncGstCents == null ? null : Math.trunc(params.amountIncGstCents),
    p_split_count: params.splitCount == null ? null : Math.trunc(params.splitCount),
    p_label: label,
    p_due_date: dueDate,
    p_reference: optionalText(params.reference, 240),
    p_payment_instructions: paymentDetailsText('invoice'),
    p_allow_over_invoice: params.allowOverInvoice === true,
    p_override_reason: optionalText(params.overrideReason, 1000),
    p_actor: params.actor,
    p_client_intent_id: params.clientIntentId,
  } as any);
  if (rpc.error) throw new Error(errorMessage(rpc.error, 'Failed to create invoice'));
  const row = Array.isArray(rpc.data) ? rpc.data[0] : rpc.data;
  const invoiceUuid = String((row as any)?.invoice_id ?? '');
  if (!invoiceUuid) throw new Error('Invoice was created but no identifier was returned');

  await insertCommercialAuditEvent({
    projectId: projectUuid,
    type: 'invoice.created',
    idempotencyKey: `invoice.created:${invoiceUuid}`,
    payload: {
      invoiceId: invoiceUuid,
      quoteVersionId: quoteVersionUuid,
      mode: params.mode,
      paymentTermId: params.paymentTermId ?? null,
      amountIncGstCents: params.amountIncGstCents ?? null,
      calculationBasis: params.calculationBasis ?? null,
      percentage: params.percentage ?? null,
      overInvoiceOverride: params.allowOverInvoice === true,
      overrideReason: params.overrideReason ?? null,
      actor: params.actor,
    },
  });

  const invoiceId = appIdFromUuid('inv', invoiceUuid);
  let sent = false;
  let sendError: string | null = null;
  if (params.sendNow) {
    try {
      await sendDepositInvoiceNow(invoiceId, params.actor);
      sent = true;
    } catch (error) {
      sendError = errorMessage(error, 'Invoice was created but not sent');
    }
  }
  const invoice = (await listDepositInvoicesForProject(params.projectId)).find((item) => item.id === invoiceId);
  if (!invoice) throw new Error('Invoice created but could not be reloaded');
  return {
    invoice,
    created: (row as any)?.replayed !== true,
    sent,
    alreadySent: false,
    sendError,
    plannedItemCount: Number((row as any)?.planned_item_count ?? 0),
    remainingBeforeIncGstCents: Number((row as any)?.remaining_before_inc_gst_cents ?? 0),
    remainingAfterIncGstCents: Number((row as any)?.remaining_after_inc_gst_cents ?? 0),
  };
}

export async function markInvoicePaid(params: {
  invoiceId: string;
  actor: string | null;
  paidAt?: string | null;
  reference?: string | null;
  method?: string | null;
  note?: string | null;
}): Promise<DepositInvoiceSummary> {
  const invoiceUuid = uuidFromAppId(params.invoiceId, 'inv');
  const invoiceRes = await supabaseServiceRole.from('deposit_invoices').select('project_id,status').eq('id', invoiceUuid).single();
  if (invoiceRes.error || !invoiceRes.data) throw new Error(errorMessage(invoiceRes.error, 'Invoice not found'));
  const paidAt = optionalText(params.paidAt, 40) ?? new Date().toISOString();
  if (!Number.isFinite(new Date(paidAt).getTime())) throw new Error('Paid date is invalid');
  const rpc = await supabaseServiceRole.rpc('commercial_mark_invoice_paid_and_record_payment', {
    p_invoice_id: invoiceUuid,
    p_actor: params.actor,
    p_paid_at: new Date(paidAt).toISOString(),
    p_reference: optionalText(params.reference, 240),
    p_method: optionalText(params.method, 80),
    p_note: optionalText(params.note, 1000),
  } as any);
  if (rpc.error) throw new Error(errorMessage(rpc.error, 'Failed to mark invoice paid'));
  await insertCommercialAuditEvent({
    projectId: String((invoiceRes.data as any).project_id),
    type: 'invoice.paid',
    idempotencyKey: `invoice.paid:${invoiceUuid}`,
    payload: { invoiceId: invoiceUuid, paidAt, actor: params.actor },
  });
  const projectId = appIdFromUuid('proj', String((invoiceRes.data as any).project_id));
  const updated = (await listDepositInvoicesForProject(projectId)).find((invoice) => invoice.id === params.invoiceId);
  if (!updated) throw new Error('Invoice paid but could not be reloaded');
  return updated;
}

export async function voidInvoice(params: {
  invoiceId: string;
  actor: string | null;
  reason: string;
}): Promise<DepositInvoiceSummary> {
  const reason = optionalText(params.reason, 1000);
  if (!reason || reason.length < 3) throw new Error('A void reason is required');
  const invoiceUuid = uuidFromAppId(params.invoiceId, 'inv');
  const invoiceRes = await supabaseServiceRole.from('deposit_invoices').select('*').eq('id', invoiceUuid).single();
  if (invoiceRes.error || !invoiceRes.data) throw new Error(errorMessage(invoiceRes.error, 'Invoice not found'));
  const current = invoiceRes.data as any;
  if (String(current.status).toUpperCase() !== 'OPEN') throw new Error('Only open invoices can be voided');
  const voidedAt = new Date().toISOString();
  const updateRes = await supabaseServiceRole.from('deposit_invoices').update({
    status: 'VOID',
    voided_at: voidedAt,
    voided_by: params.actor,
    void_reason: reason,
    portal_token_hash: null,
    portal_token_expires_at: null,
  } as any).eq('id', invoiceUuid).eq('status', 'OPEN').select('id').single();
  if (updateRes.error || !updateRes.data) throw new Error(errorMessage(updateRes.error, 'Failed to void invoice'));
  await insertCommercialAuditEvent({
    projectId: String(current.project_id),
    type: 'invoice.voided',
    payload: { invoiceId: invoiceUuid, quoteVersionId: current.quote_version_id, reason, actor: params.actor, voidedAt },
  });
  const projectId = appIdFromUuid('proj', String(current.project_id));
  const updated = (await listDepositInvoicesForProject(projectId)).find((invoice) => invoice.id === params.invoiceId);
  if (!updated) throw new Error('Invoice voided but could not be reloaded');
  return updated;
}
