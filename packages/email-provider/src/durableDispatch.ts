import { createHash } from 'node:crypto';

import {
  RESEND_AUTOMATIC_RETRY_WINDOW_MS,
  RESEND_PROVIDER_NAME,
  type DurableResendEmailDispatch,
  type EmailMessageInput,
  type NormalizedEmailMessage,
  type NormalizedEmailTag,
} from './contracts';
import { freezeTags, normalizeEmailMessage } from './normalization';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EFFECT_KEY = /^[A-Za-z0-9._:/-]{1,256}$/;
const IDEMPOTENCY_KEY = /^[A-Za-z0-9._:/-]{1,256}$/;
const SHA256 = /^[0-9a-f]{64}$/;

export type DurableResendDispatchErrorCode =
  | 'RESEND_DISPATCH_IDENTITY_INVALID'
  | 'RESEND_DISPATCH_EXPIRY_INVALID'
  | 'RESEND_DISPATCH_INTEGRITY_FAILED';

export class DurableResendDispatchError extends Error {
  readonly code: DurableResendDispatchErrorCode;

  constructor(code: DurableResendDispatchErrorCode) {
    super(code);
    this.name = 'DurableResendDispatchError';
    this.code = code;
  }
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function normalizeJobId(jobId: string): string {
  const normalized = typeof jobId === 'string' ? jobId.trim().toLowerCase() : '';
  if (!UUID.test(normalized)) throw new DurableResendDispatchError('RESEND_DISPATCH_IDENTITY_INVALID');
  return normalized;
}

function normalizeEffectKey(effectKey: string): string {
  const normalized = typeof effectKey === 'string' ? effectKey.trim() : '';
  if (!EFFECT_KEY.test(normalized)) {
    throw new DurableResendDispatchError('RESEND_DISPATCH_IDENTITY_INVALID');
  }
  return normalized;
}

export function deriveResendIdempotencyKey(jobId: string, effectKey: string): string {
  const normalizedJobId = normalizeJobId(jobId);
  const normalizedEffectKey = normalizeEffectKey(effectKey);
  return `sp_email_v1_${sha256(`${normalizedJobId}|${normalizedEffectKey}`)}`;
}

export function deriveResendEffectRef(idempotencyKey: string): string {
  const normalized = typeof idempotencyKey === 'string' ? idempotencyKey.trim() : '';
  if (!IDEMPOTENCY_KEY.test(normalized)) {
    throw new DurableResendDispatchError('RESEND_DISPATCH_IDENTITY_INVALID');
  }
  return sha256(`sanctuary:provider-effect:v1|resend|${normalized}`);
}

function timestampMs(value: string | number | Date): number {
  const milliseconds = value instanceof Date
    ? value.getTime()
    : typeof value === 'number'
      ? value
      : Date.parse(value);
  if (!Number.isFinite(milliseconds)) {
    throw new DurableResendDispatchError('RESEND_DISPATCH_EXPIRY_INVALID');
  }
  return milliseconds;
}

export function createResendIdempotencyExpiresAt(preparedAt: string | number | Date): string {
  return new Date(timestampMs(preparedAt) + RESEND_AUTOMATIC_RETRY_WINDOW_MS).toISOString();
}

function normalizeExpiry(expiresAt: string): string {
  if (typeof expiresAt !== 'string') {
    throw new DurableResendDispatchError('RESEND_DISPATCH_EXPIRY_INVALID');
  }
  const milliseconds = Date.parse(expiresAt);
  if (!Number.isFinite(milliseconds)) {
    throw new DurableResendDispatchError('RESEND_DISPATCH_EXPIRY_INVALID');
  }
  return new Date(milliseconds).toISOString();
}

type ResendWireAttachment = Readonly<{
  filename: string;
  content: string;
  content_type?: string;
}>;

type ResendWirePayload = Readonly<{
  from: string;
  to: readonly string[];
  subject: string;
  html?: string;
  text?: string;
  cc?: readonly string[];
  bcc?: readonly string[];
  reply_to?: readonly string[];
  attachments?: readonly ResendWireAttachment[];
  tags?: readonly NormalizedEmailTag[];
}>;

export function createCanonicalResendRequestBody(
  message: NormalizedEmailMessage,
  tags?: readonly NormalizedEmailTag[],
): string {
  const payload: ResendWirePayload = {
    from: message.from,
    to: message.to,
    subject: message.subject,
    ...(message.html !== undefined ? { html: message.html } : {}),
    ...(message.text !== undefined ? { text: message.text } : {}),
    ...(message.cc ? { cc: message.cc } : {}),
    ...(message.bcc ? { bcc: message.bcc } : {}),
    ...(message.replyTo ? { reply_to: message.replyTo } : {}),
    ...(message.attachments
      ? {
          attachments: message.attachments.map((attachment) => ({
            filename: attachment.filename,
            content: attachment.contentBase64,
            ...(attachment.contentType ? { content_type: attachment.contentType } : {}),
          })),
        }
      : {}),
    ...(tags ? { tags } : {}),
  };
  return JSON.stringify(payload);
}

export function createDurableResendEmailDispatch(input: Readonly<{
  jobId: string;
  effectKey: string;
  idempotencyExpiresAt: string;
  message: EmailMessageInput | NormalizedEmailMessage;
}>): DurableResendEmailDispatch {
  const jobId = normalizeJobId(input.jobId);
  const effectKey = normalizeEffectKey(input.effectKey);
  const idempotencyKey = deriveResendIdempotencyKey(jobId, effectKey);
  const effectRef = deriveResendEffectRef(idempotencyKey);
  const idempotencyExpiresAt = normalizeExpiry(input.idempotencyExpiresAt);
  const message = normalizeEmailMessage(input.message);
  const tags = freezeTags([
    { name: 'job_id', value: jobId },
    { name: 'effect_ref', value: effectRef },
  ]);
  const canonicalRequestBody = createCanonicalResendRequestBody(message, tags);
  const payloadHash = sha256(canonicalRequestBody);

  return Object.freeze({
    provider: RESEND_PROVIDER_NAME,
    jobId,
    effectKey,
    idempotencyKey,
    effectRef,
    idempotencyExpiresAt,
    payloadHash,
    message,
    tags,
    canonicalRequestBody,
  });
}

export function assertDurableResendEmailDispatchIntegrity(dispatch: DurableResendEmailDispatch): void {
  try {
    const expected = createDurableResendEmailDispatch({
      jobId: dispatch.jobId,
      effectKey: dispatch.effectKey,
      idempotencyExpiresAt: dispatch.idempotencyExpiresAt,
      message: dispatch.message,
    });
    if (
      dispatch.provider !== RESEND_PROVIDER_NAME ||
      dispatch.idempotencyKey !== expected.idempotencyKey ||
      dispatch.effectRef !== expected.effectRef ||
      dispatch.payloadHash !== expected.payloadHash ||
      !SHA256.test(dispatch.payloadHash) ||
      dispatch.canonicalRequestBody !== expected.canonicalRequestBody ||
      JSON.stringify(dispatch.tags) !== JSON.stringify(expected.tags)
    ) {
      throw new DurableResendDispatchError('RESEND_DISPATCH_INTEGRITY_FAILED');
    }
  } catch (error) {
    if (
      error instanceof DurableResendDispatchError &&
      error.code === 'RESEND_DISPATCH_INTEGRITY_FAILED'
    ) {
      throw error;
    }
    throw new DurableResendDispatchError('RESEND_DISPATCH_INTEGRITY_FAILED');
  }
}
