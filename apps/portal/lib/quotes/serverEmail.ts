import 'server-only';

import { sendTransactionalEmail } from '@/lib/emails/sendTransactionalEmail';
import { generateAcceptToken } from '@/lib/quotes/acceptToken';
import { uuidFromAppId } from '@/lib/supabase/mappers';
import { supabaseServiceRole } from '@/lib/supabaseClient';
import type { QuoteVersionDetail } from './types';
import {
  createFileArtifact,
  ensurePdfForSend,
  ensureQuoteArtifacts,
  getQuoteVersionDetail,
  insertAuditEvent,
  insertSendLog,
  updateProjectStage,
} from './serverCore';
import { addDays, nowIso } from './serverHelpers';
import {
  buildQuotePreviewBasePayload,
  isQuotePreviewBasePayload,
  quoteLogoUrl,
  quoteNumber,
  renderExpiresLabel,
  renderQuotePreviewFromBasePayload,
  type QuotePreviewBasePayload,
} from './renderArtifacts';

const REPLY_TO_EMAIL = 'info@sanctuarypergolas.co.nz';
// Capped at ~4 MB to fit under Vercel's 4.5 MB serverless function body limit.
// Keep in sync with the API routes + QuotesTab.tsx.
const MAX_ATTACHMENT_BYTES = 4 * 1024 * 1024;
const MAX_ATTACHMENTS_TOTAL_BYTES = 4 * 1024 * 1024;
const MAX_ATTACHMENT_COUNT = 10;

const ALLOWED_ATTACHMENT_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

const ALLOWED_ATTACHMENT_EXTENSIONS = new Set(['.pdf', '.jpg', '.jpeg', '.png', '.webp']);

export class EmailProviderConfigError extends Error {
  status = 503;
  code = 'EMAIL_PROVIDER_NOT_CONFIGURED';
}

type QuoteEmailAttachment = {
  filename: string;
  contentType: string;
  content: Buffer;
};

type QuoteEmailPayload = {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject?: string;
  personalNote?: string | null;
  bodyText?: string;
  bodyHtml?: string | null;
  attachmentNames?: string[];
  attachments?: QuoteEmailAttachment[];
};

type QuoteEmailMode = 'send' | 'resend';

function messageFromError(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  const msg = typeof (error as any)?.message === 'string' ? String((error as any).message) : '';
  return msg || fallback;
}

function toConfigError(error: unknown): EmailProviderConfigError | null {
  const message = messageFromError(error, '');
  if (!message) return null;
  if (message.includes('RESEND_API_KEY')) return new EmailProviderConfigError(message);
  if (message.includes('PUBLIC_SITE_URL')) return new EmailProviderConfigError(message);
  if (message.includes('NEXT_PUBLIC_SITE_URL')) return new EmailProviderConfigError(message);
  return null;
}

function pickSiteUrl(): string {
  const raw =
    process.env.PUBLIC_SITE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.NEXT_PUBLIC_MARKETING_SITE_URL?.trim() ||
    '';
  if (!raw) {
    throw new EmailProviderConfigError('Missing env var: PUBLIC_SITE_URL');
  }

  const normalized = raw.replace(/\/+$/, '');
  if (!normalized) {
    throw new EmailProviderConfigError('PUBLIC_SITE_URL must be a valid absolute URL');
  }
  try {
    return new URL(normalized).toString().replace(/\/+$/, '');
  } catch {
    throw new EmailProviderConfigError('PUBLIC_SITE_URL must be a valid absolute URL');
  }
}

function quoteAcceptLink(quoteVersionId: string, token: string): string {
  const base = pickSiteUrl();
  const id = encodeURIComponent(quoteVersionId);
  const tokenParam = encodeURIComponent(token);
  return `${base}/quote/${id}?token=${tokenParam}`;
}

function personalNoteFromPayload(payload: QuoteEmailPayload): string | null {
  const note =
    typeof payload.personalNote === 'string'
      ? payload.personalNote
      : typeof payload.bodyText === 'string'
        ? payload.bodyText
        : '';
  const trimmed = note.trim();
  return trimmed ? trimmed : null;
}

function redactToken(value: string | null): string | null {
  if (typeof value !== 'string') return value;
  return value.replace(/([?&]token=)[^&\\s\"'<>]+/gi, '$1[redacted]');
}

function quoteSubject(detail: QuoteVersionDetail, explicit: string | undefined): string {
  const trimmed = typeof explicit === 'string' ? explicit.trim() : '';
  if (trimmed) return trimmed;
  return `Quote ready - ${quoteNumber(detail)}`;
}

function fileExtension(filename: string): string {
  const trimmed = filename.trim().toLowerCase();
  const idx = trimmed.lastIndexOf('.');
  return idx >= 0 ? trimmed.slice(idx) : '';
}

function isAllowedAttachment(contentType: string, filename: string): boolean {
  const mime = contentType.trim().toLowerCase();
  if (ALLOWED_ATTACHMENT_MIME_TYPES.has(mime)) return true;
  return ALLOWED_ATTACHMENT_EXTENSIONS.has(fileExtension(filename));
}

function normalizeAttachmentFilename(filename: string, index: number): string {
  const trimmed = filename.trim();
  if (!trimmed) return `attachment-${index + 1}.bin`;
  return trimmed.replace(/[\\/:*?"<>|]+/g, '_');
}

function parseDateOnly(dateOnly: string): Date | null {
  const parsed = new Date(`${dateOnly}T23:59:59.999Z`);
  if (!Number.isFinite(parsed.getTime())) return null;
  return parsed;
}

function tokenExpiryIso(expiresAtDate: string, sentAtIso: string): string {
  const parsed = parseDateOnly(expiresAtDate);
  if (parsed) return parsed.toISOString();

  const fallbackDateOnly = addDays(sentAtIso, 30);
  const fallback = parseDateOnly(fallbackDateOnly);
  return fallback ? fallback.toISOString() : new Date(sentAtIso).toISOString();
}

function providerMessageId(response: unknown): string | null {
  const id = (response as any)?.data?.id;
  return typeof id === 'string' && id.trim() ? id.trim() : null;
}

async function loadQuoteForMode(quoteVersionId: string, mode: QuoteEmailMode): Promise<QuoteVersionDetail> {
  const detail = await getQuoteVersionDetail(quoteVersionId);
  if (!detail) throw new Error('Quote not found');
  if (mode === 'send' && detail.status !== 'DRAFT') throw new Error('Quote is locked');
  if (mode === 'resend' && detail.status === 'DRAFT') throw new Error('Quote must be sent first');
  return detail;
}

async function loadPreviewBaseForMode(
  quoteVersionId: string,
  mode: QuoteEmailMode,
): Promise<{ base: QuotePreviewBasePayload; cacheHit: boolean }> {
  const quoteVersionUuid = uuidFromAppId(quoteVersionId, 'qv');
  const res = await supabaseServiceRole
    .from('quote_versions')
    .select('status, preview_base_payload')
    .eq('id', quoteVersionUuid)
    .maybeSingle();

  if (res.error) {
    throw new Error(res.error.message ?? 'Failed to load quote preview');
  }
  if (!res.data) throw new Error('Quote not found');

  const status = typeof (res.data as any)?.status === 'string' ? String((res.data as any).status).toUpperCase() : 'DRAFT';
  if (mode === 'send' && status !== 'DRAFT') throw new Error('Quote is locked');
  if (mode === 'resend' && status === 'DRAFT') throw new Error('Quote must be sent first');

  const cachedBase = isQuotePreviewBasePayload((res.data as any)?.preview_base_payload)
    ? ((res.data as any).preview_base_payload as QuotePreviewBasePayload)
    : null;
  if (cachedBase) return { base: cachedBase, cacheHit: true };

  const ensured = await ensureQuoteArtifacts(quoteVersionId, null, { requirePdf: false });
  return { base: ensured.previewBase, cacheHit: ensured.cacheHit };
}

async function resolveExtraAttachments(params: {
  projectUuid: string;
  payload: QuoteEmailPayload;
  actor: string | null;
}): Promise<Array<{ fileUuid: string; filename: string; contentType: string; content: Buffer }>> {
  const attachments = Array.isArray(params.payload.attachments) ? params.payload.attachments : [];
  if (!attachments.length) return [];

  if (attachments.length > MAX_ATTACHMENT_COUNT) {
    throw new Error(`A quote email can include at most ${MAX_ATTACHMENT_COUNT} extra attachments`);
  }

  let totalBytes = 0;
  const resolved: Array<{ fileUuid: string; filename: string; contentType: string; content: Buffer }> = [];

  for (let i = 0; i < attachments.length; i += 1) {
    const att = attachments[i];
    const filename = normalizeAttachmentFilename(att.filename, i);
    const contentType = att.contentType.trim() || 'application/octet-stream';

    if (!isAllowedAttachment(contentType, filename)) {
      throw new Error(`Attachment "${filename}" must be a PDF, JPG, PNG, or WEBP`);
    }
    if (att.content.length <= 0) {
      throw new Error(`Attachment "${filename}" is empty`);
    }
    if (att.content.length > MAX_ATTACHMENT_BYTES) {
      throw new Error(`Attachment "${filename}" must be 4MB or smaller`);
    }
    totalBytes += att.content.length;
    if (totalBytes > MAX_ATTACHMENTS_TOTAL_BYTES) {
      throw new Error('Combined attachment size must be 4MB or smaller');
    }

    const artifact = await createFileArtifact({
      projectUuid: params.projectUuid,
      filename,
      contentType,
      content: att.content,
      actor: params.actor,
    });

    resolved.push({
      fileUuid: artifact.fileUuid,
      filename: artifact.filename,
      contentType,
      content: att.content,
    });
  }

  return resolved;
}

async function renderQuoteReadyContent(params: {
  base: QuotePreviewBasePayload;
  payload: QuoteEmailPayload;
}): Promise<{ subject: string; html: string; text: string | null }> {
  return renderQuotePreviewFromBasePayload(params.base, params.payload);
}

async function deliverQuoteReadyEmail(params: {
  base: QuotePreviewBasePayload;
  payload: QuoteEmailPayload;
  attachments: Array<{ filename: string; content: Buffer; contentType: string }>;
}): Promise<{ subject: string; html: string; text: string | null; providerMessageId: string | null }> {
  const rendered = await renderQuoteReadyContent(params);

  const response = await sendTransactionalEmail({
    to: params.payload.to,
    cc: params.payload.cc,
    bcc: params.payload.bcc,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text ?? undefined,
    attachments: params.attachments,
  });

  return {
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    providerMessageId: providerMessageId(response),
  };
}

async function updateQuoteSendState(params: {
  quoteVersionUuid: string;
  status?: 'SENT' | 'ACCEPTED' | 'DECLINED' | 'DRAFT';
  sentAt?: string | null;
  sentBy?: string | null;
  expiresAt?: string | null;
  acceptTokenHash?: string | null;
  acceptTokenExpiresAt?: string | null;
  acceptedAt?: string | null;
}) {
  const patch: Record<string, unknown> = {};
  if (params.status) patch.status = params.status;
  if (typeof params.sentAt === 'string' || params.sentAt === null) patch.sent_at = params.sentAt;
  if (typeof params.sentBy === 'string' || params.sentBy === null) patch.sent_by = params.sentBy;
  if (typeof params.expiresAt === 'string' || params.expiresAt === null) patch.expires_at = params.expiresAt;
  if (typeof params.acceptTokenHash === 'string' || params.acceptTokenHash === null) patch.accept_token_hash = params.acceptTokenHash;
  if (typeof params.acceptTokenExpiresAt === 'string' || params.acceptTokenExpiresAt === null) {
    patch.accept_token_expires_at = params.acceptTokenExpiresAt;
  }
  if (typeof params.acceptedAt === 'string' || params.acceptedAt === null) patch.accepted_at = params.acceptedAt;

  const res = await supabaseServiceRole.from('quote_versions').update(patch as any).eq('id', params.quoteVersionUuid);
  if (res.error) {
    throw new Error(res.error.message ?? 'Failed to update quote');
  }
}

export async function sendQuote(
  quoteVersionId: string,
  payload: QuoteEmailPayload,
  actor: string | null,
): Promise<QuoteVersionDetail> {
  const detail = await loadQuoteForMode(quoteVersionId, 'send');

  const projectUuid = uuidFromAppId(detail.projectId, 'proj');
  const quoteVersionUuid = uuidFromAppId(detail.id, 'qv');

  const pdf = await ensurePdfForSend(detail, actor);
  const extraAttachments = await resolveExtraAttachments({ projectUuid, payload, actor });
  const emailAttachments: Array<{ filename: string; content: Buffer; contentType: string }> = [
    {
      filename: pdf.filename,
      content: pdf.content,
      contentType: 'application/pdf',
    },
  ];
  const logAttachmentFileIds = [pdf.fileUuid];
  for (const attachment of extraAttachments) {
    emailAttachments.push({
      filename: attachment.filename,
      content: attachment.content,
      contentType: attachment.contentType,
    });
    logAttachmentFileIds.push(attachment.fileUuid);
  }

  const sentAtIso = nowIso();
  const expiresAtDate = detail.expiresAt ?? addDays(sentAtIso, 30);
  const { token, tokenHash } = generateAcceptToken();
  const acceptTokenExpiresAt = tokenExpiryIso(expiresAtDate, sentAtIso);

  let delivered: { subject: string; html: string; text: string | null; providerMessageId: string | null } | null = null;
  let sendError: string | null = null;
  let sendErrorObj: unknown = null;

  try {
    const quoteAcceptUrl = quoteAcceptLink(detail.id, token);
    const base = buildQuotePreviewBasePayload({
      detail,
      quoteAcceptUrl,
      expiresAtLabel: renderExpiresLabel(expiresAtDate),
      logoUrl: quoteLogoUrl(),
    });
    delivered = await deliverQuoteReadyEmail({
      base,
      payload,
      attachments: emailAttachments,
    });
  } catch (error) {
    sendError = messageFromError(error, 'Failed to send email');
    sendErrorObj = error;
  }

  if (delivered && !sendError) {
    await updateQuoteSendState({
      quoteVersionUuid,
      status: 'SENT',
      sentAt: detail.sentAt ?? sentAtIso,
      sentBy: actor,
      expiresAt: expiresAtDate,
      acceptTokenHash: tokenHash,
      acceptTokenExpiresAt,
    });

    await updateProjectStage(projectUuid, 'SENT', quoteVersionUuid);

    const logId = await insertSendLog({
      projectUuid,
      quoteVersionUuid,
      fromName: 'Sanctuary Pergolas',
      fromEmail: REPLY_TO_EMAIL,
      replyTo: REPLY_TO_EMAIL,
      to: payload.to,
      cc: payload.cc ?? [],
      bcc: payload.bcc ?? [],
      subject: delivered.subject,
      bodyHtml: redactToken(delivered.html),
      bodyText: redactToken(delivered.text),
      attachmentFileIds: logAttachmentFileIds,
      provider: 'resend',
      providerMessageId: delivered.providerMessageId,
      acceptTokenHash: tokenHash,
      status: 'SENT',
      actor,
      sentAt: sentAtIso,
    });

    await insertAuditEvent({
      projectId: projectUuid,
      type: 'quote.sent',
      payload: { quoteVersionId: quoteVersionUuid, sendLogId: logId, to: payload.to },
    });
  } else {
    await insertSendLog({
      projectUuid,
      quoteVersionUuid,
      fromName: 'Sanctuary Pergolas',
      fromEmail: REPLY_TO_EMAIL,
      replyTo: REPLY_TO_EMAIL,
      to: payload.to,
      cc: payload.cc ?? [],
      bcc: payload.bcc ?? [],
      subject: quoteSubject(detail, payload.subject),
      bodyHtml: payload.bodyHtml ?? null,
      bodyText: personalNoteFromPayload(payload),
      attachmentFileIds: logAttachmentFileIds,
      provider: 'resend',
      providerMessageId: null,
      status: 'FAILED',
      actor,
      sentAt: null,
      errorMessage: sendError ?? 'Failed to send email',
    });

    const configError = toConfigError(sendErrorObj);
    if (configError) throw configError;
    throw new Error(sendError ?? 'Failed to send email');
  }

  let updated = await getQuoteVersionDetail(quoteVersionId);
  if (!updated) throw new Error('Failed to load quote');
  try {
    await ensureQuoteArtifacts(quoteVersionId, actor, { requirePdf: true, allowCached: false });
    updated = (await getQuoteVersionDetail(quoteVersionId)) ?? updated;
  } catch (error) {
    console.error('[quote_artifacts] failed to refresh after send', { quoteVersionId, error });
  }
  return updated;
}

export async function resendQuote(
  quoteVersionId: string,
  payload: QuoteEmailPayload,
  actor: string | null,
): Promise<QuoteVersionDetail> {
  const detail = await loadQuoteForMode(quoteVersionId, 'resend');

  const projectUuid = uuidFromAppId(detail.projectId, 'proj');
  const quoteVersionUuid = uuidFromAppId(detail.id, 'qv');

  const pdf = await ensurePdfForSend(detail, actor);
  const extraAttachments = await resolveExtraAttachments({ projectUuid, payload, actor });
  const emailAttachments: Array<{ filename: string; content: Buffer; contentType: string }> = [
    {
      filename: pdf.filename,
      content: pdf.content,
      contentType: 'application/pdf',
    },
  ];
  const logAttachmentFileIds = [pdf.fileUuid];
  for (const attachment of extraAttachments) {
    emailAttachments.push({
      filename: attachment.filename,
      content: attachment.content,
      contentType: attachment.contentType,
    });
    logAttachmentFileIds.push(attachment.fileUuid);
  }

  const sentAtIso = nowIso();
  const expiresAtDate = detail.expiresAt ?? addDays(sentAtIso, 30);
  const { token, tokenHash } = generateAcceptToken();
  const acceptTokenExpiresAt = tokenExpiryIso(expiresAtDate, sentAtIso);

  let delivered: { subject: string; html: string; text: string | null; providerMessageId: string | null } | null = null;
  let sendError: string | null = null;
  let sendErrorObj: unknown = null;

  try {
    const quoteAcceptUrl = quoteAcceptLink(detail.id, token);
    const base = buildQuotePreviewBasePayload({
      detail,
      quoteAcceptUrl,
      expiresAtLabel: renderExpiresLabel(expiresAtDate),
      logoUrl: quoteLogoUrl(),
    });
    delivered = await deliverQuoteReadyEmail({
      base,
      payload,
      attachments: emailAttachments,
    });
  } catch (error) {
    sendError = messageFromError(error, 'Failed to send email');
    sendErrorObj = error;
  }

  if (delivered && !sendError) {
    const expiryPatch = detail.expiresAt ? {} : { expiresAt: expiresAtDate };
    await updateQuoteSendState({
      quoteVersionUuid,
      ...expiryPatch,
      acceptTokenHash: tokenHash,
      acceptTokenExpiresAt,
    });

    const logId = await insertSendLog({
      projectUuid,
      quoteVersionUuid,
      fromName: 'Sanctuary Pergolas',
      fromEmail: REPLY_TO_EMAIL,
      replyTo: REPLY_TO_EMAIL,
      to: payload.to,
      cc: payload.cc ?? [],
      bcc: payload.bcc ?? [],
      subject: delivered.subject,
      bodyHtml: redactToken(delivered.html),
      bodyText: redactToken(delivered.text),
      attachmentFileIds: logAttachmentFileIds,
      provider: 'resend',
      providerMessageId: delivered.providerMessageId,
      acceptTokenHash: tokenHash,
      status: 'SENT',
      actor,
      sentAt: sentAtIso,
    });

    await insertAuditEvent({
      projectId: projectUuid,
      type: 'quote.resent',
      payload: { quoteVersionId: quoteVersionUuid, sendLogId: logId, to: payload.to },
    });
  } else {
    await insertSendLog({
      projectUuid,
      quoteVersionUuid,
      fromName: 'Sanctuary Pergolas',
      fromEmail: REPLY_TO_EMAIL,
      replyTo: REPLY_TO_EMAIL,
      to: payload.to,
      cc: payload.cc ?? [],
      bcc: payload.bcc ?? [],
      subject: quoteSubject(detail, payload.subject),
      bodyHtml: payload.bodyHtml ?? null,
      bodyText: personalNoteFromPayload(payload),
      attachmentFileIds: logAttachmentFileIds,
      provider: 'resend',
      providerMessageId: null,
      status: 'FAILED',
      actor,
      sentAt: null,
      errorMessage: sendError ?? 'Failed to send email',
    });

    const configError = toConfigError(sendErrorObj);
    if (configError) throw configError;
    throw new Error(sendError ?? 'Failed to send email');
  }

  let updated = await getQuoteVersionDetail(quoteVersionId);
  if (!updated) throw new Error('Failed to load quote');
  try {
    await ensureQuoteArtifacts(quoteVersionId, actor, { requirePdf: true, allowCached: false });
    updated = (await getQuoteVersionDetail(quoteVersionId)) ?? updated;
  } catch (error) {
    console.error('[quote_artifacts] failed to refresh after resend', { quoteVersionId, error });
  }
  return updated;
}

export async function previewQuoteEmail(
  quoteVersionId: string,
  payload: QuoteEmailPayload,
  mode: QuoteEmailMode,
): Promise<{ subject: string; html: string; text: string | null; cacheHit: boolean }> {
  const { base, cacheHit } = await loadPreviewBaseForMode(quoteVersionId, mode);
  const rendered = await renderQuoteReadyContent({
    base,
    payload,
  });
  return { ...rendered, cacheHit };
}
