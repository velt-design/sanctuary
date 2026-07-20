import { Webhook } from 'svix';

import {
  RESEND_PROVIDER_NAME,
  RESEND_WEBHOOK_MAX_BODY_BYTES,
  type ResendWebhookErrorCode,
  type ResendWebhookHeaders,
  type ResendWebhookVerificationResult,
} from './contracts';

const SAFE_EVENT_ID = /^[A-Za-z0-9._:-]{1,256}$/;
const SAFE_EVENT_TYPE = /^[a-z][a-z0-9._-]{0,95}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EFFECT_REF = /^[0-9a-f]{64}$/;
const PROVIDER_MESSAGE_ID = /^[A-Za-z0-9._:-]{1,256}$/;

export class ResendWebhookVerificationError extends Error {
  readonly code: ResendWebhookErrorCode;

  constructor(code: ResendWebhookErrorCode) {
    super(code);
    this.name = 'ResendWebhookVerificationError';
    this.code = code;
  }
}

function webhookError(code: ResendWebhookErrorCode): never {
  throw new ResendWebhookVerificationError(code);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeTimestamp(value: unknown): string {
  if (typeof value !== 'string') webhookError('RESEND_WEBHOOK_SCHEMA_INVALID');
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) webhookError('RESEND_WEBHOOK_SCHEMA_INVALID');
  return new Date(milliseconds).toISOString();
}

function validateHeaders(headers: ResendWebhookHeaders): void {
  if (
    !headers ||
    typeof headers.id !== 'string' ||
    !SAFE_EVENT_ID.test(headers.id) ||
    typeof headers.timestamp !== 'string' ||
    !/^\d{1,16}$/.test(headers.timestamp) ||
    typeof headers.signature !== 'string' ||
    headers.signature.length < 8 ||
    headers.signature.length > 4_096 ||
    /[\r\n]/.test(headers.signature)
  ) {
    webhookError('RESEND_WEBHOOK_HEADERS_INVALID');
  }
}

function createVerifier(secret: string): Webhook {
  if (
    typeof secret !== 'string' ||
    !secret.trim() ||
    secret.length > 4_096 ||
    /[\r\n]/.test(secret)
  ) {
    webhookError('RESEND_WEBHOOK_SECRET_INVALID');
  }
  try {
    return new Webhook(secret);
  } catch {
    webhookError('RESEND_WEBHOOK_SECRET_INVALID');
  }
}

export function verifyResendWebhook(input: Readonly<{
  rawBody: string;
  headers: ResendWebhookHeaders;
  webhookSecret: string;
}>): ResendWebhookVerificationResult {
  validateHeaders(input.headers);
  if (
    typeof input.rawBody !== 'string' ||
    !input.rawBody ||
    Buffer.byteLength(input.rawBody, 'utf8') > RESEND_WEBHOOK_MAX_BODY_BYTES
  ) {
    webhookError('RESEND_WEBHOOK_SCHEMA_INVALID');
  }

  const verifier = createVerifier(input.webhookSecret);
  let payload: unknown;
  try {
    payload = verifier.verify(input.rawBody, {
      'svix-id': input.headers.id,
      'svix-timestamp': input.headers.timestamp,
      'svix-signature': input.headers.signature,
    });
  } catch {
    webhookError('RESEND_WEBHOOK_SIGNATURE_INVALID');
  }

  if (!isRecord(payload) || typeof payload.type !== 'string' || !SAFE_EVENT_TYPE.test(payload.type)) {
    webhookError('RESEND_WEBHOOK_SCHEMA_INVALID');
  }
  const occurredAt = normalizeTimestamp(payload.created_at);
  if (payload.type !== 'email.sent') {
    return Object.freeze({
      outcome: 'ignored',
      provider: RESEND_PROVIDER_NAME,
      eventType: payload.type,
      eventId: input.headers.id,
      occurredAt,
    });
  }

  if (!isRecord(payload.data)) {
    webhookError('RESEND_WEBHOOK_SCHEMA_INVALID');
  }
  const rawMessageId = payload.data.email_id;
  if (typeof rawMessageId !== 'string' || !PROVIDER_MESSAGE_ID.test(rawMessageId)) {
    webhookError('RESEND_WEBHOOK_SCHEMA_INVALID');
  }
  const rawTags = payload.data.tags;
  if (rawTags === undefined || rawTags === null) {
    return Object.freeze({
      outcome: 'ignored',
      provider: RESEND_PROVIDER_NAME,
      eventType: payload.type,
      eventId: input.headers.id,
      occurredAt,
    });
  }
  if (!isRecord(rawTags)) webhookError('RESEND_WEBHOOK_SCHEMA_INVALID');

  const hasJobId = Object.hasOwn(rawTags, 'job_id');
  const hasEffectRef = Object.hasOwn(rawTags, 'effect_ref');
  if (!hasJobId && !hasEffectRef) {
    // Resend subscriptions are account-wide by event type. Signed legacy
    // sends can therefore reach this endpoint without durable correlation;
    // acknowledge them without persisting provider/customer fields.
    return Object.freeze({
      outcome: 'ignored',
      provider: RESEND_PROVIDER_NAME,
      eventType: payload.type,
      eventId: input.headers.id,
      occurredAt,
    });
  }

  const tagNames = Object.keys(rawTags).sort();
  if (tagNames.length !== 2 || tagNames[0] !== 'effect_ref' || tagNames[1] !== 'job_id') {
    webhookError('RESEND_WEBHOOK_SCHEMA_INVALID');
  }
  const rawJobId = rawTags.job_id;
  const rawEffectRef = rawTags.effect_ref;
  if (
    typeof rawJobId !== 'string' ||
    !UUID.test(rawJobId) ||
    typeof rawEffectRef !== 'string' ||
    !EFFECT_REF.test(rawEffectRef)
  ) {
    webhookError('RESEND_WEBHOOK_SCHEMA_INVALID');
  }

  return Object.freeze({
    outcome: 'verified',
    provider: RESEND_PROVIDER_NAME,
    eventType: 'email.sent',
    eventId: input.headers.id,
    jobId: rawJobId.toLowerCase(),
    effectRef: rawEffectRef,
    messageId: rawMessageId,
    occurredAt,
  });
}
