import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  getEmailDeliveryFailureSummary: vi.fn(),
  sendEmail: vi.fn(),
  getServiceSupabase: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock('@/lib/email/sendEmail', () => ({
  getEmailDeliveryFailureSummary: h.getEmailDeliveryFailureSummary,
  sendEmail: h.sendEmail,
}));
vi.mock('@/lib/supabaseService', () => ({
  getServiceSupabase: h.getServiceSupabase,
}));

function contactRequest(eventId: string, ip: string, extra:Record<string,unknown>={}): Request {
  return new Request('http://localhost/api/contact', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-forwarded-for': ip,
    },
    body: JSON.stringify({
      name: 'Taylor',
      email: 'taylor@example.test',
      phone: '+64 21 000 0000',
      message: 'Please contact me',
      enquiry_type: 'residential',
      event_id: eventId,
      ...extra,
    }),
  });
}

describe('POST /api/contact email compatibility path', () => {
  beforeEach(() => {
    vi.resetModules();
    h.sendEmail.mockReset();
    h.getEmailDeliveryFailureSummary.mockReset();
    h.getServiceSupabase.mockReset();
    h.rpc.mockReset();
    h.rpc.mockResolvedValue({ data: [{ allowed: true, retry_after_seconds: 0 }], error: null });
    h.getServiceSupabase.mockReturnValue({ rpc: h.rpc });
    h.getEmailDeliveryFailureSummary.mockReturnValue({
      code: 'EMAIL_DELIVERY_UNEXPECTED',
      outcome: 'adapter_error',
      statusCode: null,
    });
    process.env.RESEND_API_KEY = 'contact-test-api-key';
    delete process.env.SLACK_WEBHOOK_URL;
    delete process.env.LEADS_SHEET_WEBHOOK_URL;
    delete process.env.META_PIXEL_ID;
    delete process.env.META_CAPI_ACCESS_TOKEN;
    delete process.env.EMAIL_FROM;
    delete process.env.EMAIL_TO_RESIDENTIAL;
  });

  it('uses the submitted event ID as the stable provider idempotency key', async () => {
    h.sendEmail.mockResolvedValue({ provider: 'resend', providerMessageId: 'provider-message-4' });
    const { POST } = await import('./route');

    const response = await POST(contactRequest('event-123', '203.0.113.10'));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(h.sendEmail).toHaveBeenCalledTimes(1);
    expect(h.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'onboarding@resend.dev',
        to: ['info@sanctuarypergolas.co.nz'],
        replyTo: 'taylor@example.test',
        subject: expect.stringContaining('[Website enquiry] residential'),
        html: expect.stringContaining('Please contact me'),
        idempotencyKey: 'website-contact/event-123',
      }),
    );
  });

  it('keeps a provider failure best-effort and logs only the safe typed summary', async () => {
    const providerFailure = new Error('raw provider body for taylor@example.test');
    h.sendEmail.mockRejectedValue(providerFailure);
    h.getEmailDeliveryFailureSummary.mockReturnValue({
      code: 'RESEND_TIMEOUT',
      outcome: 'uncertain',
      statusCode: null,
    });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { POST } = await import('./route');

    const response = await POST(contactRequest('event-456', '203.0.113.11'));

    expect(response.status).toBe(200);
    expect(h.getEmailDeliveryFailureSummary).toHaveBeenCalledWith(providerFailure);
    expect(warn).toHaveBeenCalledWith('Contact email delivery failed', {
      code: 'RESEND_TIMEOUT',
      outcome: 'uncertain',
      statusCode: null,
    });
    expect(JSON.stringify(warn.mock.calls)).not.toContain('taylor@example.test');
    warn.mockRestore();
  });

  it('uses the durable database rate limit', async () => {
    h.rpc.mockResolvedValueOnce({
      data: [{ allowed: false, retry_after_seconds: 120 }],
      error: null,
    });
    const { POST } = await import('./route');
    const response = await POST(contactRequest('event-limited', '203.0.113.12'));

    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('120');
    expect(h.sendEmail).not.toHaveBeenCalled();
  });

  it('rejects legacy multipart uploads instead of buffering unbound files', async () => {
    const { POST } = await import('./route');
    const response = await POST(new Request('http://localhost/api/contact', {
      method: 'POST',
      body: new FormData(),
    }));

    expect(response.status).toBe(415);
    expect(h.getServiceSupabase).not.toHaveBeenCalled();
  });

  it('requires a plausible phone before the legacy compatibility path runs', async () => {
    const { POST } = await import('./route');
    const response = await POST(new Request('http://localhost/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Taylor',
        email: 'taylor@example.test',
        phone: 'x',
      }),
    }));

    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({ ok: false, error: 'Invalid phone' });
    expect(h.getServiceSupabase).not.toHaveBeenCalled();
  });
  afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});
  it.each([
    ['production',{},1],['preview',{},0],['production',{verification:true},0],
    ['production',{attribution:{utm:{utm_source:'codex_qa',utm_medium:'qa'}}},0],
  ] as const)('preserves intake but scopes legacy CAPI to real production consent (%s)',async(environment,extra,calls)=>{
    vi.stubEnv('VERCEL_ENV',environment);vi.stubEnv('META_CONVERSIONS_API_TOKEN','synthetic-token');vi.stubEnv('NEXT_PUBLIC_FB_PIXEL_ID','123');
    const fetcher=vi.fn().mockResolvedValue(new Response('{}',{status:200}));vi.stubGlobal('fetch',fetcher);
    h.sendEmail.mockResolvedValue({provider:'resend',providerMessageId:'synthetic'});
    const {POST}=await import('./route');
    const response=await POST(contactRequest('synthetic-tracking','203.0.113.31',{marketing_consent:'yes',...extra}));
    expect(response.status).toBe(200);expect(h.sendEmail).toHaveBeenCalledTimes(1);expect(fetcher).toHaveBeenCalledTimes(calls);
  });

});
