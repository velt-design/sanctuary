import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  requireStaffSession: vi.fn(),
  availability: vi.fn(),
  fixture: vi.fn(),
  render: vi.fn(),
  send: vi.fn(),
}));

vi.mock('@/lib/api/staffApi', async () => ({
  ...(await vi.importActual<typeof import('@/lib/api/staffApi')>(
    '@/lib/api/staffApi',
  )),
  requireStaffSession: h.requireStaffSession,
}));

vi.mock('@/lib/sharedEmails', () => ({
  isWebsiteAutoresponderPreviewVariant: (value: unknown) =>
    typeof value === 'string'
    && (
      value === 'professional'
      || /^(residential|commercial)-(pitched|gable|box-perimeter|hip)-(without-blinds|with-blinds)$/.test(
        value,
      )
    ),
  getWebsiteAutoresponderPreviewFixture: h.fixture,
  renderWebsiteAutoresponder: h.render,
}));

vi.mock('@/lib/sharedEmailPreviewSender', () => ({
  getWebsiteAutoresponderPreviewAvailability: h.availability,
  sendWebsiteAutoresponderPreview: h.send,
  WebsiteAutoresponderPreviewError: class WebsiteAutoresponderPreviewError extends Error {
    code = 'EMAIL_PREVIEW_SEND_FAILED';
  },
}));

const fixture = {
  variant: 'residential-gable-with-blinds',
  label: 'Residential · Gable · With blinds',
  templateId: 'EMAIL_WEBSITE_AUTORESPONDER_RES_V1',
  variables: { name: 'Alex' },
};

describe('staff website autoresponder preview route', () => {
  beforeEach(() => {
    h.requireStaffSession.mockReset().mockResolvedValue({
      user: { email: 'staff@example.test' },
      role: 'staff',
    });
    h.availability.mockReset().mockReturnValue({
      available: true,
      sendReady: true,
      recipient: 'jordan@sanctuarypergolas.co.nz',
      reason: 'ready',
    });
    h.fixture.mockReset().mockReturnValue(fixture);
    h.render.mockReset().mockResolvedValue({
      subject: "Alex, we've received your pergola enquiry",
      preheader: 'Your project details and next steps.',
      html: '<html><body>Preview</body></html>',
      text: 'Preview',
    });
    h.send.mockReset().mockResolvedValue({
      variant: 'residential-gable-with-blinds',
      recipient: 'jordan@sanctuarypergolas.co.nz',
      subject: "Alex, we've received your pergola enquiry",
      preheader: 'Your project details and next steps.',
      providerMessageId: 'preview-message-1',
    });
  });

  it('requires an authenticated staff session', async () => {
    h.requireStaffSession.mockResolvedValueOnce(null);
    const { GET } = await import('./route');

    const response = await GET(
      new Request(
        'http://localhost/api/staff/v1/email-previews/website-autoresponder',
      ),
    );

    expect(response.status).toBe(401);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(h.render).not.toHaveBeenCalled();
  });

  it('is unavailable when the server-side preview flag is disabled', async () => {
    h.availability.mockReturnValueOnce({
      available: false,
      sendReady: false,
      recipient: null,
      reason: 'disabled',
    });
    const { GET } = await import('./route');

    const response = await GET(
      new Request(
        'http://localhost/api/staff/v1/email-previews/website-autoresponder',
      ),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      code: 'EMAIL_PREVIEW_DISABLED',
    });
    expect(h.render).not.toHaveBeenCalled();
  });

  it('renders the exact fixture subject, preheader, HTML and plain text', async () => {
    const { GET } = await import('./route');

    const response = await GET(
      new Request(
        'http://localhost/api/staff/v1/email-previews/website-autoresponder?variant=residential-gable-with-blinds',
      ),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(h.fixture).toHaveBeenCalledWith('residential-gable-with-blinds');
    expect(h.render).toHaveBeenCalledWith(
      fixture.templateId,
      fixture.variables,
    );
    await expect(response.json()).resolves.toEqual({
      variant: 'residential-gable-with-blinds',
      label: 'Residential · Gable · With blinds',
      subject: "Alex, we've received your pergola enquiry",
      preheader: 'Your project details and next steps.',
      html: '<html><body>Preview</body></html>',
      text: 'Preview',
      recipient: 'jordan@sanctuarypergolas.co.nz',
      sendReady: true,
      configurationReason: 'ready',
    });
  });

  it('rejects obsolete or invented fixture identifiers', async () => {
    const { GET } = await import('./route');

    const response = await GET(
      new Request(
        'http://localhost/api/staff/v1/email-previews/website-autoresponder?variant=residential',
      ),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: 'EMAIL_PREVIEW_VARIANT_INVALID',
    });
    expect(h.fixture).not.toHaveBeenCalled();
    expect(h.render).not.toHaveBeenCalled();
  });

  it('rejects browser-supplied recipients and all fields except the fixture variant', async () => {
    const { POST } = await import('./route');

    const response = await POST(
      new Request(
        'http://localhost/api/staff/v1/email-previews/website-autoresponder',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            variant: 'residential-gable-with-blinds',
            recipient: 'other@example.test',
          }),
        },
      ),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: 'EMAIL_PREVIEW_BODY_INVALID',
    });
    expect(h.send).not.toHaveBeenCalled();
  });

  it('sends only the selected fixture to the server-configured recipient', async () => {
    const { POST } = await import('./route');

    const response = await POST(
      new Request(
        'http://localhost/api/staff/v1/email-previews/website-autoresponder',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ variant: 'residential-gable-with-blinds' }),
        },
      ),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(h.send).toHaveBeenCalledWith('residential-gable-with-blinds');
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      recipient: 'jordan@sanctuarypergolas.co.nz',
      subject: "Alex, we've received your pergola enquiry",
      providerMessageId: 'preview-message-1',
    });
  });

  it('does not attempt delivery when preview sending is not configured', async () => {
    h.availability.mockReturnValueOnce({
      available: true,
      sendReady: false,
      recipient: 'jordan@sanctuarypergolas.co.nz',
      reason: 'missing_api_key',
    });
    const { POST } = await import('./route');

    const response = await POST(
      new Request(
        'http://localhost/api/staff/v1/email-previews/website-autoresponder',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ variant: 'professional' }),
        },
      ),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      code: 'EMAIL_PREVIEW_CONFIGURATION_MISSING',
      configurationReason: 'missing_api_key',
    });
    expect(h.send).not.toHaveBeenCalled();
  });
});
