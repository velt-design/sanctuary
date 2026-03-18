import { describe, expect, it } from 'vitest';
import { computeEstimateEditability, emptyEstimateEditability } from './editability';

describe('emptyEstimateEditability', () => {
  it('returns the unlocked baseline shape', () => {
    expect(emptyEstimateEditability()).toEqual({
      isLocked: false,
      lockReason: null,
      lockedAt: null,
      lockedByQuoteVersionId: null,
      lockedByQuoteRef: null,
      lockedByQuoteVersionNumber: null,
      hasDraftQuotes: false,
      draftQuoteCount: 0,
    });
  });
});

describe('computeEstimateEditability', () => {
  it('is unlocked when there are no related quotes', () => {
    expect(computeEstimateEditability({ quoteVersions: [], sendLogs: [] })).toEqual(emptyEstimateEditability());
  });

  it('stays unlocked when only draft quotes exist', () => {
    const result = computeEstimateEditability({
      quoteVersions: [
        { id: 'qv-1', status: 'DRAFT', version_number: 2, quotes: { quote_ref: 'Q-0026' } },
        { id: 'qv-2', status: 'draft', version_number: 3, quotes: { quote_ref: 'Q-0026' } },
      ],
    });

    expect(result.isLocked).toBe(false);
    expect(result.hasDraftQuotes).toBe(true);
    expect(result.draftQuoteCount).toBe(2);
    expect(result.lockedByQuoteRef).toBeNull();
  });

  it('locks when a related quote version is sent', () => {
    const result = computeEstimateEditability({
      quoteVersions: [
        {
          id: 'qv-7',
          status: 'SENT',
          sent_at: '2026-03-18T02:00:00Z',
          version_number: 16,
          quotes: { quote_ref: 'Q-0026' },
        },
      ],
    });

    expect(result.isLocked).toBe(true);
    expect(result.lockReason).toBe('quote_sent');
    expect(result.lockedAt).toBe('2026-03-18T02:00:00.000Z');
    expect(result.lockedByQuoteVersionId).toBe('qv-7');
    expect(result.lockedByQuoteRef).toBe('Q-0026');
    expect(result.lockedByQuoteVersionNumber).toBe(16);
  });

  it('locks when a related quote version is accepted or declined', () => {
    const accepted = computeEstimateEditability({
      quoteVersions: [{ id: 'qv-1', status: 'ACCEPTED', created_at: '2026-03-17T00:00:00Z', version_number: 4 }],
    });
    const declined = computeEstimateEditability({
      quoteVersions: [{ id: 'qv-2', status: 'DECLINED', created_at: '2026-03-18T00:00:00Z', version_number: 5 }],
    });

    expect(accepted.isLocked).toBe(true);
    expect(accepted.lockedByQuoteVersionNumber).toBe(4);
    expect(declined.isLocked).toBe(true);
    expect(declined.lockedByQuoteVersionNumber).toBe(5);
  });

  it('locks from send logs even if quote status has not advanced yet', () => {
    const result = computeEstimateEditability({
      quoteVersions: [
        {
          id: 'qv-9',
          status: 'DRAFT',
          created_at: '2026-03-18T00:00:00Z',
          version_number: 9,
          quotes: { quote_ref: 'Q-0100' },
        },
      ],
      sendLogs: [
        {
          quote_version_id: 'qv-9',
          status: 'SENT',
          sent_at: '2026-03-18T05:30:00Z',
        },
      ],
    });

    expect(result.isLocked).toBe(true);
    expect(result.lockedAt).toBe('2026-03-18T05:30:00.000Z');
    expect(result.lockedByQuoteVersionId).toBe('qv-9');
    expect(result.lockedByQuoteRef).toBe('Q-0100');
    expect(result.hasDraftQuotes).toBe(true);
    expect(result.draftQuoteCount).toBe(1);
  });

  it('prefers the most recent lock candidate', () => {
    const result = computeEstimateEditability({
      quoteVersions: [
        {
          id: 'qv-10',
          status: 'SENT',
          sent_at: '2026-03-17T12:00:00Z',
          version_number: 10,
          quotes: { quote_ref: 'Q-0009' },
        },
        {
          id: 'qv-11',
          status: 'ACCEPTED',
          sent_at: '2026-03-18T12:00:00Z',
          version_number: 11,
          quotes: { quote_ref: 'Q-0010' },
        },
      ],
    });

    expect(result.lockedByQuoteVersionId).toBe('qv-11');
    expect(result.lockedByQuoteRef).toBe('Q-0010');
    expect(result.lockedByQuoteVersionNumber).toBe(11);
  });
});
