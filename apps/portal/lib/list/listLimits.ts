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
 * PR-PG1c (2026-06-16): per-page chunk size for `fetchAllPages()`.
 * Matches PostgREST's typical `db-max-rows` default. Live verification
 * after PR-PG1 confirmed our Supabase project enforces a hard 1000-row
 * cap on every single response regardless of `.range(...)`, so client
 * code MUST page rather than ask for an oversize window.
 */
export const LIST_PAGE_SIZE = 1000;

/**
 * Keeps PostgREST `.in(...)` filters below common proxy/request-line limits.
 * UUID filters become surprisingly large once a staff list spans hundreds of
 * projects, so related-table lookups must use bounded batches.
 */
export const LIST_ID_FILTER_CHUNK_SIZE = 100;

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
type ListFetchResult<T> = {
  rows: T[];
  totalCount: number | null;
};

/**
 * PR-PG1c return shape for chunked list fetches. `truncated` is the
 * hard truth-signal the banner has been missing: when `true`, the
 * chunked loop hit `MAX_LIST_FETCH_ROWS` before exhausting the table
 * and downstream rows are not visible. The banner MUST fire on this
 * regardless of `totalCount` (PostgREST sometimes caps the count too,
 * making count-vs-threshold comparisons unreliable).
 */
export type ChunkedListFetchResult<T> = ListFetchResult<T> & {
  truncated: boolean;
};

type SupabasePageResponse<T> = {
  data: T[] | null;
  error: unknown;
  count?: number | null;
};

/**
 * Fetch every row up to `MAX_LIST_FETCH_ROWS` by paging the supplied
 * query `LIST_PAGE_SIZE` rows at a time. Defeats Supabase's
 * `db-max-rows` setting, which silently clamps any single response to
 * its configured maximum (typically 1000) regardless of what the
 * client asks for via `.range(...)`.
 *
 * `buildPage(from, to)` MUST construct a fresh query each call — the
 * helper does NOT reuse the builder across pages because Supabase
 * builders are awaited once and then frozen.
 *
 * `count` is taken from the first page only. Subsequent pages get the
 * same count from PostgREST, so taking the first is correct AND
 * cheaper to short-circuit if the first page is also the last.
 *
 * Throws on error. No retry/backoff — propagates to the caller exactly
 * as a single `.range(...)` call would have.
 */
export async function fetchAllPages<T>(
  buildPage: (from: number, to: number) => PromiseLike<SupabasePageResponse<T>>,
  options?: { pageSize?: number; maxRows?: number },
): Promise<ChunkedListFetchResult<T>> {
  const pageSize = options?.pageSize ?? LIST_PAGE_SIZE;
  const maxRows = options?.maxRows ?? MAX_LIST_FETCH_ROWS;
  if (pageSize <= 0) throw new Error('fetchAllPages: pageSize must be > 0');
  if (maxRows <= 0) throw new Error('fetchAllPages: maxRows must be > 0');

  const rows: T[] = [];
  let totalCount: number | null = null;

  for (let from = 0; from < maxRows; from += pageSize) {
    const to = Math.min(from + pageSize - 1, maxRows - 1);
    const expected = to - from + 1;
    const res = await buildPage(from, to);
    if (res.error) throw res.error;
    if (totalCount === null && typeof res.count === 'number') totalCount = res.count;
    const pageRows = Array.isArray(res.data) ? res.data : [];
    rows.push(...pageRows);
    if (pageRows.length < expected) break;
  }

  const truncated =
    rows.length >= maxRows && (totalCount === null || totalCount > maxRows);
  return { rows, totalCount, truncated };
}

type SupabaseRowsResponse<T> = {
  data: T[] | null;
  error: unknown;
};

/**
 * Fetch rows for a potentially large set of IDs without producing an
 * oversized PostgREST URL. Chunks are fetched sequentially to keep request
 * concurrency bounded when several related tables are loaded in parallel.
 */
export async function fetchRowsByIdChunks<T>(
  ids: readonly string[],
  buildChunk: (chunkIds: string[]) => PromiseLike<SupabaseRowsResponse<T>>,
  options?: { chunkSize?: number },
): Promise<T[]> {
  const chunkSize = options?.chunkSize ?? LIST_ID_FILTER_CHUNK_SIZE;
  if (chunkSize <= 0) throw new Error('fetchRowsByIdChunks: chunkSize must be > 0');

  const rows: T[] = [];
  for (let offset = 0; offset < ids.length; offset += chunkSize) {
    const response = await buildChunk(ids.slice(offset, offset + chunkSize));
    if (response.error) throw response.error;
    if (Array.isArray(response.data)) rows.push(...response.data);
  }
  return rows;
}

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
  thresholdOrOptions?: number | { threshold?: number; truncated?: boolean },
): boolean {
  const options =
    typeof thresholdOrOptions === 'number'
      ? { threshold: thresholdOrOptions }
      : thresholdOrOptions ?? {};
  const threshold = options.threshold ?? LIST_WARNING_THRESHOLD;
  // PR-PG1c hard signal: chunked fetch hit the cap. Always fire,
  // regardless of count (PostgREST may have capped the count itself).
  if (options.truncated) return true;
  if (typeof totalCount === 'number' && totalCount >= threshold) return true;
  if (visibleCount >= threshold) return true;
  return false;
}
