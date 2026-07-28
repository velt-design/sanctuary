import 'server-only';

import { sendTransactionalEmail } from '@/lib/emails/sendTransactionalEmail';
import {
  commercialEmailFailure,
  findCommercialEmailIntentByKey,
  findUnfinishedCommercialEmailIntent,
  markCommercialEmailDispatching,
  markCommercialEmailFailed,
  markCommercialEmailFinalised,
  markCommercialEmailProviderAccepted,
  prepareCommercialEmailIntent,
  prepareQuoteDeliveryEmailIntent,
  type CommercialEmailIntent,
} from '@/lib/commercial/emailIntent';
import { generateAcceptToken } from '@/lib/quotes/acceptToken';
import { uuidFromAppId } from '@/lib/supabase/mappers';
import { supabaseServiceRole } from '@/lib/supabaseClient';
import type {
  PreparedQuoteDeliverySummary,
  QuoteVersionDetail,
} from './types';
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
  intentId?: string;
  expectedCommercialRevision?: number;
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
  if (params.status) {
    patch.status = params.status;
    if (params.status !== 'DRAFT') patch.is_current_draft = false;
  }
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

type FrozenQuoteEmail = {
  mode: QuoteEmailMode;
  commercialRevision: number;
  sentAt: string;
  expiresAt: string;
  acceptTokenHash: string;
  acceptTokenExpiresAt: string;
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  html: string;
  text: string | null;
  attachmentFileIds: string[];
  actor: string | null;
};

function frozenString(
  payload: Readonly<Record<string, unknown>>,
  key: string,
): string {
  const value = payload[key];
  if (typeof value !== 'string' || !value) {
    throw new Error(`Prepared quote delivery is missing ${key}`);
  }
  return value;
}

function frozenStringArray(
  payload: Readonly<Record<string, unknown>>,
  key: string,
): string[] {
  const value = payload[key];
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new Error(`Prepared quote delivery is missing ${key}`);
  }
  return value as string[];
}

function frozenPositiveInteger(
  payload: Readonly<Record<string, unknown>>,
  key: string,
): number {
  const value = Number(payload[key]);
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`Prepared quote delivery is missing ${key}`);
  }
  return value;
}

function parseFrozenQuoteEmail(intent: CommercialEmailIntent): FrozenQuoteEmail {
  const payload = intent.protectedPayload;
  const mode = frozenString(payload, 'mode');
  if (mode !== 'send' && mode !== 'resend') {
    throw new Error('Prepared quote delivery has an invalid mode');
  }
  return {
    mode,
    commercialRevision: frozenPositiveInteger(
      payload,
      'commercialRevision',
    ),
    sentAt: frozenString(payload, 'sentAt'),
    expiresAt: frozenString(payload, 'expiresAt'),
    acceptTokenHash: frozenString(payload, 'acceptTokenHash'),
    acceptTokenExpiresAt: frozenString(payload, 'acceptTokenExpiresAt'),
    to: frozenStringArray(payload, 'to'),
    cc: frozenStringArray(payload, 'cc'),
    bcc: frozenStringArray(payload, 'bcc'),
    subject: frozenString(payload, 'subject'),
    html: frozenString(payload, 'html'),
    text: typeof payload.text === 'string' ? payload.text : null,
    attachmentFileIds: frozenStringArray(payload, 'attachmentFileIds'),
    actor: typeof payload.actor === 'string' ? payload.actor : null,
  };
}

async function loadPreparedAttachments(
  fileIds: string[],
): Promise<Array<{ filename: string; content: Buffer; contentType: string }>> {
  if (!fileIds.length) return [];
  const result = await supabaseServiceRole
    .from('file_artifacts')
    .select('id,filename,content_type,content_base64')
    .in('id', fileIds);
  if (result.error) {
    throw new Error(result.error.message ?? 'Failed to load prepared attachments');
  }
  const rows = new Map(
    (Array.isArray(result.data) ? result.data : []).map((row: any) => [
      String(row.id ?? ''),
      row,
    ]),
  );
  return fileIds.map((fileId) => {
    const row: any = rows.get(fileId);
    if (!row) throw new Error('A prepared quote attachment is unavailable');
    return {
      filename: String(row.filename ?? 'attachment.bin'),
      contentType: String(row.content_type ?? 'application/octet-stream'),
      content: Buffer.from(String(row.content_base64 ?? ''), 'base64'),
    };
  });
}

async function loadPreparedAttachmentNames(fileIds: string[]): Promise<string[]> {
  if (!fileIds.length) return [];
  const result = await supabaseServiceRole
    .from('file_artifacts')
    .select('id,filename')
    .in('id', fileIds);
  if (result.error) {
    throw new Error(
      result.error.message ?? 'Failed to load prepared attachment names',
    );
  }
  const namesById = new Map(
    (Array.isArray(result.data) ? result.data : []).map((row: any) => [
      String(row.id ?? ''),
      String(row.filename ?? 'attachment.bin'),
    ]),
  );
  return fileIds.map(
    (fileId) => namesById.get(fileId) ?? 'Unavailable attachment',
  );
}

async function prepareQuoteEmailIntent(params: {
  detail: QuoteVersionDetail;
  mode: QuoteEmailMode;
  payload: QuoteEmailPayload;
  actor: string | null;
  projectUuid: string;
  quoteVersionUuid: string;
  intentKey: string;
}): Promise<CommercialEmailIntent> {
  if (
    params.detail.commercialRevision !==
    params.payload.expectedCommercialRevision
  ) {
    throw new Error('Quote changed after this delivery review. Review it again before sending.');
  }
  if (params.mode === 'send' && !params.detail.isCurrentDraft) {
    throw new Error('This draft has been superseded and cannot be sent');
  }

  const pdf = await ensurePdfForSend(params.detail, params.actor);
  const extraAttachments = await resolveExtraAttachments({
    projectUuid: params.projectUuid,
    payload: params.payload,
    actor: params.actor,
  });
  const attachmentFileIds = [
    pdf.fileUuid,
    ...extraAttachments.map((attachment) => attachment.fileUuid),
  ];
  const sentAt = nowIso();
  const expiresAt = params.detail.expiresAt ?? addDays(sentAt, 30);
  const { token, tokenHash } = generateAcceptToken();
  const acceptTokenExpiresAt = tokenExpiryIso(expiresAt, sentAt);
  const base = buildQuotePreviewBasePayload({
    detail: params.detail,
    quoteAcceptUrl: quoteAcceptLink(params.detail.id, token),
    expiresAtLabel: renderExpiresLabel(expiresAt),
    logoUrl: quoteLogoUrl(),
  });
  const rendered = await renderQuoteReadyContent({
    base,
    payload: params.payload,
  });

  const preparedInput = {
    intentKey: params.intentKey,
    kind: params.mode === 'send' ? 'quote_send' : 'quote_resend',
    subjectId: params.quoteVersionUuid,
    projectId: params.projectUuid,
    protectedPayload: {
      mode: params.mode,
      commercialRevision: params.detail.commercialRevision,
      sentAt,
      expiresAt,
      acceptTokenHash: tokenHash,
      acceptTokenExpiresAt,
      to: params.payload.to,
      cc: params.payload.cc ?? [],
      bcc: params.payload.bcc ?? [],
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      attachmentFileIds,
      actor: params.actor,
    },
  } as const;
  if (params.mode === 'send') {
    return prepareQuoteDeliveryEmailIntent({
      ...preparedInput,
      quoteVersionId: params.quoteVersionUuid,
      expectedCommercialRevision: params.detail.commercialRevision,
      kind: 'quote_send',
    });
  }
  return prepareCommercialEmailIntent({
    ...preparedInput,
    kind: 'quote_resend',
  });
}

async function recordQuoteDeliveryFailure(params: {
  intent: CommercialEmailIntent;
  frozen: FrozenQuoteEmail;
  projectUuid: string;
  quoteVersionUuid: string;
  message: string;
  errorCode: string;
  needsAttention: boolean;
}): Promise<void> {
  const logId = await insertSendLog({
    projectUuid: params.projectUuid,
    quoteVersionUuid: params.quoteVersionUuid,
    fromName: 'Sanctuary Pergolas',
    fromEmail: REPLY_TO_EMAIL,
    replyTo: REPLY_TO_EMAIL,
    to: params.frozen.to,
    cc: params.frozen.cc,
    bcc: params.frozen.bcc,
    subject: params.frozen.subject,
    bodyHtml: null,
    bodyText: null,
    attachmentFileIds: params.frozen.attachmentFileIds,
    provider: 'resend',
    providerMessageId: null,
    acceptTokenHash: params.frozen.acceptTokenHash,
    status: 'FAILED',
    errorMessage: params.message,
    deliveryIntentId: params.needsAttention ? params.intent.id : null,
    actor: params.frozen.actor,
    sentAt: null,
  });
  await insertAuditEvent({
    projectId: params.projectUuid,
    type: params.needsAttention
      ? 'quote.send_needs_attention'
      : 'quote.send_failed',
    idempotencyKey: params.needsAttention
      ? `quote.send_needs_attention:${params.intent.id}`
      : `quote.send_failed:${params.intent.id}:${params.intent.attemptCount}`,
    payload: {
      quoteVersionId: params.quoteVersionUuid,
      sendLogId: logId,
      deliveryIntentId: params.intent.id,
      errorCode: params.errorCode,
    },
  });
}

async function executeQuoteEmail(
  quoteVersionId: string,
  mode: QuoteEmailMode,
  payload: QuoteEmailPayload,
  actor: string | null,
  preparedIntent?: CommercialEmailIntent,
): Promise<QuoteVersionDetail> {
  const quoteVersionUuid = uuidFromAppId(quoteVersionId, 'qv');
  const intentId = payload.intentId?.trim() ?? '';
  if (!/^[A-Za-z0-9._:/-]{8,128}$/.test(intentId)) {
    throw new Error('A valid delivery intent is required');
  }
  const intentKey = `${mode === 'send' ? 'quote-send' : 'quote-resend'}:${quoteVersionUuid}:${intentId}`;
  let intent =
    preparedIntent ?? (await findCommercialEmailIntentByKey(intentKey));
  let detail = await getQuoteVersionDetail(quoteVersionId);
  if (!detail) throw new Error('Quote not found');
  const projectUuid = uuidFromAppId(detail.projectId, 'proj');

  if (
    intent &&
    (intent.subjectId !== quoteVersionUuid ||
      intent.kind !== (mode === 'send' ? 'quote_send' : 'quote_resend'))
  ) {
    throw new Error('Prepared delivery does not belong to this quote action');
  }

  if (!intent) {
    if (
      mode === 'resend' &&
      (await findUnfinishedCommercialEmailIntent(
        'quote_send',
        quoteVersionUuid,
      ))
    ) {
      throw new Error(
        'A prior delivery is still being finalised. Retry the prepared delivery before resending.',
      );
    }
    detail = await loadQuoteForMode(quoteVersionId, mode);
    intent = await prepareQuoteEmailIntent({
      detail,
      mode,
      payload,
      actor,
      projectUuid,
      quoteVersionUuid,
      intentKey,
    });
  }

  if (intent.kind !== (mode === 'send' ? 'quote_send' : 'quote_resend')) {
    throw new Error('Delivery intent does not match this action');
  }
  if (intent.status === 'finalised') return detail;
  const frozen = parseFrozenQuoteEmail(intent);
  if (intent.status === 'needs_attention') {
    await recordQuoteDeliveryFailure({
      intent,
      frozen,
      projectUuid,
      quoteVersionUuid,
      message: 'This delivery needs staff attention before it can be attempted again',
      errorCode: intent.lastErrorCode ?? 'DELIVERY_NEEDS_ATTENTION',
      needsAttention: true,
    });
    throw new Error('This delivery needs staff attention before it can be attempted again');
  }

  let providerMessage = intent.providerMessageId;
  if (intent.status !== 'provider_accepted') {
    intent = await markCommercialEmailDispatching(intent.id);
    if (intent.status === 'needs_attention') {
      await recordQuoteDeliveryFailure({
        intent,
        frozen,
        projectUuid,
        quoteVersionUuid,
        message:
          'This delivery needs staff attention before it can be attempted again',
        errorCode: intent.lastErrorCode ?? 'DELIVERY_NEEDS_ATTENTION',
        needsAttention: true,
      });
      throw new Error(
        'This delivery needs staff attention before it can be attempted again',
      );
    }
    try {
      const attachments = await loadPreparedAttachments(
        frozen.attachmentFileIds,
      );
      const response = await sendTransactionalEmail({
        to: frozen.to,
        cc: frozen.cc,
        bcc: frozen.bcc,
        subject: frozen.subject,
        html: frozen.html,
        text: frozen.text ?? undefined,
        attachments,
        idempotencyKey: intent.providerIdempotencyKey,
      });
      providerMessage = response.providerMessageId;
      intent = await markCommercialEmailProviderAccepted(
        intent.id,
        providerMessage,
      );
      if (intent.status === 'needs_attention') {
        await recordQuoteDeliveryFailure({
          intent,
          frozen,
          projectUuid,
          quoteVersionUuid,
          message:
            'The email provider response conflicts with the prepared delivery',
          errorCode:
            intent.lastErrorCode ?? 'PROVIDER_MESSAGE_ID_CONFLICT',
          needsAttention: true,
        });
        throw new Error(
          'The email provider response conflicts with the prepared delivery',
        );
      }
    } catch (error) {
      const failure = commercialEmailFailure(error);
      intent = await markCommercialEmailFailed(
        intent.id,
        failure.code,
        failure.needsAttention,
      );
      await recordQuoteDeliveryFailure({
        intent,
        frozen,
        projectUuid,
        quoteVersionUuid,
        message: messageFromError(error, 'Failed to send quote email'),
        errorCode: failure.code,
        needsAttention: intent.status === 'needs_attention',
      });
      const configError = toConfigError(error);
      if (configError) throw configError;
      throw error;
    }
  }
  if (!providerMessage) {
    throw new Error('Email provider acknowledgement is unavailable');
  }

  if (mode === 'send') {
    await updateQuoteSendState({
      quoteVersionUuid,
      status: 'SENT',
      sentAt: detail.sentAt ?? frozen.sentAt,
      sentBy: frozen.actor,
      expiresAt: frozen.expiresAt,
      acceptTokenHash: frozen.acceptTokenHash,
      acceptTokenExpiresAt: frozen.acceptTokenExpiresAt,
    });
    await updateProjectStage(projectUuid, 'SENT', quoteVersionUuid);
  } else {
    await updateQuoteSendState({
      quoteVersionUuid,
      ...(detail.expiresAt ? {} : { expiresAt: frozen.expiresAt }),
      acceptTokenHash: frozen.acceptTokenHash,
      acceptTokenExpiresAt: frozen.acceptTokenExpiresAt,
    });
  }

  const logId = await insertSendLog({
    projectUuid,
    quoteVersionUuid,
    fromName: 'Sanctuary Pergolas',
    fromEmail: REPLY_TO_EMAIL,
    replyTo: REPLY_TO_EMAIL,
    to: frozen.to,
    cc: frozen.cc,
    bcc: frozen.bcc,
    subject: frozen.subject,
    bodyHtml: redactToken(frozen.html),
    bodyText: redactToken(frozen.text),
    attachmentFileIds: frozen.attachmentFileIds,
    provider: 'resend',
    providerMessageId: providerMessage,
    acceptTokenHash: frozen.acceptTokenHash,
    status: 'SENT',
    deliveryIntentId: intent.id,
    actor: frozen.actor,
    sentAt: frozen.sentAt,
  });
  await insertAuditEvent({
    projectId: projectUuid,
    type: mode === 'send' ? 'quote.sent' : 'quote.resent',
    idempotencyKey: `${mode === 'send' ? 'quote.sent' : 'quote.resent'}:${intent.id}`,
    payload: {
      quoteVersionId: quoteVersionUuid,
      sendLogId: logId,
      deliveryIntentId: intent.id,
      to: frozen.to,
    },
  });
  await markCommercialEmailFinalised(intent.id);

  let updated = await getQuoteVersionDetail(quoteVersionId);
  if (!updated) throw new Error('Failed to load quote');
  try {
    await ensureQuoteArtifacts(quoteVersionId, actor, {
      requirePdf: true,
      allowCached: false,
    });
    updated = (await getQuoteVersionDetail(quoteVersionId)) ?? updated;
  } catch (error) {
    console.error('[quote_artifacts] failed to refresh after delivery', {
      quoteVersionId,
      error,
    });
  }
  return updated;
}

export async function sendQuote(
  quoteVersionId: string,
  payload: QuoteEmailPayload,
  actor: string | null,
): Promise<QuoteVersionDetail> {
  return executeQuoteEmail(quoteVersionId, 'send', payload, actor);
}

export async function resendQuote(
  quoteVersionId: string,
  payload: QuoteEmailPayload,
  actor: string | null,
): Promise<QuoteVersionDetail> {
  return executeQuoteEmail(quoteVersionId, 'resend', payload, actor);
}

export async function getPreparedQuoteDelivery(
  quoteVersionId: string,
  mode: QuoteEmailMode,
): Promise<PreparedQuoteDeliverySummary | null> {
  const quoteVersionUuid = uuidFromAppId(quoteVersionId, 'qv');
  const kind = mode === 'send' ? 'quote_send' : 'quote_resend';
  const intent = await findUnfinishedCommercialEmailIntent(
    kind,
    quoteVersionUuid,
  );
  if (!intent || intent.status === 'finalised') return null;
  const frozen = parseFrozenQuoteEmail(intent);
  const expiresAtMs = Date.parse(intent.providerIdempotencyExpiresAt);
  return {
    mode,
    status: intent.status,
    to: frozen.to,
    cc: frozen.cc,
    bcc: frozen.bcc,
    subject: frozen.subject,
    bodyText: redactToken(frozen.text),
    attachmentNames: await loadPreparedAttachmentNames(
      frozen.attachmentFileIds,
    ),
    preparedAt: intent.createdAt,
    attemptCount: intent.attemptCount,
    lastErrorCode: intent.lastErrorCode,
    canRetry:
      intent.status !== 'needs_attention' &&
      Number.isFinite(expiresAtMs) &&
      expiresAtMs > Date.now(),
  };
}

export async function retryPreparedQuoteDelivery(
  quoteVersionId: string,
  mode: QuoteEmailMode,
  expectedCommercialRevision: number,
  actor: string | null,
): Promise<QuoteVersionDetail> {
  const quoteVersionUuid = uuidFromAppId(quoteVersionId, 'qv');
  const kind = mode === 'send' ? 'quote_send' : 'quote_resend';
  const intent = await findUnfinishedCommercialEmailIntent(
    kind,
    quoteVersionUuid,
  );
  if (!intent) {
    throw new Error('No prepared delivery is available for this quote');
  }
  const frozen = parseFrozenQuoteEmail(intent);
  if (frozen.commercialRevision !== expectedCommercialRevision) {
    throw new Error(
      'Quote changed after this delivery was prepared. Review the current version before sending.',
    );
  }
  return executeQuoteEmail(
    quoteVersionId,
    mode,
    {
      intentId: `prepared-recovery:${intent.id}`,
      expectedCommercialRevision,
      to: frozen.to,
      cc: frozen.cc,
      bcc: frozen.bcc,
      subject: frozen.subject,
    },
    actor,
    intent,
  );
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
