# List Pagination Plan (PR-PG sequence)

**Drafted**: 2026-06-16. **Status**: PR-PG1 shipped 2026-06-16; PR-PG2+ deferred until a real list crosses ~2000 rows.

The portal's entity list views (contacts, projects, design packages, running jobs, estimates) are silently capped at 1000 rows by PostgREST's default response limit. None of the list-fetch queries set an explicit `.limit()` or `.range()`. Confirmed live in [`contacts/serverContactsIndex.ts:33`](../apps/portal/lib/contacts/serverContactsIndex.ts#L33), [`repo/contactsRepo.ts:59`](../apps/portal/lib/repo/contactsRepo.ts#L59), [`projects/serverProjectsIndex.ts:99-102`](../apps/portal/lib/projects/serverProjectsIndex.ts#L99-L102), [`designPackages/server.ts`](../apps/portal/lib/designPackages/server.ts), [`runningJobs/server.ts`](../apps/portal/lib/runningJobs/server.ts) — same shape everywhere. Pre-PR-PG behaviour: the 1001st row simply doesn't render and the user has no signal it was cut.

## 1. Goal

Remove the silent 1000-row truncation across all portal list views by making the row limit explicit at every list-fetch boundary, surfacing the visible count to staff, and laying the foundation for cursor-based pagination once any list realistically exceeds a few thousand rows.

## 2. Architectural fit

### Which north-star invariant or principle does this serve?

`docs/projects-contacts-estimates-calculator.md` "single source of truth + visible state" — staff should never see a truncated view that pretends to be complete. The 1000 cap currently lies to the user. Also `docs/code-retirement-and-bloat-control.md` "make implicit constraints explicit" — relying on PostgREST's silent default for the row ceiling is a hidden-behaviour smell of exactly the kind we keep refactoring out elsewhere (`elevationMode === 'ground'` ground clamp was the same shape).

### What alternatives were considered, and why rejected?

1. **Big-bang cursor pagination + `useInfiniteQuery` + virtualization across every list in one PR.** Rejected: contacts has ~hundreds of rows (per the local org scale), projects similar, design-packages / running-jobs in single thousands at most. Cursor pagination is the right destination but not the right *next step*. Risk of bugs in a load-bearing rewrite outweighs the marginal scale benefit today.
2. **Hide pagination from the user — auto-fetch all rows in batches behind the scenes.** Rejected: solves the truncation but hides the scale signal. If contacts grow to 50k, the staff need to see that and the UI needs to nudge them to filter, not just stall behind a long fetch chain.
3. **Keep the implicit default; just bump the PostgREST `db-aggregates-default-limit` server-side.** Rejected: invisible at the call site (someone reading the code can't tell the limit), couples our code to a Supabase config knob, and doesn't surface the warning to staff.
4. **Server-side search/filter only, no full-list fetch ever.** Rejected as a *first* step — too much churn for the current list-page UX. Right destination after we have cursor pagination + a search box; not a v1 deliverable.

### What does this consciously NOT try to do?

- **NOT introduce virtualization yet.** The portal renders all rows as plain HTML; `@tanstack/react-virtual` only becomes a win past ~500 visible rows. Defer until a real list passes that threshold.
- **NOT replace the spreadsheet adapter pattern.** The pagination contract sits one layer below it — the adapter keeps consuming a `rows[]` array; the question is just where the array comes from. (When we add infinite scroll, the adapter will absorb a `loadMore` callback, but that's PR-PG3, not PR-PG1.)
- **NOT touch RPC endpoints or report queries.** Those use explicit SQL that PostgREST's default doesn't apply to. Scope is the staff list views only.
- **NOT add a database migration.** Pure application-layer change; no schema diff.
- **NOT change the read shape of the local-first store.** The TanStack Query cache shape stays `Contact[]` / `Project[]`; pagination cursor lives in a sibling query key.

### Net tech debt: pay down or add?

Net pay-down. PR-PG1 alone removes one hidden constraint from 5+ files (`contacts`, `projects`, `design-packages`, `running-jobs`, plus a count-check helper) and makes the limit grep-able. PR-PG2 adds a small pagination primitive (~80 LOC) but in exchange consolidates the limit/range/order-by pattern that's currently duplicated at every fetch site.

## 3. The new model

### PR-PG1 — explicit `.range()` + count check (band-aid, ship today)

Every list-fetch boundary gets an explicit ceiling + a separate count query that triggers a toast warning when actual rows ≥ 80% of the ceiling. The ceiling is set high enough to cover any realistic Sanctuary org size for the next 12-18 months (`MAX_LIST_FETCH_ROWS = 5000`).

```ts
// apps/portal/lib/list/listLimits.ts (NEW)
export const MAX_LIST_FETCH_ROWS = 5000;
export const LIST_WARNING_THRESHOLD = Math.floor(MAX_LIST_FETCH_ROWS * 0.8); // 4000
```

```ts
// apps/portal/lib/contacts/serverContactsIndex.ts (BEFORE)
const contactsRes = await client.from('contacts').select('*').order('name', { ascending: true });

// AFTER
const contactsRes = await client
  .from('contacts')
  .select('*', { count: 'exact' })
  .order('name', { ascending: true })
  .range(0, MAX_LIST_FETCH_ROWS - 1);
// Warning emitted via the page's existing notification slot when count >= LIST_WARNING_THRESHOLD.
```

### PR-PG2 — cursor-based pagination primitive (proper fix, when a list actually grows)

Shared primitive that every list adopts when its real row count crosses ~2000.

```ts
// apps/portal/lib/list/cursorPagination.ts (NEW)
export type PaginatedListPage<T> = {
  rows: T[];
  nextCursor: string | null;
  totalCount: number | null;
};

export async function fetchCursorPage<T>(input: {
  supabase: SupabaseClient;
  table: string;
  pageSize: number;
  cursor: string | null;            // base64-encoded (createdAt, id) keyset
  orderBy: { column: 'created_at' | 'name'; direction: 'asc' | 'desc' };
  selectColumns?: string;
  filters?: (query: PostgrestFilterBuilder) => PostgrestFilterBuilder;
  countMode?: 'exact' | 'planned' | 'estimated' | null;
}): Promise<PaginatedListPage<T>> { ... }
```

Client side uses TanStack Query's `useInfiniteQuery`:

```ts
const { data, fetchNextPage, hasNextPage } = useInfiniteQuery({
  queryKey: ['contacts', filters],
  queryFn: ({ pageParam }) => fetchCursorPage<Contact>({ ... cursor: pageParam ... }),
  getNextPageParam: (last) => last.nextCursor,
  initialPageParam: null,
});
```

## 4. PR sequence

### PR-PG1 — explicit limits + count warning (the band-aid)

Single PR. Touches 5-7 fetch sites + 1 new `listLimits.ts` constant + 1 toast wiring. ~150 LOC.

What lands:
- `MAX_LIST_FETCH_ROWS = 5000`, `LIST_WARNING_THRESHOLD = 4000` in a new `lib/list/listLimits.ts`.
- Explicit `.range(0, 4999)` + `count: 'exact'` on every list-fetch query (contacts, projects, design-packages, running-jobs, plus any sibling I missed in recon).
- One small `useListCountWarning(count, threshold)` hook that surfaces a non-blocking toast when the threshold is crossed.
- Unit test confirming the toast fires at the threshold; integration tests confirming the explicit limit doesn't change behaviour at typical scale (<100 rows in fixtures).

### PR-PG2 — cursor pagination primitive + adopt for contacts

Single PR. Introduces the shared primitive and migrates ONE list (contacts) as the template.

What lands:
- `lib/list/cursorPagination.ts` — the shared `fetchCursorPage()` helper + `encodeCursor()` / `decodeCursor()` for keyset (created_at, id).
- Contacts list switches to `useInfiniteQuery` with page size 100.
- "Load more" button at the bottom of the list when `hasNextPage`.
- "Showing X of Y" header.
- Tests for the cursor encoding round-trip + a fixture-backed test that simulates 250 contacts and verifies page boundaries.

### PR-PG3 — apply pattern to projects + design-packages + running-jobs

Single PR per list (or one PR if mechanical). Same pattern as PR-PG2 applied to each. Defer until PR-PG2 has shipped and one of these lists ACTUALLY approaches 1000 rows in the live DB.

### PR-PG4 — server-side search/filter (deferred)

Right destination but not now. When a staff search-box exists for any list and the result-set is genuinely too large to pre-fetch, push the filter into the SQL `WHERE` clause. Not in this plan.

## 5. File map (PR-PG1 only — PR-PG2+ get their own when we get there)

| File | Change | LOC delta |
|---|---|---|
| `apps/portal/lib/list/listLimits.ts` | NEW. Constants + `useListCountWarning` hook. | +40 |
| [`apps/portal/lib/contacts/serverContactsIndex.ts`](../apps/portal/lib/contacts/serverContactsIndex.ts) | Add `.range(0, MAX_LIST_FETCH_ROWS - 1)` and `count: 'exact'`. Return `{ contacts, totalCount }` instead of bare `Contact[]`. | +5 |
| [`apps/portal/lib/repo/contactsRepo.ts`](../apps/portal/lib/repo/contactsRepo.ts) | Same: explicit range + count. Update `listContacts()` return shape. | +5 |
| [`apps/portal/lib/projects/serverProjectsIndex.ts`](../apps/portal/lib/projects/serverProjectsIndex.ts) | Explicit `.range()` + `count: 'exact'` on the `buildProjectsQuery()` return. Update the caller in the page to wire the count into the warning hook. | +8 |
| [`apps/portal/lib/repo/projectsRepo.ts`](../apps/portal/lib/repo/projectsRepo.ts) | Same: explicit range + count. | +5 |
| [`apps/portal/lib/designPackages/server.ts`](../apps/portal/lib/designPackages/server.ts) | Add explicit range to the top-level `design_package_requests` queries (lines ~272, ~307). Inner per-project lookups (`projects`, `quote_versions`, etc.) stay un-ranged since they're keyed `.in('project_id', [...])` and naturally bounded. | +6 |
| [`apps/portal/lib/runningJobs/server.ts`](../apps/portal/lib/runningJobs/server.ts) | Same pattern: explicit range on the top-level `projects` query at line 181. | +3 |
| Page components for contacts + projects (`apps/portal/app/staff/contacts/page.tsx`, `apps/portal/app/staff/projects/page.tsx`) | Wire `totalCount` into `useListCountWarning` → toast. | +10 each |
| `apps/portal/lib/list/listLimits.test.ts` | NEW. Hook fires at threshold, doesn't fire below. | +30 |
| [`docs/decision-log.md`](decision-log.md) | Append PR-PG1 entry: explicit-limit guardrail + why we skipped cursor pagination for now. | +30 |
| [`docs/projects-contacts-estimates-calculator.md`](projects-contacts-estimates-calculator.md) | Document the 5000 ceiling + warning threshold as the canonical list-fetch contract. | +5 |

**Total: ~10 files touched, net ~+150 LOC.** No file deleted.

## 6. Risk + mitigation

| Risk | Likelihood | Mitigation |
|---|---|---|
| Bumping the per-request row count from 1000 → 5000 noticeably slows initial page load on a fully-populated list. | Low | Realistic max today is <500 rows for any list. 5000 is headroom, not the working set. Re-measure once any list realistically crosses 2000. |
| `count: 'exact'` adds latency (Postgres has to do a real count). | Low | One extra query per page load, runs in parallel with the row fetch. For tables under 100k rows it's <50ms. Drop to `count: 'planned'` (cheap estimate) if it ever bites. |
| Toast warning becomes spam if the threshold is too low. | Med | Show once per session per entity. Pin the threshold at 80% of the ceiling so it fires before truncation, not at every page load. If staff dismiss it 3 times in a session, escalate from toast to a banner on the list page header. |
| `loadContactsIndexData` / `listContacts` callers depend on the bare array return shape; changing to `{ contacts, totalCount }` ripples. | Med | Audit callers in PR-PG1 prep; either update them all or keep the bare-array return and pass the count through a side channel (a separate hook). I prefer the explicit return shape — the call sites already destructure. |
| Design-packages / running-jobs server functions do multi-table fan-out reads; adding `.range()` only at the top-level might miss a child fetch that's secretly the bottleneck. | Med | Recon notes the child fetches use `.in('project_id', [...])` so they're naturally bounded by the top-level result. Audit each in the PR but don't pre-range them. |
| Future cursor-pagination PR is harder if we've codified `{ rows, totalCount }` as the canonical return shape. | Low | The cursor shape `PaginatedListPage<T>` is a superset (`{ rows, totalCount, nextCursor }`). Migration is additive. |

## 7. Acceptance criteria

- `rg "\.from\(['\"](?:contacts|projects|design_package_requests|running_jobs)['\"]\)" apps/portal/lib/ | grep -v "\.range\|\.limit"` returns zero hits in production code (i.e. every list-fetch on those tables has an explicit ceiling).
- Toast fires in a Playwright fixture seeded with 4001 contacts; does not fire at 100.
- Portal typecheck clean.
- Portal vitest: contacts + projects test suites green; new `listLimits.test.ts` green.
- HARD GATE: marketing email path 6/6 (this PR doesn't touch costing but the change-routing requires the gate when modifying `apps/portal/lib/`).
- Manual verification: load `/staff/contacts` and `/staff/projects` against the dev DB; verify the page renders, the count appears in the header, and the toast does not fire at current scale.

## 8. Estimates

| PR | LOC | Risk | Est time |
|---|---|---|---|
| PR-PG1 (explicit limits + warning) | ~150 | low-medium | 2-3 hours |
| PR-PG2 (cursor primitive + contacts) | ~250 | medium | 4-6 hours, deferred until needed |
| PR-PG3 (apply to projects/design-packages/running-jobs) | ~150 per list | low | 1-2 hours per list, deferred until needed |

## 9. Sequencing diagram

```
PR-PG1 ──→ ship now (closes the silent-truncation bug)
   │
   └──→ (wait until a list actually grows past 2000 rows)
            │
            └──→ PR-PG2 ──→ PR-PG3 (per-list rollout)
                                │
                                └──→ PR-PG4 (server-side search, when needed)
```

## 10. What I'd push back on

You said "should be considering best practices". Best practice for a portal with growing-but-not-massive entity counts is **explicit limits + visible scale signal first**, then cursor pagination when a real list actually needs it. Building full cursor pagination + virtualization + server-side search across 5 list views right now would be ~1000 LOC of infrastructure that has no consumer at current scale — and the bugs in that infrastructure would silently hide data the same way the 1000 default does today.

The right "best practice" move is to make the constraint visible (PR-PG1), watch real usage, and graduate to cursor pagination one list at a time as the data forces it (PR-PG2+). That's the sequence proposed above.

If you'd rather skip PR-PG1 and go straight to cursor pagination because you know contacts/projects will cross 5000 within a few months — say so and I'll re-scope PR-PG2 as the first PR.

## 11. CTA

Ready to ship PR-PG1 as a single atomic PR (band-aid + visibility, 2-3 hours)? Or do you want me to re-scope to PR-PG2 (full cursor pagination on contacts) as the first PR because you expect imminent scale?
