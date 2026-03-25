// @vitest-environment node

import { describe, expect, it } from 'vitest';
import { generateQuotePdfBytesWithLayout } from './pdf';
import type { QuoteVersionDetail } from './types';

const buildLineItem = (index: number) => ({
  id: `line-${index}`,
  description: [
    `Pergola Module ${index}`,
    'Size: 6m x 3m',
    'Roof: Acrylic',
    'Colour: Black',
  ].join('\n'),
  qty: 1,
  unitPriceIncGstCents: 10000,
  lineTotalIncGstCents: 10000,
  sortOrder: index,
});

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
    lineItems: [buildLineItem(1)],
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
  it('paints an explicit page background', async () => {
    const quote = buildQuoteDetail();
    const { layout } = await generateQuotePdfBytesWithLayout(quote);
    expect(layout.pages[0]?.hasPageBackground).toBe(true);
  });

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

  it('records the client address when a site address exists', async () => {
    const quote = buildQuoteDetail({
      project: {
        name: 'Test Project',
        siteAddress: '55 Example Street, Onehunga, 1061, Auckland',
        region: null,
        quoteRef: null,
      },
    });
    const { layout } = await generateQuotePdfBytesWithLayout(quote);
    expect(layout.pages[0]?.headerClientAddress?.lines).toEqual(['55 Example Street', 'Onehunga, 1061, Auckland']);
  });

  it('records warehouse address lines on the right header block', async () => {
    const quote = buildQuoteDetail();
    const { layout } = await generateQuotePdfBytesWithLayout(quote);
    expect(layout.pages[0]?.headerWarehouseAddress?.lines).toEqual(['71G Montgomerie Road', 'Mangere, 2022, Auckland']);
  });

  it('keeps totals on the first page for single-page quotes', async () => {
    const quote = buildQuoteDetail();
    const { layout } = await generateQuotePdfBytesWithLayout(quote);

    expect(layout.pages).toHaveLength(1);
    expect(layout.pages[0]?.totalsBounds).toBeTruthy();
    expect(layout.pages[0]?.paymentBlock?.lineCount).toBe(4);
  });

  it('moves totals onto the final items page for multi-page quotes', async () => {
    const quote = buildQuoteDetail({
      lineItems: Array.from({ length: 20 }, (_, index) => buildLineItem(index + 1)),
      totals: {
        totalIncGstCents: 200000,
        totalExGstCents: 173913,
        gstCents: 26087,
      },
    });
    const { layout } = await generateQuotePdfBytesWithLayout(quote);
    const lastPage = layout.pages[layout.pages.length - 1];

    expect(layout.pages.length).toBeGreaterThan(1);
    expect(layout.pages[0]?.totalsBounds).toBeFalsy();
    expect(layout.pages[0]?.paymentBlock).toBeFalsy();
    expect(lastPage?.totalsBounds).toBeTruthy();
    expect(lastPage?.tableBounds).toBeTruthy();
    expect(lastPage?.paymentBlock?.lineCount).toBe(4);
    expect((lastPage?.paymentBlock?.topY ?? 0) < (lastPage?.totalsBounds?.belowTotalRuleY ?? 0)).toBe(true);
  });
});
