import { describe, expect, it } from 'vitest';
import {
  LIST_PAGE_SIZE,
  LIST_WARNING_THRESHOLD,
  MAX_LIST_FETCH_ROWS,
  fetchAllPages,
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

  it('fires when truncated is true even with a tiny visible count', () => {
    // PR-PG1c: hard signal — chunked fetch hit MAX_LIST_FETCH_ROWS and
    // count may be null (PostgREST capped it). Banner must still fire.
    expect(shouldShowListCountWarning(5000, null, { truncated: true })).toBe(true);
    expect(shouldShowListCountWarning(5000, 5000, { truncated: true })).toBe(true);
  });

  it('does not require options when called with three positional args', () => {
    // back-compat: the old `(visible, total, threshold)` signature still works
    expect(shouldShowListCountWarning(10, 10, 5)).toBe(true);
  });
});

describe('LIST_PAGE_SIZE', () => {
  it('matches PostgREST max-rows default (1000)', () => {
    expect(LIST_PAGE_SIZE).toBe(1000);
  });
});

describe('fetchAllPages', () => {
  type Row = { id: number };

  function makePages(rows: Row[], count: number | null, pageSize: number) {
    const calls: Array<{ from: number; to: number }> = [];
    const buildPage = (from: number, to: number) => {
      calls.push({ from, to });
      const slice = rows.slice(from, to + 1);
      return Promise.resolve({ data: slice, error: null, count: from === 0 ? count : null });
    };
    return { buildPage, calls, pageSize };
  }

  it('returns every row when the table fits in a single page', async () => {
    const rows: Row[] = Array.from({ length: 10 }, (_, i) => ({ id: i }));
    const { buildPage, calls } = makePages(rows, 10, 100);
    const result = await fetchAllPages(buildPage, { pageSize: 100, maxRows: 5000 });
    expect(result.rows).toHaveLength(10);
    expect(result.totalCount).toBe(10);
    expect(result.truncated).toBe(false);
    expect(calls).toEqual([{ from: 0, to: 99 }]); // stopped because short page returned
  });

  it('pages through multiple chunks until exhausted', async () => {
    const rows: Row[] = Array.from({ length: 2500 }, (_, i) => ({ id: i }));
    const { buildPage, calls } = makePages(rows, 2500, 1000);
    const result = await fetchAllPages(buildPage, { pageSize: 1000, maxRows: 5000 });
    expect(result.rows).toHaveLength(2500);
    expect(result.totalCount).toBe(2500);
    expect(result.truncated).toBe(false);
    expect(calls).toEqual([
      { from: 0, to: 999 },
      { from: 1000, to: 1999 },
      { from: 2000, to: 2999 },
    ]);
  });

  it('stops at maxRows and marks truncated when table is larger', async () => {
    const rows: Row[] = Array.from({ length: 6000 }, (_, i) => ({ id: i }));
    const { buildPage, calls } = makePages(rows, 6000, 1000);
    const result = await fetchAllPages(buildPage, { pageSize: 1000, maxRows: 5000 });
    expect(result.rows).toHaveLength(5000);
    expect(result.totalCount).toBe(6000);
    expect(result.truncated).toBe(true);
    expect(calls).toHaveLength(5);
    expect(calls[calls.length - 1]).toEqual({ from: 4000, to: 4999 });
  });

  it('treats truncated=false when rows.length === maxRows but totalCount equals maxRows', async () => {
    // Exactly at the ceiling — not over it. Banner should not cry truncation.
    const rows: Row[] = Array.from({ length: 5000 }, (_, i) => ({ id: i }));
    const { buildPage } = makePages(rows, 5000, 1000);
    const result = await fetchAllPages(buildPage, { pageSize: 1000, maxRows: 5000 });
    expect(result.rows).toHaveLength(5000);
    expect(result.truncated).toBe(false);
  });

  it('marks truncated=true when count is null and we filled maxRows (cannot rule out more rows)', async () => {
    const rows: Row[] = Array.from({ length: 5000 }, (_, i) => ({ id: i }));
    const { buildPage } = makePages(rows, null, 1000);
    const result = await fetchAllPages(buildPage, { pageSize: 1000, maxRows: 5000 });
    expect(result.totalCount).toBe(null);
    // We hit the ceiling AND have no count to confirm we got everything → assume more.
    expect(result.truncated).toBe(true);
  });

  it('takes totalCount from the first page and ignores later pages', async () => {
    const rows: Row[] = Array.from({ length: 1500 }, (_, i) => ({ id: i }));
    const buildPage = (from: number, to: number) =>
      Promise.resolve({
        data: rows.slice(from, to + 1),
        error: null,
        count: from === 0 ? 1500 : 9999, // bogus count on later pages — should be ignored
      });
    const result = await fetchAllPages(buildPage, { pageSize: 1000, maxRows: 5000 });
    expect(result.totalCount).toBe(1500);
  });

  it('propagates errors from any page', async () => {
    const buildPage = (from: number) =>
      Promise.resolve({
        data: from === 0 ? [{ id: 0 }] : null,
        error: from === 0 ? null : new Error('page 2 failed'),
        count: 2000,
      });
    // First page returns 1 row of a claimed 1000-row window → not a short page,
    // so we continue. Second page errors.
    await expect(
      fetchAllPages<Row>(
        (from, to) => {
          if (from === 0) {
            // Pad page 1 to exactly pageSize so we don't early-exit on a short page.
            return Promise.resolve({
              data: Array.from({ length: 1000 }, (_, i) => ({ id: i })),
              error: null,
              count: 2000,
            });
          }
          return buildPage(from);
        },
        { pageSize: 1000, maxRows: 5000 },
      ),
    ).rejects.toThrow('page 2 failed');
  });

  it('throws on invalid pageSize or maxRows', async () => {
    const noop = () => Promise.resolve({ data: [], error: null, count: 0 });
    await expect(fetchAllPages(noop, { pageSize: 0 })).rejects.toThrow(/pageSize/);
    await expect(fetchAllPages(noop, { maxRows: 0 })).rejects.toThrow(/maxRows/);
  });
});
