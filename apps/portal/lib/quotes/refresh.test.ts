import { describe, expect, it } from 'vitest';
import { buildQuoteRefreshPreview } from './refresh';
import type { QuoteVersionDetail } from './types';

function makeQuote(overrides: Partial<QuoteVersionDetail> = {}): QuoteVersionDetail {
  return {
    id: 'qv_1',
    quoteId: 'qt_1',
    projectId: 'proj_1',
    quoteRef: 'Q-1001',
    versionNumber: 1,
    status: 'DRAFT',
    depositPercent: 50,
    sourceEstimateVersionId: 'est_1',
    sourceEstimateVersionLabel: 'V1',
    revisedFromQuoteVersionId: null,
    createdAt: '2026-04-02T00:00:00Z',
    createdBy: 'ops@example.com',
    sentAt: null,
    sentBy: null,
    expiresAt: '2026-05-01',
    reference: 'Deck quote',
    customerName: 'Taylor',
    introText: 'Intro',
    termsText: 'Terms',
    totals: {
      totalIncGstCents: 10000,
      totalExGstCents: 8696,
      gstCents: 1304,
    },
    pdfFileId: null,
    renderHash: null,
    lineItems: [
      {
        id: 'line_1',
        description: 'Pergola 1',
        qty: 1,
        unitPriceIncGstCents: 10000,
        lineTotalIncGstCents: 10000,
        sortOrder: 0,
      },
      {
        id: 'line_2',
        description: 'Custom note row',
        qty: 1,
        unitPriceIncGstCents: 500,
        lineTotalIncGstCents: 500,
        sortOrder: 1,
      },
    ],
    sendLogs: [],
    contact: {
      name: 'Taylor',
      email: 'taylor@example.com',
      phone: null,
    },
    project: {
      name: 'Project One',
      siteAddress: null,
      region: null,
      quoteRef: 'Q-1001',
    },
    ...overrides,
  };
}

describe('buildQuoteRefreshPreview', () => {
  it('updates generated prices while preserving wording in pricing_only mode', () => {
    const current = makeQuote();
    const generated = makeQuote({
      sourceEstimateVersionId: 'est_2',
      sourceEstimateVersionLabel: 'V2',
      lineItems: [
        {
          id: 'generated_1',
          description: 'Pergola 1: Generated wording',
          qty: 1,
          unitPriceIncGstCents: 12000,
          lineTotalIncGstCents: 12000,
          sortOrder: 0,
        },
      ],
    });

    const preview = buildQuoteRefreshPreview({ current, generated, mode: 'pricing_only' });

    expect(preview.proposedQuote.lineItems[0]?.description).toBe('Pergola 1');
    expect(preview.proposedQuote.lineItems[0]?.unitPriceIncGstCents).toBe(12000);
    expect(preview.proposedQuote.lineItems[1]?.description).toBe('Custom note row');
    expect(preview.summary).toContain('Pricing changed');
    expect(preview.summary).toContain('Totals changed');
    expect(preview.summary).not.toContain('Reference reset');
  });

  it('replaces generated wording while preserving quote metadata in generated_content mode', () => {
    const current = makeQuote();
    const generated = makeQuote({
      sourceEstimateVersionId: 'est_2',
      sourceEstimateVersionLabel: 'V2',
      lineItems: [
        {
          id: 'generated_1',
          description: 'Pergola 1\n- Configuration: Gable + Pitched modules',
          qty: 1,
          unitPriceIncGstCents: 12000,
          lineTotalIncGstCents: 12000,
          sortOrder: 0,
        },
      ],
    });

    const preview = buildQuoteRefreshPreview({ current, generated, mode: 'generated_content' });

    expect(preview.proposedQuote.lineItems[0]?.description).toContain('Configuration: Gable + Pitched modules');
    expect(preview.proposedQuote.reference).toBe('Deck quote');
    expect(preview.proposedQuote.expiresAt).toBe('2026-05-01');
    expect(preview.summary).toContain('Line items changed');
    expect(preview.summary).toContain('Pricing changed');
  });

  it('resets metadata in full_rebuild mode', () => {
    const current = makeQuote();
    const generated = makeQuote({
      sourceEstimateVersionId: 'est_2',
      sourceEstimateVersionLabel: 'V2',
      reference: null,
      expiresAt: null,
      depositPercent: 25,
      introText: 'Generated intro',
      termsText: 'Generated terms',
      lineItems: [
        {
          id: 'generated_1',
          description: 'Pergola 1',
          qty: 1,
          unitPriceIncGstCents: 9000,
          lineTotalIncGstCents: 9000,
          sortOrder: 0,
        },
      ],
    });

    const preview = buildQuoteRefreshPreview({ current, generated, mode: 'full_rebuild' });

    expect(preview.proposedQuote.reference).toBeNull();
    expect(preview.proposedQuote.expiresAt).toBeNull();
    expect(preview.proposedQuote.depositPercent).toBe(25);
    expect(preview.proposedQuote.introText).toBe('Generated intro');
    expect(preview.summary).toContain('Reference reset');
    expect(preview.summary).toContain('Expiry reset');
    expect(preview.summary).toContain('Deposit changed');
    expect(preview.summary).toContain('Intro changed');
    expect(preview.summary).toContain('Terms changed');
  });
});
