import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  getEmailDeliveryFailureSummary: vi.fn(),
  sendEmail: vi.fn(),
}));

vi.mock('@/lib/email/sendEmail', () => ({
  getEmailDeliveryFailureSummary: h.getEmailDeliveryFailureSummary,
  sendEmail: h.sendEmail,
}));

function contactRequest(eventId: string, ip: string): Request {
  return new Request('http://localhost/api/contact', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-forwarded-for': ip,
    },
    body: JSON.stringify({
      name: 'Taylor',
      email: 'taylor@example.test',
      message: 'Please contact me',
      enquiry_type: 'residential',
      event_id: eventId,
    }),
  });
}

describe('POST /api/contact email compatibility path', () => {
  beforeEach(() => {
    vi.resetModules();
    h.sendEmail.mockReset();
    h.getEmailDeliveryFailureSummary.mockReset();
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
});
