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
import { paymentDetailsLines, paymentDetailsText } from '../payments/paymentDetails';
import { supabaseServiceRole } from '../supabaseClient';
import { generateDepositInvoicePdfBytes, depositInvoicePdfFilename } from './pdf';
import type { DepositInvoiceSummary } from './types';

const REPLY_TO_EMAIL = 'info@sanctuarypergolas.co.nz';

const MONEY = new Intl.NumberFormat('en-NZ', {
  style: 'currency',
  currency: 'NZD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

type DepositInvoiceRow = {
  id: string;
  project_id: string;
  quote_id: string;
  quote_version_id: string;
  quote_ref: string;
  quote_version_number: number;
  invoice_ref: string;
  status: 'OPEN' | 'VOID';
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
  customerName: string | null;
  projectName: string | null;
  projectAddress: string | null;
  contactEmail: string | null;
};

type RecipientLists = { to: string[]; cc: string[]; bcc: string[] };

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

function toDateOnly(value: string): string {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return value.slice(0, 10);
  const year = parsed.getUTCFullYear();
  const month = String(parsed.getUTCMonth() + 1).padStart(2, '0');
  const day = String(parsed.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDaysDateOnly(dateOnly: string, days: number): string {
  const parsed = new Date(`${dateOnly}T00:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime())) return dateOnly;
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return toDateOnly(parsed.toISOString());
}

function parseDateOnly(dateOnly: string): Date | null {
  const parsed = new Date(`${dateOnly}T23:59:59.999Z`);
  if (!Number.isFinite(parsed.getTime())) return null;
  return parsed;
}

function normalizeDateOnlyInput(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) throw new Error('Due date must be YYYY-MM-DD');
  if (!parseDateOnly(trimmed)) throw new Error('Due date is invalid');
  return trimmed;
}

function normalizeOptionalText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function parsePercent(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value ?? 0);
  if (!Number.isFinite(n)) return 50;
  return Math.max(0, Math.min(100, Math.round(n * 100) / 100));
}

function roundInt(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value);
}

function formatMoney(cents: number): string {
  return MONEY.format((Number.isFinite(cents) ? cents : 0) / 100);
}

function formatPercent(value: number): string {
  const clamped = parsePercent(value);
  const text = clamped.toFixed(2).replace(/\.00$/, '');
  return `${text}%`;
}

function formatDateForEmail(value: string): string {
  const parsed = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime())) return value;
  return new Intl.DateTimeFormat('en-NZ', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Pacific/Auckland',
  }).format(parsed);
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

function normalizeStatus(value: unknown): 'OPEN' | 'VOID' {
  return String(value ?? '').toUpperCase() === 'VOID' ? 'VOID' : 'OPEN';
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

function isUniqueViolation(error: any): boolean {
  const code = typeof error?.code === 'string' ? error.code.trim() : '';
  const message = typeof error?.message === 'string' ? error.message.toLowerCase() : '';
  return code === '23505' || message.includes('duplicate key value') || message.includes('unique constraint');
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  const message = typeof (error as any)?.message === 'string' ? String((error as any).message) : '';
  if (message) return message;
  const alt = typeof (error as any)?.error === 'string' ? String((error as any).error) : '';
  return alt || fallback;
}

function computeDepositAmounts(totalIncGstCents: number, depositPercent: number) {
  const pct = parsePercent(depositPercent);
  const total = roundInt(totalIncGstCents);
  const depositInc = roundInt((total * pct) / 100);
  const depositEx = roundInt(depositInc / 1.15);
  const gst = depositInc - depositEx;
  return {
    depositPercent: pct,
    quoteTotalIncGstCents: total,
    totalIncGstCents: depositInc,
    totalExGstCents: depositEx,
    gstCents: gst,
  };
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

function paymentInstructions(): string {
  return paymentDetailsText('invoice');
}

function redactToken(value: string | null): string | null {
  if (typeof value !== 'string') return value;
  return value.replace(/([?&]token=)[^&\s\"'<>]+/gi, '$1[redacted]');
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
    .select('id, quote_id, status, version_number, deposit_percent, total_inc_gst_cents, customer_name')
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

async function allocateInvoiceRef(): Promise<string> {
  const refRes = await supabaseServiceRole.rpc('next_deposit_invoice_ref');
  if (refRes.error || !refRes.data) {
    throw new Error(errorMessage(refRes.error, 'Failed to allocate invoice reference'));
  }
  const invoiceRef = String(refRes.data ?? '').trim();
  if (!invoiceRef) throw new Error('Failed to allocate invoice reference');
  return invoiceRef;
}

async function createOpenInvoice(
  context: AcceptedQuoteContext,
  actor: string | null,
  overrides?: {
    depositPercent?: number;
    dueDate?: string | null;
    reference?: string | null;
  },
): Promise<{ invoice: DepositInvoiceRow; created: boolean }> {
  const existing = await loadOpenInvoiceByQuoteVersion(
    context.quoteVersionUuid,
  );
  if (existing) return { invoice: existing, created: false };

  const invoiceRef = await allocateInvoiceRef();
  const depositPercent = overrides?.depositPercent === undefined ? context.depositPercent : parsePercent(overrides.depositPercent);
  const amount = computeDepositAmounts(context.quoteTotalIncGstCents, depositPercent);

  const issueDate = toDateOnly(nowIso());
  const dueDate = normalizeDateOnlyInput(overrides?.dueDate) ?? addDaysDateOnly(issueDate, 7);
  const reference =
    normalizeOptionalText(overrides?.reference) ??
    `Deposit for Quote ${context.quoteRef}${context.projectName ? ` - ${context.projectName}` : ''}`;

  const insertRes = await supabaseServiceRole
    .from('deposit_invoices')
    .insert({
      project_id: context.projectUuid,
      quote_id: context.quoteUuid,
      quote_version_id: context.quoteVersionUuid,
      quote_ref: context.quoteRef,
      quote_version_number: context.quoteVersionNumber,
      invoice_ref: invoiceRef,
      status: 'OPEN',
      issue_date: issueDate,
      due_date: dueDate,
      reference,
      customer_name: context.customerName,
      project_name: context.projectName,
      project_address: context.projectAddress,
      deposit_percent: amount.depositPercent,
      quote_total_inc_gst_cents: amount.quoteTotalIncGstCents,
      total_inc_gst_cents: amount.totalIncGstCents,
      total_ex_gst_cents: amount.totalExGstCents,
      gst_cents: amount.gstCents,
      payment_instructions: paymentInstructions(),
      created_by: actor,
    } as any)
    .select('*')
    .single();

  if (insertRes.error || !insertRes.data) {
    if (isUniqueViolation(insertRes.error)) {
      const raced = await loadOpenInvoiceByQuoteVersion(
        context.quoteVersionUuid,
      );
      if (raced) return { invoice: raced, created: false };
    }
    throw new Error(errorMessage(insertRes.error, 'Failed to create deposit invoice'));
  }

  const created = mapInvoiceRow(insertRes.data);

  await insertAuditEvent({
    projectId: context.projectUuid,
    type: 'invoice.created',
    payload: {
      depositInvoiceId: created.id,
      invoiceRef: created.invoice_ref,
      quoteVersionId: context.quoteVersionUuid,
    },
  });

  return { invoice: created, created: true };
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

async function ensureInvoicePdf(invoice: DepositInvoiceRow, actor: string | null): Promise<{ fileUuid: string; filename: string; content: Buffer }> {
  if (invoice.pdf_file_id) {
    const existing = await loadFileContent(invoice.pdf_file_id);
    if (existing) return { fileUuid: invoice.pdf_file_id, filename: existing.filename, content: existing.content };
  }

  const bytes = await generateDepositInvoicePdfBytes({
    invoiceRef: invoice.invoice_ref,
    quoteRef: invoice.quote_ref,
    quoteVersionNumber: invoice.quote_version_number,
    customerName: invoice.customer_name,
    projectName: invoice.project_name,
    projectAddress: invoice.project_address,
    issueDate: invoice.issue_date,
    dueDate: invoice.due_date,
    depositPercent: invoice.deposit_percent,
    quoteTotalIncGstCents: invoice.quote_total_inc_gst_cents,
    totalIncGstCents: invoice.total_inc_gst_cents,
    totalExGstCents: invoice.total_ex_gst_cents,
    gstCents: invoice.gst_cents,
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

type FrozenInvoiceEmail = {
  sentAt: string;
  tokenHash: string;
  tokenExpiresAt: string;
  recipients: RecipientLists;
  subject: string;
  html: string;
  text: string | null;
  attachmentFileIds: string[];
  actor: string | null;
};

function requiredIntentString(
  payload: Readonly<Record<string, unknown>>,
  key: string,
): string {
  const value = payload[key];
  if (typeof value !== 'string' || !value) {
    throw new Error(`Prepared invoice delivery is missing ${key}`);
  }
  return value;
}

function intentStringArray(
  payload: Readonly<Record<string, unknown>>,
  key: string,
): string[] {
  const value = payload[key];
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string')) {
    throw new Error(`Prepared invoice delivery is missing ${key}`);
  }
  return value as string[];
}

function parseFrozenInvoiceEmail(intent: CommercialEmailIntent): FrozenInvoiceEmail {
  const payload = intent.protectedPayload;
  return {
    sentAt: requiredIntentString(payload, 'sentAt'),
    tokenHash: requiredIntentString(payload, 'tokenHash'),
    tokenExpiresAt: requiredIntentString(payload, 'tokenExpiresAt'),
    recipients: {
      to: intentStringArray(payload, 'to'),
      cc: intentStringArray(payload, 'cc'),
      bcc: intentStringArray(payload, 'bcc'),
    },
    subject: requiredIntentString(payload, 'subject'),
    html: requiredIntentString(payload, 'html'),
    text: typeof payload.text === 'string' ? payload.text : null,
    attachmentFileIds: intentStringArray(payload, 'attachmentFileIds'),
    actor: typeof payload.actor === 'string' ? payload.actor : null,
  };
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
  const subject = `Deposit invoice - ${invoice.invoice_ref}`;
  const rendered = await renderDepositInvoiceEmail({
    to: recipients.to,
    cc: recipients.cc,
    bcc: recipients.bcc,
    subject,
    name: invoice.customer_name || 'there',
    invoice_number: invoice.invoice_ref,
    invoice_total_inc_gst: formatMoney(invoice.total_inc_gst_cents),
    quote_number: `${invoice.quote_ref} v${invoice.quote_version_number}`,
    deposit_percent: formatPercent(invoice.deposit_percent),
    due_date: formatDateForEmail(invoice.due_date),
    project_address: invoice.project_address ?? undefined,
    invoice_link: invoiceLink(invoice.id, token),
    payment_lines: paymentDetailsLines('invoice'),
    reference_id: invoice.reference ?? undefined,
    attachments: [
      {
        filename: pdf.filename,
        content: pdf.content,
        contentType: 'application/pdf',
      },
    ],
  });
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
    bodyHtml: redactToken(frozen.html),
    bodyText: redactToken(frozen.text),
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

async function clearInvoicePaidManualCheck(projectUuid: string) {
  const deleteRes = await supabaseServiceRole
    .from('project_task_checks')
    .delete()
    .eq('project_id', projectUuid)
    .eq('task_key', 'invoice_paid');

  if (deleteRes.error && !missingTableError(deleteRes.error)) {
    throw new Error(errorMessage(deleteRes.error, 'Failed to reset invoice paid task'));
  }
}

async function moveProjectToSent(projectUuid: string, quoteVersionUuid: string | null, reason: string) {
  const prevRes = await supabaseServiceRole.from('projects').select('pipeline_stage').eq('id', projectUuid).single();
  if (prevRes.error) throw new Error(errorMessage(prevRes.error, 'Failed to load project stage'));

  const fromStage = typeof (prevRes.data as any)?.pipeline_stage === 'string' ? String((prevRes.data as any).pipeline_stage) : null;

  const updateRes = await supabaseServiceRole.from('projects').update({ pipeline_stage: 'SENT' } as any).eq('id', projectUuid);
  if (updateRes.error) throw new Error(errorMessage(updateRes.error, 'Failed to revert project stage'));

  await insertAuditEvent({
    projectId: projectUuid,
    type: 'pipeline.stage_changed',
    payload: { fromStage, toStage: 'SENT', quoteId: quoteVersionUuid, reason },
  });
}

export async function ensureDepositInvoiceForAcceptedQuote(params: {
  quoteVersionUuid: string;
  actor: string | null;
}): Promise<{ invoice: DepositInvoiceRow; sent: boolean; sendError: string | null }> {
  const context = await loadAcceptedQuoteContext(params.quoteVersionUuid);
  if (!context) throw new Error('Accepted quote context not found');
  if (context.status !== 'ACCEPTED') throw new Error('Quote must be accepted to create a deposit invoice');

  const { invoice } = await createOpenInvoice(context, params.actor);
  await clearInvoicePaidManualCheck(context.projectUuid);

  const recipients = await loadRecipients(context.quoteVersionUuid, context.contactEmail);
  const delivery = await deliverInvoiceEmail(invoice, recipients, params.actor);
  if (delivery.delivered) return { invoice, sent: true, sendError: null };
  return {
    invoice,
    sent: false,
    sendError: delivery.error ?? 'Deposit invoice was created but not sent',
  };
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

export async function createDepositInvoiceFromQuote(params: {
  quoteVersionId: string;
  actor: string | null;
  depositPercent?: number;
  dueDate?: string | null;
  reference?: string | null;
  sendNow?: boolean;
}): Promise<{
  invoice: DepositInvoiceSummary;
  created: boolean;
  sent: boolean;
  alreadySent: boolean;
  sendError: string | null;
}> {
  const quoteVersionUuid = uuidFromAppId(params.quoteVersionId, 'qv');
  const context = await loadAcceptedQuoteContext(quoteVersionUuid);
  if (!context) throw new Error('Quote context not found');
  if (context.status !== 'ACCEPTED') {
    throw new Error('Only accepted quotes can create an invoice');
  }

  const createdInvoice = await createOpenInvoice(context, params.actor, {
    depositPercent: params.depositPercent,
    dueDate: params.dueDate,
    reference: params.reference,
  });

  if (context.status === 'ACCEPTED') {
    await clearInvoicePaidManualCheck(context.projectUuid);
  }

  let sent = false;
  let alreadySent = false;
  let sendError: string | null = null;

  if (params.sendNow) {
    const recipients = await loadRecipients(context.quoteVersionUuid, context.contactEmail);
    const delivery = await deliverInvoiceEmail(createdInvoice.invoice, recipients, params.actor);
    sent = delivery.delivered && !delivery.alreadySent;
    alreadySent = delivery.alreadySent;
    if (!delivery.delivered) {
      sendError = delivery.error ?? 'Invoice was created but not sent';
    }
  }

  const latest = await loadLatestSendLogForInvoice(createdInvoice.invoice.id);
  const refreshed = (await loadInvoiceById(createdInvoice.invoice.id)) ?? createdInvoice.invoice;

  return {
    invoice: mapInvoiceSummary(refreshed, latest),
    created: createdInvoice.created,
    sent,
    alreadySent,
    sendError,
  };
}

export async function voidOpenDepositInvoiceForQuote(params: {
  quoteUuid: string;
  actor: string | null;
  reason: string;
}): Promise<void> {
  const openRes = await supabaseServiceRole
    .from('deposit_invoices')
    .select('*')
    .eq('quote_id', params.quoteUuid)
    .eq('status', 'OPEN');
  if (openRes.error) {
    throw new Error(
      errorMessage(openRes.error, 'Failed to load deposit invoices'),
    );
  }
  const invoices = (Array.isArray(openRes.data) ? openRes.data : []).map(
    mapInvoiceRow,
  );
  if (!invoices.length) return;
  const updateRes = await supabaseServiceRole
    .from('deposit_invoices')
    .update({
      status: 'VOID',
      voided_at: nowIso(),
      voided_by: params.actor,
      void_reason: params.reason,
      portal_token_hash: null,
      portal_token_expires_at: null,
    } as any)
    .eq('quote_id', params.quoteUuid)
    .eq('status', 'OPEN');

  if (updateRes.error) throw new Error(errorMessage(updateRes.error, 'Failed to void deposit invoice'));

  for (const invoice of invoices) {
    await insertAuditEvent({
      projectId: invoice.project_id,
      type: 'invoice.voided',
      payload: {
        depositInvoiceId: invoice.id,
        invoiceRef: invoice.invoice_ref,
        quoteVersionId: invoice.quote_version_id,
        reason: params.reason,
      },
    });
  }

  const first = invoices[0]!;
  await clearInvoicePaidManualCheck(first.project_id);
  await moveProjectToSent(
    first.project_id,
    first.quote_version_id,
    'quote_unaccepted_or_voided',
  );
}
