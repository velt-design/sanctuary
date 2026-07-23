# Project Operational Command Centre Architecture

Status: Stages 1 and 2 are present in the current repository; Stage 2 environment gates remain Yellow.

Baseline assessed: `ea1641c6c6647d22603d07b9f980cc3a1dad95fc` on 2026-07-20.

Product authority: `project-command-centre-v1.md`. Programme authority: `project-command-centre-roadmap.md`.

## How To Use This Document

- Read sections 3, 4, 7, 8, 10, 11, 14, 16, and 17 before changing the command-centre read model, commands, or Overview.
- Read the later-stage communication, migration, and risk sections before proposing Stage 3 or later work.
- Treat repository evidence as current-state fact and the V1 specification as product policy.
- Do not move a later-stage workflow into the current stage by extending the read model or card.
- Keep this document, the roadmap, the project current-state doc, and testing commands aligned when implementation changes.

## 1. Repository baseline and commit

The Stage 0 assessment used clean repository head `ea1641c6c6647d22603d07b9f980cc3a1dad95fc`. Stage 1 was committed locally as `8770198f`; that commit is the Stage 2 baseline.

The project-page architecture at the baseline already had the performance and trust foundations Stage 1 needed:

- A user-owned TanStack Query client.
- An immediate current-user project/contact summary followed by the complete project snapshot.
- Five truthful project read states.
- Access-ending data hiding.
- A synchronous project frame and lazy workflow tabs.
- Responsive desktop rails and a narrow-layout `Details` tab.
- Existing Project Detail bundle and authenticated performance budgets.

Workbench Gate 0 is `N/A`. Stage 1 does not touch drawings, geometry, workbench routes, or costing inputs. It removes the unsafe current-design fallback rather than building on it, and it has no Phase 2 workbench/cost-engine dependency.

## 2. Repository documentation and change routing

Stage 1 is owned by the staff-workflow-spine lane in `target-architecture.md`.

Required owner and guardrail docs are:

- `project-command-centre-v1.md`: product behavior and exclusions.
- `project-command-centre-roadmap.md`: programme stage and evidence.
- This document: repository ownership and implementation contract.
- `projects-contacts-estimates-calculator.md`: project snapshot, project page, estimate locks, and current Overview behavior.
- `staff-api-auth-contracts.md`: staff API and auth-bound client behavior.
- `quotes-invoices-job-packs.md`: quote history, totals, and status ownership.
- `portal-ux-roadmap.md`: staff-facing command-centre priority.
- `portal-production-readiness.md`: readiness and budget status.
- `testing-and-qa.md`: commands, fixtures, browser, bundle, smoke, and performance gates.
- `maintainability-principles.md`, `file-decomposition-and-ownership.md`, and `code-retirement-and-bloat-control.md`: small-owner and retirement rules.

`change-routing.md` routes `apps/portal/lib/projects/**`, staff project APIs, Project Page components, and command-centre fixtures/tests to this owner set.

## 3. Existing project-page architecture

The route `apps/portal/app/staff/projects/[projectId]/page.tsx` keeps the internal default tab key `activity`. The staff-facing label is `Overview`; preserving the key keeps URLs, old links, lazy-loading boundaries, and tests compatible.

`ProjectSnapshotPageClient.tsx` owns the project summary/full-snapshot transition and page-level unavailable state. `ProjectPageFrame.tsx` owns one fixed sticky header and the full-width body. `ProjectTabNavigation.tsx` owns the shared tab registry, grouped active state, URL normalization, and intent preloading; `ProjectMainTabs.tsx` owns active workflow rendering. `CommercialTab.tsx` owns Quotes/Invoices composition and quote Edit/Preview URL state without taking over either subview's side effects. The retired rail, panel-slot, drag, resize, collapsible-header, and narrow-layout Details-tab systems have no runtime compatibility path.

The Overview implementation is a lazy module at `tabs/OverviewTab.tsx`. It is allowed to render during the snapshot `summary` state because its commercial read is independent; snapshot-owned notes and tasks remain explicitly updating until the full snapshot is ready.

The current staff-facing lazy navigation owners are:

- Overview (`activity` key), the default project workflow.
- Calculator (`estimates` key), embedded with fixed project context.
- Commercial (`quotes` navigation key), with separate Quotes and Invoices inner views retaining the `quotes` and `invoices` keys.
- Job Packs (`job-packs` key) when available.

The project Emails UI is retired; `tab=emails` normalizes to Overview. Durable email audit data, preview APIs, snapshot fields, and quote/invoice delivery side effects are unchanged. The separate Design Workbench route remains available from the project header.

Project details and stage correction are part of Overview at every width. The pipeline is no longer rendered in the header.

Stage 1 did not add logic to the specialist tabs. The later shell Slice 2 retired the legacy Estimates/Configurator owner in favour of the authoritative Calculator and deliberately left the critical `QuotesTab.tsx` mutation boundary unchanged.

## 4. Existing current-design resolution

The baseline browser bar used three client queries and `lib/projects/currentDesign/resolve.ts`. Its quote source lookup could silently fall back to an active or latest unrelated estimate, and quote price formatting could fall back to estimate price. Those behaviors conflicted with the approved V1 contract.

Stage 1 retires that resolver, summarizer, and bar. The server-owned selector now lives in `apps/portal/lib/projects/commandCentre/resolve.ts` and applies:

1. Newest created `ACCEPTED` quote.
2. Else newest created `SENT` quote.
3. Else newest created `DRAFT` quote.
4. Else newest unlocked draft estimate.
5. Else newest non-archived draft estimate.
6. Else no current design.

Additional strict rules:

- `DECLINED` is historical and never current.
- A selected quote may use only `source_estimate_version_id`.
- A missing exact source produces `Source design unavailable`; no other estimate is borrowed.
- A selected quote may use only its raw stored `total_inc_gst_cents`.
- A missing or invalid quote total produces `Price unavailable`; no estimate price is borrowed.
- Estimate price uses the canonical quote-handoff projection from the selected saved estimate snapshot. The read does not invoke costing, and never treats `summary_json.total` as customer price.
- A blocked or zero-value estimate projection produces `Price unavailable` plus `estimate_price_unavailable`; partial line totals are not presented as a customer total.
- Accepted quote plus a newer unrelated estimate keeps the accepted quote authoritative and reports the newer estimate separately.
- Multiple accepted quotes select the newest deterministically and emit an integrity warning.

## 5. Estimate and quote domain ownership

Estimate persistence and locks remain owned by `apps/portal/lib/estimates`. Quote status, totals, send history, public tokens, PDFs, email, invoice creation, and job-pack effects remain owned by `apps/portal/lib/quotes` and their specialist routes.

The command centre is a read model only. It reuses `computeEstimateEditability()` to identify the unlocked active draft boundary. It does not change statuses, editability, line items, totals, tokens, source metadata, artifacts, or downstream records.

Estimate design labels reuse quote module formatters. Costing freshness is derived only from stored `outputs.pricing_sync_state`:

- `current` -> Current costing.
- `stale` -> Stored costing may be stale.
- Other retained output -> Stored costing.
- No usable output -> Costing unavailable.

No costing engine or costing input layer is imported.

## 6. Existing project snapshot

`ProjectPageSnapshot` remains the complete project-detail read model for identity, pipeline, tasks, notes, activity, and emails. Stage 1 does not extend it.

The snapshot remains shared with project routes and workbench route context, so putting commercial version arrays or estimate inputs into it would enlarge unrelated reads and weaken its ownership. The command-centre endpoint is therefore a separate read model and query key.

The Overview composes:

- Header/project identity from the existing project snapshot/summary.
- Customer/site/reference context from the existing project snapshot/summary.
- Current design and commercial facts from the dedicated command-centre response.
- Notes and stage tasks only after the full project snapshot is ready.

Placeholder task/note arrays never produce a false empty state.

## 7. Canonical ownership

Stage 2 owns one project assignment in `project_owner_assignments`, keyed by project. The approved owner roster is Jordan, JP, Joe, and Bruce. A row stores only the stable business key; no row means unassigned. This project owner carries the project from `new` through `deposit` and remains visible afterward when assigned.

The forward migration prefers an existing active Sales assignment, then Design and Estimating, only when the legacy assignee name maps to the approved roster. Unknown identities remain unassigned. The legacy three-role table is retained read-only as rollback evidence and has no current writer or read-model consumer.

## 8. Existing next-action and task systems

The project snapshot already resolves stage tasks from `pipelineDefinition.ts` and `project_task_checks`. Those tasks remain visible in Overview and retain their existing mutation owner.

Stage 2 candidates are open `tasks`, open `followup_tasks`, and `project_manual_actions`. The pure `actionResolver.ts` owns precedence, owner fallback, Auckland due state, explicit selection, conflict detection, and the 25-option bounded response. Stage checks, personal reminders, generic statuses, undated automatic candidates, approvals, and blockers are excluded.

`project_primary_action_selections` records explicit focus and the confirmed outranking hash. `project_action_controls` records critical state and lifetime reschedule count. `project_command_audit` is append-only command history. `project_action_versions` is trigger-maintained optimistic concurrency support for the complete candidate set. Source tasks remain canonical records rather than copied action rows.

## 9. Existing communication and activity sources

Stage 1 retains project notes and existing snapshot activity capability. It does not merge quote events, outbox events, calls, messages, site visits, audits, or tasks into a new timeline.

Current sources remain independently owned:

- Project notes by the project-note domain and note routes.
- Email summaries/outbox activity by the project snapshot and email domains.
- Quote send history by `quote_send_logs` and quote domain helpers.
- Site visits, audit events, automation, and task history by their existing domains.

Stage 4 owns the future normalized communication/timeline read model.

## 10. Existing auth and permissions

Command-centre reads and owner/action commands use `requireStaffContext()` and the returned auth-bound Supabase client. RLS plus security-definer command checks remain authoritative. The compatibility projection is refreshed inside the transactional action command; no browser or service-role caller has execute permission on its helper, and the retired Details writer or current task routes cannot write the legacy project columns.

The response is `private, no-store`, carries standard request diagnostics, returns `401`/`403` from the auth helper, returns `404` only when the authenticated project read is absent, and returns a stable `500` when a bounded subordinate read fails.

No raw tokens, token hashes, internal true cost, margin, service-role data, or oversized estimate inputs leave the endpoint.

## 11. Existing loading, caching, and local-first model

The query key is `qk.projects.commandCentre(host, projectId)`. It uses the authenticated user's existing QueryClient and a one-day garbage-collection window. It is stale immediately and refetches whenever Overview remounts, so a return from Calculator or Commercial refreshes current commercial state without adding cache logic to those critical workflows.

Overview states are explicit:

- Pending without data: updating current design and commercial state.
- Fresh: current server response.
- Background refresh: cached facts remain visible with an updating marker.
- Refresh failure with cached data: last known facts remain visible with Retry.
- Initial network/server failure: failure state with Retry, never a fake no-design state.
- `401`/`403`/`404`: no cached commercial or project data is rendered.

On access-ending command-centre responses, the child reports to `ProjectSnapshotPageClient`, which removes the current user's project, estimate, quote, invoice, and job-pack query families for the host and switches the page to unavailable. Local-first mutation ownership is unchanged.

## 12. Existing tests and performance gates

Stage 1 must retain:

- `npm run test:portal:projects`.
- Repository typecheck and lint.
- Portal production build.
- `npm run portal:bundle-budget` with unchanged Project Detail allowance.
- `npm run test:portal:browser` for fixture-safe visual/state coverage.
- Authenticated smoke and performance when credentials and compatible data are available.
- Docs and architecture changed guards.

The existing authenticated Project Detail journey already measures the active tab workflow before background completion. No latency or bundle budget may be raised to accommodate Stage 1.

## 13. Canonical V1 data ownership map

| V1 fact | Canonical Stage 1 source | Stage 1 behavior |
| --- | --- | --- |
| Project identity | Existing project summary/snapshot | Reuse header and customer context |
| Current quote | `quote_versions` | Strict accepted > sent > draft |
| Quote source design | `source_estimate_version_id` | Exact match only |
| Quote customer price | Raw `total_inc_gst_cents` | No fallback |
| Estimate selection | `estimates` plus quote-derived lock state | Active eligible draft, then latest non-archived |
| Estimate customer price | Canonical quote-handoff projection from saved `inputs` + `outputs` | No live costing; blocked projections are unavailable |
| Design labels | Selected estimate `inputs.modules` | Largest module plus additional count |
| Costing freshness | Selected estimate `outputs.pricing_sync_state` | Stored status only |
| Quote delivery | Selected quote status and send logs | Accepted/sent/failed/draft only |
| Notes and tasks | Existing project snapshot | Render only when full snapshot is ready |
| Specialist links | Existing tab routes | Read-only navigation |
| Project owner | `project_owner_assignments` | One approved owner, required/missing state, and admin edit permission |
| Primary action sources | Open `tasks`, `followup_tasks`, `project_manual_actions` | Referenced and selected, never copied |
| Selection/conflict | `project_primary_action_selections` plus selector hashes | Explicit selection with later outranking conflict |
| Critical/reschedule state | `project_action_controls` | Explicit red reason and lifetime count |
| Command history | `project_command_audit` | Latest 20 in project read model |

Later-stage workstreams, communications, normalized timeline, blockers, and approvals remain intentionally absent.

## 14. Required read models

Stage 1 adds `ProjectCommandCentreResponse` under `lib/projects/commandCentre/types.ts`.

The payload contains:

- `projectId` and `generatedAt`.
- One `currentDesign` object.
- Selected source and status presentation.
- Design availability and bounded design summary.
- Price source and nullable stored total.
- Selected estimate identity/version/saved/lock/source/costing facts.
- Selected quote identity/reference/version/status/timestamps/delivery facts.
- Optional newer unrelated estimate.
- Optional declined historical outcome when no quote is current.
- Explicit integrity/source/price warnings.
- Existing specialist-tab links.
- Three normalized owner summaries and permissions.
- Current primary action or explicit no-action state.
- Up to 25 sorted candidate options plus total/revision.
- Explicit-selection conflict and allowed operations.
- Latest 20 command-audit events and project exception flags.

The server performs one auth-bound `projects` relation read for estimate metadata, quote versions, and send logs, followed by one exact selected-estimate detail read for `inputs`, `outputs`, and costing trace fields. Only the bounded normalized response reaches the browser.

## 15. Required migrations

Stage 1 required no migration. Stage 2 is owned by two ordered forward migrations:

- `20260720_000008_project_command_centre_stage2.sql` promotes task/follow-up setup into migration truth; adds the initial owner/action/control/selection/audit tables, updated timestamps, focused indexes, select-only portal RLS, transactional idempotent commands, active-user backfills, and compatibility projection columns. Source-table triggers maintain candidate versions and the Schedule projection; Design Package source-task changes use a bounded staff RPC after direct authenticated source writes are revoked.
- `20260721_000001_project_command_single_owner.sql` replaces the initial three-role owner contract with one Project Owner from the approved Jordan/JP/Joe/Bruce roster, performs the deterministic legacy backfill, and replaces the owner command.

Both migrations must pass the executable environment smoke before Stage 2 can move from Yellow to complete.

Legacy `projects.next_action*` and `follow_up_date` are a read-only Schedule compatibility projection. The transactional action command alone refreshes them through an internal helper. Project Details, dashboard controls, stage-task completion, and AutomationRunner no longer own those fields.

## 16. Required API boundaries

Implemented Stage 1 route:

`GET /api/staff/v1/projects/[projectId]/command-centre`

Contract:

- Staff-authenticated, auth-bound Supabase only.
- `private, no-store`.
- Stable small JSON response.
- Project access determined by the parent project row under RLS.
- Any errored bounded relationship or selected-detail read fails the complete response.
- No side effects.
- No direct browser Supabase reads.

Existing summary and complete snapshot routes remain unchanged and independent.

Stage 2 extends that GET response with `operations` and adds:

- `GET /api/staff/v1/staff-directory`.
- `PATCH /api/staff/v1/projects/[projectId]/command-centre/owners`.
- `POST /api/staff/v1/projects/[projectId]/command-centre/primary-action/commands`.
- `GET /api/staff/v1/dashboard/project-exceptions`.

Every response, including errors, is `private, no-store`. Mutations require UUID command IDs and optimistic versions, are transactional/idempotent, and return committed success with `refreshRequired` rather than inviting a retry after a post-commit refresh failure.

## 17. Component reuse plan

Implemented component boundaries:

- `OverviewTab.tsx`: query and five-state orchestration plus the responsive operational-card composition.
- `overview/ProjectCurrentDesignCommercialCard.tsx`: read-only selected design/commercial presentation.
- `overview/ProjectStatusDetailsCard.tsx`: pipeline stage, stage correction, and user-owned local-first project details.
- Existing `ProjectNotesPanel.client.tsx`: project note/activity column.
- Existing `ProjectTasksSidebar.client.tsx`: stage-task action card below the operational row.
- Project Header: project identity, owner, actions, and the horizontally scrollable tab navigation.
- `overview/ProjectPrimaryActionCard.tsx`: owner/action/conflict/manual/history controls.
- Project Header: always-visible single Project Owner summary.
- Dashboard Project Action Queue: read-only bounded projection of canonical primary actions, filtered by Today, Next 7 days, or All due. Personal reminders remain independent. The legacy project-exceptions endpoint remains available as a bounded diagnostic read, but the staff Dashboard no longer queries or renders it because missing owner/action adoption across historical projects is not a useful home-page workload.

The `activity` module loader now resolves to `OverviewTab`; the old Activity component, three-query snapshot bar, fallback resolver, and summarizer are removed after consumer search proved no remaining code consumer.

## 18. Test and fixture strategy

Focused coverage includes:

- Pure selector precedence and exact-source tests.
- Raw server normalization, quote/estimate price ownership, blocked-estimate pricing, delivery, freshness, missing-source, and complete-read failure tests.
- Auth route response and failure tests.
- Query preloading and preserved activity-key tab tests.
- Overview pending/fresh/stale/failure/access-ending tests.
- Page-level protected cache clearing tests.
- Current design/commercial component tests.
- Environment-gated, customer-data-free fixture route.
- Browser matrix for the nine Stage 1 commercial scenarios plus primary, empty, conflict, critical, and undated Stage 2 states at 1600, 1366, 1024, 768, and 390 px.
- 390px no-horizontal-overflow and always-visible action facts.

Fixture route: `/qa/project-command-centre-fixture?scenario=...&action=...`, enabled only by `ENABLE_PORTAL_QA_FIXTURES=1`.

Stage 1 verification completed on 2026-07-20:

- Strict selector, loader, and route tests passed.
- Overview, card, preload, fixture, proxy/shell, and access-ending cache-clear tests passed.
- `npm run test:portal:projects` passed 322 tests across 61 files.
- `npm run test:portal:browser` passed 15 checks with one conditional workbench test skipped; all nine command-centre scenarios and the 390px check passed.
- `npm run test:portal:performance:fixture` passed nine checks.
- Repository typecheck and lint passed, including docs, package, cache, brand, and mojibake guards.
- An isolated production build generated 64 pages while the user's pre-existing port-3001 dev server remained untouched.
- The unchanged bundle-budget assertions passed against that isolated build. Project Detail measured 662.8 KiB raw / 190.5 KiB gzip initial and 1,771.0 KiB raw / 371.5 KiB gzip lazy; its largest lazy entry measured 1,526.9 KiB raw / 308.7 KiB gzip.
- Authenticated smoke and production performance were not rerun because `PORTAL_TEST_EMAIL` and `PORTAL_TEST_PASSWORD` were unavailable.

## 19. Recommended PR and goal sequence

- Stage 0: repository assessment and architecture record. Complete.
- Stage 1A: strict selector, normalized read model, staff API, and query. Implemented.
- Stage 1B: Overview label/module, commercial card, customer context, truthful states, and legacy retirement. Implemented.
- Stage 1C: deterministic unit/route/component/browser fixtures, docs, bundle/performance verification. Complete in the working tree.
- Stage 2A-C: present in the current repository; executable migration smoke plus authenticated real-project quality gates remain before completion.
- Stage 3: workstreams. Not started.
- Stage 4: communications and timeline. Not started.
- Stage 5: exceptions and approvals. Not started.
- Stage 6: final responsive QA, pilot, and rollout. Not started.

## 20. Technical risks

- Nested PostgREST relationship naming or RLS drift can fail the complete read. Route tests and live authenticated smoke remain required.
- Historical rows may contain invalid timestamps, missing totals, or missing source records. Normalization must preserve unknown/unavailable rather than fabricate data.
- Quote/estimate mutations do not directly update the new endpoint cache. Immediate staleness plus remount/focus refetch is the Stage 1 coherence mechanism; do not add logic to the critical tabs casually.
- Estimate inputs can be large. The metadata-first plus exact-detail read prevents all historical inputs reaching the browser or being fetched for every estimate.
- Multiple accepted quotes are an integrity issue. Stage 1 warns but does not mutate history.
- A future stage could accidentally duplicate task, communication, or issue truth in the command-centre payload. Extend only through an approved owner contract.

## 21. Confirmed implementation decisions

- Keep `activity` as the internal/default tab key and label it `Overview`.
- Keep `ProjectPageSnapshot` unchanged.
- Use a separate server-owned command-centre read model and query key.
- Use auth-bound staff access only.
- Apply accepted > sent > draft and exact source only.
- Never select declined quotes.
- Never fall back from quote source or quote price to an estimate.
- Read stored estimate summary and freshness; do not run costing.
- Keep existing project identity, notes, tasks, lazy boundaries, and compatible URL keys while consolidating details and stage correction into Overview.
- Clear protected user-owned caches on command-centre access-ending responses.
- Remove the legacy fallback resolver/summarizer/bar after zero-consumer proof.
- Make no Stage 1 migration or specialist mutation change.
- Keep task/follow-up rows canonical; manual rows represent only genuinely manual actions.
- Keep stage checks and personal dashboard reminders outside selection.
- Store staff dates at 5:00pm Auckland and preserve source timestamps.
- Keep overdue amber; critical is explicit and reasoned.
- Keep the compatibility projection service-owned and non-authoritative.
- The command-centre Stage 2 kept specialist workflows, workbench/drawings, geometry, and costing inputs unchanged. The later project-shell Slice 2 replaced only the obsolete project Estimates/Configurator composition with the authoritative Calculator; it did not change costing inputs or the separate Workbench route.

## 22. Unresolved technical questions

No unresolved question blocks Stage 1.

Later-stage questions remain deliberately open:

- Structured inbound/outbound communication schema.
- Timeline normalization and pagination.
- Workstream override and progress storage.
- Blocker/approval ownership, visibility, and audit.
- Stage 6 pilot cohort, measurement, and rollback procedure.

Those questions require their owning stage and must not be answered implicitly by extending Stage 1.

## 23. Repository evidence index

- Route/default key: `apps/portal/app/staff/projects/[projectId]/page.tsx`.
- Summary/full page state: `ProjectSnapshotPageClient.tsx`.
- Frame/shell/responsive details: `ProjectPageFrame.tsx`, `ProjectPageShell.tsx`.
- Tab labels/lazy module/preload: `ProjectMainTabs.tsx`, `projectTabModules.tsx`, `projectTabDataPreload.ts`.
- Snapshot owner: `lib/projects/getProjectPageSnapshot.ts`, `lib/projects/types.ts`.
- Command domain: `lib/projects/commandCentre/**`.
- Staff API: `app/api/staff/v1/projects/[projectId]/command-centre/**`.
- Query key/options: `lib/queries/keys.ts`, `lib/queries/projects.ts`.
- Overview components: `components/projects/ProjectPage/tabs/OverviewTab.tsx`, `tabs/overview/**`.
- Estimate lock truth: `lib/estimates/editability.ts`.
- Quote/estimate stored schemas: `supabase/portal_schema.sql` and ordered migrations.
- Fixture/browser evidence: `app/qa/project-command-centre-fixture/**`, `playwright/portal.command-centre.spec.ts`.

## 24. Update rules

- Update this document when the command-centre response, resolver precedence, auth boundary, cache behavior, component ownership, fixture matrix, or stage sequence changes.
- Update `project-command-centre-roadmap.md` whenever stage status or completion evidence changes.
- Update `projects-contacts-estimates-calculator.md` for current project-page behavior.
- Update `staff-api-auth-contracts.md` when route/auth/response contracts change.
- Update `testing-and-qa.md` when commands or browser fixtures change.
- Update `portal-production-readiness.md` and `portal-ux-roadmap.md` when readiness or UX status changes.
- Do not copy the full V1 product specification into this architecture record.
- Do not mark a later stage complete from partial or Stage 1 evidence.
