import 'server-only';

import { insertCommercialAuditEvent } from '../commercial/audit';
import { paymentDetailsText } from '../payments/paymentDetails';
import { normalizeStoredQuotePaymentSchedule, paymentScheduleCompatibilityDepositPercent } from '../quotes/paymentSchedule';
import { appIdFromUuid, uuidFromAppId } from '../supabase/mappers';
import { supabaseServiceRole } from '../supabaseClient';
import { listDepositInvoicesForProject, sendDepositInvoiceNow } from './server';
import { summarizeQuoteVersionInvoices } from './invoiceSchedule';
import type { DepositInvoiceSummary, ProjectInvoiceSchedule, QuoteInvoiceCreateResult } from './types';

function errorMessage(error: unknown, fallback: string): string {
  return typeof (error as { message?: unknown })?.message === 'string'
    ? String((error as { message: string }).message)
    : fallback;
}

function dateOnly(value = new Date()): string {
  return value.toISOString().slice(0, 10);
}

function addDays(value: string, days: number): string {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return dateOnly(parsed);
}

function optionalText(value: unknown, maxLength: number): string | null {
  const text = typeof value === 'string' ? value.trim() : '';
  return text ? text.slice(0, maxLength) : null;
}

async function latestAcceptedQuoteVersion(projectUuid: string) {
  const quoteRes = await supabaseServiceRole.from('quotes').select('id,quote_ref').eq('project_id', projectUuid).maybeSingle();
  if (quoteRes.error) throw new Error(errorMessage(quoteRes.error, 'Failed to load project quote'));
  if (!quoteRes.data) return null;
  const versionRes = await supabaseServiceRole.from('quote_versions').select('*')
    .eq('quote_id', String(quoteRes.data.id))
    .eq('status', 'ACCEPTED')
    .order('version_number', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (versionRes.error) throw new Error(errorMessage(versionRes.error, 'Failed to load accepted quote'));
  return versionRes.data ? { quote: quoteRes.data as any, version: versionRes.data as any } : null;
}

export async function getProjectInvoiceSchedule(projectId: string): Promise<ProjectInvoiceSchedule> {
  const projectUuid = uuidFromAppId(projectId, 'proj');
  const [accepted, invoices] = await Promise.all([
    latestAcceptedQuoteVersion(projectUuid),
    listDepositInvoicesForProject(projectId),
  ]);
  if (!accepted) {
    return {
      acceptedQuoteTotalIncGstCents: 0,
      invoicedIncGstCents: 0,
      paidIncGstCents: 0,
      outstandingIncGstCents: 0,
      remainingToInvoiceIncGstCents: 0,
      terms: [],
    };
  }

  const versionUuid = String(accepted.version.id);
  const versionId = appIdFromUuid('qv', versionUuid);
  const summary = summarizeQuoteVersionInvoices(invoices, versionId);
  const activeInvoices = summary.active;
  const total = Number(accepted.version.total_inc_gst_cents ?? 0) || 0;
  const terms = normalizeStoredQuotePaymentSchedule(
    accepted.version.payment_terms,
    total,
    Number(accepted.version.deposit_percent ?? 50),
  );
  const invoicesByTerm = new Map(
    activeInvoices
      .map((invoice) => [invoice.paymentTermId, invoice]),
  );
  const latestInvoiced = terms.reduce(
    (sum, term) => sum + (invoicesByTerm.has(term.id) ? term.resolvedAmountIncGstCents : 0),
    0,
  );
  return {
    acceptedQuoteTotalIncGstCents: total,
    invoicedIncGstCents: summary.invoicedIncGstCents,
    paidIncGstCents: summary.paidIncGstCents,
    outstandingIncGstCents: summary.outstandingIncGstCents,
    remainingToInvoiceIncGstCents: Math.max(0, total - latestInvoiced),
    terms: terms.map((term, index) => ({
      quoteVersionId: versionId,
      quoteRef: String(accepted.quote.quote_ref ?? ''),
      quoteVersionNumber: Number(accepted.version.version_number ?? 0) || 0,
      paymentTermId: term.id,
      label: term.label,
      position: index + 1,
      termCount: terms.length,
      amountIncGstCents: term.resolvedAmountIncGstCents,
      invoice: invoicesByTerm.get(term.id) ?? null,
    })),
  };
}

export async function createScheduledInvoice(params: {
  projectId: string;
  quoteVersionId: string;
  paymentTermId: string;
  dueDate?: string | null;
  reference?: string | null;
  sendNow?: boolean;
  actor: string | null;
}): Promise<QuoteInvoiceCreateResult> {
  const projectUuid = uuidFromAppId(params.projectId, 'proj');
  const quoteVersionUuid = uuidFromAppId(params.quoteVersionId, 'qv');
  const versionRes = await supabaseServiceRole.from('quote_versions').select('*').eq('id', quoteVersionUuid).single();
  if (versionRes.error || !versionRes.data) throw new Error(errorMessage(versionRes.error, 'Quote version not found'));
  const version = versionRes.data as any;
  if (String(version.status).toUpperCase() !== 'ACCEPTED') throw new Error('Only accepted quotes can be invoiced');
  const total = Number(version.total_inc_gst_cents ?? 0) || 0;
  const terms = normalizeStoredQuotePaymentSchedule(version.payment_terms, total, Number(version.deposit_percent ?? 50));
  const termIndex = terms.findIndex((term) => term.id === params.paymentTermId);
  if (termIndex < 0) throw new Error('Payment term not found');

  const quoteRes = await supabaseServiceRole.from('quotes').select('id,quote_ref,project_id').eq('id', String(version.quote_id)).single();
  if (quoteRes.error || !quoteRes.data) throw new Error(errorMessage(quoteRes.error, 'Quote not found'));
  if (String((quoteRes.data as any).project_id) !== projectUuid) throw new Error('Quote does not belong to this project');

  const existingRes = await supabaseServiceRole.from('deposit_invoices').select('id')
    .eq('quote_version_id', quoteVersionUuid)
    .eq('payment_term_id', params.paymentTermId)
    .neq('status', 'VOID')
    .maybeSingle();
  if (existingRes.error) throw new Error(errorMessage(existingRes.error, 'Failed to check invoice'));
  if (existingRes.data) {
    const invoice = (await listDepositInvoicesForProject(params.projectId))
      .find((item) => item.id === appIdFromUuid('inv', String(existingRes.data!.id)));
    if (!invoice) throw new Error('Invoice already exists');
    return { invoice, created: false, sent: false, alreadySent: invoice.lastDeliveryStatus === 'SENT', sendError: null };
  }

  if (termIndex > 0) {
    const priorIds = terms.slice(0, termIndex).map((term) => term.id);
    const priorRes = await supabaseServiceRole.from('deposit_invoices').select('payment_term_id')
      .eq('quote_version_id', quoteVersionUuid).neq('status', 'VOID').in('payment_term_id', priorIds);
    if (priorRes.error) throw new Error(errorMessage(priorRes.error, 'Failed to check prior invoices'));
    const createdPriorIds = new Set((priorRes.data ?? []).map((row: any) => String(row.payment_term_id)));
    if (priorIds.some((id) => !createdPriorIds.has(id))) throw new Error('Create the earlier scheduled invoices first');
  }

  const [projectRes, refRes] = await Promise.all([
    supabaseServiceRole.from('projects').select('id,name,site_address').eq('id', projectUuid).single(),
    supabaseServiceRole.rpc('next_deposit_invoice_ref'),
  ]);
  if (projectRes.error || !projectRes.data) throw new Error(errorMessage(projectRes.error, 'Project not found'));
  if (refRes.error || !refRes.data) throw new Error(errorMessage(refRes.error, 'Failed to allocate invoice reference'));

  const term = terms[termIndex]!;
  const issueDate = dateOnly();
  const dueDate = optionalText(params.dueDate, 10) ?? addDays(issueDate, 7);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) throw new Error('Due date must be YYYY-MM-DD');
  const amountEx = Math.round(term.resolvedAmountIncGstCents / 1.15);
  const insertRes = await supabaseServiceRole.from('deposit_invoices').insert({
    project_id: projectUuid,
    quote_id: String(quoteRes.data.id),
    quote_version_id: quoteVersionUuid,
    quote_ref: String((quoteRes.data as any).quote_ref ?? ''),
    quote_version_number: Number(version.version_number ?? 0) || 0,
    invoice_ref: String(refRes.data),
    status: 'OPEN',
    issue_date: issueDate,
    due_date: dueDate,
    reference: optionalText(params.reference, 240) ?? `${term.label} for Quote ${String((quoteRes.data as any).quote_ref ?? '')}`,
    customer_name: optionalText(version.customer_name, 240),
    project_name: optionalText((projectRes.data as any).name, 240),
    project_address: optionalText((projectRes.data as any).site_address, 500),
    currency: 'NZD',
    deposit_percent: paymentScheduleCompatibilityDepositPercent([term], total),
    quote_total_inc_gst_cents: total,
    total_inc_gst_cents: term.resolvedAmountIncGstCents,
    total_ex_gst_cents: amountEx,
    gst_cents: term.resolvedAmountIncGstCents - amountEx,
    payment_instructions: paymentDetailsText('invoice'),
    created_by: params.actor,
    payment_term_id: term.id,
    payment_term_label: term.label,
    payment_term_position: termIndex + 1,
    payment_term_count: terms.length,
    payment_term_calculation: term.calculationType,
    payment_term_percentage: term.percentageOfRemainder,
  } as any).select('id').single();
  if (insertRes.error || !insertRes.data) throw new Error(errorMessage(insertRes.error, 'Failed to create invoice'));

  await insertCommercialAuditEvent({
    projectId: projectUuid,
    type: 'invoice.created',
    payload: { invoiceId: insertRes.data.id, quoteVersionId: quoteVersionUuid, paymentTermId: term.id, actor: params.actor },
  });
  const invoiceId = appIdFromUuid('inv', String(insertRes.data.id));
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
  return { invoice, created: true, sent, alreadySent: false, sendError };
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
  const invoiceRes = await supabaseServiceRole.from('deposit_invoices').select('*').eq('id', invoiceUuid).single();
  if (invoiceRes.error || !invoiceRes.data) throw new Error(errorMessage(invoiceRes.error, 'Invoice not found'));
  const current = invoiceRes.data as any;
  if (String(current.status).toUpperCase() === 'PAID') {
    const existing = (await listDepositInvoicesForProject(appIdFromUuid('proj', String(current.project_id))))
      .find((invoice) => invoice.id === params.invoiceId);
    if (!existing) throw new Error('Invoice not found');
    return existing;
  }
  if (String(current.status).toUpperCase() !== 'OPEN') throw new Error('Only open invoices can be marked paid');
  const paidAt = optionalText(params.paidAt, 40) ?? new Date().toISOString();
  if (!Number.isFinite(new Date(paidAt).getTime())) throw new Error('Paid date is invalid');
  const updateRes = await supabaseServiceRole.from('deposit_invoices').update({
    status: 'PAID', paid_at: new Date(paidAt).toISOString(), paid_by: params.actor,
    payment_reference: optionalText(params.reference, 240),
    payment_method: optionalText(params.method, 80),
    payment_note: optionalText(params.note, 1000),
  } as any).eq('id', invoiceUuid).eq('status', 'OPEN').select('*').single();
  if (updateRes.error || !updateRes.data) throw new Error(errorMessage(updateRes.error, 'Failed to mark invoice paid'));
  await insertCommercialAuditEvent({
    projectId: String(current.project_id), type: 'invoice.paid',
    payload: { invoiceId: invoiceUuid, paidAt: (updateRes.data as any).paid_at, actor: params.actor },
  });
  const projectId = appIdFromUuid('proj', String(current.project_id));
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
