import 'server-only';

import { hashAcceptToken } from '@/lib/quotes/acceptToken';
import { getServiceSupabase } from '@/lib/supabaseService';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type InvoiceStatus = 'OPEN' | 'VOID';

type InvoiceRow = {
  id: string;
  status: InvoiceStatus;
  invoice_ref: string;
  quote_ref: string;
  quote_version_id: string;
  quote_version_number: number;
  issue_date: string;
  due_date: string;
  reference: string | null;
  customer_name: string | null;
  project_name: string | null;
  project_address: string | null;
  payment_instructions: string | null;
  deposit_percent: number;
  quote_total_inc_gst_cents: number;
  total_inc_gst_cents: number;
  total_ex_gst_cents: number;
  gst_cents: number;
  portal_token_expires_at: string | null;
  pdf_file_id: string | null;
};

export type PublicDepositInvoice = {
  id: string;
  status: InvoiceStatus;
  invoiceRef: string;
  quoteRef: string;
  quoteVersionId: string;
  quoteVersionNumber: number;
  issueDate: string;
  dueDate: string;
  reference: string | null;
  customerName: string | null;
  projectName: string | null;
  projectAddress: string | null;
  paymentInstructions: string | null;
  depositPercent: number;
  quoteTotalIncGstCents: number;
  totalIncGstCents: number;
  totalExGstCents: number;
  gstCents: number;
  tokenExpiresAt: string | null;
  pdfFileId: string | null;
  quotePdfFileId: string | null;
};

export type PublicDepositInvoiceLookupResult = {
  invoice: PublicDepositInvoice | null;
  reason?: 'invalid' | 'expired' | 'void';
};

function isUuid(value: string): boolean {
  return UUID_REGEX.test(value.trim());
}

function invoiceUuidFromParam(value: string): string {
  const raw = value.trim();
  if (!raw) throw new Error('invoiceId is required');
  if (isUuid(raw)) return raw;
  const maybeUuid = raw.split('_').at(-1) ?? '';
  if (isUuid(maybeUuid)) return maybeUuid;
  throw new Error('Invalid invoiceId');
}

function toStatus(value: unknown): InvoiceStatus {
  return String(value ?? '').toUpperCase() === 'VOID' ? 'VOID' : 'OPEN';
}

function tokenHasExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return false;
  const parsed = new Date(expiresAt);
  if (!Number.isFinite(parsed.getTime())) return false;
  return Date.now() > parsed.getTime();
}

function mapInvoiceRow(row: any): InvoiceRow {
  return {
    id: String(row?.id ?? ''),
    status: toStatus(row?.status),
    invoice_ref: String(row?.invoice_ref ?? ''),
    quote_ref: String(row?.quote_ref ?? ''),
    quote_version_id: String(row?.quote_version_id ?? ''),
    quote_version_number: Number(row?.quote_version_number ?? 0) || 0,
    issue_date: String(row?.issue_date ?? ''),
    due_date: String(row?.due_date ?? ''),
    reference: typeof row?.reference === 'string' ? row.reference : null,
    customer_name: typeof row?.customer_name === 'string' ? row.customer_name : null,
    project_name: typeof row?.project_name === 'string' ? row.project_name : null,
    project_address: typeof row?.project_address === 'string' ? row.project_address : null,
    payment_instructions: typeof row?.payment_instructions === 'string' ? row.payment_instructions : null,
    deposit_percent: Number(row?.deposit_percent ?? 0) || 0,
    quote_total_inc_gst_cents: Number(row?.quote_total_inc_gst_cents ?? 0) || 0,
    total_inc_gst_cents: Number(row?.total_inc_gst_cents ?? 0) || 0,
    total_ex_gst_cents: Number(row?.total_ex_gst_cents ?? 0) || 0,
    gst_cents: Number(row?.gst_cents ?? 0) || 0,
    portal_token_expires_at: typeof row?.portal_token_expires_at === 'string' ? row.portal_token_expires_at : null,
    pdf_file_id: typeof row?.pdf_file_id === 'string' ? row.pdf_file_id : null,
  };
}

function toPublicInvoice(row: InvoiceRow, quotePdfFileId: string | null): PublicDepositInvoice {
  return {
    id: row.id,
    status: row.status,
    invoiceRef: row.invoice_ref,
    quoteRef: row.quote_ref,
    quoteVersionId: row.quote_version_id,
    quoteVersionNumber: row.quote_version_number,
    issueDate: row.issue_date,
    dueDate: row.due_date,
    reference: row.reference,
    customerName: row.customer_name,
    projectName: row.project_name,
    projectAddress: row.project_address,
    paymentInstructions: row.payment_instructions,
    depositPercent: row.deposit_percent,
    quoteTotalIncGstCents: row.quote_total_inc_gst_cents,
    totalIncGstCents: row.total_inc_gst_cents,
    totalExGstCents: row.total_ex_gst_cents,
    gstCents: row.gst_cents,
    tokenExpiresAt: row.portal_token_expires_at,
    pdfFileId: row.pdf_file_id,
    quotePdfFileId,
  };
}

async function loadQuotePdfFileId(quoteVersionId: string): Promise<string | null> {
  if (!quoteVersionId) return null;
  const supabase = getServiceSupabase();
  const quoteRes = await supabase
    .from('quote_versions')
    .select('pdf_file_id')
    .eq('id', quoteVersionId)
    .maybeSingle();
  if (quoteRes.error || !quoteRes.data) return null;
  return typeof (quoteRes.data as any).pdf_file_id === 'string' ? (quoteRes.data as any).pdf_file_id : null;
}

async function loadFileArtifact(fileId: string): Promise<{ filename: string; content: Buffer } | null> {
  if (!fileId) return null;
  const supabase = getServiceSupabase();
  const fileRes = await supabase
    .from('file_artifacts')
    .select('filename, content_base64')
    .eq('id', fileId)
    .maybeSingle();

  if (fileRes.error || !fileRes.data) return null;

  const filename = String((fileRes.data as any).filename ?? 'document.pdf');
  const base64 = String((fileRes.data as any).content_base64 ?? '');
  return { filename, content: Buffer.from(base64, 'base64') };
}

async function loadInvoiceByToken(params: { invoiceId: string; token: string }): Promise<InvoiceRow | null> {
  const supabase = getServiceSupabase();
  const invoiceUuid = invoiceUuidFromParam(params.invoiceId);
  const tokenHash = hashAcceptToken(params.token);

  const invoiceRes = await supabase
    .from('deposit_invoices')
    .select(
      'id, status, invoice_ref, quote_ref, quote_version_id, quote_version_number, issue_date, due_date, reference, customer_name, project_name, project_address, payment_instructions, deposit_percent, quote_total_inc_gst_cents, total_inc_gst_cents, total_ex_gst_cents, gst_cents, portal_token_expires_at, pdf_file_id',
    )
    .eq('id', invoiceUuid)
    .eq('portal_token_hash', tokenHash)
    .maybeSingle();

  if (invoiceRes.error || !invoiceRes.data) return null;
  return mapInvoiceRow(invoiceRes.data);
}

export async function loadPublicDepositInvoiceByToken(params: {
  invoiceId: string;
  token: string;
}): Promise<PublicDepositInvoiceLookupResult> {
  let row: InvoiceRow | null;

  try {
    row = await loadInvoiceByToken(params);
  } catch {
    return { invoice: null, reason: 'invalid' };
  }

  if (!row) return { invoice: null, reason: 'invalid' };
  if (row.status === 'VOID') return { invoice: null, reason: 'void' };

  const quotePdfFileId = await loadQuotePdfFileId(row.quote_version_id);
  const invoice = toPublicInvoice(row, quotePdfFileId);
  if (tokenHasExpired(invoice.tokenExpiresAt)) {
    return { invoice, reason: 'expired' };
  }

  return { invoice };
}

export async function loadPublicDepositInvoicePdfByToken(params: {
  invoiceId: string;
  token: string;
}): Promise<{ filename: string; content: Buffer } | null> {
  let row: InvoiceRow | null;

  try {
    row = await loadInvoiceByToken(params);
  } catch {
    return null;
  }

  if (!row || row.status !== 'OPEN' || !row.pdf_file_id) return null;

  const file = await loadFileArtifact(row.pdf_file_id);
  if (!file) return null;
  return file;
}

export async function loadPublicSourceQuotePdfByInvoiceToken(params: {
  invoiceId: string;
  token: string;
}): Promise<{ filename: string; content: Buffer } | null> {
  let row: InvoiceRow | null;

  try {
    row = await loadInvoiceByToken(params);
  } catch {
    return null;
  }

  if (!row || row.status !== 'OPEN') return null;

  const quotePdfFileId = await loadQuotePdfFileId(row.quote_version_id);
  if (!quotePdfFileId) return null;

  const file = await loadFileArtifact(quotePdfFileId);
  if (!file) return null;

  const fallback = `quote-${row.quote_ref}-v${row.quote_version_number}.pdf`;
  const filename = file.filename.trim() || fallback;
  return { filename, content: file.content };
}
