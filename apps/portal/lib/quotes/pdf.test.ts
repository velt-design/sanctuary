// @vitest-environment node

import { describe, expect, it } from 'vitest';
import { generateQuotePdfBytesWithLayout } from './pdf';
import type { QuoteVersionDetail } from './types';

const buildQuoteDetail = (overrides: Partial<QuoteVersionDetail> = {}): QuoteVersionDetail => {
  const sentAt = new Date('2026-02-01T00:00:00Z').toISOString();
  return {
    id: 'quote-version-1',
    quoteId: 'quote-1',
    projectId: 'project-1',
    quoteRef: 'Q-0003',
    versionNumber: 5,
    status: 'SENT',
    depositPercent: 50,
    sourceEstimateVersionId: 'estimate-version-1',
    sourceEstimateVersionLabel: 'v1',
    revisedFromQuoteVersionId: null,
    createdAt: sentAt,
    createdBy: 'tester',
    sentAt,
    sentBy: 'tester',
    expiresAt: new Date('2026-03-03T00:00:00Z').toISOString(),
    reference: null,
    customerName: null,
    introText: 'Thanks for the opportunity to quote.',
    termsText: 'This quote is valid for 30 days from the issue date.',
    totals: {
      totalIncGstCents: 10000,
      totalExGstCents: 8696,
      gstCents: 1304,
    },
    pdfFileId: null,
    lineItems: [
      {
        id: 'line-1',
        description: 'Pergola Module\nSize: 6m x 3m\nRoof: Acrylic\nColour: Black',
        qty: 1,
        unitPriceIncGstCents: 10000,
        lineTotalIncGstCents: 10000,
        sortOrder: 1,
      },
    ],
    sendLogs: [],
    contact: {
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      phone: '021',
    },
    project: {
      name: 'Test Project',
      siteAddress: null,
      region: null,
      quoteRef: null,
    },
    ...overrides,
  };
};

describe('quote pdf layout', () => {
  it('records the client name when present', async () => {
    const quote = buildQuoteDetail();
    const { layout } = await generateQuotePdfBytesWithLayout(quote);
    expect(layout.pages[0]?.headerClientName?.text).toBe('Ada Lovelace');
  });

  it('prefers customer name snapshot over contact name', async () => {
    const quote = buildQuoteDetail({ customerName: 'Grace Hopper' });
    const { layout } = await generateQuotePdfBytesWithLayout(quote);
    expect(layout.pages[0]?.headerClientName?.text).toBe('Grace Hopper');
  });
});
