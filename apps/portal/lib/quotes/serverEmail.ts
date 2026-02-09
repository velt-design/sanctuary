import 'server-only';

import { Resend } from 'resend';
import { supabaseServer } from '@/lib/supabaseClient';
import { uuidFromAppId } from '@/lib/supabase/mappers';
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

const FROM_EMAIL = 'Sanctuary Pergolas <info@sanctuarypergolas.co.nz>';
const REPLY_TO_EMAIL = 'info@sanctuarypergolas.co.nz';

let resendClient: Resend | null = null;

type ResendSendResponse = Awaited<ReturnType<Resend['emails']['send']>>;

export class EmailProviderConfigError extends Error {
  status = 503;
  code = 'EMAIL_PROVIDER_NOT_CONFIGURED';
}

function getResendClient(): Resend {
  const key = process.env.RESEND_API_KEY;
  if (!key || !key.trim()) {
    throw new EmailProviderConfigError('Email provider not configured (RESEND_API_KEY missing).');
  }
  if (!resendClient) resendClient = new Resend(key);
  return resendClient;
}

async function attemptSend(params: {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  bodyText: string;
  bodyHtml?: string | null;
  attachmentName: string;
  attachmentContent: Buffer;
}): Promise<{ id?: string } | null> {
  const html = params.bodyHtml ?? params.bodyText.replace(/\n/g, '<br />');
  const client = getResendClient();
  const response: ResendSendResponse = await client.emails.send({
    from: FROM_EMAIL,
    to: params.to,
    cc: params.cc,
    bcc: params.bcc,
    replyTo: REPLY_TO_EMAIL,
    subject: params.subject,
    html,
    text: params.bodyText,
    attachments: [{ filename: params.attachmentName, content: params.attachmentContent, contentType: 'application/pdf' }],
  });
  if ('error' in response && response.error) {
    const message = response.error.message ?? 'Failed to send email';
    const err = new Error(message);
    (err as any).code = response.error.name ?? 'RESEND_ERROR';
    throw err;
  }
  const id = (response as any)?.data?.id;
  return id ? { id } : null;
}

export async function sendQuote(
  quoteVersionId: string,
  payload: { to: string[]; cc?: string[]; bcc?: string[]; subject: string; bodyText: string; bodyHtml?: string | null },
  actor: string | null,
): Promise<QuoteVersionDetail> {
  const detail = await getQuoteVersionDetail(quoteVersionId);
  if (!detail) throw new Error('Quote not found');
  if (detail.status !== 'DRAFT') throw new Error('Quote is locked');

  const projectUuid = uuidFromAppId(detail.projectId, 'proj');
  const quoteVersionUuid = uuidFromAppId(detail.id, 'qv');

  const pdf = await ensurePdfForSend(detail, actor);

  let sendRes: { id?: string } | null = null;
  let sendError: string | null = null;
  let sendErrorObj: unknown = null;
  try {
    sendRes = await attemptSend({
      to: payload.to,
      cc: payload.cc,
      bcc: payload.bcc,
      subject: payload.subject,
      bodyText: payload.bodyText,
      bodyHtml: payload.bodyHtml,
      attachmentName: pdf.filename,
      attachmentContent: pdf.content,
    });
  } catch (err: any) {
    sendError = err instanceof Error ? err.message : 'Failed to send email';
    sendErrorObj = err;
  }

  const sentAtIso = nowIso();
  const html = payload.bodyHtml ?? payload.bodyText.replace(/\n/g, '<br />');

  if (sendRes && !sendError) {
    const expiresAt = detail.expiresAt ?? addDays(sentAtIso, 30);

    const updateRes = await supabaseServer
      .from('quote_versions')
      .update({
        status: 'SENT',
        sent_at: detail.sentAt ?? sentAtIso,
        sent_by: actor,
        expires_at: expiresAt,
      } as any)
      .eq('id', quoteVersionUuid);
    if (updateRes.error) {
      throw new Error(updateRes.error.message ?? 'Failed to update quote');
    }

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
      subject: payload.subject,
      bodyHtml: html,
      bodyText: payload.bodyText,
      attachmentFileIds: [pdf.fileUuid],
      provider: 'resend',
      providerMessageId: sendRes.id ?? null,
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
      subject: payload.subject,
      bodyHtml: html,
      bodyText: payload.bodyText,
      attachmentFileIds: [pdf.fileUuid],
      provider: 'resend',
      providerMessageId: null,
      status: 'FAILED',
      actor,
      sentAt: null,
      errorMessage: sendError ?? 'Failed to send email',
    });

    if (sendErrorObj instanceof EmailProviderConfigError) {
      throw sendErrorObj;
    }
    throw new Error(sendError ?? 'Failed to send email');
  }

  const updated = await getQuoteVersionDetail(quoteVersionId);
  if (!updated) throw new Error('Failed to load quote');
  return updated;
}

export async function resendQuote(
  quoteVersionId: string,
  payload: { to: string[]; cc?: string[]; bcc?: string[]; subject: string; bodyText: string; bodyHtml?: string | null },
  actor: string | null,
): Promise<QuoteVersionDetail> {
  const detail = await getQuoteVersionDetail(quoteVersionId);
  if (!detail) throw new Error('Quote not found');
  if (detail.status === 'DRAFT') throw new Error('Quote must be sent first');

  const projectUuid = uuidFromAppId(detail.projectId, 'proj');
  const quoteVersionUuid = uuidFromAppId(detail.id, 'qv');
  const pdf = await ensurePdfForSend(detail, actor);

  let sendRes: { id?: string } | null = null;
  let sendError: string | null = null;
  let sendErrorObj: unknown = null;
  try {
    sendRes = await attemptSend({
      to: payload.to,
      cc: payload.cc,
      bcc: payload.bcc,
      subject: payload.subject,
      bodyText: payload.bodyText,
      bodyHtml: payload.bodyHtml,
      attachmentName: pdf.filename,
      attachmentContent: pdf.content,
    });
  } catch (err: any) {
    sendError = err instanceof Error ? err.message : 'Failed to send email';
    sendErrorObj = err;
  }

  const sentAtIso = nowIso();
  const html = payload.bodyHtml ?? payload.bodyText.replace(/\n/g, '<br />');

  if (sendRes && !sendError) {
    const logId = await insertSendLog({
      projectUuid,
      quoteVersionUuid,
      fromName: 'Sanctuary Pergolas',
      fromEmail: REPLY_TO_EMAIL,
      replyTo: REPLY_TO_EMAIL,
      to: payload.to,
      cc: payload.cc ?? [],
      bcc: payload.bcc ?? [],
      subject: payload.subject,
      bodyHtml: html,
      bodyText: payload.bodyText,
      attachmentFileIds: [pdf.fileUuid],
      provider: 'resend',
      providerMessageId: sendRes.id ?? null,
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
      subject: payload.subject,
      bodyHtml: html,
      bodyText: payload.bodyText,
      attachmentFileIds: [pdf.fileUuid],
      provider: 'resend',
      providerMessageId: null,
      status: 'FAILED',
      actor,
      sentAt: null,
      errorMessage: sendError ?? 'Failed to send email',
    });

    if (sendErrorObj instanceof EmailProviderConfigError) {
      throw sendErrorObj;
    }
    throw new Error(sendError ?? 'Failed to send email');
  }

  const updated = await getQuoteVersionDetail(quoteVersionId);
  if (!updated) throw new Error('Failed to load quote');
  return updated;
}
