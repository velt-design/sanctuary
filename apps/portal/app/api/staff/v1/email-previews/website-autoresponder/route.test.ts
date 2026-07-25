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
  isWebsiteAutoresponderPreviewLayout: (value: unknown) =>
    typeof value === 'string'
    && ['editorial-refined', 'image-led', 'compact'].includes(value),
  getWebsiteAutoresponderPreviewFixture: h.fixture,
  WEBSITE_AUTORESPONDER_PREVIEW_LAYOUTS: [
    {
      id: 'editorial-refined',
      name: 'Editorial Refined',
      description: 'Editorial description',
      bestFor: 'Balanced brand expression',
    },
    {
      id: 'image-led',
      name: 'Image-led',
      description: 'Image description',
      bestFor: 'Visual impact',
    },
    {
      id: 'compact',
      name: 'Compact',
      description: 'Compact description',
      bestFor: 'Fast scanning',
    },
  ],
  renderWebsiteAutoresponderAlternative: h.render,
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
    h.render.mockReset().mockImplementation(
      async (
        _templateId: string,
        _variables: unknown,
        layout: string,
        options: { previewTheme: string },
      ) => ({
        layout,
        subject: "Alex, we've received your pergola enquiry",
        sendSubject: `[Preview: ${layout}] Alex, we've received your pergola enquiry`,
        preheader: 'Your project details and next steps.',
        html: `<html class="${options.previewTheme}"><body>${layout}</body></html>`,
        text: `${layout} preview`,
      }),
    );
    h.send.mockReset().mockResolvedValue({
      variant: 'residential-gable-with-blinds',
      layout: 'editorial-refined',
      recipient: 'jordan@sanctuarypergolas.co.nz',
      subject:
        "[Preview: Editorial Refined] Alex, we've received your pergola enquiry",
      customerSubject: "Alex, we've received your pergola enquiry",
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

  it('renders all three layouts in forced light and dark comparison modes', async () => {
    const { GET } = await import('./route');

    const response = await GET(
      new Request(
        'http://localhost/api/staff/v1/email-previews/website-autoresponder?variant=residential-gable-with-blinds',
      ),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(h.fixture).toHaveBeenCalledWith('residential-gable-with-blinds');
    expect(h.render).toHaveBeenCalledTimes(6);
    expect(h.render).toHaveBeenCalledWith(
      fixture.templateId,
      fixture.variables,
      'editorial-refined',
      { previewTheme: 'light' },
    );
    expect(h.render).toHaveBeenCalledWith(
      fixture.templateId,
      fixture.variables,
      'compact',
      { previewTheme: 'dark' },
    );
    await expect(response.json()).resolves.toMatchObject({
      variant: 'residential-gable-with-blinds',
      label: 'Residential · Gable · With blinds',
      layouts: [
        {
          id: 'editorial-refined',
          name: 'Editorial Refined',
          htmlLight:
            '<html class="light"><body>editorial-refined</body></html>',
          htmlDark:
            '<html class="dark"><body>editorial-refined</body></html>',
        },
        { id: 'image-led', name: 'Image-led' },
        { id: 'compact', name: 'Compact' },
      ],
      recipient: 'jordan@sanctuarypergolas.co.nz',
      sendReady: true,
      configurationReason: 'ready',
    });
  });

  it('rejects obsolete fixture identifiers', async () => {
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
  });

  it('rejects browser-supplied recipients and arbitrary payload fields', async () => {
    const { POST } = await import('./route');
    const response = await POST(
      new Request(
        'http://localhost/api/staff/v1/email-previews/website-autoresponder',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            variant: 'residential-gable-with-blinds',
            layout: 'editorial-refined',
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

  it('rejects invented preview layouts', async () => {
    const { POST } = await import('./route');
    const response = await POST(
      new Request(
        'http://localhost/api/staff/v1/email-previews/website-autoresponder',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            variant: 'residential-gable-with-blinds',
            layout: 'invented',
          }),
        },
      ),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: 'EMAIL_PREVIEW_LAYOUT_INVALID',
    });
    expect(h.send).not.toHaveBeenCalled();
  });

  it('sends only the selected fixture and layout to the configured recipient', async () => {
    const { POST } = await import('./route');
    const response = await POST(
      new Request(
        'http://localhost/api/staff/v1/email-previews/website-autoresponder',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            variant: 'residential-gable-with-blinds',
            layout: 'editorial-refined',
          }),
        },
      ),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(h.send).toHaveBeenCalledWith(
      'residential-gable-with-blinds',
      'editorial-refined',
    );
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      layout: 'editorial-refined',
      recipient: 'jordan@sanctuarypergolas.co.nz',
      subject:
        "[Preview: Editorial Refined] Alex, we've received your pergola enquiry",
      customerSubject: "Alex, we've received your pergola enquiry",
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
          body: JSON.stringify({
            variant: 'professional',
            layout: 'compact',
          }),
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
