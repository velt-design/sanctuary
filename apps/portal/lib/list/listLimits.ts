/**
 * PR-PG1 (2026-06-16): canonical list-fetch limits for staff list pages.
 *
 * Background: PostgREST applies a silent 1000-row default to any
 * unbounded SELECT response. Before PR-PG1, every list fetch in the
 * portal (`contacts`, `projects`, `design_package_requests`, `projects`
 * for running jobs, …) inherited that default — the 1001st row was
 * dropped on the floor with no UI signal. PR-PG1 closes that by making
 * the ceiling explicit at every list-fetch boundary and surfacing a
 * `ListCountBanner` on the staff pages when the visible row count
 * approaches the ceiling.
 *
 * Sizing rationale:
 *  - `MAX_LIST_FETCH_ROWS = 5000`: comfortably above any realistic
 *    Sanctuary org scale for the next 12-18 months. Pure ceiling — not
 *    the working set. Bump if a real list crosses 2000 (and then it's
 *    time for PR-PG2 cursor pagination, not a higher cap).
 *  - `LIST_WARNING_THRESHOLD = 4000`: 80% of the ceiling. Triggers the
 *    banner before silent truncation, not at it.
 *
 * When the threshold fires, do NOT just bump these constants. The
 * banner is the signal to graduate that list to cursor pagination
 * (PR-PG2 / PR-PG3) — a higher cap would just hide the next problem
 * the same way the silent PostgREST default did.
 */

export const MAX_LIST_FETCH_ROWS = 5000;
export const LIST_WARNING_THRESHOLD = 4000;

/**
 * Canonical result shape for any list-fetch boundary that surfaces a
 * row count to the UI. The `totalCount` field carries Supabase's
 * `count: 'exact'` response when the query asked for it; consumers
 * should tolerate `null` (the count is opt-in and some legacy callers
 * still don't ask for it).
 *
 * Supersedes the bare `T[]` return shape used pre-PR-PG1.
 * PR-PG2's cursor pagination primitive (`fetchCursorPage`) returns a
 * strict superset of this shape (adds `nextCursor`), so consumers can
 * migrate forward without re-typing.
 */
export type ListFetchResult<T> = {
  rows: T[];
  totalCount: number | null;
};

/**
 * Wrap a Supabase `select` response that asked for `count: 'exact'`
 * into the canonical `ListFetchResult` shape. Treats absent / non-array
 * `data` as an empty result and absent `count` as `null`.
 */
export function intoListFetchResult<T>(
  res: { data: T[] | null; count: number | null },
): ListFetchResult<T> {
  return {
    rows: Array.isArray(res.data) ? res.data : [],
    totalCount: typeof res.count === 'number' ? res.count : null,
  };
}

/**
 * True when the visible count is close enough to the ceiling that the
 * UI should surface a banner. Pure function so callers can use it in
 * `useMemo` without pulling in any provider.
 */
export function shouldShowListCountWarning(
  visibleCount: number,
  totalCount: number | null,
  threshold: number = LIST_WARNING_THRESHOLD,
): boolean {
  if (typeof totalCount === 'number' && totalCount >= threshold) return true;
  if (visibleCount >= threshold) return true;
  return false;
}
