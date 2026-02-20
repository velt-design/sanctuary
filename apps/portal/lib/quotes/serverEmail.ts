import 'server-only';

import { renderQuoteReadyEmail } from '@/lib/emails/quote';
import { sendTransactionalEmail } from '@/lib/emails/sendTransactionalEmail';
import { generateAcceptToken } from '@/lib/quotes/acceptToken';
import { uuidFromAppId } from '@/lib/supabase/mappers';
import { supabaseServer } from '@/lib/supabaseClient';
import type { QuoteVersionDetail } from './types';
import {
  addDays,
  ensurePdfForSend,
  getQuoteVersionDetail,
  insertAuditEvent,
  insertSendLog,
  nowIso,
  updateProjectStage,
} from './serverCore';

const REPLY_TO_EMAIL = 'info@sanctuarypergolas.co.nz';

export class EmailProviderConfigError extends Error {
  status = 503;
  code = 'EMAIL_PROVIDER_NOT_CONFIGURED';
}

type QuoteEmailPayload = {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject?: string;
  personalNote?: string | null;
  bodyText?: string;
  bodyHtml?: string | null;
};

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
  try {
    const parsed = new URL(normalized);
    return parsed.toString().replace(/\/+$/, '');
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

function formatCurrency(cents: number): string {
  const dollars = Number.isFinite(cents) ? cents / 100 : 0;
  return new Intl.NumberFormat('en-NZ', {
    style: 'currency',
    currency: 'NZD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(dollars);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
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

function personalNoteHtml(note: string | null): string | undefined {
  if (!note) return undefined;
  return escapeHtml(note).replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n/g, '<br />');
}

function redactToken(value: string | null): string | null {
  if (typeof value !== 'string') return value;
  return value.replace(/([?&]token=)[^&\\s\"'<>]+/gi, '$1[redacted]');
}

function quoteNumber(detail: QuoteVersionDetail): string {
  return `${detail.quoteRef} v${detail.versionNumber}`;
}

function quoteSubject(detail: QuoteVersionDetail, explicit: string | undefined): string {
  const trimmed = typeof explicit === 'string' ? explicit.trim() : '';
  if (trimmed) return trimmed;
  return `Quote ready - ${quoteNumber(detail)}`;
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

function renderExpiresLabel(expiresAtDate: string | null): string | undefined {
  if (!expiresAtDate) return undefined;
  const parsed = new Date(`${expiresAtDate}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime())) return expiresAtDate;

  return new Intl.DateTimeFormat('en-NZ', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Pacific/Auckland',
  }).format(parsed);
}

function providerMessageId(response: unknown): string | null {
  const id = (response as any)?.data?.id;
  return typeof id === 'string' && id.trim() ? id.trim() : null;
}

async function deliverQuoteReadyEmail(params: {
  detail: QuoteVersionDetail;
  payload: QuoteEmailPayload;
  quoteAcceptUrl: string;
  pdf: { filename: string; content: Buffer };
  expiresAtDate: string | null;
}): Promise<{ subject: string; html: string; text: string | null; providerMessageId: string | null }> {
  const note = personalNoteFromPayload(params.payload);
  const subject = quoteSubject(params.detail, params.payload.subject);

  const rendered = await renderQuoteReadyEmail({
    to: params.payload.to,
    cc: params.payload.cc,
    bcc: params.payload.bcc,
    subject,
    name: params.detail.customerName || params.detail.contact.name || 'there',
    quote_number: quoteNumber(params.detail),
    quote_total_inc_gst: formatCurrency(params.detail.totals.totalIncGstCents),
    project_address: params.detail.project.siteAddress ?? undefined,
    quote_accept_link: params.quoteAcceptUrl,
    quote_valid_until: renderExpiresLabel(params.expiresAtDate),
    next_step_text: 'Use the button above to accept the quote and proceed.',
    personal_note_html: personalNoteHtml(note),
    reference_id: params.detail.reference ?? params.detail.project.quoteRef ?? undefined,
  });

  const response = await sendTransactionalEmail({
    to: params.payload.to,
    cc: params.payload.cc,
    bcc: params.payload.bcc,
    subject,
    html: rendered.html,
    text: rendered.text,
    attachments: [
      {
        filename: params.pdf.filename,
        content: params.pdf.content,
        contentType: 'application/pdf',
      },
    ],
  });

  return {
    subject,
    html: rendered.html,
    text: rendered.text ?? null,
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

  const res = await supabaseServer.from('quote_versions').update(patch as any).eq('id', params.quoteVersionUuid);
  if (res.error) {
    throw new Error(res.error.message ?? 'Failed to update quote');
  }
}

export async function sendQuote(
  quoteVersionId: string,
  payload: QuoteEmailPayload,
  actor: string | null,
): Promise<QuoteVersionDetail> {
  const detail = await getQuoteVersionDetail(quoteVersionId);
  if (!detail) throw new Error('Quote not found');
  if (detail.status !== 'DRAFT') throw new Error('Quote is locked');

  const projectUuid = uuidFromAppId(detail.projectId, 'proj');
  const quoteVersionUuid = uuidFromAppId(detail.id, 'qv');

  const pdf = await ensurePdfForSend(detail, actor);

  const sentAtIso = nowIso();
  const expiresAtDate = detail.expiresAt ?? addDays(sentAtIso, 30);
  const { token, tokenHash } = generateAcceptToken();
  const acceptTokenExpiresAt = tokenExpiryIso(expiresAtDate, sentAtIso);

  let delivered: { subject: string; html: string; text: string | null; providerMessageId: string | null } | null = null;
  let sendError: string | null = null;
  let sendErrorObj: unknown = null;

  try {
    const quoteAcceptUrl = quoteAcceptLink(detail.id, token);
    delivered = await deliverQuoteReadyEmail({
      detail,
      payload,
      quoteAcceptUrl,
      pdf,
      expiresAtDate,
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
      attachmentFileIds: [pdf.fileUuid],
      provider: 'resend',
      providerMessageId: delivered.providerMessageId,
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
      attachmentFileIds: [pdf.fileUuid],
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

  const updated = await getQuoteVersionDetail(quoteVersionId);
  if (!updated) throw new Error('Failed to load quote');
  return updated;
}

export async function resendQuote(
  quoteVersionId: string,
  payload: QuoteEmailPayload,
  actor: string | null,
): Promise<QuoteVersionDetail> {
  const detail = await getQuoteVersionDetail(quoteVersionId);
  if (!detail) throw new Error('Quote not found');
  if (detail.status === 'DRAFT') throw new Error('Quote must be sent first');

  const projectUuid = uuidFromAppId(detail.projectId, 'proj');
  const quoteVersionUuid = uuidFromAppId(detail.id, 'qv');

  const pdf = await ensurePdfForSend(detail, actor);

  const sentAtIso = nowIso();
  const expiresAtDate = detail.expiresAt ?? addDays(sentAtIso, 30);
  const { token, tokenHash } = generateAcceptToken();
  const acceptTokenExpiresAt = tokenExpiryIso(expiresAtDate, sentAtIso);

  let delivered: { subject: string; html: string; text: string | null; providerMessageId: string | null } | null = null;
  let sendError: string | null = null;
  let sendErrorObj: unknown = null;

  try {
    const quoteAcceptUrl = quoteAcceptLink(detail.id, token);
    delivered = await deliverQuoteReadyEmail({
      detail,
      payload,
      quoteAcceptUrl,
      pdf,
      expiresAtDate,
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
      attachmentFileIds: [pdf.fileUuid],
      provider: 'resend',
      providerMessageId: delivered.providerMessageId,
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
      attachmentFileIds: [pdf.fileUuid],
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

  const updated = await getQuoteVersionDetail(quoteVersionId);
  if (!updated) throw new Error('Failed to load quote');
  return updated;
}
