# Portal State Synchronisation Audit

Status: Complete (2026-08-13).

Purpose: track the page-by-page review of staff-portal interaction state, URL state, cached server state, optimistic writes, and browser navigation. A route is complete only when its state owners have been inspected and focused regression coverage exists for every verified defect.

## Review Contract

For each route, check:

- loading and authenticated-shell swaps do not discard active input or focus;
- URL/prop reconciliation responds to Back/Forward without replaying unchanged defaults over live edits;
- stale or out-of-order requests cannot replace newer user intent;
- optimistic rollback is scoped to the failed entity or command;
- cache data is shown only when it matches the active request and access state;
- selected rows, tabs, dialogs, and detail/list transitions have one canonical owner;
- navigation works on the first click and preserves expected browser history.

`Reviewed` means the route and its directly owned controllers were inspected. `Fixed` means the audit also found and corrected a verified defect. Diagnostic `/qa/**` fixtures are evidence surfaces rather than staff workflows and are excluded from page coverage.

## Shared State

| Surface | Status | Evidence |
| --- | --- | --- |
| Authenticated shell and global search | Fixed | Search query, open interaction, and focus now survive pending-to-loaded page-header replacement. Covered by `GlobalPortalSearch.client.test.tsx`. |
| Project quote list/detail URL selection | Fixed | A pending URL-intent barrier prevents stale `quoteId` from reopening detail after one-click Back to quotes; external Back/Forward can still take authority. Covered by `QuotesTab.test.tsx` and `CommercialTab.test.tsx`. |
| Sidebar and route-transition ownership | Fixed | Browser Back/Forward now cancels pending progress immediately; instant-route completion is identity-checked so an older mount cannot dismiss a newer destination; mobile navigation closes for pathname or query commits. Shared transition/shell tests cover all three races. |

## Route Checklist

| Route or page group | Status | Findings / next check |
| --- | --- | --- |
| `/dashboard` | Fixed | Dashboard query states were already truthful. Personal-task refresh and overlapping rollback could rewind unrelated state; reconciliation is now per task with focused tests. |
| `/staff/projects` | Fixed | URL filters were reapplied when unrelated search params changed, overwriting live search text. Reconciliation now depends only on parsed filter values and still follows Back/Forward. |
| `/staff/contacts` | Fixed | The server `q` prop now reconciles on actual URL-query changes but ordinary rerenders preserve live typing. |
| `/staff/projects/new` | Fixed | Server idempotency and retry semantics were already scoped. Preselected-contact state now follows actual `contactId` Back/Forward changes without replaying unchanged URL state over a manual choice. |
| `/staff/contacts/new` | Reviewed | Form draft remains mounted through submit/retry; duplicate submission is blocked while pending and navigation occurs only after confirmation. |
| `/staff/contacts/:contactId` | Fixed | Local-first draft protects editing and pending changes from refresh. The details editor is now keyed to contact identity so direct dynamic-route changes cannot carry one contact's draft into another. |
| `/staff/projects/work-queue` | Reviewed | Filters and pagination are client-owned and retained across data refresh; page clamping is derived from filtered results. Row commands use their domain controller and no route-level replay defect was found. |
| `/staff/projects/:projectId` shell and Activity | Fixed | Snapshot refresh keeps known truth and hides it after access-ending responses. Main-tab optimistic intent now yields to a genuinely new Back/Forward URL, and project identity remounts page-scoped draft state. Activity local-first details and command controllers already protect dirty/pending intent. |
| Project Estimates | Reviewed | Estimate list/workspace identity is URL-owned; explicit push enters calculator and replace returns to the list. Project-keyed mounting prevents state leaking between projects. Existing tests cover create, duplicate, invalid/locked selections, save handoff, and list return. |
| Project Quotes | Fixed | One-click list return, controlled URL selection, project isolation, and Commercial Back/Forward are fixed. PDF loads abort on selection changes; send-review bytes are now cleared before loading a different quote and non-OK artifacts are rejected. Local-first quote mutations remain serialised by entity. |
| Project Invoices | Reviewed | Project-keyed mounting isolates dialogs and pending controls; queries and invalidations are project-scoped. Payment/invoice commands are server-serialised and close dialogs only after confirmed refresh. No additional route-state defect was found. |
| Project Job Packs | Reviewed | Estimate and sheet selection are URL-owned and project-isolated; detail queries follow estimate identity and spreadsheet editing uses the corrected shared queue/shell. |
| `/staff/schedule` | Fixed | V2 request epochs, Board intent replay, mutation ownership and URL view reconciliation were already covered. Legacy fallback now follows Back/Forward Board/Gantt props, and Site Visit scope changes close stale modal/popover/assignment state. |
| `/staff/projects/design-packages` | Fixed | Shared spreadsheet queue serialises per-row edits, replays queued intent, and handles conflicts. The shared editor now closes if filter/refresh removes its row. |
| `/staff/projects/running-jobs` and compatibility redirect | Fixed | Uses the same corrected spreadsheet owner and serialised row queue; compatibility redirect remains stateless. |
| `/staff/calculator` and `/staff/old-calculator` | Fixed | Local drafts remain session-keyed. Removing an estimate URL now clears the edit session, and late project/estimate responses cannot overwrite a newer URL selection. Compatibility route remains stateless. |
| Project Design Workbench | Reviewed | Architecture gate applied. Existing request cancellation and project-keyed query ownership were inspected; no verified state defect or code change was required. Legacy audit rows: N/A; neither builds on legacy nor adds a Phase 2 dependency. |
| `/staff/design-booklets` | Fixed | Save and media operations already serialize and discard superseded asset work. Workbench mounting is now keyed by linked project/standalone identity so one project's draft/selection cannot leak into another scope. |
| `/staff/email-previews` | Fixed | Variant reads already abort on selection changes and delivery locks its exact scenario. Responses are now rejected unless their variant matches the current selection, preventing stale or mis-keyed content from rendering. |
| `/staff/ui-foundation` and `/staff/sidebar-lab` | Reviewed | Catalogue state is intentionally local and has no server/URL replay. The lab is stateless and uses the corrected shared shell/sidebar owners. |
| `/admin`, `/admin/access` | Fixed | Admin home is a stateless redirect. Access reads now ignore superseded responses; row status rollback restores only the failed field so it cannot rewind another row's draft. Row fields lock while their exact save is pending. |
| `/admin/costing`, `/pricebook`, cost editors | Fixed | Redirects are stateless and publication retains hash/time concurrency checks. A refreshed server overview now reconciles while clean; async workflow/editor controls lock during saves so typing or selection cannot race a response. Estimate searches abort and previews retain request identity/hash checks. |
| `/admin/imports` | Fixed | Import batches are preview-first and serialized during writes. File parsing now owns a request sequence so a superseded selection cannot replace the latest parsed batch. |
| `/login`, `/access-status`, staff/root redirects | Reviewed | Callback URLs are safe and query-preserving; access lookup uses a nonce so stale auth responses cannot win. Public/status and compatibility redirects remain stateless, with callback/redirect tests covering preservation and unsafe targets. |

## Completion Gate

Completed with no checklist item Pending or In progress. Focused regression tests cover every verified defect; the full portal Vitest suite, portal TypeScript check, lint, production build, docs guard, architecture report, and worktree report pass. Authenticated browser smoke confirms that active global-search text and focus survive a loading-header swap and that one click on **Back to quotes** returns to the list without reopening detail.
