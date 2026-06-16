import { describe, expect, it } from 'vitest';
import {
  LIST_WARNING_THRESHOLD,
  MAX_LIST_FETCH_ROWS,
  intoListFetchResult,
  shouldShowListCountWarning,
} from './listLimits';

describe('listLimits constants', () => {
  it('keeps the warning threshold below the fetch ceiling', () => {
    expect(LIST_WARNING_THRESHOLD).toBeLessThan(MAX_LIST_FETCH_ROWS);
    // 80% of the ceiling is the intended spec; loosen if it ever needs tuning.
    expect(LIST_WARNING_THRESHOLD).toBe(Math.floor(MAX_LIST_FETCH_ROWS * 0.8));
  });
});

describe('intoListFetchResult', () => {
  it('returns rows + count from a typical Supabase select-with-count response', () => {
    expect(intoListFetchResult({ data: [{ id: 'a' }, { id: 'b' }], count: 2 })).toEqual({
      rows: [{ id: 'a' }, { id: 'b' }],
      totalCount: 2,
    });
  });

  it('treats null data as an empty result', () => {
    expect(intoListFetchResult({ data: null, count: 0 })).toEqual({ rows: [], totalCount: 0 });
  });

  it('treats null count as null totalCount (count was not requested)', () => {
    expect(intoListFetchResult({ data: [{ id: 'a' }], count: null })).toEqual({
      rows: [{ id: 'a' }],
      totalCount: null,
    });
  });
});

describe('shouldShowListCountWarning', () => {
  it('does not warn when both visible and total are well below the threshold', () => {
    expect(shouldShowListCountWarning(50, 50)).toBe(false);
    expect(shouldShowListCountWarning(50, null)).toBe(false);
  });

  it('warns when totalCount meets the default threshold', () => {
    expect(shouldShowListCountWarning(LIST_WARNING_THRESHOLD - 1, LIST_WARNING_THRESHOLD)).toBe(true);
    expect(shouldShowListCountWarning(0, LIST_WARNING_THRESHOLD + 1000)).toBe(true);
  });

  it('warns when visibleCount alone meets the threshold (no count available)', () => {
    expect(shouldShowListCountWarning(LIST_WARNING_THRESHOLD, null)).toBe(true);
  });

  it('respects an explicit threshold override (used by unit tests)', () => {
    expect(shouldShowListCountWarning(6, 6, 5)).toBe(true);
    expect(shouldShowListCountWarning(4, 4, 5)).toBe(false);
  });
});
