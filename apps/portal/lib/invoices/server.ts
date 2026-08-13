import 'server-only';

import { appIdFromUuid, uuidFromAppId } from '../supabase/mappers';
import { generateAcceptToken } from '../quotes/acceptToken';
import { renderDepositInvoiceEmail } from '../emails/invoice';
import { sendTransactionalEmail } from '../emails/sendTransactionalEmail';
import {
  commercialEmailFailure,
  findCommercialEmailIntentByKey,
  markCommercialEmailDispatching,
  markCommercialEmailFailed,
  markCommercialEmailFinalised,
  markCommercialEmailProviderAccepted,
  prepareCommercialEmailIntent,
  type CommercialEmailIntent,
} from '../commercial/emailIntent';
import { insertCommercialAuditEvent } from '../commercial/audit';
import { paymentDetailsLines } from '../payments/paymentDetails';
import { supabaseServiceRole } from '../supabaseClient';
import { generateDepositInvoicePdfBytes, depositInvoicePdfFilename } from './pdf';
import { resolveDepositInvoicePaymentLines } from './invoiceArtifactViewModel';
import { buildDepositInvoiceEmailInput } from './emailPresentation';
import { parseFrozenInvoiceEmail, redactInvoiceToken, type FrozenInvoiceEmail, type InvoiceRecipientLists } from './deliveryIntent';
import { preparedDepositInvoicePreview, prospectiveDepositInvoicePreview } from './staffPreview';
import type { DepositInvoiceArtifactPreview, DepositInvoiceSummary } from './types';
import { normalizeStoredQuotePaymentSchedule, type QuotePaymentTerm } from '../quotes/paymentSchedule';

const REPLY_TO_EMAIL = 'info@sanctuarypergolas.co.nz';

type DepositInvoiceRow = {
  id: string;
  project_id: string;
  quote_id: string;
  quote_version_id: string;
  quote_ref: string;
  quote_version_number: number;
  invoice_ref: string;
  status: 'OPEN' | 'PAID' | 'VOID';
  payment_term_id: string;
  payment_term_label: string;
  payment_term_position: number;
  payment_term_count: number;
  payment_term_calculation: 'fixed' | 'percentage';
  payment_term_percentage: number | null;
  issue_date: string;
  due_date: string;
  reference: string | null;
  customer_name: string | null;
  project_name: string | null;
  project_address: string | null;
  deposit_percent: number;
  quote_total_inc_gst_cents: number;
  total_inc_gst_cents: number;
  total_ex_gst_cents: number;
  gst_cents: number;
  payment_instructions: string | null;
  portal_token_hash: string | null;
  portal_token_expires_at: string | null;
  pdf_file_id: string | null;
  sent_at: string | null;
  sent_by: string | null;
  paid_at: string | null;
  paid_by: string | null;
  payment_reference: string | null;
  payment_method: string | null;
  payment_note: string | null;
  voided_by: string | null;
  created_at: string;
  updated_at: string;
  voided_at: string | null;
  void_reason: string | null;
};

type AcceptedQuoteContext = {
  quoteVersionUuid: string;
  quoteUuid: string;
  projectUuid: string;
  quoteRef: string;
  quoteVersionNumber: number;
  status: string;
  depositPercent: number;
  quoteTotalIncGstCents: number;
  paymentTerms: QuotePaymentTerm[];
  customerName: string | null;
  projectName: string | null;
  projectAddress: string | null;
  contactEmail: string | null;
};

type RecipientLists = InvoiceRecipientLists;

type SendAttemptInfo = { attemptNumber: number; firstAttemptAt: string };

type DepositInvoiceSendLogRow = {
  deposit_invoice_id: string;
  to_emails: string[];
  cc_emails: string[];
  bcc_emails: string[];
  status: 'SENT' | 'FAILED';
  error_message: string | null;
  created_at: string;
  sent_at: string | null;
  next_retry_at: string | null;
  final_failure: boolean;
};

type DepositInvoiceDeliveryResult = {
  delivered: boolean;
  alreadySent: boolean;
  retryScheduled: boolean;
  error: string | null;
  nextRetryAt: string | null;
  finalFailure: boolean;
};

function nowIso(): string {
  return new Date().toISOString();
}
function parseDateOnly(dateOnly: string): Date | null {
  const parsed = new Date(`${dateOnly}T23:59:59.999Z`);
  if (!Number.isFinite(parsed.getTime())) return null;
  return parsed;
}

function parsePercent(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value ?? 0);
  if (!Number.isFinite(n)) return 50;
  return Math.max(0, Math.min(100, Math.round(n * 100) / 100));
}

function normalizeRecipients(list: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of list) {
    const email = String(raw ?? '').trim();
    if (!email) continue;
    const key = email.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(email);
  }
  return out;
}

function normalizeStatus(value: unknown): 'OPEN' | 'PAID' | 'VOID' {
  const normalized = String(value ?? '').toUpperCase();
  if (normalized === 'VOID' || normalized === 'PAID') return normalized;
  return 'OPEN';
}

function missingTableError(error: any): boolean {
  const code = typeof error?.code === 'string' ? error.code.trim() : '';
  const message = typeof error?.message === 'string' ? error.message.toLowerCase() : '';
  return (
    code === 'PGRST204' ||
    message.includes('does not exist') ||
    message.includes('schema cache') ||
    message.includes('relation') ||
    message.includes('function')
  );
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  const message = typeof (error as any)?.message === 'string' ? String((error as any).message) : '';
  if (message) return message;
  const alt = typeof (error as any)?.error === 'string' ? String((error as any).error) : '';
  return alt || fallback;
}

function pickSiteUrl(): string {
  const raw =
    process.env.PUBLIC_SITE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.NEXT_PUBLIC_MARKETING_SITE_URL?.trim() ||
    '';
  if (!raw) throw new Error('Missing env var: PUBLIC_SITE_URL');
  const normalized = raw.replace(/\/+$/, '');
  try {
    const parsed = new URL(normalized);
    return parsed.toString().replace(/\/+$/, '');
  } catch {
    throw new Error('PUBLIC_SITE_URL must be a valid absolute URL');
  }
}

function invoiceLink(invoiceUuid: string, token: string): string {
  const base = pickSiteUrl();
  return `${base}/invoice/${encodeURIComponent(invoiceUuid)}?token=${encodeURIComponent(token)}`;
}

function invoicePaymentLines(invoice: DepositInvoiceRow): string[] {
  return resolveDepositInvoicePaymentLines(invoice.payment_instructions, paymentDetailsLines('invoice'));
}

async function insertAuditEvent(params: {
  projectId: string;
  type: string;
  payload?: unknown;
  idempotencyKey?: string;
}) {
  return insertCommercialAuditEvent(params);
}

function mapInvoiceRow(row: any): DepositInvoiceRow {
  return {
    id: String(row?.id ?? ''),
    project_id: String(row?.project_id ?? ''),
    quote_id: String(row?.quote_id ?? ''),
    quote_version_id: String(row?.quote_version_id ?? ''),
    quote_ref: String(row?.quote_ref ?? ''),
    quote_version_number: Number(row?.quote_version_number ?? 0) || 0,
    invoice_ref: String(row?.invoice_ref ?? ''),
    status: normalizeStatus(row?.status),
    payment_term_id: String(row?.payment_term_id ?? 'payment-1'),
    payment_term_label: String(row?.payment_term_label ?? 'Initial payment'),
    payment_term_position: Number(row?.payment_term_position ?? 1) || 1,
    payment_term_count: Number(row?.payment_term_count ?? 1) || 1,
    payment_term_calculation: row?.payment_term_calculation === 'fixed' ? 'fixed' : 'percentage',
    payment_term_percentage: row?.payment_term_percentage === null || row?.payment_term_percentage === undefined
      ? null
      : parsePercent(row.payment_term_percentage),
    issue_date: String(row?.issue_date ?? ''),
    due_date: String(row?.due_date ?? ''),
    reference: typeof row?.reference === 'string' ? row.reference : null,
    customer_name: typeof row?.customer_name === 'string' ? row.customer_name : null,
    project_name: typeof row?.project_name === 'string' ? row.project_name : null,
    project_address: typeof row?.project_address === 'string' ? row.project_address : null,
    deposit_percent: parsePercent(row?.deposit_percent),
    quote_total_inc_gst_cents: Number(row?.quote_total_inc_gst_cents ?? 0) || 0,
    total_inc_gst_cents: Number(row?.total_inc_gst_cents ?? 0) || 0,
    total_ex_gst_cents: Number(row?.total_ex_gst_cents ?? 0) || 0,
    gst_cents: Number(row?.gst_cents ?? 0) || 0,
    payment_instructions: typeof row?.payment_instructions === 'string' ? row.payment_instructions : null,
    portal_token_hash: typeof row?.portal_token_hash === 'string' ? row.portal_token_hash : null,
    portal_token_expires_at: typeof row?.portal_token_expires_at === 'string' ? row.portal_token_expires_at : null,
    pdf_file_id: typeof row?.pdf_file_id === 'string' ? row.pdf_file_id : null,
    sent_at: typeof row?.sent_at === 'string' ? row.sent_at : null,
    sent_by: typeof row?.sent_by === 'string' ? row.sent_by : null,
    paid_at: typeof row?.paid_at === 'string' ? row.paid_at : null,
    paid_by: typeof row?.paid_by === 'string' ? row.paid_by : null,
    payment_reference: typeof row?.payment_reference === 'string' ? row.payment_reference : null,
    payment_method: typeof row?.payment_method === 'string' ? row.payment_method : null,
    payment_note: typeof row?.payment_note === 'string' ? row.payment_note : null,
    voided_by: typeof row?.voided_by === 'string' ? row.voided_by : null,
    created_at: typeof row?.created_at === 'string' ? row.created_at : nowIso(),
    updated_at: typeof row?.updated_at === 'string' ? row.updated_at : nowIso(),
    voided_at: typeof row?.voided_at === 'string' ? row.voided_at : null,
    void_reason: typeof row?.void_reason === 'string' ? row.void_reason : null,
  };
}

function mapSendLogRow(row: any): DepositInvoiceSendLogRow {
  return {
    deposit_invoice_id: String(row?.deposit_invoice_id ?? ''),
    to_emails: normalizeRecipients(Array.isArray(row?.to_emails) ? row.to_emails : []),
    cc_emails: normalizeRecipients(Array.isArray(row?.cc_emails) ? row.cc_emails : []),
    bcc_emails: normalizeRecipients(Array.isArray(row?.bcc_emails) ? row.bcc_emails : []),
    status: String(row?.status ?? '').toUpperCase() === 'SENT' ? 'SENT' : 'FAILED',
    error_message: typeof row?.error_message === 'string' ? row.error_message : null,
    created_at: typeof row?.created_at === 'string' ? row.created_at : nowIso(),
    sent_at: typeof row?.sent_at === 'string' ? row.sent_at : null,
    next_retry_at: typeof row?.next_retry_at === 'string' ? row.next_retry_at : null,
    final_failure: Boolean(row?.final_failure),
  };
}

function mapInvoiceSummary(invoice: DepositInvoiceRow, latestAttempt: DepositInvoiceSendLogRow | null): DepositInvoiceSummary {
  return {
    id: appIdFromUuid('inv', invoice.id),
    projectId: appIdFromUuid('proj', invoice.project_id),
    quoteId: appIdFromUuid('qt', invoice.quote_id),
    quoteVersionId: appIdFromUuid('qv', invoice.quote_version_id),
    quoteRef: invoice.quote_ref,
    quoteVersionNumber: invoice.quote_version_number,
    invoiceRef: invoice.invoice_ref,
    status: invoice.status,
    paymentTermId: invoice.payment_term_id,
    paymentTermLabel: invoice.payment_term_label,
    paymentTermPosition: invoice.payment_term_position,
    paymentTermCount: invoice.payment_term_count,
    paymentTermCalculation: invoice.payment_term_calculation,
    paymentTermPercentage: invoice.payment_term_percentage,
    issueDate: invoice.issue_date,
    dueDate: invoice.due_date,
    reference: invoice.reference,
    customerName: invoice.customer_name,
    projectName: invoice.project_name,
    projectAddress: invoice.project_address,
    depositPercent: invoice.deposit_percent,
    totalIncGstCents: invoice.total_inc_gst_cents,
    totalExGstCents: invoice.total_ex_gst_cents,
    gstCents: invoice.gst_cents,
    createdAt: invoice.created_at,
    sentAt: invoice.sent_at,
    paidAt: invoice.paid_at,
    paidBy: invoice.paid_by,
    paymentReference: invoice.payment_reference,
    paymentMethod: invoice.payment_method,
    paymentNote: invoice.payment_note,
    voidedAt: invoice.voided_at,
    voidedBy: invoice.voided_by,
    voidReason: invoice.void_reason,
    lastDeliveryStatus: latestAttempt?.status ?? 'NOT_SENT',
    lastDeliveryError: latestAttempt?.error_message ?? null,
    lastDeliveryAttemptAt: latestAttempt ? latestAttempt.sent_at ?? latestAttempt.created_at : null,
    nextRetryAt: latestAttempt?.next_retry_at ?? null,
    finalFailure: latestAttempt?.final_failure ?? false,
    recipients: latestAttempt
      ? normalizeRecipients([...latestAttempt.to_emails, ...latestAttempt.cc_emails, ...latestAttempt.bcc_emails])
      : [],
  };
}

async function loadAcceptedQuoteContext(quoteVersionUuid: string): Promise<AcceptedQuoteContext | null> {
  const versionRes = await supabaseServiceRole
    .from('quote_versions')
    .select('id, quote_id, status, version_number, deposit_percent, payment_terms, total_inc_gst_cents, customer_name')
    .eq('id', quoteVersionUuid)
    .single();

  if (versionRes.error || !versionRes.data) {
    if (missingTableError(versionRes.error)) return null;
    throw new Error(errorMessage(versionRes.error, 'Failed to load quote version'));
  }

  const quoteUuid = String((versionRes.data as any).quote_id ?? '');
  if (!quoteUuid) return null;

  const quoteRes = await supabaseServiceRole
    .from('quotes')
    .select('id, quote_ref, project_id')
    .eq('id', quoteUuid)
    .single();

  if (quoteRes.error || !quoteRes.data) {
    if (missingTableError(quoteRes.error)) return null;
    throw new Error(errorMessage(quoteRes.error, 'Failed to load quote'));
  }

  const projectUuid = String((quoteRes.data as any).project_id ?? '');
  if (!projectUuid) return null;

  const projectRes = await supabaseServiceRole
    .from('projects')
    .select('id, name, site_address, contacts ( name, email )')
    .eq('id', projectUuid)
    .maybeSingle();

  if (projectRes.error) {
    if (missingTableError(projectRes.error)) return null;
    throw new Error(errorMessage(projectRes.error, 'Failed to load project'));
  }

  const projectRow = projectRes.data as any;
  const contactRow = Array.isArray(projectRow?.contacts) ? projectRow.contacts[0] : projectRow?.contacts ?? null;

  const fallbackCustomerName = typeof contactRow?.name === 'string' ? contactRow.name.trim() : '';
  const customerNameRaw =
    typeof (versionRes.data as any).customer_name === 'string' ? String((versionRes.data as any).customer_name).trim() : '';
  const customerName = customerNameRaw || fallbackCustomerName || null;

  const contactEmail = typeof contactRow?.email === 'string' ? contactRow.email.trim() : null;

  return {
    quoteVersionUuid,
    quoteUuid,
    projectUuid,
    quoteRef: String((quoteRes.data as any).quote_ref ?? ''),
    quoteVersionNumber: Number((versionRes.data as any).version_number ?? 0) || 0,
    status: String((versionRes.data as any).status ?? '').toUpperCase(),
    depositPercent: parsePercent((versionRes.data as any).deposit_percent),
    quoteTotalIncGstCents: Number((versionRes.data as any).total_inc_gst_cents ?? 0) || 0,
    paymentTerms: normalizeStoredQuotePaymentSchedule(
      (versionRes.data as any).payment_terms,
      Number((versionRes.data as any).total_inc_gst_cents ?? 0) || 0,
      parsePercent((versionRes.data as any).deposit_percent),
    ),
    customerName,
    projectName: typeof projectRow?.name === 'string' ? projectRow.name : null,
    projectAddress: typeof projectRow?.site_address === 'string' ? projectRow.site_address : null,
    contactEmail,
  };
}

async function loadOpenInvoiceByQuoteVersion(
  quoteVersionUuid: string,
): Promise<DepositInvoiceRow | null> {
  const res = await supabaseServiceRole
    .from('deposit_invoices')
    .select('*')
    .eq('quote_version_id', quoteVersionUuid)
    .eq('status', 'OPEN')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (res.error || !res.data) {
    if (res.error && !missingTableError(res.error)) {
      throw new Error(errorMessage(res.error, 'Failed to load deposit invoice'));
    }
    return null;
  }

  return mapInvoiceRow(res.data);
}

async function loadInvoiceById(invoiceUuid: string): Promise<DepositInvoiceRow | null> {
  const res = await supabaseServiceRole.from('deposit_invoices').select('*').eq('id', invoiceUuid).maybeSingle();
  if (res.error || !res.data) {
    if (res.error && !missingTableError(res.error)) {
      throw new Error(errorMessage(res.error, 'Failed to load deposit invoice'));
    }
    return null;
  }
  return mapInvoiceRow(res.data);
}

async function loadRecipients(quoteVersionUuid: string, fallbackEmail: string | null): Promise<RecipientLists> {
  const logRes = await supabaseServiceRole
    .from('quote_send_logs')
    .select('to_emails, cc_emails, bcc_emails')
    .eq('quote_version_id', quoteVersionUuid)
    .eq('status', 'SENT')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const log = logRes.data as any;
  const to = normalizeRecipients(Array.isArray(log?.to_emails) ? log.to_emails : []);
  const cc = normalizeRecipients(Array.isArray(log?.cc_emails) ? log.cc_emails : []);
  const bcc = normalizeRecipients(Array.isArray(log?.bcc_emails) ? log.bcc_emails : []);

  if (to.length) return { to, cc, bcc };

  const fallback = fallbackEmail?.trim() ? [fallbackEmail.trim()] : [];
  if (!fallback.length) throw new Error('No recipient email is available for deposit invoice delivery');

  return { to: fallback, cc: [], bcc };
}

async function loadFileContent(fileUuid: string): Promise<{ filename: string; content: Buffer } | null> {
  const res = await supabaseServiceRole.from('file_artifacts').select('filename, content_base64').eq('id', fileUuid).single();
  if (res.error) {
    if (missingTableError(res.error)) return null;
    throw new Error(errorMessage(res.error, 'Failed to load invoice PDF'));
  }
  if (!res.data) return null;
  const filename = String((res.data as any).filename ?? 'invoice.pdf');
  const base64 = String((res.data as any).content_base64 ?? '');
  return { filename, content: Buffer.from(base64, 'base64') };
}

async function loadPreviewAttachmentNames(fileIds: readonly string[]): Promise<string[]> {
  const ids = fileIds.filter(Boolean);
  if (!ids.length) return [];
  const res = await supabaseServiceRole.from('file_artifacts').select('id,filename').in('id', ids);
  if (res.error) {
    throw new Error(errorMessage(res.error, 'Failed to load invoice attachment names'));
  }
  const namesById = new Map(
    (Array.isArray(res.data) ? res.data : []).map((row: any) => [String(row?.id ?? ''), String(row?.filename ?? 'deposit-invoice.pdf')])
  );
  return ids.map((id) => namesById.get(id) ?? 'Attachment unavailable');
}

function invoiceArtifactInput(invoice: DepositInvoiceRow) {
  return {
    invoiceRef: invoice.invoice_ref,
    quoteRef: invoice.quote_ref,
    quoteVersionNumber: invoice.quote_version_number,
    customerName: invoice.customer_name,
    projectName: invoice.project_name,
    projectAddress: invoice.project_address,
    issueDate: invoice.issue_date,
    dueDate: invoice.due_date,
    depositPercent: invoice.deposit_percent,
    paymentTermLabel: invoice.payment_term_label,
    paymentTermCalculation: invoice.payment_term_calculation,
    paymentTermPercentage: invoice.payment_term_percentage,
    quoteTotalIncGstCents: invoice.quote_total_inc_gst_cents,
    totalIncGstCents: invoice.total_inc_gst_cents,
    totalExGstCents: invoice.total_ex_gst_cents,
    gstCents: invoice.gst_cents,
  };
}

async function ensureInvoicePdf(invoice: DepositInvoiceRow, actor: string | null): Promise<{ fileUuid: string; filename: string; content: Buffer }> {
  if (invoice.pdf_file_id) {
    const existing = await loadFileContent(invoice.pdf_file_id);
    if (existing) return { fileUuid: invoice.pdf_file_id, filename: existing.filename, content: existing.content };
  }

  const bytes = await generateDepositInvoicePdfBytes(invoiceArtifactInput(invoice), {
    paymentLines: invoicePaymentLines(invoice),
  });

  const filename = depositInvoicePdfFilename(invoice.invoice_ref);
  const base64 = Buffer.from(bytes).toString('base64');

  const fileRes = await supabaseServiceRole
    .from('file_artifacts')
    .insert({
      project_id: invoice.project_id,
      filename,
      content_type: 'application/pdf',
      size_bytes: bytes.length,
      content_base64: base64,
      created_by: actor,
    } as any)
    .select('id')
    .single();

  if (fileRes.error || !fileRes.data) {
    throw new Error(errorMessage(fileRes.error, 'Failed to store invoice PDF'));
  }

  const fileUuid = String((fileRes.data as any).id ?? '');
  const patchRes = await supabaseServiceRole.from('deposit_invoices').update({ pdf_file_id: fileUuid } as any).eq('id', invoice.id);
  if (patchRes.error) throw new Error(errorMessage(patchRes.error, 'Failed to link invoice PDF'));

  return { fileUuid, filename, content: Buffer.from(bytes) };
}

async function latestSendAttempt(invoiceId: string): Promise<SendAttemptInfo> {
  const latest = await supabaseServiceRole
    .from('deposit_invoice_send_logs')
    .select('attempt_number, first_attempt_at')
    .eq('deposit_invoice_id', invoiceId)
    .order('attempt_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latest.error || !latest.data) return { attemptNumber: 1, firstAttemptAt: nowIso() };

  const attempt = Number((latest.data as any).attempt_number ?? 0) || 0;
  const firstAttemptAt =
    typeof (latest.data as any).first_attempt_at === 'string' ? String((latest.data as any).first_attempt_at) : nowIso();

  return { attemptNumber: attempt + 1, firstAttemptAt };
}

async function loadLatestSendLogForInvoice(invoiceId: string): Promise<DepositInvoiceSendLogRow | null> {
  const latest = await supabaseServiceRole
    .from('deposit_invoice_send_logs')
    .select('deposit_invoice_id,to_emails,cc_emails,bcc_emails,status,error_message,created_at,sent_at,next_retry_at,final_failure')
    .eq('deposit_invoice_id', invoiceId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latest.error || !latest.data) {
    if (latest.error && !missingTableError(latest.error)) {
      throw new Error(errorMessage(latest.error, 'Failed to load invoice send status'));
    }
    return null;
  }

  return mapSendLogRow(latest.data);
}

async function insertSendLog(params: {
  invoice: DepositInvoiceRow;
  recipients: RecipientLists;
  subject: string;
  bodyHtml: string | null;
  bodyText: string | null;
  attachmentFileIds: string[];
  providerMessageId: string | null;
  status: 'SENT' | 'FAILED';
  actor: string | null;
  sentAt: string | null;
  errorMessage?: string | null;
  attemptNumber: number;
  firstAttemptAt: string;
  nextRetryAt?: string | null;
  finalFailure?: boolean;
  deliveryIntentId?: string | null;
}) {
  const res = await supabaseServiceRole.from('deposit_invoice_send_logs').insert({
    deposit_invoice_id: params.invoice.id,
    project_id: params.invoice.project_id,
    from_name: 'Sanctuary Pergolas',
    from_email: REPLY_TO_EMAIL,
    reply_to_email: REPLY_TO_EMAIL,
    to_emails: params.recipients.to,
    cc_emails: params.recipients.cc,
    bcc_emails: params.recipients.bcc,
    subject: params.subject,
    body_html: params.bodyHtml,
    body_text: params.bodyText,
    attachment_file_ids: params.attachmentFileIds,
    provider: 'resend',
    provider_message_id: params.providerMessageId,
    status: params.status,
    error_message: params.errorMessage ?? null,
    attempt_number: params.attemptNumber,
    first_attempt_at: params.firstAttemptAt,
    next_retry_at: params.nextRetryAt ?? null,
    final_failure: params.finalFailure ?? false,
    delivery_intent_id: params.deliveryIntentId ?? null,
    created_by: params.actor,
    sent_at: params.sentAt,
  } as any);

  if (res.error) {
    if (
      params.deliveryIntentId &&
      String((res.error as { code?: unknown }).code ?? '') === '23505'
    ) {
      return;
    }
    throw new Error(errorMessage(res.error, 'Failed to log invoice email attempt'));
  }
}

async function hasSuccessfulSend(invoiceId: string): Promise<boolean> {
  const res = await supabaseServiceRole
    .from('deposit_invoice_send_logs')
    .select('id')
    .eq('deposit_invoice_id', invoiceId)
    .eq('status', 'SENT')
    .limit(1)
    .maybeSingle();

  return Boolean(res.data && !res.error);
}

async function markInvoiceSent(invoice: DepositInvoiceRow, patch: { actor: string | null; sentAt: string; tokenHash: string; tokenExpiresAt: string }) {
  const res = await supabaseServiceRole
    .from('deposit_invoices')
    .update({
      sent_at: invoice.sent_at ?? patch.sentAt,
      sent_by: patch.actor,
      portal_token_hash: patch.tokenHash,
      portal_token_expires_at: patch.tokenExpiresAt,
    } as any)
    .eq('id', invoice.id);

  if (res.error) throw new Error(errorMessage(res.error, 'Failed to update invoice send state'));
}

async function recordInvoiceDeliveryFailure(params: {
  invoice: DepositInvoiceRow;
  intent: CommercialEmailIntent;
  frozen: FrozenInvoiceEmail;
  message: string;
  errorCode: string;
  needsAttention: boolean;
}): Promise<void> {
  const attempt = await latestSendAttempt(params.invoice.id);
  await insertSendLog({
    invoice: params.invoice,
    recipients: params.frozen.recipients,
    subject: params.frozen.subject,
    bodyHtml: null,
    bodyText: null,
    attachmentFileIds: params.frozen.attachmentFileIds,
    providerMessageId: null,
    status: 'FAILED',
    actor: params.frozen.actor,
    sentAt: null,
    errorMessage: params.message,
    attemptNumber: attempt.attemptNumber,
    firstAttemptAt: attempt.firstAttemptAt,
    nextRetryAt: null,
    finalFailure: params.needsAttention,
    deliveryIntentId: params.needsAttention ? params.intent.id : null,
  });
  await insertAuditEvent({
    projectId: params.invoice.project_id,
    type: params.needsAttention
      ? 'invoice.send_needs_attention'
      : 'invoice.send_failed',
    idempotencyKey: params.needsAttention
      ? `invoice.send_needs_attention:${params.intent.id}`
      : `invoice.send_failed:${params.intent.id}:${attempt.attemptNumber}`,
    payload: {
      depositInvoiceId: params.invoice.id,
      quoteVersionId: params.invoice.quote_version_id,
      deliveryIntentId: params.intent.id,
      errorCode: params.errorCode,
    },
  });
}

async function prepareInvoiceEmailIntent(
  invoice: DepositInvoiceRow,
  recipients: RecipientLists,
  actor: string | null,
  intentKey: string,
): Promise<CommercialEmailIntent> {
  const sentAt = nowIso();
  const tokenExpiry = (() => {
    const parsed = parseDateOnly(invoice.due_date);
    if (parsed) {
      parsed.setUTCDate(parsed.getUTCDate() + 30);
      return parsed.toISOString();
    }
    const fallback = new Date(sentAt);
    fallback.setUTCDate(fallback.getUTCDate() + 30);
    return fallback.toISOString();
  })();
  const { token, tokenHash } = generateAcceptToken();
  const pdf = await ensureInvoicePdf(invoice, actor);
  const subject = `${invoice.payment_term_label} invoice - ${invoice.invoice_ref}`;
  const rendered = await renderDepositInvoiceEmail(
    buildDepositInvoiceEmailInput({
      invoiceRef: invoice.invoice_ref,
      quoteRef: invoice.quote_ref,
      quoteVersionNumber: invoice.quote_version_number,
      customerName: invoice.customer_name,
      projectName: invoice.project_name,
      projectAddress: invoice.project_address,
      issueDate: invoice.issue_date,
      dueDate: invoice.due_date,
      depositPercent: invoice.deposit_percent,
      paymentTermLabel: invoice.payment_term_label,
      paymentTermCalculation: invoice.payment_term_calculation,
      paymentTermPercentage: invoice.payment_term_percentage,
      quoteTotalIncGstCents: invoice.quote_total_inc_gst_cents,
      totalIncGstCents: invoice.total_inc_gst_cents,
      totalExGstCents: invoice.total_ex_gst_cents,
      gstCents: invoice.gst_cents,
      recipients,
      subject,
      invoiceLink: invoiceLink(invoice.id, token),
      paymentLines: invoicePaymentLines(invoice),
      referenceId: invoice.reference ?? undefined,
      attachmentNames: [pdf.filename],
      attachments: [
        {
          filename: pdf.filename,
          content: pdf.content,
          contentType: 'application/pdf',
        },
      ],
    })
  );
  return prepareCommercialEmailIntent({
    intentKey,
    kind: 'deposit_invoice_send',
    subjectId: invoice.id,
    projectId: invoice.project_id,
    protectedPayload: {
      sentAt,
      tokenHash,
      tokenExpiresAt: tokenExpiry,
      to: recipients.to,
      cc: recipients.cc,
      bcc: recipients.bcc,
      subject,
      html: rendered.html,
      text: rendered.text ?? null,
      attachmentFileIds: [pdf.fileUuid],
      actor,
    },
  });
}

async function deliverInvoiceEmailDurably(
  invoice: DepositInvoiceRow,
  recipients: RecipientLists,
  actor: string | null,
): Promise<DepositInvoiceDeliveryResult> {
  if (invoice.status !== 'OPEN') {
    return {
      delivered: false,
      alreadySent: false,
      retryScheduled: false,
      error: 'Deposit invoice is no longer open',
      nextRetryAt: null,
      finalFailure: true,
    };
  }
  if (await hasSuccessfulSend(invoice.id)) {
    return {
      delivered: true,
      alreadySent: true,
      retryScheduled: false,
      error: null,
      nextRetryAt: null,
      finalFailure: false,
    };
  }

  const intentKey = `deposit-invoice-send:${invoice.id}`;
  let intent =
    (await findCommercialEmailIntentByKey(intentKey)) ??
    (await prepareInvoiceEmailIntent(invoice, recipients, actor, intentKey));
  const frozen = parseFrozenInvoiceEmail(intent);
  if (intent.status === 'finalised') {
    return {
      delivered: true,
      alreadySent: true,
      retryScheduled: false,
      error: null,
      nextRetryAt: null,
      finalFailure: false,
    };
  }
  if (intent.status === 'needs_attention') {
    await recordInvoiceDeliveryFailure({
      invoice,
      intent,
      frozen,
      message: 'Delivery needs staff attention before another attempt',
      errorCode: intent.lastErrorCode ?? 'DELIVERY_NEEDS_ATTENTION',
      needsAttention: true,
    });
    return {
      delivered: false,
      alreadySent: false,
      retryScheduled: false,
      error: 'Delivery needs staff attention before another attempt',
      nextRetryAt: null,
      finalFailure: true,
    };
  }

  let providerMessage = intent.providerMessageId;
  if (intent.status !== 'provider_accepted') {
    intent = await markCommercialEmailDispatching(intent.id);
    if (intent.status === 'needs_attention') {
      await recordInvoiceDeliveryFailure({
        invoice,
        intent,
        frozen,
        message: 'Delivery needs staff attention before another attempt',
        errorCode: intent.lastErrorCode ?? 'DELIVERY_NEEDS_ATTENTION',
        needsAttention: true,
      });
      return {
        delivered: false,
        alreadySent: false,
        retryScheduled: false,
        error: 'Delivery needs staff attention before another attempt',
        nextRetryAt: null,
        finalFailure: true,
      };
    }
    try {
      const pdf = await loadFileContent(frozen.attachmentFileIds[0] ?? '');
      if (!pdf) throw new Error('Prepared deposit invoice PDF is unavailable');
      const response = await sendTransactionalEmail({
        to: frozen.recipients.to,
        cc: frozen.recipients.cc,
        bcc: frozen.recipients.bcc,
        subject: frozen.subject,
        html: frozen.html,
        text: frozen.text ?? undefined,
        attachments: [
          {
            filename: pdf.filename,
            content: pdf.content,
            contentType: 'application/pdf',
          },
        ],
        idempotencyKey: intent.providerIdempotencyKey,
      });
      providerMessage = response.providerMessageId;
      intent = await markCommercialEmailProviderAccepted(
        intent.id,
        providerMessage,
      );
      if (intent.status === 'needs_attention') {
        await recordInvoiceDeliveryFailure({
          invoice,
          intent,
          frozen,
          message: 'Email provider response needs staff attention',
          errorCode:
            intent.lastErrorCode ?? 'PROVIDER_MESSAGE_ID_CONFLICT',
          needsAttention: true,
        });
        return {
          delivered: false,
          alreadySent: false,
          retryScheduled: false,
          error: 'Email provider response needs staff attention',
          nextRetryAt: null,
          finalFailure: true,
        };
      }
    } catch (error) {
      const failure = commercialEmailFailure(error);
      intent = await markCommercialEmailFailed(
        intent.id,
        failure.code,
        failure.needsAttention,
      );
      const message = errorMessage(error, 'Failed to send deposit invoice email');
      const needsAttention = intent.status === 'needs_attention';
      await recordInvoiceDeliveryFailure({
        invoice,
        intent,
        frozen,
        message,
        errorCode: failure.code,
        needsAttention,
      });
      return {
        delivered: false,
        alreadySent: false,
        retryScheduled: false,
        error: message,
        nextRetryAt: null,
        finalFailure: needsAttention,
      };
    }
  }
  if (!providerMessage) {
    throw new Error('Email provider acknowledgement is unavailable');
  }

  await markInvoiceSent(invoice, {
    actor: frozen.actor,
    sentAt: frozen.sentAt,
    tokenHash: frozen.tokenHash,
    tokenExpiresAt: frozen.tokenExpiresAt,
  });
  const attempt = await latestSendAttempt(invoice.id);
  await insertSendLog({
    invoice,
    recipients: frozen.recipients,
    subject: frozen.subject,
    bodyHtml: redactInvoiceToken(frozen.html),
    bodyText: redactInvoiceToken(frozen.text),
    attachmentFileIds: frozen.attachmentFileIds,
    providerMessageId: providerMessage,
    status: 'SENT',
    actor: frozen.actor,
    sentAt: frozen.sentAt,
    attemptNumber: attempt.attemptNumber,
    firstAttemptAt: attempt.firstAttemptAt,
    nextRetryAt: null,
    finalFailure: false,
    deliveryIntentId: intent.id,
  });
  await insertAuditEvent({
    projectId: invoice.project_id,
    type: 'invoice.sent',
    idempotencyKey: `invoice.sent:${intent.id}`,
    payload: {
      depositInvoiceId: invoice.id,
      invoiceRef: invoice.invoice_ref,
      quoteVersionId: invoice.quote_version_id,
      deliveryIntentId: intent.id,
      to: frozen.recipients.to,
    },
  });
  await markCommercialEmailFinalised(intent.id);
  return {
    delivered: true,
    alreadySent: false,
    retryScheduled: false,
    error: null,
    nextRetryAt: null,
    finalFailure: false,
  };
}

async function deliverInvoiceEmail(
  invoice: DepositInvoiceRow,
  recipients: RecipientLists,
  actor: string | null,
): Promise<DepositInvoiceDeliveryResult> {
  return deliverInvoiceEmailDurably(invoice, recipients, actor);
}

export async function deliverAcceptedDepositInvoiceById(params: {
  invoiceUuid: string;
  actor: string | null;
}): Promise<{
  invoice: DepositInvoiceRow;
  sent: boolean;
  sendError: string | null;
  deliveryState: 'sent' | 'retry_available' | 'needs_attention';
}> {
  const invoice = await loadInvoiceById(params.invoiceUuid);
  if (!invoice) throw new Error('Deposit invoice not found');
  if (invoice.status !== 'OPEN') {
    return {
      invoice,
      sent: false,
      sendError: 'Deposit invoice is no longer open',
      deliveryState: 'needs_attention',
    };
  }

  const context = await loadAcceptedQuoteContext(invoice.quote_version_id);
  if (!context || context.status !== 'ACCEPTED') {
    throw new Error('Accepted quote context not found');
  }
  const recipients = await loadRecipients(
    invoice.quote_version_id,
    context.contactEmail,
  );
  const delivery = await deliverInvoiceEmail(
    invoice,
    recipients,
    params.actor,
  );
  return {
    invoice: (await loadInvoiceById(invoice.id)) ?? invoice,
    sent: delivery.delivered,
    sendError: delivery.delivered
      ? null
      : delivery.error ?? 'Deposit invoice was prepared but not sent',
    deliveryState: delivery.delivered
      ? 'sent'
      : delivery.finalFailure
        ? 'needs_attention'
        : 'retry_available',
  };
}

export async function listDepositInvoicesForProject(projectId: string): Promise<DepositInvoiceSummary[]> {
  const projectUuid = uuidFromAppId(projectId, 'proj');

  const [invoiceRes, logRes] = await Promise.all([
    supabaseServiceRole
      .from('deposit_invoices')
      .select('*')
      .eq('project_id', projectUuid)
      .order('created_at', { ascending: false }),
    supabaseServiceRole
      .from('deposit_invoice_send_logs')
      .select('deposit_invoice_id,to_emails,cc_emails,bcc_emails,status,error_message,created_at,sent_at,next_retry_at,final_failure')
      .eq('project_id', projectUuid)
      .order('created_at', { ascending: false }),
  ]);

  if (invoiceRes.error) throw new Error(errorMessage(invoiceRes.error, 'Failed to load invoices'));
  if (logRes.error && !missingTableError(logRes.error)) {
    throw new Error(errorMessage(logRes.error, 'Failed to load invoice send logs'));
  }

  const latestByInvoiceId = new Map<string, DepositInvoiceSendLogRow>();
  for (const row of Array.isArray(logRes.data) ? logRes.data : []) {
    const mapped = mapSendLogRow(row);
    if (!mapped.deposit_invoice_id || latestByInvoiceId.has(mapped.deposit_invoice_id)) continue;
    latestByInvoiceId.set(mapped.deposit_invoice_id, mapped);
  }

  return (Array.isArray(invoiceRes.data) ? invoiceRes.data : []).map((row) => {
    const invoice = mapInvoiceRow(row);
    return mapInvoiceSummary(invoice, latestByInvoiceId.get(invoice.id) ?? null);
  });
}

export async function getDepositInvoiceArtifactPreview(invoiceId: string): Promise<DepositInvoiceArtifactPreview | null> {
  const invoiceUuid = uuidFromAppId(invoiceId, 'inv');
  const invoice = await loadInvoiceById(invoiceUuid);
  if (!invoice) return null;

  const intent = await findCommercialEmailIntentByKey(`deposit-invoice-send:${invoice.id}`);
  if (intent) {
    const frozen = parseFrozenInvoiceEmail(intent);
    return preparedDepositInvoicePreview({
      invoiceId,
      invoiceRef: invoice.invoice_ref,
      frozen,
      attachmentNames: await loadPreviewAttachmentNames(frozen.attachmentFileIds),
    });
  }

  const existing = invoice.pdf_file_id ? await loadFileContent(invoice.pdf_file_id) : null;
  const filename = existing?.filename ?? depositInvoicePdfFilename(invoice.invoice_ref);
  return prospectiveDepositInvoicePreview({
    ...invoiceArtifactInput(invoice),
    invoiceId,
    recipients: { to: [], cc: [], bcc: [] },
    subject: `${invoice.payment_term_label} invoice - ${invoice.invoice_ref}`,
    invoiceLink: `https://preview.invalid/invoice/${encodeURIComponent(invoice.id)}?token=preview-only`,
    paymentLines: invoicePaymentLines(invoice),
    referenceId: invoice.reference ?? undefined,
    attachmentNames: [filename],
  });
}

export async function getDepositInvoicePdfPreview(invoiceId: string): Promise<{ filename: string; bytes: Uint8Array } | null> {
  const invoiceUuid = uuidFromAppId(invoiceId, 'inv');
  const invoice = await loadInvoiceById(invoiceUuid);
  if (!invoice) return null;

  const existing = invoice.pdf_file_id ? await loadFileContent(invoice.pdf_file_id) : null;
  if (existing) {
    return {
      filename: existing.filename,
      bytes: new Uint8Array(existing.content),
    };
  }

  return {
    filename: depositInvoicePdfFilename(invoice.invoice_ref),
    bytes: await generateDepositInvoicePdfBytes(invoiceArtifactInput(invoice), {
      paymentLines: invoicePaymentLines(invoice),
    }),
  };
}

export async function sendDepositInvoiceNow(invoiceId: string, actor: string | null): Promise<DepositInvoiceSummary> {
  const invoiceUuid = uuidFromAppId(invoiceId, 'inv');
  const invoice = await loadInvoiceById(invoiceUuid);
  if (!invoice) throw new Error('Invoice not found');
  if (invoice.status !== 'OPEN') throw new Error('Only open invoices can be sent');

  const context = await loadAcceptedQuoteContext(invoice.quote_version_id);
  if (!context) throw new Error('Accepted quote context not found');

  const recipients = await loadRecipients(invoice.quote_version_id, context.contactEmail);
  const delivery = await deliverInvoiceEmail(invoice, recipients, actor);
  if (!delivery.delivered) {
    throw new Error(delivery.error ?? 'Invoice was created but email delivery did not complete');
  }

  const refreshed = await loadInvoiceById(invoiceUuid);
  if (!refreshed) throw new Error('Invoice not found after send');

  return mapInvoiceSummary(refreshed, await loadLatestSendLogForInvoice(invoiceUuid));
}
