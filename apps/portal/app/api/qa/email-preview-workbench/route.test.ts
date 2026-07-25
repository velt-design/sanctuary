import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  renderPreview: vi.fn(),
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
}));

vi.mock('@/lib/emailPreviews/websiteAutoresponderPreviewRenderer', () => ({
  renderWebsiteAutoresponderPreviewPayload: h.renderPreview,
}));

const originalFixtureFlag = process.env.ENABLE_PORTAL_QA_FIXTURES;
const fixturePayload = {
  variant: 'residential-gable-with-blinds',
  label: 'Residential · Gable · With blinds',
  image: {
    projectTitle: 'Warkworth Outdoor Room',
    match: 'exact',
  },
  layouts: [
    {
      id: 'editorial-refined',
      name: 'Editorial Refined',
      subject: 'Customer subject',
      sendSubject: '[Preview: Editorial Refined] Customer subject',
      preheader: 'Fixture preheader',
    },
    {
      id: 'image-led',
      name: 'Image-led',
      subject: 'Customer subject',
      sendSubject: '[Preview: Image-led] Customer subject',
      preheader: 'Fixture preheader',
    },
    {
      id: 'compact',
      name: 'Compact',
      subject: 'Customer subject',
      sendSubject: '[Preview: Compact] Customer subject',
      preheader: 'Fixture preheader',
    },
  ],
};

describe('email preview workbench QA route', () => {
  beforeEach(() => {
    process.env.ENABLE_PORTAL_QA_FIXTURES = '1';
    h.renderPreview.mockReset().mockResolvedValue(fixturePayload);
  });

  afterEach(() => {
    if (originalFixtureFlag === undefined) {
      delete process.env.ENABLE_PORTAL_QA_FIXTURES;
    } else {
      process.env.ENABLE_PORTAL_QA_FIXTURES = originalFixtureFlag;
    }
  });

  it('is unavailable unless the QA fixture flag is explicitly enabled', async () => {
    delete process.env.ENABLE_PORTAL_QA_FIXTURES;
    const { GET } = await import('./route');

    const response = await GET(
      new Request('http://localhost/api/qa/email-preview-workbench'),
    );

    expect(response.status).toBe(404);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    await expect(response.json()).resolves.toMatchObject({
      code: 'EMAIL_PREVIEW_QA_DISABLED',
    });
    expect(h.renderPreview).not.toHaveBeenCalled();
  });

  it('renders the governed fixture with synthetic delivery context', async () => {
    const { GET } = await import('./route');

    const response = await GET(
      new Request(
        'http://localhost/api/qa/email-preview-workbench?variant=residential-gable-with-blinds',
      ),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(h.renderPreview).toHaveBeenCalledWith(
      'residential-gable-with-blinds',
    );
    await expect(response.json()).resolves.toMatchObject({
      variant: 'residential-gable-with-blinds',
      layouts: [{ id: 'editorial-refined' }, { id: 'image-led' }, { id: 'compact' }],
      recipient: 'jordan@sanctuarypergolas.co.nz',
      environment: 'Local QA fixture',
      deliveryMode: 'QA simulation · no provider or writes',
      sendReady: true,
      configurationReason: 'ready',
    });
  });

  it('rejects unknown variants without rendering', async () => {
    const { GET } = await import('./route');
    const response = await GET(
      new Request(
        'http://localhost/api/qa/email-preview-workbench?variant=made-up',
      ),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: 'EMAIL_PREVIEW_VARIANT_INVALID',
    });
    expect(h.renderPreview).not.toHaveBeenCalled();
  });

  it('returns a synthetic one-layout acceptance with no provider call', async () => {
    const { POST } = await import('./route');
    const response = await POST(
      new Request('http://localhost/api/qa/email-preview-workbench', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          variant: 'residential-gable-with-blinds',
          layout: 'image-led',
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(h.renderPreview).toHaveBeenCalledWith(
      'residential-gable-with-blinds',
    );
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      variant: 'residential-gable-with-blinds',
      layout: 'image-led',
      recipient: 'jordan@sanctuarypergolas.co.nz',
      subject: '[Preview: Image-led] Customer subject',
      customerSubject: 'Customer subject',
      providerMessageId: 'qa-simulated-image-led',
    });
  });

  it('rejects recipient overrides and arbitrary body fields', async () => {
    const { POST } = await import('./route');
    const response = await POST(
      new Request('http://localhost/api/qa/email-preview-workbench', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          variant: 'residential-gable-with-blinds',
          layout: 'compact',
          recipient: 'other@example.test',
        }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: 'EMAIL_PREVIEW_BODY_INVALID',
    });
    expect(h.renderPreview).not.toHaveBeenCalled();
  });
});
