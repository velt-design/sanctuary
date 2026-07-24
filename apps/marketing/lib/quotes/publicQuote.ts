import 'server-only';

import { randomUUID } from 'node:crypto';
import { hashAcceptToken } from '@/lib/quotes/acceptToken';
import { getServiceSupabase } from '@/lib/supabaseService';
import { publicTokenAccessState } from '@/lib/publicTokenAccess';
import { ensureDepositInvoiceForAcceptedQuote } from '../../../portal/lib/invoices/server';

type PublicQuoteLineItem = {
  id: string;
  description: string;
  qty: number;
  lineTotalIncGstCents: number;
};

type PublicQuoteAttachment = {
  id: string;
  label: string;
  href: string;
};

export type PublicQuote = {
  id: string;
  status: 'DRAFT' | 'SENT' | 'ACCEPTED' | 'DECLINED';
  quoteRef: string;
  versionNumber: number;
  customerName?: string | null;
  projectName: string;
  projectAddress: string | null;
  totalIncGstCents: number;
  totalExGstCents?: number;
  gstCents?: number;
  createdAt: string;
  sentAt?: string | null;
  expiresAt: string | null;
  tokenExpiresAt: string | null;
  introText?: string | null;
  termsText?: string | null;
  lineItems: PublicQuoteLineItem[];
  attachments: PublicQuoteAttachment[];
};

type PublicQuoteLookupResult = {
  quote: PublicQuote | null;
  reason?: 'invalid' | 'expired';
};

type AcceptPublicQuoteResult =
  | { ok: true; alreadyAccepted: boolean }
  | { ok: false; code: 'invalid' | 'expired' | 'invalid_status' | 'server'; message: string };

type PublicQuoteAttachmentDownloadResult =
  | { ok: true; filename: string; contentType: string; bytes: Uint8Array }
  | { ok: false; code: 'invalid' | 'expired' | 'not_found'; message: string };

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_REGEX.test(value.trim());
}

function quoteVersionUuidFromParam(value: string): string {
  const raw = value.trim();
  if (!raw) throw new Error('quoteId is required');
  if (isUuid(raw)) return raw;
  const maybeUuid = raw.split('_').at(-1) ?? '';
  if (isUuid(maybeUuid)) return maybeUuid;
  throw new Error('Invalid quoteId');
}

function fileArtifactUuidFromParam(value: string): string {
  const raw = value.trim();
  if (!raw) throw new Error('fileId is required');
  if (isUuid(raw)) return raw;
  const maybeUuid = raw.split('_').at(-1) ?? '';
  if (isUuid(maybeUuid)) return maybeUuid;
  throw new Error('Invalid fileId');
}

function normalizeStatus(value: unknown): PublicQuote['status'] {
  const raw = typeof value === 'string' ? value.trim().toUpperCase() : '';
  if (raw === 'SENT' || raw === 'ACCEPTED' || raw === 'DECLINED') return raw;
  return 'DRAFT';
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  const message = typeof (error as any)?.message === 'string' ? String((error as any).message) : '';
  return message || fallback;
}

async function loadQuoteVersionByToken(params: {
  quoteId: string;
  token: string;
}): Promise<{
  quoteVersionUuid: string;
  quoteId: string;
  tokenHash: string;
  status: PublicQuote['status'];
  versionNumber: number;
  createdAt: string;
  sentAt: string | null;
  expiresAt: string | null;
  tokenExpiresAt: string | null;
  pdfFileId: string | null;
  totalIncGstCents: number;
  totalExGstCents: number;
  gstCents: number;
  customerName: string | null;
  introText: string | null;
  termsText: string | null;
} | null> {
  const supabase = getServiceSupabase();
  const quoteVersionUuid = quoteVersionUuidFromParam(params.quoteId);
  const tokenHash = hashAcceptToken(params.token);

  const versionRes = await supabase
    .from('quote_versions')
    .select(
      'id, quote_id, status, version_number, created_at, sent_at, expires_at, accept_token_expires_at, pdf_file_id, customer_name, intro_text, terms_text, total_inc_gst_cents, total_ex_gst_cents, gst_cents',
    )
    .eq('id', quoteVersionUuid)
    .eq('accept_token_hash', tokenHash)
    .maybeSingle();

  if (versionRes.error || !versionRes.data) return null;

  return {
    quoteVersionUuid: String((versionRes.data as any).id ?? ''),
    quoteId: String((versionRes.data as any).quote_id ?? ''),
    tokenHash,
    status: normalizeStatus((versionRes.data as any).status),
    versionNumber: Number((versionRes.data as any).version_number ?? 0) || 0,
    createdAt: typeof (versionRes.data as any).created_at === 'string' ? (versionRes.data as any).created_at : new Date().toISOString(),
    sentAt: typeof (versionRes.data as any).sent_at === 'string' ? (versionRes.data as any).sent_at : null,
    expiresAt: typeof (versionRes.data as any).expires_at === 'string' ? (versionRes.data as any).expires_at : null,
    tokenExpiresAt:
      typeof (versionRes.data as any).accept_token_expires_at === 'string'
        ? (versionRes.data as any).accept_token_expires_at
        : null,
    pdfFileId: typeof (versionRes.data as any).pdf_file_id === 'string' ? (versionRes.data as any).pdf_file_id : null,
    totalIncGstCents: Number((versionRes.data as any).total_inc_gst_cents ?? 0) || 0,
    totalExGstCents: Number((versionRes.data as any).total_ex_gst_cents ?? 0) || 0,
    gstCents: Number((versionRes.data as any).gst_cents ?? 0) || 0,
    customerName:
      typeof (versionRes.data as any).customer_name === 'string' && (versionRes.data as any).customer_name.trim()
        ? (versionRes.data as any).customer_name.trim()
        : null,
    introText: typeof (versionRes.data as any).intro_text === 'string' ? (versionRes.data as any).intro_text : null,
    termsText: typeof (versionRes.data as any).terms_text === 'string' ? (versionRes.data as any).terms_text : null,
  };
}

async function loadActiveQuoteVersionByToken(
  params: { quoteId: string; token: string },
): Promise<
  | { version: NonNullable<Awaited<ReturnType<typeof loadQuoteVersionByToken>>>; reason?: never }
  | { version: null; reason: 'invalid' | 'expired' }
> {
  const version = await loadQuoteVersionByToken(params);
  if (!version) return { version: null, reason: 'invalid' };
  if (publicTokenAccessState(version.tokenExpiresAt) === 'expired') {
    return { version: null, reason: 'expired' };
  }
  return { version };
}

async function loadQuoteProject(quoteId: string): Promise<{ quoteRef: string; projectId: string | null } | null> {
  const supabase = getServiceSupabase();
  const quoteRes = await supabase.from('quotes').select('id, quote_ref, project_id').eq('id', quoteId).maybeSingle();
  if (quoteRes.error || !quoteRes.data) return null;

  return {
    quoteRef: typeof (quoteRes.data as any).quote_ref === 'string' ? (quoteRes.data as any).quote_ref : '',
    projectId: typeof (quoteRes.data as any).project_id === 'string' ? (quoteRes.data as any).project_id : null,
  };
}

async function loadProject(projectId: string | null): Promise<{ name: string; siteAddress: string | null; customerName: string | null }> {
  if (!projectId) return { name: '', siteAddress: null, customerName: null };
  const supabase = getServiceSupabase();
  const projectRes = await supabase
    .from('projects')
    .select('name, site_address, contacts ( name )')
    .eq('id', projectId)
    .maybeSingle();
  if (projectRes.error || !projectRes.data) return { name: '', siteAddress: null, customerName: null };

  const row = projectRes.data as any;
  const contactRow = Array.isArray(row?.contacts) ? row.contacts[0] : row?.contacts ?? null;
  const customerNameRaw = typeof contactRow?.name === 'string' ? contactRow.name.trim() : '';
  const customerName = customerNameRaw || null;

  return {
    name: typeof row?.name === 'string' ? row.name : '',
    siteAddress: typeof row?.site_address === 'string' ? row.site_address : null,
    customerName,
  };
}

async function loadLineItems(quoteVersionUuid: string): Promise<PublicQuoteLineItem[]> {
  const supabase = getServiceSupabase();
  const itemsRes = await supabase
    .from('quote_line_items')
    .select('id, description, qty, line_total_inc_gst_cents, sort_order')
    .eq('quote_version_id', quoteVersionUuid)
    .order('sort_order', { ascending: true });

  if (itemsRes.error || !Array.isArray(itemsRes.data)) return [];

  return itemsRes.data.map((row: any) => ({
    id: String(row?.id ?? ''),
    description: typeof row?.description === 'string' ? row.description : '',
    qty: typeof row?.qty === 'number' ? row.qty : Number(row?.qty ?? 0) || 0,
    lineTotalIncGstCents: Number(row?.line_total_inc_gst_cents ?? 0) || 0,
  }));
}

function looksLikePdf(contentType: string | null, filename: string): boolean {
  const mime = String(contentType ?? '').trim().toLowerCase();
  if (mime === 'application/pdf') return true;
  return filename.trim().toLowerCase().endsWith('.pdf');
}

async function loadTokenScopedAttachmentFileIds(params: {
  quoteVersionUuid: string;
  tokenHash: string;
  quotePdfFileId: string | null;
}): Promise<string[]> {
  const supabase = getServiceSupabase();
  const sendLogRes = await supabase
    .from('quote_send_logs')
    .select('attachment_file_ids')
    .eq('quote_version_id', params.quoteVersionUuid)
    .eq('status', 'SENT')
    .eq('accept_token_hash', params.tokenHash)
    .order('sent_at', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (sendLogRes.error || !sendLogRes.data) return [];
  const ids = Array.isArray((sendLogRes.data as any).attachment_file_ids)
    ? ((sendLogRes.data as any).attachment_file_ids as unknown[])
        .map((value) => String(value ?? '').trim())
        .filter((value) => isUuid(value))
    : [];
  const unique = [...new Set(ids)];
  if (!params.quotePdfFileId) return unique;
  return unique.filter((id) => id !== params.quotePdfFileId);
}

async function loadTokenScopedAttachments(params: {
  quoteId: string;
  token: string;
  quoteVersionUuid: string;
  tokenHash: string;
  quotePdfFileId: string | null;
}): Promise<PublicQuoteAttachment[]> {
  const attachmentFileIds = await loadTokenScopedAttachmentFileIds({
    quoteVersionUuid: params.quoteVersionUuid,
    tokenHash: params.tokenHash,
    quotePdfFileId: params.quotePdfFileId,
  });
  if (!attachmentFileIds.length) return [];

  const supabase = getServiceSupabase();
  const filesRes = await supabase
    .from('file_artifacts')
    .select('id, filename, content_type')
    .in('id', attachmentFileIds);

  if (filesRes.error || !Array.isArray(filesRes.data)) return [];
  const byId = new Map<string, { filename: string; contentType: string | null }>();
  for (const row of filesRes.data as any[]) {
    const id = String(row?.id ?? '').trim();
    if (!isUuid(id)) continue;
    const filename = typeof row?.filename === 'string' && row.filename.trim() ? row.filename.trim() : `${id}.pdf`;
    const contentType = typeof row?.content_type === 'string' ? row.content_type : null;
    byId.set(id, { filename, contentType });
  }

  return attachmentFileIds
    .map((id) => {
      const file = byId.get(id);
      if (!file) return null;
      if (!looksLikePdf(file.contentType, file.filename)) return null;
      return {
        id,
        label: file.filename,
        href: `/api/quotes/${encodeURIComponent(params.quoteId)}/attachments/${encodeURIComponent(id)}?token=${encodeURIComponent(params.token)}`,
      } satisfies PublicQuoteAttachment;
    })
    .filter((item): item is PublicQuoteAttachment => Boolean(item));
}

async function insertAuditEvent(projectId: string, type: string, payload: Record<string, unknown>): Promise<void> {
  const supabase = getServiceSupabase();
  try {
    await supabase.from('audit_events').insert({
      project_id: projectId,
      type,
      idempotency_key: `${type}:${projectId}:${randomUUID()}`,
      payload,
    } as any);
  } catch {
    // Best effort audit logging for public acceptance flow.
  }
}

export async function loadPublicQuoteByToken(params: { quoteId: string; token: string }): Promise<PublicQuoteLookupResult> {
  const access = await loadActiveQuoteVersionByToken(params);
  if (!access.version) return { quote: null, reason: access.reason };
  const version = access.version;

  const [quoteProject, lineItems, attachments] = await Promise.all([
    loadQuoteProject(version.quoteId),
    loadLineItems(version.quoteVersionUuid),
    loadTokenScopedAttachments({
      quoteId: params.quoteId,
      token: params.token,
      quoteVersionUuid: version.quoteVersionUuid,
      tokenHash: version.tokenHash,
      quotePdfFileId: version.pdfFileId,
    }),
  ]);
  if (!quoteProject) return { quote: null, reason: 'invalid' };

  const project = await loadProject(quoteProject.projectId);

  const quote: PublicQuote = {
    id: params.quoteId,
    status: version.status,
    quoteRef: quoteProject.quoteRef,
    versionNumber: version.versionNumber,
    customerName: version.customerName || project.customerName,
    projectName: project.name,
    projectAddress: project.siteAddress,
    totalIncGstCents: version.totalIncGstCents,
    totalExGstCents: version.totalExGstCents,
    gstCents: version.gstCents,
    createdAt: version.createdAt,
    sentAt: version.sentAt,
    expiresAt: version.expiresAt,
    tokenExpiresAt: version.tokenExpiresAt,
    introText: version.introText,
    termsText: version.termsText,
    lineItems,
    attachments,
  };

  return { quote };
}

export async function downloadPublicQuoteAttachmentByToken(params: {
  quoteId: string;
  token: string;
  fileId: string;
}): Promise<PublicQuoteAttachmentDownloadResult> {
  let fileUuid: string;
  try {
    fileUuid = fileArtifactUuidFromParam(params.fileId);
  } catch (error) {
    return { ok: false, code: 'invalid', message: errorMessage(error, 'Invalid attachment ID') };
  }

  const access = await loadActiveQuoteVersionByToken({ quoteId: params.quoteId, token: params.token });
  if (!access.version) {
    return {
      ok: false,
      code: access.reason,
      message: access.reason === 'expired' ? 'Quote link has expired' : 'Invalid quote link',
    };
  }
  const version = access.version;

  const attachmentIds = await loadTokenScopedAttachmentFileIds({
    quoteVersionUuid: version.quoteVersionUuid,
    tokenHash: version.tokenHash,
    quotePdfFileId: version.pdfFileId,
  });
  if (!attachmentIds.includes(fileUuid)) {
    return { ok: false, code: 'not_found', message: 'Attachment not found for this quote link' };
  }

  const supabase = getServiceSupabase();
  const fileRes = await supabase
    .from('file_artifacts')
    .select('id, filename, content_type, content_base64')
    .eq('id', fileUuid)
    .maybeSingle();
  if (fileRes.error || !fileRes.data) {
    return { ok: false, code: 'not_found', message: 'Attachment file not found' };
  }

  const filename =
    typeof (fileRes.data as any).filename === 'string' && (fileRes.data as any).filename.trim()
      ? String((fileRes.data as any).filename).trim()
      : `${fileUuid}.pdf`;
  const contentType =
    typeof (fileRes.data as any).content_type === 'string' && (fileRes.data as any).content_type.trim()
      ? String((fileRes.data as any).content_type).trim()
      : 'application/pdf';
  if (!looksLikePdf(contentType, filename)) {
    return { ok: false, code: 'not_found', message: 'Attachment is unavailable' };
  }

  const contentBase64 = String((fileRes.data as any).content_base64 ?? '');
  const bytes = Buffer.from(contentBase64, 'base64');
  if (!bytes.length) {
    return { ok: false, code: 'not_found', message: 'Attachment is empty' };
  }

  return {
    ok: true,
    filename,
    contentType,
    bytes,
  };
}

export async function acceptPublicQuoteByToken(params: {
  quoteId: string;
  token: string;
}): Promise<AcceptPublicQuoteResult> {
  let access: Awaited<ReturnType<typeof loadActiveQuoteVersionByToken>>;
  try {
    access = await loadActiveQuoteVersionByToken(params);
  } catch (error) {
    return { ok: false, code: 'invalid', message: errorMessage(error, 'Invalid quote ID') };
  }

  if (!access.version && access.reason === 'expired') {
    return { ok: false, code: 'expired', message: 'Quote link has expired' };
  }
  if (!access.version) return { ok: false, code: 'invalid', message: 'Invalid token' };
  const version = access.version;

  if (version.status === 'ACCEPTED') {
    return { ok: true, alreadyAccepted: true };
  }

  if (version.status !== 'SENT') {
    return { ok: false, code: 'invalid_status', message: 'Quote cannot be accepted in its current status' };
  }

  const supabase = getServiceSupabase();
  const nowIso = new Date().toISOString();

  const updateRes = await supabase
    .from('quote_versions')
    .update({ status: 'ACCEPTED', accepted_at: nowIso } as any)
    .eq('id', version.quoteVersionUuid);

  if (updateRes.error) {
    return { ok: false, code: 'server', message: updateRes.error.message ?? 'Failed to accept quote' };
  }

  const quoteProject = await loadQuoteProject(version.quoteId);
  const projectId = quoteProject?.projectId ?? null;
  if (projectId) {
    await insertAuditEvent(projectId, 'quote.accepted', { quoteVersionId: version.quoteVersionUuid });
  }

  try {
    await ensureDepositInvoiceForAcceptedQuote({
      quoteVersionUuid: version.quoteVersionUuid,
      actor: null,
    });
  } catch (error) {
    const message = errorMessage(error, 'Failed to trigger deposit invoice');
    if (projectId) {
      await insertAuditEvent(projectId, 'invoice.send_failed', {
        quoteVersionId: version.quoteVersionUuid,
        reason: message,
      });
    } else {
      console.error('[public_quote_accept] invoice trigger failed', { quoteVersionId: version.quoteVersionUuid, error: message });
    }
  }

  return { ok: true, alreadyAccepted: false };
}
