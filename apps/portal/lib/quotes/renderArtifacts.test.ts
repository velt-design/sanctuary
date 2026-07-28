import { stat } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  buildQuotePreviewBasePayload,
  buildQuoteRenderHash,
  isQuotePreviewBasePayload,
  parseQuotePreviewBasePayload,
  quoteLogoUrl,
  quoteNumber,
  renderQuotePreviewFromBasePayload,
} from './renderArtifacts';
import type { QuoteVersionDetail } from './types';

const originalPublicSiteUrl = process.env.PUBLIC_SITE_URL;
const originalNextPublicSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
const originalNextPublicMarketingSiteUrl = process.env.NEXT_PUBLIC_MARKETING_SITE_URL;

afterEach(() => {
  if (originalPublicSiteUrl === undefined) {
    delete process.env.PUBLIC_SITE_URL;
  } else {
    process.env.PUBLIC_SITE_URL = originalPublicSiteUrl;
  }

  if (originalNextPublicSiteUrl === undefined) {
    delete process.env.NEXT_PUBLIC_SITE_URL;
  } else {
    process.env.NEXT_PUBLIC_SITE_URL = originalNextPublicSiteUrl;
  }

  if (originalNextPublicMarketingSiteUrl === undefined) {
    delete process.env.NEXT_PUBLIC_MARKETING_SITE_URL;
  } else {
    process.env.NEXT_PUBLIC_MARKETING_SITE_URL = originalNextPublicMarketingSiteUrl;
  }
});

function makeDetail(): QuoteVersionDetail {
  return {
    id: 'qv_123',
    quoteId: 'qt_123',
    projectId: 'proj_123',
    quoteRef: 'Q-123',
    versionNumber: 2,
    status: 'DRAFT',
    updatedAt: '2026-03-10T00:00:00.000Z',
    commercialRevision: 1,
    isCurrentDraft: true,
    deliveryPreparedAt: null,
    pricingSource: 'calculator_live',
    depositPercent: 50,
    sourceEstimateVersionId: 'est_123',
    sourceEstimateVersionLabel: 'Estimate v1',
    createdAt: '2026-03-10T00:00:00.000Z',
    sentAt: null,
    sentBy: null,
    expiresAt: '2026-03-20',
    reference: 'REF-1',
    customerName: 'Taylor',
    introText: 'Intro',
    termsText: 'Terms',
    totals: {
      totalIncGstCents: 115000,
      totalExGstCents: 100000,
      gstCents: 15000,
    },
    pdfFileId: 'file_123',
    renderHash: null,
    lineItems: [
      {
        id: 'qli_1',
        description: 'Pergola',
        qty: 1,
        unitPriceIncGstCents: 115000,
        lineTotalIncGstCents: 115000,
        sortOrder: 0,
      },
    ],
    sendLogs: [],
    contact: {
      name: 'Taylor',
      email: 'taylor@example.com',
      phone: '123',
    },
    project: {
      name: 'Garden',
      siteAddress: '1 Ocean Road',
      region: 'North',
      quoteRef: 'Q-123',
    },
  };
}

describe('quote render artifacts', () => {
  it('builds a stable preview base payload', () => {
    const detail = makeDetail();
    const base = buildQuotePreviewBasePayload({
      detail,
      quoteAcceptUrl: 'https://example.com/quote/qv_123?token=preview',
      expiresAtLabel: '20 Mar 2026',
      logoUrl: 'https://example.com/logo.png',
    });

    expect(base.default_subject).toBe(`Quote ready - ${quoteNumber(detail)}`);
    expect(base.quote_subtotal_ex_gst).toBe('$1,000.00');
    expect(base.quote_gst).toBe('$150.00');
    expect(base.quote_total_inc_gst).toBe('$1,150.00');
    expect(base.deposit_percent).toBe('50');
    expect(base.reference_id).toBe('REF-1');
    expect(base.next_step_text).toContain('No payment is due with this quote');
    expect(isQuotePreviewBasePayload(base)).toBe(true);
  });

  it('rejects legacy preview payloads and normalizes optional stored fields', () => {
    expect(
      parseQuotePreviewBasePayload({
        quote_number: 'Q-LEGACY',
        quote_total_inc_gst: '$1,150.00',
      }),
    ).toBeNull();

    const parsed = parseQuotePreviewBasePayload({
      quote_number: 'Q-123',
      quote_subtotal_ex_gst: '$1,000.00',
      quote_gst: '$150.00',
      quote_total_inc_gst: '$1,150.00',
      deposit_percent: '50',
    });

    expect(parsed).toMatchObject({
      name: 'there',
      quote_accept_link: 'https://preview.invalid',
      default_subject: 'Quote ready - Q-123',
    });
  });

  it('renders complete customer context without premature banking instructions', async () => {
    const detail = makeDetail();
    const base = buildQuotePreviewBasePayload({
      detail,
      quoteAcceptUrl: 'https://example.com/quote/qv_123?token=preview',
      expiresAtLabel: '20 Mar 2026',
      logoUrl: 'https://example.com/logo.png',
    });

    const rendered = await renderQuotePreviewFromBasePayload(base, {
      to: ['taylor@example.com'],
    });

    expect(rendered.html).toContain('Subtotal excl. GST');
    expect(rendered.html).toContain('GST 15%');
    expect(rendered.html).toContain('No payment is due with this quote');
    expect(rendered.text).toContain('Subtotal excl. GST: $1,000.00');
    expect(rendered.text).toContain('GST 15%: $150.00');
    expect(rendered.text).not.toContain('06-0185-0845164-00');
    expect(rendered.text).toContain(
      'https://example.com/quote/qv_123?token=preview',
    );
    expect(rendered.text).not.toContain('&#x3D;');
  });

  it('keeps personal notes and attachment names in HTML and plain text', async () => {
    const base = buildQuotePreviewBasePayload({
      detail: makeDetail(),
      quoteAcceptUrl: 'https://example.com/quote/qv_123?token=preview',
      expiresAtLabel: '20 Mar 2026',
    });

    const rendered = await renderQuotePreviewFromBasePayload(base, {
      to: ['taylor@example.com'],
      personalNote: 'Thanks Taylor.\nPlease call if you have questions.',
      attachmentNames: ['Planning set.pdf'],
    });

    expect(rendered.html).toContain('Thanks Taylor.<br />Please call');
    expect(rendered.html).toContain('Planning set.pdf');
    expect(rendered.text).toContain(
      'Thanks Taylor.\nPlease call if you have questions.',
    );
    expect(rendered.text).toContain('- Planning set.pdf');
  });

  it('escapes personal-note markup while preserving line breaks', async () => {
    const base = buildQuotePreviewBasePayload({
      detail: makeDetail(),
      quoteAcceptUrl: 'https://example.com/quote/qv_123?token=preview',
    });

    const rendered = await renderQuotePreviewFromBasePayload(base, {
      to: ['taylor@example.com'],
      personalNote: '<script>alert("x")</script>\nSecond line',
    });

    expect(rendered.html).not.toContain('<script>');
    expect(rendered.html).toContain(
      '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;<br />Second line',
    );
  });

  it('uses a fluid email shell for narrow clients', async () => {
    const base = buildQuotePreviewBasePayload({
      detail: makeDetail(),
      quoteAcceptUrl: 'https://example.com/quote/qv_123?token=preview',
      expiresAtLabel: '20 Mar 2026',
    });

    const rendered = await renderQuotePreviewFromBasePayload(base, {
      to: ['taylor@example.com'],
    });

    expect(rendered.html).toContain('width:100%; max-width:640px');
    expect(rendered.html).not.toContain('width="600"');
    expect(rendered.html).not.toContain('width:600px');
  });

  it('builds the quote email logo URL from the public site origin', () => {
    process.env.PUBLIC_SITE_URL = 'https://sanctuarypergolas.co.nz/';
    delete process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.NEXT_PUBLIC_MARKETING_SITE_URL;

    expect(quoteLogoUrl()).toBe('https://sanctuarypergolas.co.nz/images/email-logo.png');
  });

  it('renders the public email logo URL into the quote email preview', async () => {
    process.env.PUBLIC_SITE_URL = 'https://sanctuarypergolas.co.nz';
    delete process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.NEXT_PUBLIC_MARKETING_SITE_URL;

    const detail = makeDetail();
    const base = buildQuotePreviewBasePayload({
      detail,
      quoteAcceptUrl: 'https://example.com/quote/qv_123?token=preview',
      expiresAtLabel: '20 Mar 2026',
      logoUrl: quoteLogoUrl(),
    });

    const rendered = await renderQuotePreviewFromBasePayload(base, {
      to: ['taylor@example.com'],
    });

    expect(rendered.html).toContain('https://sanctuarypergolas.co.nz/images/email-logo.png');
  });

  it('falls back to text branding when no valid public site URL is configured', async () => {
    delete process.env.PUBLIC_SITE_URL;
    process.env.NEXT_PUBLIC_SITE_URL = 'not-a-valid-url';
    delete process.env.NEXT_PUBLIC_MARKETING_SITE_URL;

    const detail = makeDetail();
    const base = buildQuotePreviewBasePayload({
      detail,
      quoteAcceptUrl: 'https://example.com/quote/qv_123?token=preview',
      expiresAtLabel: '20 Mar 2026',
      logoUrl: quoteLogoUrl(),
    });

    const rendered = await renderQuotePreviewFromBasePayload(base, {
      to: ['taylor@example.com'],
    });

    expect(quoteLogoUrl()).toBeUndefined();
    expect(rendered.html).not.toContain('<img');
    expect(rendered.html).toContain('Sanctuary Pergolas');
  });

  it('ships a non-empty public email logo asset', async () => {
    const assetPath = path.resolve(process.cwd(), 'apps', 'marketing', 'public', 'images', 'email-logo.png');
    const assetStat = await stat(assetPath);

    expect(assetStat.isFile()).toBe(true);
    expect(assetStat.size).toBeGreaterThan(0);
  });

  it('changes render hash when the quote content changes', () => {
    const initial = makeDetail();
    const changed = makeDetail();
    changed.lineItems = [
      {
        ...changed.lineItems[0],
        unitPriceIncGstCents: 120000,
        lineTotalIncGstCents: 120000,
      },
    ];

    expect(buildQuoteRenderHash(initial)).not.toBe(buildQuoteRenderHash(changed));
  });
});
