import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  createResendEmailGateway: vi.fn(),
  dispatchLegacy: vi.fn(),
}));

vi.mock('@sp/email-provider', () => ({
  createResendEmailGateway: h.createResendEmailGateway,
}));

describe('sendEmail', () => {
  beforeEach(() => {
    vi.resetModules();
    h.createResendEmailGateway.mockReset();
    h.dispatchLegacy.mockReset();
    h.createResendEmailGateway.mockReturnValue({
      dispatchLegacy: h.dispatchLegacy,
    });
    process.env.RESEND_API_KEY = 'marketing-test-api-key';
  });

  it('dispatches the exact message with a 15 second timeout and stable key', async () => {
    h.dispatchLegacy.mockResolvedValue({
      provider: 'resend',
      outcome: 'accepted',
      code: 'RESEND_ACCEPTED',
      messageId: 'provider-message-2',
      statusCode: 200,
      durationMs: 5,
    });
    const controller = new AbortController();
    const { sendEmail } = await import('./sendEmail');

    const result = await sendEmail({
      from: 'sender@example.test',
      to: ['recipient@example.test'],
      bcc: ['audit@example.test'],
      replyTo: 'reply@example.test',
      subject: 'Enquiry received',
      html: '<p>Received</p>',
      text: 'Received',
      attachments: [{ filename: 'plan.pdf', content: 'UERGREFUQQ==', contentType: 'application/pdf' }],
      idempotencyKey: 'website:autoresponder:enquiry-1',
      signal: controller.signal,
    });

    expect(h.createResendEmailGateway).toHaveBeenCalledWith({ apiKey: 'marketing-test-api-key' });
    expect(h.dispatchLegacy).toHaveBeenCalledWith(
      {
        from: 'sender@example.test',
        to: ['recipient@example.test'],
        bcc: ['audit@example.test'],
        replyTo: 'reply@example.test',
        subject: 'Enquiry received',
        html: '<p>Received</p>',
        text: 'Received',
        attachments: [{ filename: 'plan.pdf', content: 'UERGREFUQQ==', contentType: 'application/pdf' }],
      },
      {
        timeoutMs: 15_000,
        idempotencyKey: 'website:autoresponder:enquiry-1',
        signal: controller.signal,
      },
    );
    expect(result).toEqual({ provider: 'resend', providerMessageId: 'provider-message-2' });
  });

  it('maps provider failures to a typed summary without provider response content', async () => {
    h.dispatchLegacy.mockResolvedValue({
      provider: 'resend',
      outcome: 'uncertain',
      code: 'RESEND_TIMEOUT',
      statusCode: null,
      durationMs: 15_000,
    });
    const { EmailDeliveryError, getEmailDeliveryFailureSummary, sendEmail } = await import('./sendEmail');

    const error = await sendEmail({
      from: 'sender@example.test',
      to: 'recipient@example.test',
      subject: 'Enquiry received',
      html: '<p>Received</p>',
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(EmailDeliveryError);
    expect(error).toMatchObject({
      code: 'RESEND_TIMEOUT',
      outcome: 'uncertain',
      statusCode: null,
      message: 'Email delivery failed (RESEND_TIMEOUT).',
    });
    expect(getEmailDeliveryFailureSummary(error)).toEqual({
      code: 'RESEND_TIMEOUT',
      outcome: 'uncertain',
      statusCode: null,
    });
    expect(JSON.stringify(error)).not.toContain('recipient@example.test');
  });
});
