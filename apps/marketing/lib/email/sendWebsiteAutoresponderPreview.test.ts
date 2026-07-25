import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  createResendEmailGateway: vi.fn(),
  dispatchLegacy: vi.fn(),
}));

vi.mock('@sp/email-provider', () => ({
  createResendEmailGateway: h.createResendEmailGateway,
}));

describe('website autoresponder preview sender', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
    h.createResendEmailGateway.mockReset();
    h.dispatchLegacy.mockReset();
    h.createResendEmailGateway.mockReturnValue({
      dispatchLegacy: h.dispatchLegacy,
    });
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('VERCEL_ENV', '');
    vi.stubEnv('EMAIL_PREVIEW_ENABLED', 'true');
    vi.stubEnv('EMAIL_PREVIEW_TO', 'jordan@sanctuarypergolas.co.nz');
    vi.stubEnv('RESEND_API_KEY_PREVIEW', 'preview-test-api-key');
  });

  afterEach(() => vi.unstubAllEnvs());

  it('sends the exact rendered customer content only to the configured review inbox without BCC', async () => {
    h.dispatchLegacy.mockResolvedValue({
      provider: 'resend',
      outcome: 'accepted',
      code: 'RESEND_ACCEPTED',
      messageId: 'preview-message-1',
      statusCode: 200,
      durationMs: 5,
    });
    const { sendWebsiteAutoresponderPreview } = await import(
      './sendWebsiteAutoresponderPreview'
    );

    const result = await sendWebsiteAutoresponderPreview(
      'residential-gable-with-blinds',
    );

    expect(h.createResendEmailGateway).toHaveBeenCalledWith({
      apiKey: 'preview-test-api-key',
    });
    expect(h.dispatchLegacy).toHaveBeenCalledTimes(1);
    const [message, options] = h.dispatchLegacy.mock.calls[0]!;
    expect(message).toMatchObject({
      from: 'Sanctuary Pergolas <info@sanctuarypergolas.co.nz>',
      to: 'jordan@sanctuarypergolas.co.nz',
      replyTo: 'info@sanctuarypergolas.co.nz',
      subject: "Alex, we've received your pergola enquiry",
    });
    expect(message).not.toHaveProperty('bcc');
    expect(message.html).toContain('Project details received');
    expect(message.text).toContain('Project details received');
    expect(options).toMatchObject({ timeoutMs: 15_000 });
    expect(options.idempotencyKey).toMatch(
      /^website-autoresponder-preview:residential-gable-with-blinds:/,
    );
    expect(result).toMatchObject({
      recipient: 'jordan@sanctuarypergolas.co.nz',
      subject: "Alex, we've received your pergola enquiry",
      providerMessageId: 'preview-message-1',
    });
  });

  it('is unavailable when the preview flag is disabled', async () => {
    vi.stubEnv('EMAIL_PREVIEW_ENABLED', 'TRUE');
    const {
      getWebsiteAutoresponderPreviewAvailability,
      sendWebsiteAutoresponderPreview,
    } = await import(
      './sendWebsiteAutoresponderPreview'
    );

    expect(getWebsiteAutoresponderPreviewAvailability()).toMatchObject({
      available: false,
      sendReady: false,
      reason: 'disabled',
    });
    await expect(sendWebsiteAutoresponderPreview('professional')).rejects.toMatchObject({
      code: 'EMAIL_PREVIEW_UNAVAILABLE',
    });
    expect(h.createResendEmailGateway).not.toHaveBeenCalled();
  });

  it('stays unavailable in a production deployment even if the flag is set', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('VERCEL_ENV', 'production');
    const {
      getWebsiteAutoresponderPreviewAvailability,
      sendWebsiteAutoresponderPreview,
    } = await import('./sendWebsiteAutoresponderPreview');

    expect(getWebsiteAutoresponderPreviewAvailability()).toMatchObject({
      available: false,
      sendReady: false,
      recipient: null,
      reason: 'environment_not_allowed',
    });
    await expect(
      sendWebsiteAutoresponderPreview('commercial-pitched-without-blinds'),
    ).rejects.toMatchObject({
      code: 'EMAIL_PREVIEW_UNAVAILABLE',
    });
  });

  it('requires one server-configured recipient and the preview-only provider key', async () => {
    const { getWebsiteAutoresponderPreviewAvailability } = await import(
      './sendWebsiteAutoresponderPreview'
    );

    vi.stubEnv(
      'EMAIL_PREVIEW_TO',
      'jordan@sanctuarypergolas.co.nz,other@example.test',
    );
    expect(getWebsiteAutoresponderPreviewAvailability()).toMatchObject({
      available: true,
      sendReady: false,
      recipient: null,
      reason: 'invalid_recipient',
    });

    vi.stubEnv('EMAIL_PREVIEW_TO', 'jordan@sanctuarypergolas.co.nz');
    vi.stubEnv('RESEND_API_KEY_PREVIEW', '');
    expect(getWebsiteAutoresponderPreviewAvailability()).toMatchObject({
      available: true,
      sendReady: false,
      recipient: 'jordan@sanctuarypergolas.co.nz',
      reason: 'missing_api_key',
    });
  });
});
