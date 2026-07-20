import {
  RESEND_WEBHOOK_MAX_BODY_BYTES,
  ResendWebhookVerificationError,
  verifyResendWebhook,
} from '@sp/email-provider';
import { NextResponse } from 'next/server';

import {
  ProviderWebhookRepositoryError,
  reconcileVerifiedProviderAcceptance,
} from '@/lib/backgroundJobs/providerWebhookRepository';

export const runtime = 'nodejs';

function response(body: Readonly<Record<string, unknown>>, status: number): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

function webhookSecret(): string | null {
  const value = process.env.RESEND_WEBHOOK_SECRET;
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

async function readBoundedUtf8Body(request: Request): Promise<string> {
  const contentLength = request.headers.get('content-length');
  if (
    contentLength !== null &&
    (!/^\d+$/.test(contentLength) || Number(contentLength) > RESEND_WEBHOOK_MAX_BODY_BYTES)
  ) {
    try {
      await request.body?.cancel();
    } catch {
      // Cancellation is best-effort; the invalid request must still fail closed.
    }
    throw new Error('RESEND_WEBHOOK_BODY_INVALID');
  }

  if (!request.body) return '';
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let byteLength = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      byteLength += value.byteLength;
      if (byteLength > RESEND_WEBHOOK_MAX_BODY_BYTES) {
        throw new Error('RESEND_WEBHOOK_BODY_INVALID');
      }
      chunks.push(value);
    }
  } catch (error) {
    try {
      await reader.cancel();
    } catch {
      // Preserve the original body read/limit failure.
    }
    throw error;
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

export async function POST(request: Request): Promise<NextResponse> {
  const secret = webhookSecret();
  if (!secret) {
    return response({ ok: false, code: 'RESEND_WEBHOOK_NOT_CONFIGURED' }, 503);
  }

  let rawBody: string;
  try {
    rawBody = await readBoundedUtf8Body(request);
  } catch {
    return response({ ok: false, code: 'RESEND_WEBHOOK_BODY_INVALID' }, 400);
  }

  let verified;
  try {
    verified = verifyResendWebhook({
      rawBody,
      headers: {
        id: request.headers.get('svix-id') ?? '',
        timestamp: request.headers.get('svix-timestamp') ?? '',
        signature: request.headers.get('svix-signature') ?? '',
      },
      webhookSecret: secret,
    });
  } catch (error) {
    if (
      error instanceof ResendWebhookVerificationError &&
      error.code === 'RESEND_WEBHOOK_SECRET_INVALID'
    ) {
      return response({ ok: false, code: 'RESEND_WEBHOOK_NOT_CONFIGURED' }, 503);
    }
    return response({ ok: false, code: 'RESEND_WEBHOOK_REJECTED' }, 400);
  }

  if (verified.outcome === 'ignored') {
    return response({ ok: true, outcome: 'ignored' }, 200);
  }

  try {
    const outcome = await reconcileVerifiedProviderAcceptance({
      provider: verified.provider,
      eventId: verified.eventId,
      eventType: verified.eventType,
      providerMessageId: verified.messageId,
      occurredAt: verified.occurredAt,
      taggedJobId: verified.jobId,
      taggedEffectRef: verified.effectRef,
    });
    return response({ ok: true, outcome }, 200);
  } catch (error) {
    if (error instanceof ProviderWebhookRepositoryError) {
      if (error.code === 'PROVIDER_RECONCILIATION_CONFLICT') {
        return response({ ok: false, code: error.code }, 409);
      }
      if (error.code === 'PROVIDER_RECONCILIATION_REJECTED') {
        return response({ ok: false, code: error.code }, 400);
      }
    }
    return response({ ok: false, code: 'PROVIDER_RECONCILIATION_UNAVAILABLE' }, 503);
  }
}
