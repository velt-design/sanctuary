import 'server-only';

import { randomUUID } from 'crypto';
import { appIdFromUuid, uuidFromAppId } from '../supabase/mappers';
import { generateAcceptToken } from '../quotes/acceptToken';
import { sendDepositInvoiceEmail } from '../emails/invoice';
import { supabaseServer } from '../supabaseClient';
import { generateDepositInvoicePdfBytes, depositInvoicePdfFilename } from './pdf';
import type { DepositInvoiceSummary } from './types';

const REPLY_TO_EMAIL = 'info@sanctuarypergolas.co.nz';
const MAX_RETRY_ATTEMPTS = 5;
const MAX_RETRY_WINDOW_MS = 24 * 60 * 60 * 1000;
const RETRY_DELAYS_MS = [5 * 60 * 1000, 30 * 60 * 1000, 2 * 60 * 60 * 1000, 8 * 60 * 60 * 1000];

const MONEY = new Intl.NumberFormat('en-NZ', {
  style: 'currency',
  currency: 'NZD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export type DepositInvoiceRow = {
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

function providerMessageId(response: unknown): string | null {
  const id = (response as any)?.data?.id;
  return typeof id === 'string' && id.trim() ? id.trim() : null;
}

function paymentInstructions(invoiceRef: string): string {
  const accountName = process.env.DEPOSIT_BANK_ACCOUNT_NAME?.trim() || '';
  const accountNumber = process.env.DEPOSIT_BANK_ACCOUNT_NUMBER?.trim() || '';
  const referencePrefix = process.env.DEPOSIT_BANK_REFERENCE_PREFIX?.trim() || '';

  const lines: string[] = [];
  lines.push('Please pay by bank transfer using the invoice number as reference.');
  if (accountName) lines.push(`Account name: ${accountName}`);
  if (accountNumber) lines.push(`Account number: ${accountNumber}`);
  if (referencePrefix) lines.push(`Reference: ${referencePrefix} ${invoiceRef}`.trim());
  lines.push('Questions? Reply to info@sanctuarypergolas.co.nz');
  return lines.join('\n');
}

function bankDetailsFromInstructions(value: string | null | undefined): {
  accountName?: string;
  accountNumber?: string;
  reference?: string;
} {
  const lines = String(value ?? '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const findValue = (prefix: string): string | undefined => {
    const line = lines.find((entry) => entry.toLowerCase().startsWith(prefix));
    if (!line) return undefined;
    return line.slice(prefix.length).trim() || undefined;
  };

  return {
    accountName: findValue('account name:'),
    accountNumber: findValue('account number:'),
    reference: findValue('reference:'),
  };
}

function redactToken(value: string | null): string | null {
  if (typeof value !== 'string') return value;
  return value.replace(/([?&]token=)[^&\s\"'<>]+/gi, '$1[redacted]');
}

async function insertAuditEvent(params: { projectId: string; type: string; payload?: unknown }) {
  try {
    await supabaseServer.from('audit_events').insert({
      project_id: params.projectId,
      type: params.type,
      idempotency_key: `${params.type}:${params.projectId}:${randomUUID()}`,
      payload: params.payload ?? {},
    } as any);
  } catch (error: any) {
    if (missingTableError(error)) return;
    console.error('[invoice_audit] failed to insert', error);
  }
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
  const versionRes = await supabaseServer
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

  const quoteRes = await supabaseServer
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

  const projectRes = await supabaseServer
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

async function loadOpenInvoiceByQuote(quoteUuid: string): Promise<DepositInvoiceRow | null> {
  const res = await supabaseServer
    .from('deposit_invoices')
    .select('*')
    .eq('quote_id', quoteUuid)
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
  const res = await supabaseServer.from('deposit_invoices').select('*').eq('id', invoiceUuid).maybeSingle();
  if (res.error || !res.data) {
    if (res.error && !missingTableError(res.error)) {
      throw new Error(errorMessage(res.error, 'Failed to load deposit invoice'));
    }
    return null;
  }
  return mapInvoiceRow(res.data);
}

async function allocateInvoiceRef(): Promise<string> {
  const refRes = await supabaseServer.rpc('next_deposit_invoice_ref');
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
  const existing = await loadOpenInvoiceByQuote(context.quoteUuid);
  if (existing) return { invoice: existing, created: false };

  const invoiceRef = await allocateInvoiceRef();
  const depositPercent = overrides?.depositPercent === undefined ? context.depositPercent : parsePercent(overrides.depositPercent);
  const amount = computeDepositAmounts(context.quoteTotalIncGstCents, depositPercent);

  const issueDate = toDateOnly(nowIso());
  const dueDate = normalizeDateOnlyInput(overrides?.dueDate) ?? addDaysDateOnly(issueDate, 7);
  const reference =
    normalizeOptionalText(overrides?.reference) ??
    `Deposit for Quote ${context.quoteRef}${context.projectName ? ` - ${context.projectName}` : ''}`;

  const insertRes = await supabaseServer
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
      payment_instructions: paymentInstructions(invoiceRef),
      created_by: actor,
    } as any)
    .select('*')
    .single();

  if (insertRes.error || !insertRes.data) {
    if (isUniqueViolation(insertRes.error)) {
      const raced = await loadOpenInvoiceByQuote(context.quoteUuid);
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
  const logRes = await supabaseServer
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
  const res = await supabaseServer.from('file_artifacts').select('filename, content_base64').eq('id', fileUuid).single();
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
    paymentInstructions: invoice.payment_instructions,
  });

  const filename = depositInvoicePdfFilename(invoice.invoice_ref);
  const base64 = Buffer.from(bytes).toString('base64');

  const fileRes = await supabaseServer
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
  const patchRes = await supabaseServer.from('deposit_invoices').update({ pdf_file_id: fileUuid } as any).eq('id', invoice.id);
  if (patchRes.error) throw new Error(errorMessage(patchRes.error, 'Failed to link invoice PDF'));

  return { fileUuid, filename, content: Buffer.from(bytes) };
}

async function latestSendAttempt(invoiceId: string): Promise<SendAttemptInfo> {
  const latest = await supabaseServer
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
  const latest = await supabaseServer
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

function computeRetry(attemptNumber: number, firstAttemptAt: string): { nextRetryAt: string | null; finalFailure: boolean } {
  if (attemptNumber >= MAX_RETRY_ATTEMPTS) {
    return { nextRetryAt: null, finalFailure: true };
  }

  const delay = RETRY_DELAYS_MS[Math.max(0, attemptNumber - 1)] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1];
  const base = new Date(firstAttemptAt);
  const now = new Date();
  const next = new Date(now.getTime() + delay);

  if (!Number.isFinite(base.getTime()) || !Number.isFinite(next.getTime())) {
    return { nextRetryAt: null, finalFailure: true };
  }

  if (next.getTime() - base.getTime() > MAX_RETRY_WINDOW_MS) {
    return { nextRetryAt: null, finalFailure: true };
  }

  return { nextRetryAt: next.toISOString(), finalFailure: false };
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
}) {
  const res = await supabaseServer.from('deposit_invoice_send_logs').insert({
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
    created_by: params.actor,
    sent_at: params.sentAt,
  } as any);

  if (res.error) throw new Error(errorMessage(res.error, 'Failed to log invoice email attempt'));
}

async function hasSuccessfulSend(invoiceId: string): Promise<boolean> {
  const res = await supabaseServer
    .from('deposit_invoice_send_logs')
    .select('id')
    .eq('deposit_invoice_id', invoiceId)
    .eq('status', 'SENT')
    .limit(1)
    .maybeSingle();

  return Boolean(res.data && !res.error);
}

async function markInvoiceSent(invoice: DepositInvoiceRow, patch: { actor: string | null; sentAt: string; tokenHash: string; tokenExpiresAt: string }) {
  const res = await supabaseServer
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

const retryTimersKey = '__spDepositInvoiceRetryTimers__';

type TimerHandle = ReturnType<typeof setTimeout>;

function getRetryTimers(): Map<string, TimerHandle> {
  const globalAny = globalThis as any;
  if (!globalAny[retryTimersKey]) globalAny[retryTimersKey] = new Map<string, TimerHandle>();
  return globalAny[retryTimersKey] as Map<string, TimerHandle>;
}

function scheduleRetryTimer(invoiceId: string, retryAtIso: string, actor: string | null) {
  const retryAt = new Date(retryAtIso);
  if (!Number.isFinite(retryAt.getTime())) return;

  const delay = Math.max(0, retryAt.getTime() - Date.now());
  const timers = getRetryTimers();
  const existing = timers.get(invoiceId);
  if (existing) {
    clearTimeout(existing);
    timers.delete(invoiceId);
  }

  const handle = setTimeout(() => {
    timers.delete(invoiceId);
    void retryInvoiceDelivery(invoiceId, actor).catch((error) => {
      console.error('[deposit_invoice_retry] failed', { invoiceId, error });
    });
  }, delay);

  timers.set(invoiceId, handle);
}

function clearRetryTimer(invoiceId: string) {
  const timers = getRetryTimers();
  const existing = timers.get(invoiceId);
  if (!existing) return;
  clearTimeout(existing);
  timers.delete(invoiceId);
}

async function deliverInvoiceEmail(
  invoice: DepositInvoiceRow,
  recipients: RecipientLists,
  actor: string | null,
): Promise<DepositInvoiceDeliveryResult> {
  if (invoice.status !== 'OPEN') {
    return {
      delivered: false,
      alreadySent: false,
      retryScheduled: false,
      error: null,
      nextRetryAt: null,
      finalFailure: false,
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

  const attempt = await latestSendAttempt(invoice.id);
  const sentAtIso = nowIso();
  const tokenExpiry = (() => {
    const parsed = parseDateOnly(invoice.due_date);
    if (parsed) {
      parsed.setUTCDate(parsed.getUTCDate() + 30);
      return parsed.toISOString();
    }
    const fallback = new Date(sentAtIso);
    fallback.setUTCDate(fallback.getUTCDate() + 30);
    return fallback.toISOString();
  })();

  const { token, tokenHash } = generateAcceptToken();
  const link = invoiceLink(invoice.id, token);
  const pdf = await ensureInvoicePdf(invoice, actor);
  const bank = bankDetailsFromInstructions(invoice.payment_instructions);
  const subject = `Deposit invoice - ${invoice.invoice_ref}`;

  try {
    const delivered = await sendDepositInvoiceEmail({
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
      invoice_link: link,
      bank_account_name: bank.accountName,
      bank_account_number: bank.accountNumber,
      bank_reference: bank.reference,
      reference_id: invoice.reference ?? undefined,
      attachments: [{ filename: pdf.filename, content: pdf.content, contentType: 'application/pdf' }],
    });

    await markInvoiceSent(invoice, {
      actor,
      sentAt: sentAtIso,
      tokenHash,
      tokenExpiresAt: tokenExpiry,
    });

    clearRetryTimer(invoice.id);

    await insertSendLog({
      invoice,
      recipients,
      subject,
      bodyHtml: redactToken(delivered.html),
      bodyText: redactToken(delivered.text ?? null),
      attachmentFileIds: [pdf.fileUuid],
      providerMessageId: providerMessageId(delivered.response),
      status: 'SENT',
      actor,
      sentAt: sentAtIso,
      attemptNumber: attempt.attemptNumber,
      firstAttemptAt: attempt.firstAttemptAt,
      nextRetryAt: null,
      finalFailure: false,
    });

    await insertAuditEvent({
      projectId: invoice.project_id,
      type: 'invoice.sent',
      payload: {
        depositInvoiceId: invoice.id,
        invoiceRef: invoice.invoice_ref,
        quoteVersionId: invoice.quote_version_id,
        attempt: attempt.attemptNumber,
        to: recipients.to,
      },
    });
    return {
      delivered: true,
      alreadySent: false,
      retryScheduled: false,
      error: null,
      nextRetryAt: null,
      finalFailure: false,
    };
  } catch (error) {
    const message = errorMessage(error, 'Failed to send deposit invoice email');
    const retry = computeRetry(attempt.attemptNumber, attempt.firstAttemptAt);

    await insertSendLog({
      invoice,
      recipients,
      subject,
      bodyHtml: null,
      bodyText: null,
      attachmentFileIds: [pdf.fileUuid],
      providerMessageId: null,
      status: 'FAILED',
      actor,
      sentAt: null,
      errorMessage: message,
      attemptNumber: attempt.attemptNumber,
      firstAttemptAt: attempt.firstAttemptAt,
      nextRetryAt: retry.nextRetryAt,
      finalFailure: retry.finalFailure,
    });

    await insertAuditEvent({
      projectId: invoice.project_id,
      type: retry.finalFailure ? 'invoice.send_failed_final' : 'invoice.send_failed',
      payload: {
        depositInvoiceId: invoice.id,
        invoiceRef: invoice.invoice_ref,
        quoteVersionId: invoice.quote_version_id,
        attempt: attempt.attemptNumber,
        nextRetryAt: retry.nextRetryAt,
        error: message,
      },
    });

    if (retry.nextRetryAt && !retry.finalFailure) {
      scheduleRetryTimer(invoice.id, retry.nextRetryAt, actor);
      return {
        delivered: false,
        alreadySent: false,
        retryScheduled: true,
        error: message,
        nextRetryAt: retry.nextRetryAt,
        finalFailure: false,
      };
    }

    return {
      delivered: false,
      alreadySent: false,
      retryScheduled: false,
      error: message,
      nextRetryAt: null,
      finalFailure: retry.finalFailure,
    };
  }
}

async function clearInvoicePaidManualCheck(projectUuid: string) {
  const deleteRes = await supabaseServer
    .from('project_task_checks')
    .delete()
    .eq('project_id', projectUuid)
    .eq('task_key', 'invoice_paid');

  if (deleteRes.error && !missingTableError(deleteRes.error)) {
    throw new Error(errorMessage(deleteRes.error, 'Failed to reset invoice paid task'));
  }
}

async function moveProjectToSent(projectUuid: string, quoteVersionUuid: string | null, reason: string) {
  const prevRes = await supabaseServer.from('projects').select('pipeline_stage').eq('id', projectUuid).single();
  if (prevRes.error) throw new Error(errorMessage(prevRes.error, 'Failed to load project stage'));

  const fromStage = typeof (prevRes.data as any)?.pipeline_stage === 'string' ? String((prevRes.data as any).pipeline_stage) : null;

  const updateRes = await supabaseServer.from('projects').update({ pipeline_stage: 'SENT' } as any).eq('id', projectUuid);
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

export async function retryInvoiceDelivery(invoiceUuid: string, actor: string | null): Promise<void> {
  const invoice = await loadInvoiceById(invoiceUuid);
  if (!invoice || invoice.status !== 'OPEN') {
    clearRetryTimer(invoiceUuid);
    return;
  }
  if (await hasSuccessfulSend(invoice.id)) {
    clearRetryTimer(invoiceUuid);
    return;
  }

  const context = await loadAcceptedQuoteContext(invoice.quote_version_id);
  if (!context) return;

  const recipients = await loadRecipients(invoice.quote_version_id, context.contactEmail);
  await deliverInvoiceEmail(invoice, recipients, actor);
}

export async function listDepositInvoicesForProject(projectId: string): Promise<DepositInvoiceSummary[]> {
  const projectUuid = uuidFromAppId(projectId, 'proj');

  const [invoiceRes, logRes] = await Promise.all([
    supabaseServer
      .from('deposit_invoices')
      .select('*')
      .eq('project_id', projectUuid)
      .order('created_at', { ascending: false }),
    supabaseServer
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
  if (context.status !== 'SENT' && context.status !== 'ACCEPTED') {
    throw new Error('Only sent or accepted quotes can create an invoice');
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
  const invoice = await loadOpenInvoiceByQuote(params.quoteUuid);
  if (!invoice) return;

  clearRetryTimer(invoice.id);

  const updateRes = await supabaseServer
    .from('deposit_invoices')
    .update({
      status: 'VOID',
      voided_at: nowIso(),
      voided_by: params.actor,
      void_reason: params.reason,
      portal_token_hash: null,
      portal_token_expires_at: null,
    } as any)
    .eq('id', invoice.id);

  if (updateRes.error) throw new Error(errorMessage(updateRes.error, 'Failed to void deposit invoice'));

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

  await clearInvoicePaidManualCheck(invoice.project_id);
  await moveProjectToSent(invoice.project_id, invoice.quote_version_id, 'quote_unaccepted_or_voided');
}

export async function ensureInvoiceRetryScheduledFromLatestFailure(invoiceUuid: string, actor: string | null): Promise<void> {
  const latest = await supabaseServer
    .from('deposit_invoice_send_logs')
    .select('next_retry_at, status, final_failure')
    .eq('deposit_invoice_id', invoiceUuid)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latest.error || !latest.data) return;
  const row = latest.data as any;
  if (String(row?.status ?? '').toUpperCase() !== 'FAILED') return;
  if (row?.final_failure) return;
  const nextRetryAt = typeof row?.next_retry_at === 'string' ? row.next_retry_at : null;
  if (!nextRetryAt) return;
  scheduleRetryTimer(invoiceUuid, nextRetryAt, actor);
}

export async function getOpenDepositInvoiceForProject(projectUuid: string): Promise<DepositInvoiceRow | null> {
  const res = await supabaseServer
    .from('deposit_invoices')
    .select('*')
    .eq('project_id', projectUuid)
    .eq('status', 'OPEN')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (res.error || !res.data) {
    if (res.error && !missingTableError(res.error)) {
      throw new Error(errorMessage(res.error, 'Failed to load project invoice'));
    }
    return null;
  }

  return mapInvoiceRow(res.data);
}

export async function getOpenDepositInvoiceById(invoiceUuid: string): Promise<DepositInvoiceRow | null> {
  const row = await loadInvoiceById(invoiceUuid);
  if (!row || row.status !== 'OPEN') return null;
  return row;
}

export async function rotateInvoicePortalToken(invoiceUuid: string, actor: string | null): Promise<{ token: string; tokenHash: string; expiresAt: string }> {
  const invoice = await loadInvoiceById(invoiceUuid);
  if (!invoice) throw new Error('Invoice not found');
  if (invoice.status !== 'OPEN') throw new Error('Invoice is not active');

  const { token, tokenHash } = generateAcceptToken();
  const due = parseDateOnly(invoice.due_date);
  const expiresAt = (() => {
    if (due) {
      due.setUTCDate(due.getUTCDate() + 30);
      return due.toISOString();
    }
    const now = new Date();
    now.setUTCDate(now.getUTCDate() + 30);
    return now.toISOString();
  })();

  const updateRes = await supabaseServer
    .from('deposit_invoices')
    .update({
      portal_token_hash: tokenHash,
      portal_token_expires_at: expiresAt,
      sent_by: actor,
    } as any)
    .eq('id', invoice.id);

  if (updateRes.error) throw new Error(errorMessage(updateRes.error, 'Failed to rotate invoice token'));

  return { token, tokenHash, expiresAt };
}
