import { describe, expect, it } from 'vitest';
import type { EstimateMeta } from '@/lib/estimates/types';
import type { QuoteVersion } from '@/lib/quotes/types';
import type { ResolvedCurrentDesign } from './resolve';
import { summarizeCurrentDesign } from './summarize';

function meta(overrides: Partial<EstimateMeta> = {}): EstimateMeta {
  return {
    id: 'est_1',
    projectId: 'proj_1',
    createdAt: '2026-05-01T00:00:00.000Z',
    status: 'draft',
    summary: { total: 18000 },
    versionLabel: 'V1',
    isActiveDraft: true,
    hasSentQuote: false,
    jobPackEligible: false,
    jobPackGeneratedAt: null,
    jobPackQuoteVersionId: null,
    ...overrides,
  };
}

function acceptedQuote(): QuoteVersion {
  return {
    id: 'qv_1',
    quoteId: 'q_1',
    projectId: 'proj_1',
    quoteRef: 'Q-001',
    versionNumber: 1,
    status: 'ACCEPTED',
    depositPercent: 50,
    sourceEstimateVersionId: 'est_1',
    sourceEstimateVersionLabel: 'V1',
    revisedFromQuoteVersionId: null,
    createdAt: '2026-05-02T00:00:00.000Z',
    createdBy: null,
    sentAt: null,
    sentBy: null,
    expiresAt: null,
    reference: null,
    customerName: null,
    introText: null,
    termsText: null,
    totals: { totalIncGstCents: 2485000, totalExGstCents: 2160870, gstCents: 324130 },
    pdfFileId: null,
    renderHash: null,
  };
}

function snapshotWith(modules: unknown[]): unknown {
  return { inputs: { modules } };
}

const moduleA = {
  pergolaId: 'p1',
  pergolaStyle: 'pitched_roof',
  roofMaterial: 'acrylic',
  lengthM: '6',
  projectionM: '3',
};

const moduleB = {
  pergolaId: 'p2',
  pergolaStyle: 'gable',
  roofMaterial: 'timber',
  lengthM: '4',
  projectionM: '2.5',
};

describe('summarizeCurrentDesign', () => {
  it('returns the empty fallback when source is empty', () => {
    const summary = summarizeCurrentDesign({
      source: 'empty',
      status: 'empty',
      quoteVersion: null,
      estimate: null,
      hasDeclinedQuotes: false,
    });
    expect(summary.isEmpty).toBe(true);
    expect(summary.size).toBe('Size not set');
    expect(summary.shape).toBe('Design details incomplete');
    expect(summary.totalLabel).toBe('Price not available');
    expect(summary.statusLabel).toBe('No design');
    expect(summary.statusVariant).toBe('muted');
    expect(summary.quoteVersionId).toBeNull();
    expect(summary.estimateId).toBeNull();
  });

  it('formats size, shape, and status from an accepted quote with one module', () => {
    const resolved: ResolvedCurrentDesign = {
      source: 'accepted_quote',
      status: 'quote_accepted',
      quoteVersion: acceptedQuote(),
      estimate: meta(),
      hasDeclinedQuotes: false,
    };
    const summary = summarizeCurrentDesign(resolved, snapshotWith([moduleA]));
    expect(summary.size).toBe('6m x 3m');
    expect(summary.shape).toBe('Pitched Roof acrylic');
    expect(summary.totalLabel).toBe('$24,850 inc GST');
    expect(summary.statusLabel).toBe('Quote accepted');
    expect(summary.statusVariant).toBe('accepted');
    expect(summary.quoteVersionId).toBe('qv_1');
    expect(summary.estimateId).toBe('est_1');
    expect(summary.additionalModuleCount).toBe(0);
  });

  it('appends "+ N more" when multiple modules exist and uses the largest as primary', () => {
    const resolved: ResolvedCurrentDesign = {
      source: 'accepted_quote',
      status: 'quote_accepted',
      quoteVersion: acceptedQuote(),
      estimate: meta(),
      hasDeclinedQuotes: false,
    };
    const summary = summarizeCurrentDesign(resolved, snapshotWith([moduleB, moduleA]));
    expect(summary.size).toBe('6m x 3m + 1 more');
    expect(summary.additionalModuleCount).toBe(1);
    expect(summary.shape).toBe('Pitched Roof acrylic');
  });

  it('falls back to the estimate summary total when the quote total is missing', () => {
    const quoteWithoutTotal = { ...acceptedQuote(), totals: { totalIncGstCents: NaN, totalExGstCents: 0, gstCents: 0 } } as QuoteVersion;
    const resolved: ResolvedCurrentDesign = {
      source: 'accepted_quote',
      status: 'quote_accepted',
      quoteVersion: quoteWithoutTotal,
      estimate: meta({ summary: { total: 18000 } }),
      hasDeclinedQuotes: false,
    };
    const summary = summarizeCurrentDesign(resolved, snapshotWith([moduleA]));
    expect(summary.totalLabel).toBe('$18,000 inc GST');
  });

  it('returns Price not available when neither quote nor estimate totals are usable', () => {
    const resolved: ResolvedCurrentDesign = {
      source: 'estimate',
      status: 'no_accepted_quote',
      quoteVersion: null,
      estimate: meta({ summary: { total: null } }),
      hasDeclinedQuotes: false,
    };
    const summary = summarizeCurrentDesign(resolved, snapshotWith([moduleA]));
    expect(summary.totalLabel).toBe('Price not available');
  });

  it('returns size and shape fallbacks when calculator snapshot is missing', () => {
    const resolved: ResolvedCurrentDesign = {
      source: 'estimate',
      status: 'no_accepted_quote',
      quoteVersion: null,
      estimate: meta(),
      hasDeclinedQuotes: false,
    };
    const summary = summarizeCurrentDesign(resolved, null);
    expect(summary.size).toBe('Size not set');
    expect(summary.shape).toBe('Design details incomplete');
  });

  it('maps quotes_declined fall-through to the declined status pill', () => {
    const resolved: ResolvedCurrentDesign = {
      source: 'estimate',
      status: 'quotes_declined',
      quoteVersion: null,
      estimate: meta(),
      hasDeclinedQuotes: true,
    };
    const summary = summarizeCurrentDesign(resolved, snapshotWith([moduleA]));
    expect(summary.statusLabel).toBe('Quotes declined');
    expect(summary.statusVariant).toBe('declined');
  });

  it('maps each known status to a variant', () => {
    const baseResolved = {
      source: 'estimate' as const,
      quoteVersion: null,
      estimate: meta(),
      hasDeclinedQuotes: false,
    };
    expect(summarizeCurrentDesign({ ...baseResolved, status: 'quote_accepted' }).statusVariant).toBe('accepted');
    expect(summarizeCurrentDesign({ ...baseResolved, status: 'quote_sent' }).statusVariant).toBe('sent');
    expect(summarizeCurrentDesign({ ...baseResolved, status: 'quote_draft' }).statusVariant).toBe('draft');
    expect(summarizeCurrentDesign({ ...baseResolved, status: 'no_accepted_quote' }).statusVariant).toBe('muted');
  });
});
