import { describe, expect, it } from 'vitest';
import {
  buildQuotePreviewBasePayload,
  buildQuoteRenderHash,
  isQuotePreviewBasePayload,
  quoteNumber,
  renderQuotePreviewFromBasePayload,
} from './renderArtifacts';
import { paymentDetailsLines } from '@/lib/payments/paymentDetails';
import type { QuoteVersionDetail } from './types';

function makeDetail(): QuoteVersionDetail {
  return {
    id: 'qv_123',
    quoteId: 'qt_123',
    projectId: 'proj_123',
    quoteRef: 'Q-123',
    versionNumber: 2,
    status: 'DRAFT',
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
    expect(base.quote_total_inc_gst).toBe('$1,150.00');
    expect(base.reference_id).toBe('REF-1');
    expect(base.payment_lines).toEqual(paymentDetailsLines('quote'));
    expect(isQuotePreviewBasePayload(base)).toBe(true);
  });

  it('renders payment lines into the quote email preview', async () => {
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

    for (const line of paymentDetailsLines('quote')) {
      expect(rendered.html).toContain(line);
      expect(rendered.text).toContain(line);
    }
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
