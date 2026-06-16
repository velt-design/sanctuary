# PR-PG1 — Explicit list-fetch limits + visible scale signal

**Drafted**: 2026-06-16. **Status**: shipped 2026-06-16 (commit pending push). Retained as a retrospective plan.

First PR in the [list-pagination plan](list-pagination-plan.md) sequence. Closes the silent 1000-row truncation across every staff list view by setting an explicit ceiling and surfacing a banner when the visible row count crosses 80% of that ceiling. No cursor pagination, no virtualization, no infinite scroll — those are PR-PG2+.

## 1. Goal

Replace PostgREST's implicit 1000-row default with an explicit `MAX_LIST_FETCH_ROWS = 5000` on every staff list-fetch boundary, fetch `count: 'exact'` alongside the rows, and render a `PageMessagePanel` banner on each list page when the row count crosses 80% of the ceiling.

## 2. Architectural fit

### Which north-star invariant or principle does this serve?

`docs/projects-contacts-estimates-calculator.md` "visible state" + `docs/code-retirement-and-bloat-control.md` "make implicit constraints explicit". The same shape as PR-T9's `elevationMode` removal: the codebase is currently relying on an upstream silent default to act as a meaningful constraint. Either the constraint matters (then say so in code) or it doesn't (then remove the dependency). PR-PG1 makes the constraint explicit AND surfaces it to users.

### What alternatives were considered, and why rejected?

1. **Use `toast.info(...)` to fire the warning.** Rejected — the site-wide `ToastProvider` policy at [`ToastProvider.tsx:56-57`](../apps/portal/components/ui/toast/ToastProvider.tsx#L56-L57) silently suppresses every non-error toast. An info toast for "showing 4000 of 4200" would literally never appear. Using `toast.error(...)` instead is wrong — the truncation isn't an error, and dressing it up as one cries wolf. Inline banner on the list page is the right surface (it's a STATE, not an EVENT).
2. **Bump the limit higher (e.g. 50000) so the warning never realistically fires.** Rejected — the warning is the whole point of the PR. Hiding it behind a higher ceiling just delays the silent-truncation moment. 5000 with a banner at 4000 lets staff see growth coming.
3. **Add the cap as a query helper that wraps every `client.from(...)` call.** Rejected as scope creep for PR-PG1. The right wrapper is `fetchCursorPage()` in PR-PG2; building a half-wrapper now would have to be ripped out and replaced.
4. **Drop the `count: 'exact'` query because it costs an extra round-trip.** Rejected — Postgres counts on tables under 100k rows are sub-50ms and run in parallel with the row fetch. Without the count, the banner can never show the denominator ("showing 4000 of ???"), which kills the visibility goal.

### What does this consciously NOT try to do?

- **NOT introduce cursor pagination / `useInfiniteQuery`.** That's PR-PG2.
- **NOT touch single-row reads (`.eq().single()`, `.maybeSingle()`) or scoped reads (`.in('project_id', [...])` child fetches).** Those are naturally bounded; range-limiting them adds noise without value.
- **NOT touch RPC endpoints, write paths, or report queries.** PostgREST's 1000 default applies only to unfiltered SELECT responses.
- **NOT touch `scheduled_jobs` selects in `scheduleV2Server.ts`.** Schedule isn't a flat list (it's date-windowed and project-keyed); the silent 1000 cap doesn't apply the same way. Audit deferred to a separate PR.
- **NOT extend the `ToastProvider` to allow a "warning" kind.** Would couple PR-PG1 to a UI-layer change that doesn't belong in this scope.
- **NOT change the cache key shape (`qk.contacts.list(host)` etc.).** Cache invalidation paths stay identical.

### Net tech debt: pay down or add?

Net pay-down. Removes one hidden constraint (silent 1000 cap) from 7 fetch sites and replaces it with one named constant + one shared hook. The return shape change (`Contact[]` → `{ rows: Contact[]; totalCount: number | null }`) introduces a small contract that PR-PG2's cursor primitive will absorb as a strict subset of its own return type, so this isn't migration-and-throwaway.

## 3. The new model

### Shared primitive

```ts
// apps/portal/lib/list/listLimits.ts (NEW)
export const MAX_LIST_FETCH_ROWS = 5000;
export const LIST_WARNING_THRESHOLD = 4000; // 80% of ceiling

export type ListFetchResult<T> = {
  rows: T[];
  totalCount: number | null;
};

/**
 * Wrap a Supabase select-with-count response into the canonical
 * ListFetchResult shape. Use after `.select('*', { count: 'exact' }).range(0, MAX_LIST_FETCH_ROWS - 1)`.
 */
export function intoListFetchResult<T>(
  res: { data: T[] | null; count: number | null },
): ListFetchResult<T> {
  return { rows: Array.isArray(res.data) ? res.data : [], totalCount: res.count };
}
```

```ts
// apps/portal/components/ui/listBanner/ListCountBanner.tsx (NEW)
export function ListCountBanner({
  totalCount,
  visibleCount,
  entityLabelSingular,
  entityLabelPlural,
}: {
  totalCount: number | null;
  visibleCount: number;
  entityLabelSingular: string;
  entityLabelPlural: string;
}): JSX.Element | null;
// Renders nothing when totalCount === null or visibleCount < LIST_WARNING_THRESHOLD.
// Renders a PageMessagePanel-styled banner otherwise.
// Copy: "Showing 4,000 of 4,237 contacts. Use search or filter to find what you need."
```

### Fetch-site contract change

Every list-fetch boundary moves from `Promise<T[]>` to `Promise<ListFetchResult<T>>`.

```ts
// BEFORE — apps/portal/lib/contacts/serverContactsIndex.ts
export async function loadContactsIndexData(supabase?: SupabaseClient): Promise<Contact[]> {
  const client = supabase ?? (await getSupabaseServerAuth());
  const contactsRes = await client.from('contacts').select('*').order('name', { ascending: true });
  if (contactsRes.error) throw contactsRes.error;
  return sortContacts((Array.isArray(contactsRes.data) ? contactsRes.data : []).map((row) => mapContactRow(...)));
}

// AFTER
export async function loadContactsIndexData(supabase?: SupabaseClient): Promise<ListFetchResult<Contact>> {
  const client = supabase ?? (await getSupabaseServerAuth());
  const contactsRes = await client
    .from('contacts')
    .select('*', { count: 'exact' })
    .order('name', { ascending: true })
    .range(0, MAX_LIST_FETCH_ROWS - 1);
  if (contactsRes.error) throw contactsRes.error;
  const rows = sortContacts((Array.isArray(contactsRes.data) ? contactsRes.data : []).map((row) => mapContactRow(...)));
  return { rows, totalCount: contactsRes.count };
}
```

## 4. File map

| File | Change | LOC |
|---|---|---|
| `apps/portal/lib/list/listLimits.ts` | NEW. `MAX_LIST_FETCH_ROWS = 5000`, `LIST_WARNING_THRESHOLD = 4000`, `ListFetchResult<T>` type, `intoListFetchResult()` helper. | +40 |
| `apps/portal/components/ui/listBanner/ListCountBanner.tsx` | NEW. Inline banner component (renders nothing under threshold, renders `PageMessagePanel`-styled notice above it). Pure presentation; no state. | +60 |
| [`apps/portal/lib/contacts/serverContactsIndex.ts`](../apps/portal/lib/contacts/serverContactsIndex.ts) | Add `count: 'exact'` + `.range(0, MAX_LIST_FETCH_ROWS - 1)`. Return `ListFetchResult<Contact>` (was `Contact[]`). | +6 / -2 |
| [`apps/portal/lib/repo/contactsRepo.ts`](../apps/portal/lib/repo/contactsRepo.ts) | `listContacts()` returns `ListFetchResult<Contact>` (was `Contact[]`). Same range + count change. | +6 / -2 |
| [`apps/portal/lib/projects/serverProjectsIndex.ts`](../apps/portal/lib/projects/serverProjectsIndex.ts) | Three archive-filter branches of `buildProjectsQuery()` (lines 99-111) all get range + count. Also the sibling `contacts` fetch at line 115. Return type becomes `{ projects: ListFetchResult<Project>; contacts: ListFetchResult<Contact> }`. | +12 / -4 |
| [`apps/portal/lib/repo/projectsRepo.ts`](../apps/portal/lib/repo/projectsRepo.ts) | `listProjects()` (line 144) returns `ListFetchResult<Project>`. Same range + count change. | +6 / -2 |
| [`apps/portal/lib/designPackages/server.ts`](../apps/portal/lib/designPackages/server.ts) | Add range + count on the two top-level `.from('design_package_requests')` list selects at lines 272 and 307. (Child per-project lookups via `.in('project_id', [...])` are already bounded.) `loadDesignPackages()` return shape gains a `totalRequestCount: number \| null`. | +10 / -2 |
| [`apps/portal/lib/runningJobs/server.ts`](../apps/portal/lib/runningJobs/server.ts) | Add range + count on the top-level `.from('projects')` select at line 181. Return shape gains `totalProjectCount`. | +5 / -1 |
| [`apps/portal/lib/queries/contacts.ts`](../apps/portal/lib/queries/contacts.ts) | `contactsListQueryOptions.queryFn` adapts to the new `listContacts()` return shape. Cache key unchanged. | +3 / -1 |
| `apps/portal/lib/queries/projects.ts` (if exists; otherwise inline) | Same adapter for projects list query. | +3 / -1 |
| [`apps/portal/app/staff/contacts/page.tsx`](../apps/portal/app/staff/contacts/page.tsx) | Pass `initialContacts.rows` to client (was the bare array). Pass `initialContacts.totalCount` as a sibling prop. | +2 / -1 |
| [`apps/portal/app/staff/contacts/ContactsIndexClient.tsx`](../apps/portal/app/staff/contacts/ContactsIndexClient.tsx) | Accept the new prop shape. Render `<ListCountBanner ... entityLabelPlural="contacts" />` above the table. Update the TanStack Query selector to destructure `data.rows` / `data.totalCount`. | +15 / -5 |
| `apps/portal/app/staff/projects/page.tsx` + `ProjectsIndexClient.tsx` (or equivalent) | Mirror of the contacts wiring. | +15 / -5 |
| Design-packages page client + running-jobs page client | Mirror of the contacts wiring — banner above the spreadsheet adapter's table. | +10 each |
| `apps/portal/lib/list/listLimits.test.ts` | NEW. `intoListFetchResult` round-trip. | +15 |
| `apps/portal/components/ui/listBanner/ListCountBanner.test.tsx` | NEW. Renders nothing below threshold; renders with correct copy at threshold; uses singular vs plural correctly. | +40 |
| [`docs/decision-log.md`](decision-log.md) | Append PR-PG1 entry: explicit-limit guardrail + why we picked the inline banner over a toast + why we skipped cursor pagination for now. | +25 |
| [`docs/projects-contacts-estimates-calculator.md`](projects-contacts-estimates-calculator.md) | Document `MAX_LIST_FETCH_ROWS = 5000` + `LIST_WARNING_THRESHOLD = 4000` as the canonical list-fetch contract. | +5 |
| [`docs/list-pagination-plan.md`](list-pagination-plan.md) | Mark PR-PG1 as shipped; cross-link the decision-log entry. | +2 |

**Total: ~14 production files touched, 2 files created, 2 test files created, 3 docs updated. Net ~+200 LOC.**

## 5. Verification audit (during PR, not before)

The recon was thorough but I'd rather the PR author audit these once more during execution rather than freeze the file map now:

- `apps/portal/lib/repo/estimatesRepo.ts:154` — `.from('estimates').select('*').order('created_at', { ascending: false })` looks like an unscoped global estimates list. **Find the caller** during PR — if it's a list page, add it to PR-PG1. If it's only used by a scoped consumer (e.g. project-detail tabs that don't use it as a top-level list), defer.
- `apps/portal/lib/queries/scheduleDiagnostics.ts:20-21` — diagnostic-only `.limit(1)` selects, no action needed.
- `apps/portal/lib/scheduling/scheduleV2Server.ts:748` — top-level `projects` + `estimates` selects feeding the schedule. The schedule isn't a 1000-row-truncation-risk list (it's date-windowed and operates on resolved-job sets), but worth a one-glance audit during the PR to confirm.

If any of those turn out to need range + count, fold them into PR-PG1; otherwise note them in the decision-log entry as "audited, not affected".

## 6. Risk + mitigation

| Risk | Likelihood | Mitigation |
|---|---|---|
| Changing `loadContactsIndexData` / `listContacts` return shape from `T[]` to `{ rows: T[]; totalCount }` ripples into more callers than I've enumerated. | Med | Run `rg "loadContactsIndexData\\|listContacts\\(" apps/portal/` at the start of the PR to enumerate every caller. Adjust each. Typecheck catches the rest. |
| `count: 'exact'` adds noticeable latency on every page load. | Low | Postgres counts on tables under 100k rows are sub-50ms and run in parallel with the row fetch. If it ever bites, switch the worst-offending fetch to `count: 'planned'` (cheap estimate, ±5%) — same opt key, different value, no caller change. |
| Banner copy or threshold annoys staff at current scale (false-positive). | Low | Threshold is 4000; current data is hundreds. Banner will not fire today. If it ever does, that's the intended signal. |
| TanStack Query cache pre-PR-PG1 is `T[]`; post-PR-PG1 is `{ rows, totalCount }` — stale cached entries from the old shape crash the page after deploy. | Med | Either (a) bump the cache key (`qk.contacts.list(host)` → `qk.contacts.listV2(host)`) so old entries get ignored, or (b) defensive read: `data?.rows ?? data ?? []` for one release cycle. Picking (a) — cleaner, no zombie defensive code. |
| Adding `range()` to the design-packages top-level select silently truncates a child fan-out that depends on the full set. | Med | Recon noted child fetches are `.in('project_id', [...])` keyed off the parent result, so the bound carries through naturally. PR author re-confirms during execution. |
| The `archived_at`-missing-column branch in `serverProjectsIndex.ts:106-111` is a fallback path; easy to forget to range-limit. | Med | Apply the change uniformly across all three branches of `buildProjectsQuery()`. Test coverage: a unit test that exercises both the happy path and the `archived_at`-missing fallback. |

## 7. Acceptance criteria

- Grepping `.from('contacts'|'projects'|'design_package_requests').select` across `apps/portal/lib/` (excluding `.eq`/`.in`/`.maybeSingle`/`.single`/`.range`/`.limit` matches) returns zero hits in production code — i.e. every top-level list select either has a range/limit or is filtered.
- `MAX_LIST_FETCH_ROWS` appears exactly once in production source (the constant definition); all call sites reference it by import, no inline `5000` literals.
- Portal typecheck clean.
- Portal vitest: contacts test suite green, projects test suite green, new `listLimits.test.ts` green, new `ListCountBanner.test.tsx` green.
- **HARD GATE: marketing email path** — `npm --prefix apps/marketing run build` clean (PR-PG1 doesn't touch costing, but change-routing requires the gate when modifying `apps/portal/lib/`).
- Manual verification (dev DB):
  - Load `/staff/contacts` → page renders, no banner visible (current contact count well below 4000).
  - Load `/staff/projects` → page renders, no banner visible.
  - Temporarily set `LIST_WARNING_THRESHOLD = 1` locally → banner appears on both pages with correct count text.
- `rg "list-pagination-plan|PR-PG1"` in `docs/` returns the new decision-log entry + the cross-link in `list-pagination-plan.md`.

## 8. What I'd push back on

The list-pagination parent plan said "toast warning". The site-wide toast policy ([`ToastProvider.tsx:56-57`](../apps/portal/components/ui/toast/ToastProvider.tsx#L56-L57)) silently swallows non-error toasts, so the original toast plan would have shipped a silent no-op. Switched to an inline `PageMessagePanel`-styled banner — that's the right surface anyway (truncation is a STATE, not an EVENT), but worth flagging that the parent plan's "toast" line was wrong.

Also: the parent plan suggested "showing X of Y" in a page header. Sticking that in a separate banner above the table — not in the header — because every list page already has its own header pattern (`PageHeader`, `HeaderActions`) and I don't want to fight that surface in this PR. PR-PG2 can integrate the count into the header alongside the search box.

## 9. CTA

Ready to execute as a single PR (~200 LOC, low-medium risk, 2-3 hours of careful work)? Say `go PR-PG1` and I'll start with the `listLimits.ts` + `ListCountBanner.tsx` primitives, then walk the file map top-to-bottom. Or push back on any of the design choices above (banner vs toast, return-shape change, threshold of 4000) first.
