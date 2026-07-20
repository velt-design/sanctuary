import { describe, expect, it } from 'vitest';
import { resolveCommandCentreSelection } from './resolve';
import type { CommandCentreEstimateCandidate, CommandCentreQuoteCandidate } from './types';

function estimate(
  id: string,
  createdAt: string,
  overrides: Partial<CommandCentreEstimateCandidate> = {},
): CommandCentreEstimateCandidate {
  return {
    id: `est_${id}`,
    sourceId: id,
    createdAt,
    status: 'draft',
    versionLabel: 'V1',
    totalIncGstCents: 120_000,
    isLocked: false,
    ...overrides,
  };
}

function quote(
  id: string,
  status: CommandCentreQuoteCandidate['status'],
  sourceEstimateId: string | null,
  createdAt: string,
  overrides: Partial<CommandCentreQuoteCandidate> = {},
): CommandCentreQuoteCandidate {
  return {
    id: `qv_${id}`,
    sourceId: id,
    quoteRef: 'Q-0100',
    versionNumber: 1,
    status,
    sourceEstimateId,
    createdAt,
    sentAt: null,
    totalIncGstCents: 150_000,
    sendLogs: [],
    ...overrides,
  };
}

describe('resolveCommandCentreSelection', () => {
  it('returns an explicit empty selection for a new lead', () => {
    expect(resolveCommandCentreSelection({ estimates: [], quoteVersions: [] })).toMatchObject({
      source: 'none',
      quote: null,
      estimate: null,
    });
  });

  it('uses the newest unlocked draft as the standard estimate', () => {
    const older = estimate('estimate-1', '2026-07-01T00:00:00.000Z');
    const newer = estimate('estimate-2', '2026-07-02T00:00:00.000Z', { versionLabel: 'V2' });
    expect(resolveCommandCentreSelection({ estimates: [older, newer], quoteVersions: [] })).toMatchObject({
      source: 'estimate',
      estimate: { id: newer.id },
    });
  });

  it('prefers an active unlocked draft before a newer locked non-archived estimate', () => {
    const active = estimate('estimate-1', '2026-07-01T00:00:00.000Z');
    const locked = estimate('estimate-2', '2026-07-03T00:00:00.000Z', { isLocked: true });
    expect(resolveCommandCentreSelection({ estimates: [locked, active], quoteVersions: [] }).estimate?.id)
      .toBe(active.id);
  });

  it('keeps a sent revision current ahead of a newer draft quote', () => {
    const source = estimate('estimate-1', '2026-07-01T00:00:00.000Z');
    const sent = quote('quote-sent', 'SENT', source.sourceId, '2026-07-02T00:00:00.000Z');
    const draft = quote('quote-draft', 'DRAFT', source.sourceId, '2026-07-03T00:00:00.000Z');
    const result = resolveCommandCentreSelection({ estimates: [source], quoteVersions: [draft, sent] });
    expect(result.source).toBe('sent_quote');
    expect(result.quote?.id).toBe(sent.id);
  });

  it('uses only the accepted quote source and reports a newer unrelated estimate', () => {
    const source = estimate('estimate-1', '2026-07-01T00:00:00.000Z');
    const newer = estimate('estimate-2', '2026-07-05T00:00:00.000Z', { versionLabel: 'V2' });
    const accepted = quote('quote-accepted', 'ACCEPTED', source.sourceId, '2026-07-03T00:00:00.000Z');
    const result = resolveCommandCentreSelection({ estimates: [newer, source], quoteVersions: [accepted] });
    expect(result.source).toBe('accepted_quote');
    expect(result.estimate?.id).toBe(source.id);
    expect(result.newerEstimate?.id).toBe(newer.id);
  });

  it('never selects a declined quote and falls back to the eligible estimate', () => {
    const source = estimate('estimate-1', '2026-07-01T00:00:00.000Z', { isLocked: true });
    const declined = quote('quote-declined', 'DECLINED', source.sourceId, '2026-07-03T00:00:00.000Z');
    const result = resolveCommandCentreSelection({ estimates: [source], quoteVersions: [declined] });
    expect(result.source).toBe('estimate');
    expect(result.quote).toBeNull();
    expect(result.estimate?.id).toBe(source.id);
    expect(result.latestDeclinedQuote?.id).toBe(declined.id);
  });

  it('marks a missing quote source instead of substituting another estimate', () => {
    const unrelated = estimate('estimate-2', '2026-07-05T00:00:00.000Z');
    const accepted = quote('quote-accepted', 'ACCEPTED', 'missing-estimate', '2026-07-03T00:00:00.000Z');
    const result = resolveCommandCentreSelection({ estimates: [unrelated], quoteVersions: [accepted] });
    expect(result.source).toBe('accepted_quote');
    expect(result.estimate).toBeNull();
    expect(result.sourceEstimateMissing).toBe(true);
  });

  it('selects the newest accepted quote deterministically and exposes the integrity count', () => {
    const source = estimate('estimate-1', '2026-07-01T00:00:00.000Z');
    const older = quote('quote-old', 'ACCEPTED', source.sourceId, '2026-07-02T00:00:00.000Z');
    const newer = quote('quote-new', 'ACCEPTED', source.sourceId, '2026-07-03T00:00:00.000Z');
    const result = resolveCommandCentreSelection({ estimates: [source], quoteVersions: [older, newer] });
    expect(result.quote?.id).toBe(newer.id);
    expect(result.acceptedQuoteCount).toBe(2);
  });
});
