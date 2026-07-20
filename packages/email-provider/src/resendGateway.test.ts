// @vitest-environment node

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createDurableResendEmailDispatch,
  createResendEmailGateway,
  createResendIdempotencyExpiresAt,
  parseRetryAfterMs,
  type DurableResendEmailDispatch,
} from './index';

const NOW = Date.parse('2026-07-20T01:02:03.000Z');
const JOB_ID = '11111111-1111-4111-8111-111111111111';

function message() {
  return {
    from: 'Sanctuary Pergolas <info@sanctuarypergolas.co.nz>',
    to: ['customer@example.test'],
    subject: 'Your quote',
    html: '<p>Ready</p>',
    attachments: [
      { filename: 'quote.pdf', content: new Uint8Array([1, 2, 3]), contentType: 'application/pdf' },
    ],
  };
}

function dispatch(expiry = createResendIdempotencyExpiresAt(NOW)): DurableResendEmailDispatch {
  return createDurableResendEmailDispatch({
    jobId: JOB_ID,
    effectKey: 'email_dispatch',
    idempotencyExpiresAt: expiry,
    message: message(),
  });
}

function jsonResponse(body: unknown, status: number, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(body), { status, headers });
}

afterEach(() => {
  vi.useRealTimers();
});

describe('Resend email gateway', () => {
  it('sends exact canonical bytes and parses only a strict safe accepted ID', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ id: 'provider-message-1' }, 200));
    const durable = dispatch();
    const gateway = createResendEmailGateway({
      apiKey: 'test-api-key',
      fetch: fetchMock as typeof fetch,
      now: () => NOW,
    });

    await expect(gateway.dispatchDurable(durable, { timeoutMs: 5_000 })).resolves.toEqual({
      provider: 'resend',
      outcome: 'accepted',
      code: 'RESEND_ACCEPTED',
      messageId: 'provider-message-1',
      statusCode: 200,
      durationMs: 0,
    });
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://api.resend.com/emails');
    expect(init?.body).toBe(durable.canonicalRequestBody);
    expect(new Headers(init?.headers).get('idempotency-key')).toBe(durable.idempotencyKey);
    expect(JSON.parse(String(init?.body))).toMatchObject({
      attachments: [{ filename: 'quote.pdf', content: 'AQID', content_type: 'application/pdf' }],
      tags: [
        { name: 'job_id', value: JOB_ID },
        { name: 'effect_ref', value: durable.effectRef },
      ],
    });
  });

  it.each([
    {
      name: 'rate limiting',
      body: { name: 'rate_limit_exceeded', message: 'ignored' },
      status: 429,
      headers: { 'Retry-After': '3' },
      expected: {
        outcome: 'retryable_rejection',
        code: 'RESEND_RATE_LIMITED',
        retryAfterMs: 3_000,
      },
    },
    {
      name: 'concurrent idempotency',
      body: { name: 'concurrent_idempotent_requests', message: 'ignored' },
      status: 409,
      expected: {
        outcome: 'retryable_rejection',
        code: 'RESEND_IDEMPOTENCY_IN_PROGRESS',
        retryAfterMs: null,
      },
    },
    {
      name: 'changed idempotent payload',
      body: { name: 'invalid_idempotent_request', message: 'ignored' },
      status: 409,
      expected: {
        outcome: 'idempotency_conflict',
        code: 'RESEND_IDEMPOTENCY_PAYLOAD_CONFLICT',
      },
    },
    {
      name: 'authentication rejection',
      body: { name: 'invalid_api_key', message: 'ignored' },
      status: 401,
      expected: { outcome: 'terminal_rejection', code: 'RESEND_AUTH_REJECTED' },
    },
    {
      name: 'validation rejection',
      body: { name: 'invalid_attachment', message: 'ignored' },
      status: 422,
      expected: { outcome: 'terminal_rejection', code: 'RESEND_VALIDATION_REJECTED' },
    },
    {
      name: 'quota rejection',
      body: { name: 'monthly_quota_exceeded', message: 'ignored' },
      status: 429,
      expected: { outcome: 'terminal_rejection', code: 'RESEND_QUOTA_REJECTED' },
    },
    {
      name: 'other terminal request rejection',
      body: { name: 'security_error', message: 'ignored' },
      status: 403,
      expected: { outcome: 'terminal_rejection', code: 'RESEND_REQUEST_REJECTED' },
    },
    {
      name: 'provider server failure',
      body: { name: 'internal_server_error', message: 'ignored' },
      status: 503,
      expected: { outcome: 'uncertain', code: 'RESEND_SERVER_ERROR' },
    },
  ])('classifies $name without returning the provider body', async ({ body, status, headers, expected }) => {
    const gateway = createResendEmailGateway({
      apiKey: 'test-api-key',
      fetch: vi.fn(async () => jsonResponse(body, status, headers)) as typeof fetch,
      now: () => NOW,
    });
    const outcome = await gateway.dispatchDurable(dispatch(), { timeoutMs: 5_000 });
    expect(outcome).toMatchObject({ provider: 'resend', statusCode: status, ...expected });
    expect(JSON.stringify(outcome)).not.toContain('ignored');
  });

  it.each([
    [jsonResponse({ data: { id: 'nested-id-is-not-accepted' } }, 200), 200],
    [new Response('not-json', { status: 200 }), 200],
    [jsonResponse({ name: 'future_unknown_error', message: 'private provider body' }, 418), 418],
  ])('treats malformed or unknown provider responses as uncertain', async (response, status) => {
    const gateway = createResendEmailGateway({
      apiKey: 'test-api-key',
      fetch: vi.fn(async () => response) as typeof fetch,
      now: () => NOW,
    });
    await expect(gateway.dispatchDurable(dispatch(), { timeoutMs: 5_000 })).resolves.toMatchObject({
      outcome: 'uncertain',
      code: 'RESEND_RESPONSE_INVALID',
      statusCode: status,
    });
  });

  it('classifies network rejection without leaking the thrown error', async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error('customer@example.test token=https://private.invalid/?token=secret');
    });
    const gateway = createResendEmailGateway({
      apiKey: 'test-api-key',
      fetch: fetchMock as typeof fetch,
      now: () => NOW,
    });
    const outcome = await gateway.dispatchDurable(dispatch(), { timeoutMs: 5_000 });
    expect(outcome).toMatchObject({ outcome: 'uncertain', code: 'RESEND_NETWORK_ERROR' });
    expect(JSON.stringify(outcome)).not.toContain('customer@example.test');
    expect(JSON.stringify(outcome)).not.toContain('secret');
  });

  it('returns an explicit timeout even when an injected transport ignores abort', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const fetchMock = vi.fn(() => new Promise<Response>(() => undefined));
    const gateway = createResendEmailGateway({
      apiKey: 'test-api-key',
      fetch: fetchMock as typeof fetch,
    });
    const result = gateway.dispatchDurable(dispatch(), { timeoutMs: 1_000 });
    await vi.advanceTimersByTimeAsync(1_000);
    await expect(result).resolves.toMatchObject({
      outcome: 'uncertain',
      code: 'RESEND_TIMEOUT',
    });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('distinguishes abort before invocation from abort after invocation', async () => {
    const alreadyAborted = new AbortController();
    alreadyAborted.abort();
    const neverCalled = vi.fn(async () => jsonResponse({ id: 'provider-message-1' }, 200));
    const firstGateway = createResendEmailGateway({
      apiKey: 'test-api-key',
      fetch: neverCalled as typeof fetch,
      now: () => NOW,
    });
    await expect(
      firstGateway.dispatchDurable(dispatch(), { timeoutMs: 5_000, signal: alreadyAborted.signal }),
    ).resolves.toMatchObject({
      outcome: 'not_dispatched',
      code: 'RESEND_ABORTED_BEFORE_DISPATCH',
    });
    expect(neverCalled).not.toHaveBeenCalled();

    const controller = new AbortController();
    const invoked = vi.fn(() => new Promise<Response>(() => undefined));
    const secondGateway = createResendEmailGateway({
      apiKey: 'test-api-key',
      fetch: invoked as typeof fetch,
      now: () => NOW,
    });
    const result = secondGateway.dispatchDurable(dispatch(), {
      timeoutMs: 5_000,
      signal: controller.signal,
    });
    await vi.waitFor(() => expect(invoked).toHaveBeenCalledOnce());
    controller.abort();
    await expect(result).resolves.toMatchObject({ outcome: 'uncertain', code: 'RESEND_ABORTED' });
  });

  it('does not invoke the provider after expiry or when dispatch integrity is forged', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ id: 'provider-message-1' }, 200));
    const gateway = createResendEmailGateway({
      apiKey: 'test-api-key',
      fetch: fetchMock as typeof fetch,
      now: () => NOW,
    });
    await expect(
      gateway.dispatchDurable(dispatch(new Date(NOW).toISOString()), { timeoutMs: 5_000 }),
    ).resolves.toMatchObject({ outcome: 'not_dispatched', code: 'RESEND_IDEMPOTENCY_EXPIRED' });
    await expect(
      gateway.dispatchDurable(
        dispatch(new Date(NOW + 20 * 60 * 60 * 1_000 + 1).toISOString()),
        { timeoutMs: 5_000 },
      ),
    ).rejects.toThrow('RESEND_DISPATCH_EXPIRY_INVALID');
    const forged = { ...dispatch(), payloadHash: 'b'.repeat(64) };
    await expect(gateway.dispatchDurable(forged, { timeoutMs: 5_000 })).rejects.toThrow(
      'RESEND_DISPATCH_INTEGRITY_FAILED',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('supports the legacy path with or without an optional idempotency key', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ id: 'provider-message-1' }, 200));
    const gateway = createResendEmailGateway({
      apiKey: 'test-api-key',
      fetch: fetchMock as typeof fetch,
      now: () => NOW,
    });
    await gateway.dispatchLegacy(message(), { timeoutMs: 5_000 });
    await gateway.dispatchLegacy(message(), {
      timeoutMs: 5_000,
      idempotencyKey: 'legacy/email/intent-1',
    });
    expect(new Headers(fetchMock.mock.calls[0]![1]?.headers).get('idempotency-key')).toBeNull();
    expect(new Headers(fetchMock.mock.calls[1]![1]?.headers).get('idempotency-key')).toBe(
      'legacy/email/intent-1',
    );
    expect(JSON.parse(String(fetchMock.mock.calls[0]![1]?.body))).not.toHaveProperty('tags');
  });
});

describe('parseRetryAfterMs', () => {
  it('parses delta seconds and HTTP dates without accepting malformed values', () => {
    expect(parseRetryAfterMs('12', NOW)).toBe(12_000);
    expect(parseRetryAfterMs(new Date(NOW + 4_000).toUTCString(), NOW)).toBe(4_000);
    expect(parseRetryAfterMs(new Date(NOW - 4_000).toUTCString(), NOW)).toBe(0);
    expect(parseRetryAfterMs('1.5', NOW)).toBeNull();
    expect(parseRetryAfterMs('private-provider-detail', NOW)).toBeNull();
  });
});
