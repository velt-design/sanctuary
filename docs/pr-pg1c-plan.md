# PR-PG1c — Chunked list-fetch (defeat Supabase `db-max-rows`) + banner threshold fix

**Drafted**: 2026-06-16. **Status**: planning. Follow-up to [PR-PG1](pr-pg1-plan.md) after live verification revealed the deployed Supabase project enforces a `db-max-rows = 1000` cap server-side, overriding our `.range(0, 4999)` request.

## 1. Goal

Replace every list-fetch site's single `.range(0, MAX_LIST_FETCH_ROWS - 1)` call with a chunked loop that pages through Supabase 1000 rows at a time until exhausted or `MAX_LIST_FETCH_ROWS` is hit, AND change the banner trigger so it fires on actual truncation (`truncated === true`) — not only when the count crosses 80% of an unenforceable ceiling.

## 2. Architectural fit

### Which north-star invariant or principle does this serve?

`docs/projects-contacts-estimates-calculator.md` "visible state" + `docs/code-retirement-and-bloat-control.md` "make implicit constraints explicit". PR-PG1 made the *client's* ask explicit but assumed `.range()` was honored. The live deploy proved that wrong: Supabase's project-level `db-max-rows` setting silently clamps every page response to 1000 rows regardless of `.range()`. The same north-star (no hidden truncation, no silent constraint) now requires the client to defeat the per-page cap by paging, not just declaring intent.

### What alternatives were considered, and why rejected?

1. **Just raise the Supabase project's `Max Rows` setting to 5000+ (dashboard config, no code).** Rejected as the *only* fix — but I'd still recommend the user do it as a belt-and-braces step. Code-only: leaves the portal silently broken on any Supabase project whose Max Rows is < `MAX_LIST_FETCH_ROWS` (e.g. a freshly forked staging project, a Supabase default change, or a security-conscious admin lowering it). The chunked fetcher makes the portal immune to whatever the upstream cap is.
2. **Use Supabase's `useInfiniteQuery` / RPC-based cursor pagination now (skip straight to PR-PG2).** Rejected as scope creep. PR-PG2 is the right place for user-facing cursors (UI pages with "load more"); PR-PG1c is a transparent server-side fix that preserves the existing list-page contract (all rows returned, sorted client-side). The chunked helper is also a stepping stone PR-PG2 can layer over, not throw away.
3. **Make each call site do its own chunked loop inline.** Rejected — 7 fetch sites means 7 places to get the loop wrong (off-by-one on `range`, miscount of `truncated`, drift over time). One helper means one bug surface.
4. **Issue parallel range requests (`Promise.all([range(0,999), range(1000,1999), range(2000,2999)])`).** Rejected for correctness: you don't know how many pages there are without first either fetching the count or hitting an empty page. Parallelizing a fixed count of pages risks under-fetching when count > N*1000 or wasting requests when count < N*1000. Sequential loop with early-exit is correct; the perf cost is negligible at our row counts (a 3000-row contacts list = 3 sequential ~50ms requests = 150ms total, dwarfed by SSR render).

### What does this consciously NOT try to do?

- **NOT introduce user-facing cursor pagination.** That's PR-PG2. The chunked fetch is invisible — call sites still receive a complete `ListFetchResult<T>` with all rows.
- **NOT change the public return shape of `listContacts()`, `listProjects()`, `listAllEstimates()`.** They still return `Contact[]` / `Project[]` / `Estimate[]` for back-compat with non-page-level callers (cache warmup, project-create form, exporter).
- **NOT change the page-level `loadContactsIndexData()` / `loadProjectsIndexData()` return shape.** They already return `ListFetchResult<T>` (PR-PG1). Only the internals change to chunked.
- **NOT increase `MAX_LIST_FETCH_ROWS`.** Stays at 5000. The fix is to make the cap *real* (truncate at 5000) rather than honored-by-default (silently capped at 1000 by upstream).
- **NOT touch single-row, `.in(...)`-filtered, or `.eq(...)`-filtered queries.** Those are naturally bounded and don't hit the silent-cap pattern.
- **NOT add retry/backoff to the chunked loop.** Each chunk inherits the existing error-throw behavior; if one page fails, the whole call fails, same as today.

### Net tech debt: pay down or add?

Net pay-down. Replaces 7 inline `.range(0, MAX_LIST_FETCH_ROWS - 1)` patterns with 7 calls to one helper, removes the latent "what if upstream caps?" failure mode, and adds a `truncated: boolean` flag that lets the banner fire on a real signal instead of a hopeful threshold.

## 3. The new model

### Helper — single source of paging behavior

```ts
// apps/portal/lib/list/listLimits.ts (extension)

export const LIST_PAGE_SIZE = 1000; // Matches PostgREST's typical max-rows default.

export type ChunkedListFetchResult<T> = ListFetchResult<T> & {
  /** True when we hit MAX_LIST_FETCH_ROWS before the table was exhausted. */
  truncated: boolean;
};

/**
 * Fetch every row up to MAX_LIST_FETCH_ROWS by paging through Supabase
 * `LIST_PAGE_SIZE` rows at a time. Defeats Supabase's project-level
 * `db-max-rows` cap, which silently truncates any single response to its
 * configured maximum (typically 1000) regardless of `.range()`.
 *
 * `buildPage(from, to)` MUST construct a fresh query each call — Supabase
 * builders are not safely re-runnable.
 */
export async function fetchAllPages<T>(
  buildPage: (from: number, to: number) => PromiseLike<{
    data: T[] | null;
    error: unknown;
    count?: number | null;
  }>,
  options?: { pageSize?: number; maxRows?: number },
): Promise<ChunkedListFetchResult<T>> {
  const pageSize = options?.pageSize ?? LIST_PAGE_SIZE;
  const maxRows = options?.maxRows ?? MAX_LIST_FETCH_ROWS;
  const rows: T[] = [];
  let totalCount: number | null = null;

  for (let from = 0; from < maxRows; from += pageSize) {
    const to = Math.min(from + pageSize - 1, maxRows - 1);
    const res = await buildPage(from, to);
    if (res.error) throw res.error;
    if (totalCount === null && typeof res.count === 'number') totalCount = res.count;
    const pageRows = Array.isArray(res.data) ? res.data : [];
    rows.push(...pageRows);
    if (pageRows.length < to - from + 1) break; // short page → end of data
  }

  const truncated = rows.length >= maxRows && (totalCount === null || totalCount > maxRows);
  return { rows, totalCount, truncated };
}
```

### Banner threshold fix

```ts
// apps/portal/lib/list/listLimits.ts (modification)

export function shouldShowListCountWarning(
  visibleCount: number,
  totalCount: number | null,
  options?: { threshold?: number; truncated?: boolean },
): boolean {
  const threshold = options?.threshold ?? LIST_WARNING_THRESHOLD;
  // Hard signal: chunked fetch hit the cap. Always fire.
  if (options?.truncated) return true;
  // Soft signal: count approaching the cap.
  if (typeof totalCount === 'number' && totalCount >= threshold) return true;
  if (visibleCount >= threshold) return true;
  return false;
}
```

And `ListCountBanner` gets a new `truncated?: boolean` prop that flows through to the helper.

### Call site shape

Before (PR-PG1):
```ts
const contactsRes = await client
  .from('contacts')
  .select('*', { count: 'exact' })
  .order('name', { ascending: true })
  .range(0, MAX_LIST_FETCH_ROWS - 1);
if (contactsRes.error) throw contactsRes.error;
const rows = sortContacts(...);
return { rows, totalCount: contactsRes.count ?? null };
```

After (PR-PG1c):
```ts
const result = await fetchAllPages<Record<string, unknown>>((from, to) =>
  client
    .from('contacts')
    .select('*', { count: 'exact' })
    .order('name', { ascending: true })
    .range(from, to),
);
const rows = sortContacts(result.rows.map(mapContactRow));
return { rows, totalCount: result.totalCount, truncated: result.truncated };
```

## 4. File map

| File | Change | LOC |
|---|---|---|
| [apps/portal/lib/list/listLimits.ts](../apps/portal/lib/list/listLimits.ts) | Add `LIST_PAGE_SIZE`, `ChunkedListFetchResult<T>`, `fetchAllPages()`. Extend `shouldShowListCountWarning()` to accept `{ truncated }`. | +50 |
| [apps/portal/lib/list/listLimits.test.ts](../apps/portal/lib/list/listLimits.test.ts) | Add cases: (a) full table < pageSize returns all rows, (b) full table > pageSize chunks correctly, (c) hits `maxRows` → `truncated: true`, (d) error mid-loop throws, (e) `count` taken from first page, (f) `truncated` triggers banner. | +80 |
| [apps/portal/lib/contacts/serverContactsIndex.ts](../apps/portal/lib/contacts/serverContactsIndex.ts) | Replace single `.range()` with `fetchAllPages()`. Return `ListFetchResult<Contact> & { truncated }`. | +6 / -5 |
| [apps/portal/lib/projects/serverProjectsIndex.ts](../apps/portal/lib/projects/serverProjectsIndex.ts) | Replace 4 inline `.range()` calls (active/archived/all + `archived_at`-missing fallback for projects, contacts) with `fetchAllPages()`. Return shape gains `truncated`. | +30 / -25 |
| [apps/portal/lib/repo/contactsRepo.ts](../apps/portal/lib/repo/contactsRepo.ts) | `listContacts()` internals → `fetchAllPages()`. Return shape stays `Contact[]` (back-compat). | +6 / -6 |
| [apps/portal/lib/repo/projectsRepo.ts](../apps/portal/lib/repo/projectsRepo.ts) | `listProjects()` internals → `fetchAllPages()`. Return shape stays `Project[]`. | +8 / -6 |
| [apps/portal/lib/repo/estimatesRepo.ts](../apps/portal/lib/repo/estimatesRepo.ts) | `listAllEstimates()` internals → `fetchAllPages()`. Return shape stays `Estimate[]`. | +6 / -5 |
| [apps/portal/lib/designPackages/server.ts](../apps/portal/lib/designPackages/server.ts) | Top-level select uses `fetchAllPages()`. Conditional `.in('project_id', projectIds)` filter has to be applied inside the page builder. | +12 / -8 |
| [apps/portal/lib/runningJobs/server.ts](../apps/portal/lib/runningJobs/server.ts) | Same shape change — conditional `.in('id', projectIdsFilter)` moves inside the page builder. | +12 / -8 |
| [apps/portal/components/ui/listBanner/ListCountBanner.tsx](../apps/portal/components/ui/listBanner/ListCountBanner.tsx) | Accept `truncated?: boolean` prop. Wire through to `shouldShowListCountWarning()`. Banner copy: when truncated → "Showing first 5,000 of 7,200 contacts. Search or filter to find specific entries." Otherwise existing copy. | +20 / -8 |
| [apps/portal/app/staff/contacts/page.tsx](../apps/portal/app/staff/contacts/page.tsx) | Pass `initialContactsTruncated` from server fetch. | +2 |
| [apps/portal/app/staff/contacts/ContactsIndexClient.tsx](../apps/portal/app/staff/contacts/ContactsIndexClient.tsx) | Add `initialContactsTruncated` prop. Pass to banner. | +4 |
| [apps/portal/app/staff/projects/page.tsx](../apps/portal/app/staff/projects/page.tsx) | Pass truncated flags for both projects + contacts. | +4 |
| [apps/portal/app/staff/projects/ProjectsIndexClient.tsx](../apps/portal/app/staff/projects/ProjectsIndexClient.tsx) | Add two truncated props; pass to both banners. | +6 |
| [docs/decision-log.md](decision-log.md) | New entry under [PG/list pagination](#) section: "PR-PG1c — chunked list fetch defeats `db-max-rows` cap". | +20 |
| [docs/projects-contacts-estimates-calculator.md](projects-contacts-estimates-calculator.md) | Update list-fetch contract paragraph: top-level list fetches MUST go through `fetchAllPages()`, not a bare `.range()`. | +5 / -2 |

**Total**: ~280 LOC including tests and docs; production source delta ~190 LOC.

## 5. Risk + mitigation

| Risk | Likelihood | Mitigation |
|---|---|---|
| Sequential paging is slow on a large table (e.g. 5000 contacts = 5 round trips). | Low | At Sanctuary's current scale we're talking ~1500 contacts and ~600 projects — 2 round trips each, ~100ms total. Re-evaluate if any list crosses 3000. PR-PG2 cursor pagination is the long-term answer. |
| `count` on a chunked fetch differs across pages (e.g. concurrent insert during the loop). | Very Low | We take `count` from the first page only. A concurrent insert during fetch shows up next refresh; the snapshot is still internally consistent (sorted, deduplicated by id at the client). |
| Page builder closure forgets to re-apply a `.in()` / `.is()` filter between iterations. | Med | The builder is a function `(from, to) => …` so the filter is part of the function body and runs on every call. Test for each call site asserts both first and second page apply the filter. |
| Supabase JS `.range(from, to)` is end-inclusive; off-by-one would silently double-count or skip a row. | Low | Helper uses `to = min(from + pageSize - 1, maxRows - 1)`. Test case: 1000 rows in DB, pageSize=1000, expect exactly 1000 rows returned (not 999 or 1001). |
| One of the 7 call sites gets missed in the refactor and stays on the old broken `.range(0, 4999)` pattern. | Med | After refactor: `Grep MAX_LIST_FETCH_ROWS - 1` should return zero hits in production source (only the constant definition + helper internals). |
| Banner shows "Showing 5000 of ???" when count is `null` because PostgREST capped the count too. | Low | When `count === null` AND `truncated === true`, banner copy: "Showing first 5,000 entries — there may be more. Search or filter to narrow." |
| Test mocks need updating to return paged shape. | Med | `createQuery` mock in `serverContactsIndex.test.ts` / `serverProjectsIndex.test.ts` already supports `.range()` as terminal. Update mocks to return short page after first call OR add a `pages` array fixture to drive the loop. |

## 6. Acceptance criteria

- `pnpm -w turbo run typecheck --filter portal` clean.
- `pnpm --filter portal exec vitest run lib/list lib/contacts lib/projects lib/repo` green.
- `pnpm -w turbo run lint --filter portal` clean.
- **HARD GATE**: `pnpm --filter marketing build` clean (PR-PG1c doesn't touch marketing, but the gate catches accidental cross-app imports).
- `Grep "\.range\(0, MAX_LIST_FETCH_ROWS - 1\)"` returns zero hits in `apps/portal/` (all replaced by `fetchAllPages`).
- Manual: hit `/staff/contacts` on local dev with a seeded >1000-row contacts table → see all rows, no "1000 total" cap. (If we don't have >1000 local rows, mock the page-size at 10 in a temp test and verify chunking works against a 25-row fixture.)
- After deploy to portal.sanctuarypergolas.co.nz → screenshot from user shows full contact list past "P".

## 7. What I'd push back on

The user-facing fix is **two clicks in the Supabase dashboard** (Settings → API → Max Rows → 5000). That's strictly faster than this PR and unblocks the portal immediately. PR-PG1c is the right *durable* answer — the portal should never silently break on a per-project Supabase config — but if the user wants the contacts list working in 30 seconds, the dashboard tweak is the move. PR-PG1c can land afterwards as a safety net.

I'd recommend doing **both**:
1. Right now: bump the Supabase Max Rows setting (unblocks today).
2. Ship PR-PG1c (makes the portal immune to future regressions).

## 8. CTA

Ready to execute PR-PG1c? Say go and I'll start with the helper + tests, then refactor the 7 call sites, then run gates.

Or — if you'd rather raise the Supabase Max Rows setting first and defer PR-PG1c until after you've confirmed the portal is unblocked — say "dashboard first" and I'll stand down on the code change until you've tested.
