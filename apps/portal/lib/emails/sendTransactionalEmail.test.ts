import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  createResendEmailGateway: vi.fn(),
  dispatchLegacy: vi.fn(),
}));

vi.mock('@sp/email-provider', () => ({
  createResendEmailGateway: h.createResendEmailGateway,
}));

describe('sendTransactionalEmail', () => {
  beforeEach(() => {
    vi.resetModules();
    h.createResendEmailGateway.mockReset();
    h.dispatchLegacy.mockReset();
    h.createResendEmailGateway.mockReturnValue({
      dispatchLegacy: h.dispatchLegacy,
    });
    process.env.RESEND_API_KEY = 'test-api-key';
    process.env.EMAIL_FROM = 'Sanctuary Test <sender@example.test>';
    process.env.EMAIL_REPLY_TO = 'reply@example.test';
    process.env.EMAIL_BCC = 'audit@example.test, DUPLICATE@example.test';
  });

  it('maps the exact message, attachment, timeout, signal, and stable idempotency key', async () => {
    h.dispatchLegacy.mockResolvedValue({
      provider: 'resend',
      outcome: 'accepted',
      code: 'RESEND_ACCEPTED',
      messageId: 'provider-message-1',
      statusCode: 200,
      durationMs: 8,
    });
    const controller = new AbortController();
    const attachment = Buffer.from('quote-pdf');
    const { sendTransactionalEmail } = await import('./sendTransactionalEmail');

    const result = await sendTransactionalEmail({
      to: [' customer@example.test ', 'second@example.test'],
      cc: ['accounts@example.test'],
      bcc: ['duplicate@example.test', 'sales@example.test'],
      subject: 'Quote ready',
      html: '<p>Quote ready</p>',
      text: 'Quote ready',
      attachments: [{ filename: 'quote.pdf', content: attachment, contentType: 'application/pdf' }],
      idempotencyKey: 'quote-send/quote-version-1',
      signal: controller.signal,
    });

    expect(h.createResendEmailGateway).toHaveBeenCalledWith({ apiKey: 'test-api-key' });
    expect(h.dispatchLegacy).toHaveBeenCalledWith(
      {
        from: 'Sanctuary Test <sender@example.test>',
        to: ['customer@example.test', 'second@example.test'],
        cc: ['accounts@example.test'],
        bcc: ['audit@example.test', 'DUPLICATE@example.test', 'sales@example.test'],
        replyTo: 'reply@example.test',
        subject: 'Quote ready',
        html: '<p>Quote ready</p>',
        text: 'Quote ready',
        attachments: [{ filename: 'quote.pdf', content: attachment, contentType: 'application/pdf' }],
      },
      {
        timeoutMs: 15_000,
        idempotencyKey: 'quote-send/quote-version-1',
        signal: controller.signal,
      },
    );
    expect(result).toEqual({
      data: { id: 'provider-message-1' },
      error: null,
      provider: 'resend',
      providerMessageId: 'provider-message-1',
    });
  });

  it('throws a typed safe error for a provider rejection', async () => {
    h.dispatchLegacy.mockResolvedValue({
      provider: 'resend',
      outcome: 'terminal_rejection',
      code: 'RESEND_AUTH_REJECTED',
      statusCode: 401,
      durationMs: 4,
    });
    const { sendTransactionalEmail, TransactionalEmailDeliveryError } = await import(
      './sendTransactionalEmail'
    );

    const promise = sendTransactionalEmail({
      to: 'customer@example.test',
      subject: 'Invoice ready',
      html: '<p>Invoice ready</p>',
    });

    await expect(promise).rejects.toBeInstanceOf(TransactionalEmailDeliveryError);
    await expect(promise).rejects.toMatchObject({
      code: 'RESEND_AUTH_REJECTED',
      outcome: 'terminal_rejection',
      statusCode: 401,
      message: 'Transactional email delivery failed (RESEND_AUTH_REJECTED).',
    });
  });

  it('preserves the existing quote-route configuration classification without exposing a credential', async () => {
    delete process.env.RESEND_API_KEY;
    const { sendTransactionalEmail } = await import('./sendTransactionalEmail');

    const promise = sendTransactionalEmail({
      to: 'customer@example.test',
      subject: 'Quote ready',
      html: '<p>Quote ready</p>',
    });

    await expect(promise).rejects.toMatchObject({
      code: 'EMAIL_PROVIDER_CONFIGURATION_MISSING',
      outcome: 'configuration_error',
      statusCode: null,
      message: 'Missing env var: RESEND_API_KEY',
    });
    expect(h.createResendEmailGateway).not.toHaveBeenCalled();
  });
});
