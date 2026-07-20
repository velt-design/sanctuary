import { beforeEach, describe, expect, it, vi } from 'vitest';

const verifyResendWebhook = vi.fn();
const reconcileVerifiedProviderAcceptance = vi.fn();

class MockVerificationError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

class MockRepositoryError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

vi.mock('@sp/email-provider', () => ({
  RESEND_WEBHOOK_MAX_BODY_BYTES: 262_144,
  ResendWebhookVerificationError: MockVerificationError,
  verifyResendWebhook,
}));

vi.mock('@/lib/backgroundJobs/providerWebhookRepository', () => ({
  ProviderWebhookRepositoryError: MockRepositoryError,
  reconcileVerifiedProviderAcceptance,
}));

function request(body = '{"type":"email.sent"}', headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/api/webhooks/resend', {
    method: 'POST',
    body,
    headers: {
      'content-type': 'application/json',
      'svix-id': 'evt_123',
      'svix-timestamp': '1784510000',
      'svix-signature': 'v1,signature',
      ...headers,
    },
  });
}

function streamingRequest(
  body: ReadableStream<Uint8Array>,
  headers: Record<string, string> = {},
): Request {
  return new Request('http://localhost/api/webhooks/resend', {
    method: 'POST',
    body,
    duplex: 'half',
    headers: {
      'content-type': 'application/json',
      'svix-id': 'evt_123',
      'svix-timestamp': '1784510000',
      'svix-signature': 'v1,signature',
      ...headers,
    },
  } as RequestInit & { duplex: 'half' });
}

describe('POST /api/webhooks/resend', () => {
  beforeEach(() => {
    vi.resetModules();
    verifyResendWebhook.mockReset();
    reconcileVerifiedProviderAcceptance.mockReset();
    process.env.RESEND_WEBHOOK_SECRET = 'whsec_test';
    verifyResendWebhook.mockReturnValue({
      outcome: 'verified',
      provider: 'resend',
      eventType: 'email.sent',
      eventId: 'evt_123',
      jobId: '018f8f52-22f2-7f4d-8e13-0d1ccb612345',
      effectRef: 'a'.repeat(64),
      messageId: 'email_123',
      occurredAt: '2026-07-20T01:02:03.000Z',
    });
    reconcileVerifiedProviderAcceptance.mockResolvedValue('accepted');
  });

  it('passes the untouched body and signature headers to verification, then only the safe envelope to the RPC owner', async () => {
    const rawBody = '{\n  "type": "email.sent"\n}';
    const { POST } = await import('./route');
    const result = await POST(request(rawBody));

    expect(verifyResendWebhook).toHaveBeenCalledWith({
      rawBody,
      headers: {
        id: 'evt_123',
        timestamp: '1784510000',
        signature: 'v1,signature',
      },
      webhookSecret: 'whsec_test',
    });
    expect(reconcileVerifiedProviderAcceptance).toHaveBeenCalledWith({
      provider: 'resend',
      eventId: 'evt_123',
      eventType: 'email.sent',
      providerMessageId: 'email_123',
      occurredAt: '2026-07-20T01:02:03.000Z',
      taggedJobId: '018f8f52-22f2-7f4d-8e13-0d1ccb612345',
      taggedEffectRef: 'a'.repeat(64),
    });
    expect(result.status).toBe(200);
    expect(result.headers.get('cache-control')).toBe('no-store');
    await expect(result.json()).resolves.toEqual({ ok: true, outcome: 'accepted' });
  });

  it('acknowledges signed event types that do not mutate provider acceptance', async () => {
    verifyResendWebhook.mockReturnValue({
      outcome: 'ignored',
      provider: 'resend',
      eventType: 'email.delivered',
      eventId: 'evt_ignored',
      occurredAt: '2026-07-20T01:02:03.000Z',
    });
    const { POST } = await import('./route');
    const result = await POST(request());

    expect(result.status).toBe(200);
    expect(reconcileVerifiedProviderAcceptance).not.toHaveBeenCalled();
    await expect(result.json()).resolves.toEqual({ ok: true, outcome: 'ignored' });
  });

  it('acknowledges signed untagged legacy email events without calling reconciliation', async () => {
    verifyResendWebhook.mockReturnValue({
      outcome: 'ignored',
      provider: 'resend',
      eventType: 'email.sent',
      eventId: 'evt_legacy',
      occurredAt: '2026-07-20T01:02:03.000Z',
    });
    const { POST } = await import('./route');
    const result = await POST(request());

    expect(result.status).toBe(200);
    expect(reconcileVerifiedProviderAcceptance).not.toHaveBeenCalled();
    await expect(result.json()).resolves.toEqual({ ok: true, outcome: 'ignored' });
  });

  it('fails closed for a missing server secret or rejected signature', async () => {
    delete process.env.RESEND_WEBHOOK_SECRET;
    let route = await import('./route');
    let result = await route.POST(request());
    expect(result.status).toBe(503);
    expect(verifyResendWebhook).not.toHaveBeenCalled();

    process.env.RESEND_WEBHOOK_SECRET = 'whsec_test';
    vi.resetModules();
    verifyResendWebhook.mockImplementation(() => {
      throw new MockVerificationError('RESEND_WEBHOOK_SIGNATURE_INVALID');
    });
    route = await import('./route');
    result = await route.POST(request());
    expect(result.status).toBe(400);
    expect(reconcileVerifiedProviderAcceptance).not.toHaveBeenCalled();
    await expect(result.json()).resolves.toEqual({ ok: false, code: 'RESEND_WEBHOOK_REJECTED' });
  });

  it.each([
    ['string body', request('x'.repeat(262_145))],
    ['advertised content length', request('{}', { 'content-length': '262145' })],
    ['malformed content length', request('{}', { 'content-length': 'not-a-number' })],
  ])('rejects an invalid %s before signature verification', async (_case, oversizedRequest) => {
    const { POST } = await import('./route');
    const result = await POST(oversizedRequest);

    expect(result.status).toBe(400);
    expect(verifyResendWebhook).not.toHaveBeenCalled();
    expect(reconcileVerifiedProviderAcceptance).not.toHaveBeenCalled();
    await expect(result.json()).resolves.toEqual({ ok: false, code: 'RESEND_WEBHOOK_BODY_INVALID' });
  });

  it('enforces the body limit cumulatively across chunks and cancels the remaining stream', async () => {
    const cancelled = vi.fn();
    let pullCount = 0;
    const oversizedStream = new ReadableStream<Uint8Array>({
      pull(controller) {
        pullCount += 1;
        controller.enqueue(new Uint8Array(pullCount === 1 ? 131_072 : 131_073));
      },
      cancel: cancelled,
    });
    const { POST } = await import('./route');
    const result = await POST(streamingRequest(oversizedStream));

    expect(result.status).toBe(400);
    expect(pullCount).toBeGreaterThanOrEqual(2);
    expect(cancelled).toHaveBeenCalledOnce();
    expect(verifyResendWebhook).not.toHaveBeenCalled();
    await expect(result.json()).resolves.toEqual({ ok: false, code: 'RESEND_WEBHOOK_BODY_INVALID' });
  });

  it('cancels an unread stream when content length is rejected before the first read', async () => {
    const cancelled = vi.fn();
    const body = new ReadableStream<Uint8Array>({
      pull: vi.fn(),
      cancel: cancelled,
    });
    const { POST } = await import('./route');
    const result = await POST(streamingRequest(body, { 'content-length': '262145' }));

    expect(result.status).toBe(400);
    expect(cancelled).toHaveBeenCalledOnce();
    expect(verifyResendWebhook).not.toHaveBeenCalled();
  });

  it('fails closed when the request stream errors while being read', async () => {
    let pullCount = 0;
    const failingStream = new ReadableStream<Uint8Array>({
      pull(controller) {
        pullCount += 1;
        if (pullCount === 1) {
          controller.enqueue(new Uint8Array([123]));
          return;
        }
        controller.error(new Error('socket failed'));
      },
    });
    const { POST } = await import('./route');
    const result = await POST(streamingRequest(failingStream));

    expect(result.status).toBe(400);
    expect(verifyResendWebhook).not.toHaveBeenCalled();
    expect(reconcileVerifiedProviderAcceptance).not.toHaveBeenCalled();
    await expect(result.json()).resolves.toEqual({ ok: false, code: 'RESEND_WEBHOOK_BODY_INVALID' });
  });

  it.each([
    ['PROVIDER_RECONCILIATION_CONFLICT', 409],
    ['PROVIDER_RECONCILIATION_REJECTED', 400],
    ['PROVIDER_RECONCILIATION_FAILED', 503],
  ] as const)('maps repository error %s to a safe HTTP status', async (code, status) => {
    reconcileVerifiedProviderAcceptance.mockRejectedValue(new MockRepositoryError(code));
    const { POST } = await import('./route');
    const result = await POST(request());

    expect(result.status).toBe(status);
    expect(await result.text()).not.toContain('sensitive');
  });
});
