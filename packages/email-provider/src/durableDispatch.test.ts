// @vitest-environment node

import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  RESEND_AUTOMATIC_RETRY_WINDOW_MS,
  RESEND_PROVIDER_IDEMPOTENCY_RETENTION_MS,
  assertDurableResendEmailDispatchIntegrity,
  createDurableResendEmailDispatch,
  createResendIdempotencyExpiresAt,
  deriveResendEffectRef,
  deriveResendIdempotencyKey,
  normalizeEmailMessage,
} from './index';

const JOB_ID = '11111111-1111-4111-8111-111111111111';
const EFFECT_KEY = 'email_dispatch';
const PREPARED_AT = '2026-07-20T01:02:03.000Z';
const EXPIRES_AT = createResendIdempotencyExpiresAt(PREPARED_AT);

function message(overrides: Record<string, unknown> = {}) {
  return {
    from: 'Sanctuary Pergolas <info@sanctuarypergolas.co.nz>',
    to: ['customer@example.test'],
    cc: ['staff@example.test'],
    subject: 'Your quote',
    html: '<p>Ready</p>',
    text: 'Ready',
    attachments: [
      {
        filename: 'quote.pdf',
        content: new Uint8Array([1, 2, 3, 4]),
        contentType: 'application/pdf',
      },
    ],
    ...overrides,
  };
}

describe('durable Resend dispatch identity', () => {
  it('derives stable opaque provider identity with the required effect-ref domain separator', () => {
    const key = deriveResendIdempotencyKey(JOB_ID, EFFECT_KEY);
    expect(key).toMatch(/^sp_email_v1_[0-9a-f]{64}$/);
    expect(key).toBe(deriveResendIdempotencyKey(JOB_ID.toUpperCase(), EFFECT_KEY));
    expect(deriveResendEffectRef(key)).toBe(
      createHash('sha256')
        .update(`sanctuary:provider-effect:v1|resend|${key}`, 'utf8')
        .digest('hex'),
    );
  });

  it('freezes the conservative 20-hour retry window', () => {
    expect(RESEND_PROVIDER_IDEMPOTENCY_RETENTION_MS).toBe(24 * 60 * 60 * 1_000);
    expect(RESEND_AUTOMATIC_RETRY_WINDOW_MS).toBe(20 * 60 * 60 * 1_000);
    expect(RESEND_AUTOMATIC_RETRY_WINDOW_MS).toBeLessThan(
      RESEND_PROVIDER_IDEMPOTENCY_RETENTION_MS,
    );
    expect(Date.parse(EXPIRES_AT) - Date.parse(PREPARED_AT)).toBe(
      RESEND_AUTOMATIC_RETRY_WINDOW_MS,
    );
    expect(() => createResendIdempotencyExpiresAt('not-a-date')).toThrow(
      'RESEND_DISPATCH_EXPIRY_INVALID',
    );
  });

  it('creates a byte-stable deeply frozen request with exactly the two safe tags', () => {
    const recipients = ['customer@example.test'];
    const attachmentBytes = new Uint8Array([1, 2, 3, 4]);
    const input = message({
      to: recipients,
      attachments: [{ filename: 'quote.pdf', content: attachmentBytes, contentType: 'APPLICATION/PDF' }],
    });
    const first = createDurableResendEmailDispatch({
      jobId: JOB_ID,
      effectKey: EFFECT_KEY,
      idempotencyExpiresAt: EXPIRES_AT,
      message: input,
    });
    const second = createDurableResendEmailDispatch({
      jobId: JOB_ID,
      effectKey: EFFECT_KEY,
      idempotencyExpiresAt: EXPIRES_AT,
      message: input,
    });

    recipients[0] = 'changed@example.test';
    attachmentBytes[0] = 255;

    expect(first.canonicalRequestBody).toBe(second.canonicalRequestBody);
    expect(first.payloadHash).toBe(second.payloadHash);
    expect(first.message.to).toEqual(['customer@example.test']);
    expect(first.message.attachments?.[0]).toEqual({
      filename: 'quote.pdf',
      contentBase64: 'AQIDBA==',
      contentType: 'application/pdf',
    });
    expect(first.tags).toEqual([
      { name: 'job_id', value: JOB_ID },
      { name: 'effect_ref', value: first.effectRef },
    ]);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.message)).toBe(true);
    expect(Object.isFrozen(first.message.to)).toBe(true);
    expect(Object.isFrozen(first.message.attachments)).toBe(true);
    expect(Object.isFrozen(first.message.attachments?.[0])).toBe(true);
    expect(Object.isFrozen(first.tags)).toBe(true);
    expect(() => assertDurableResendEmailDispatchIntegrity(first)).not.toThrow();
  });

  it.each([
    ['recipient', { to: ['other@example.test'] }],
    ['subject', { subject: 'Changed subject' }],
    ['html content', { html: '<p>Changed</p>' }],
    ['text content', { text: 'Changed' }],
    [
      'attachment bytes',
      {
        attachments: [
          {
            filename: 'quote.pdf',
            content: new Uint8Array([9, 8, 7]),
            contentType: 'application/pdf',
          },
        ],
      },
    ],
    [
      'attachment filename',
      {
        attachments: [
          {
            filename: 'different.pdf',
            content: new Uint8Array([1, 2, 3, 4]),
            contentType: 'application/pdf',
          },
        ],
      },
    ],
  ])('changes the payload hash, but not logical provider key, for changed %s', (_name, change) => {
    const baseline = createDurableResendEmailDispatch({
      jobId: JOB_ID,
      effectKey: EFFECT_KEY,
      idempotencyExpiresAt: EXPIRES_AT,
      message: message(),
    });
    const changed = createDurableResendEmailDispatch({
      jobId: JOB_ID,
      effectKey: EFFECT_KEY,
      idempotencyExpiresAt: EXPIRES_AT,
      message: message(change),
    });
    expect(changed.idempotencyKey).toBe(baseline.idempotencyKey);
    expect(changed.effectRef).toBe(baseline.effectRef);
    expect(changed.payloadHash).not.toBe(baseline.payloadHash);
    expect(changed.canonicalRequestBody).not.toBe(baseline.canonicalRequestBody);
  });

  it('rejects a forged payload hash without exposing message content', () => {
    const dispatch = createDurableResendEmailDispatch({
      jobId: JOB_ID,
      effectKey: EFFECT_KEY,
      idempotencyExpiresAt: EXPIRES_AT,
      message: message(),
    });
    const forged = { ...dispatch, payloadHash: 'b'.repeat(64) };
    expect(() => assertDurableResendEmailDispatchIntegrity(forged)).toThrow(
      'RESEND_DISPATCH_INTEGRITY_FAILED',
    );
  });

  it('accepts portal bytes and marketing canonical base64 but rejects malformed base64', () => {
    expect(normalizeEmailMessage(message()).attachments?.[0]?.contentBase64).toBe('AQIDBA==');
    expect(
      normalizeEmailMessage(
        message({ attachments: [{ filename: 'quote.pdf', content: 'AQIDBA==' }] }),
      ).attachments?.[0]?.contentBase64,
    ).toBe('AQIDBA==');
    expect(() =>
      normalizeEmailMessage(message({ attachments: [{ filename: 'quote.pdf', content: 'not base64' }] })),
    ).toThrow('EMAIL_ATTACHMENT_INVALID');
  });

  it('rejects missing bodies, missing recipients, and unsafe identity fields with safe codes', () => {
    expect(() => normalizeEmailMessage(message({ html: undefined, text: undefined }))).toThrow(
      'EMAIL_BODY_MISSING',
    );
    expect(() => normalizeEmailMessage(message({ to: [] }))).toThrow('EMAIL_RECIPIENT_MISSING');
    expect(() => deriveResendIdempotencyKey('not-a-job-id', EFFECT_KEY)).toThrow(
      'RESEND_DISPATCH_IDENTITY_INVALID',
    );
    expect(() => deriveResendIdempotencyKey(JOB_ID, 'customer@example.test')).toThrow(
      'RESEND_DISPATCH_IDENTITY_INVALID',
    );
  });
});
