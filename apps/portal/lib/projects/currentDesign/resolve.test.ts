import { describe, expect, it } from 'vitest';
import type { EstimateMeta } from '@/lib/estimates/types';
import type { QuoteStatus, QuoteVersion } from '@/lib/quotes/types';
import { resolveProjectCurrentDesign } from './resolve';

function estimate(overrides: Partial<EstimateMeta> = {}): EstimateMeta {
  return {
    id: 'est_1',
    projectId: 'proj_1',
    createdAt: '2026-05-01T00:00:00.000Z',
    status: 'draft',
    summary: { total: 1000 },
    versionLabel: 'V1',
    isActiveDraft: true,
    hasSentQuote: false,
    jobPackEligible: false,
    jobPackGeneratedAt: null,
    jobPackQuoteVersionId: null,
    ...overrides,
  };
}

function quote(status: QuoteStatus, overrides: Partial<QuoteVersion> = {}): QuoteVersion {
  return {
    id: `qv_${overrides.id ?? status.toLowerCase()}`,
    quoteId: 'q_1',
    projectId: 'proj_1',
    quoteRef: 'Q-001',
    versionNumber: 1,
    status,
    depositPercent: 50,
    sourceEstimateVersionId: 'est_1',
    sourceEstimateVersionLabel: 'V1',
    revisedFromQuoteVersionId: null,
    createdAt: '2026-05-01T00:00:00.000Z',
    createdBy: null,
    sentAt: null,
    sentBy: null,
    expiresAt: null,
    reference: null,
    customerName: null,
    introText: null,
    termsText: null,
    totals: { totalIncGstCents: 100000, totalExGstCents: 86957, gstCents: 13043 },
    pdfFileId: null,
    renderHash: null,
    ...overrides,
  };
}

describe('resolveProjectCurrentDesign', () => {
  it('returns empty when there are no estimates and no quotes', () => {
    const resolved = resolveProjectCurrentDesign({ estimates: [], quoteVersions: [] });
    expect(resolved.source).toBe('empty');
    expect(resolved.status).toBe('empty');
    expect(resolved.estimate).toBeNull();
    expect(resolved.quoteVersion).toBeNull();
    expect(resolved.hasDeclinedQuotes).toBe(false);
  });

  it('returns the estimate when no quotes exist', () => {
    const e = estimate();
    const resolved = resolveProjectCurrentDesign({ estimates: [e], quoteVersions: [] });
    expect(resolved.source).toBe('estimate');
    expect(resolved.status).toBe('no_accepted_quote');
    expect(resolved.estimate?.id).toBe('est_1');
    expect(resolved.quoteVersion).toBeNull();
  });

  it('picks the most recent draft quote when there is no sent or accepted', () => {
    const e = estimate();
    const olderDraft = quote('DRAFT', { id: 'old', createdAt: '2026-05-01T00:00:00.000Z' });
    const newerDraft = quote('DRAFT', { id: 'new', createdAt: '2026-05-05T00:00:00.000Z' });
    const resolved = resolveProjectCurrentDesign({ estimates: [e], quoteVersions: [olderDraft, newerDraft] });
    expect(resolved.source).toBe('draft_quote');
    expect(resolved.status).toBe('quote_draft');
    expect(resolved.quoteVersion?.id).toBe('new');
  });

  it('prefers a sent quote over a draft', () => {
    const e = estimate();
    const draft = quote('DRAFT', { createdAt: '2026-05-05T00:00:00.000Z' });
    const sent = quote('SENT', { createdAt: '2026-05-01T00:00:00.000Z' });
    const resolved = resolveProjectCurrentDesign({ estimates: [e], quoteVersions: [draft, sent] });
    expect(resolved.source).toBe('sent_quote');
    expect(resolved.status).toBe('quote_sent');
  });

  it('prefers an accepted quote over sent, draft, and declined', () => {
    const e = estimate();
    const draft = quote('DRAFT', { id: 'd', createdAt: '2026-05-05T00:00:00.000Z' });
    const sent = quote('SENT', { id: 's', createdAt: '2026-05-04T00:00:00.000Z' });
    const accepted = quote('ACCEPTED', { id: 'a', createdAt: '2026-05-02T00:00:00.000Z' });
    const declined = quote('DECLINED', { id: 'x', createdAt: '2026-05-03T00:00:00.000Z' });
    const resolved = resolveProjectCurrentDesign({
      estimates: [e],
      quoteVersions: [draft, sent, accepted, declined],
    });
    expect(resolved.source).toBe('accepted_quote');
    expect(resolved.status).toBe('quote_accepted');
    expect(resolved.hasDeclinedQuotes).toBe(true);
  });

  it('falls through to estimate with quotes_declined status when only declined quotes exist', () => {
    const e = estimate();
    const declined = quote('DECLINED');
    const resolved = resolveProjectCurrentDesign({ estimates: [e], quoteVersions: [declined] });
    expect(resolved.source).toBe('estimate');
    expect(resolved.status).toBe('quotes_declined');
    expect(resolved.hasDeclinedQuotes).toBe(true);
  });

  it('returns empty when only declined quotes exist and there is no estimate', () => {
    const resolved = resolveProjectCurrentDesign({ estimates: [], quoteVersions: [quote('DECLINED')] });
    expect(resolved.source).toBe('empty');
    expect(resolved.hasDeclinedQuotes).toBe(true);
  });

  it('matches the estimate row that backs the chosen quote when available', () => {
    const matching = estimate({ id: 'est_match', isActiveDraft: false });
    const other = estimate({ id: 'est_other', isActiveDraft: true });
    const sent = quote('SENT', { sourceEstimateVersionId: 'est_match' });
    const resolved = resolveProjectCurrentDesign({ estimates: [other, matching], quoteVersions: [sent] });
    expect(resolved.estimate?.id).toBe('est_match');
  });

  it('falls back to active draft when the source estimate row is missing', () => {
    const activeDraft = estimate({ id: 'est_active', isActiveDraft: true });
    const archived = estimate({ id: 'est_archived', isActiveDraft: false });
    const sent = quote('SENT', { sourceEstimateVersionId: 'est_missing' });
    const resolved = resolveProjectCurrentDesign({
      estimates: [archived, activeDraft],
      quoteVersions: [sent],
    });
    expect(resolved.estimate?.id).toBe('est_active');
  });

  it('exposes the quote version id when a quote is chosen', () => {
    const e = estimate();
    const accepted = quote('ACCEPTED', { id: 'chosen' });
    const resolved = resolveProjectCurrentDesign({ estimates: [e], quoteVersions: [accepted] });
    expect(resolved.quoteVersion?.id).toBe('chosen');
  });
});
