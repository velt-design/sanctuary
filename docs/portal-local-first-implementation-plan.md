# Portal Local-First UX Implementation Plan

Date: 2026-03-19
Depends on:

- `docs/portal-local-first-spec.md`

## Objective

Ship a portal-first editing model that makes routine work feel instant while keeping shared business state, locks, and irreversible workflows server-authoritative.

## Delivery strategy

Implement in this order:

1. local-first foundation
2. calculator, estimates, and draft quotes
3. forms, notes, and task-style autosave
4. shared optimistic editing across the portal
5. schedule refinement
6. background side effects and heavy artifact work

This order gets the biggest UX win early while avoiding a risky full-repo rewrite.

## Phase 1: local-first foundation

Goal:

- create the shared client infrastructure for local working copies, queued mutations, sync state, and conflict handling

Work:

- define shared local-first types:
  - entity identity
  - queue item
  - sync status
  - conflict payload
- introduce a durable browser store for:
  - working copies
  - pending queue items
  - entity sync state
  - conflict snapshots
- add a shared mutation runner that:
  - queues by entity
  - retries transient failures
  - pauses on conflicts
  - resumes after reconnect
- upgrade the existing save indicator from "network request in flight" to "entity sync state"
- add shared hooks for:
  - loading a working copy
  - writing local changes
  - enqueueing sync mutations
  - observing sync status
- keep the existing `saveTracker` behavior in place during migration, then make it an adapter or thin compatibility layer

Primary files:

- `apps/portal/lib/sync/saveTracker.ts`
- `apps/portal/lib/repo/apiClient.ts`
- `components/layout/SaveStatusPill.tsx`
- new folder, likely `apps/portal/lib/localFirst/`
- likely new files:
  - `apps/portal/lib/localFirst/types.ts`
  - `apps/portal/lib/localFirst/store.ts`
  - `apps/portal/lib/localFirst/queue.ts`
  - `apps/portal/lib/localFirst/useEntitySyncState.ts`

Notes:

- do not start by rewriting route contracts
- keep Phase 1 focused on client infrastructure
- support feature-flagged adoption per surface

Exit criteria:

- queued edits survive reload
- sync status can be read per entity
- offline failure does not discard queued edits
- conflict state can pause only the affected entity

## Phase 2: calculator, estimates, and draft quotes

Goal:

- make the highest-friction estimating and quoting workflow local-first

Work:

- replace browser-direct estimate creation with a single portal API write path
- keep calculator working copies in the durable local store, not only `sessionStorage`
- maintain mode-aware draft keys for:
  - new calculator draft
  - duplicate-from-estimate draft
  - edit-existing-estimate draft
- when saving or generating an estimate:
  - persist the local working copy immediately
  - enqueue the server mutation
  - allow the user to continue or navigate without waiting for the DB write
- represent newly created local estimates with provisional local identities until the server row is returned, then reconcile
- move quote draft creation onto the same local-first model:
  - create draft quote from local estimate snapshot
  - enqueue quote persistence
- remove synchronous artifact regeneration from quote create and draft-edit critical paths
- change preview flows so draft previews can use local draft state where possible
- preserve server-authoritative lock checks for:
  - estimate editability
  - quote send/resend eligibility

Primary files:

- `apps/portal/app/staff/calculator/CalculatorGridClient.tsx`
- `apps/portal/lib/repo/estimatesRepo.ts`
- `apps/portal/app/api/projects/[projectId]/estimates/route.ts`
- `apps/portal/app/api/estimates/[estimateId]/route.ts`
- `apps/portal/lib/quotes/quotesRepo.ts`
- `apps/portal/lib/quotes/serverCore.ts`
- `apps/portal/lib/quotes/serverEmail.ts`
- `apps/portal/components/projects/ProjectPage/tabs/QuotesTab.tsx`
- `apps/portal/components/projects/ProjectPage/tabs/QuotePdfInlinePreview.tsx`
- `apps/portal/app/api/quotes/[quoteVersionId]/pdf/route.ts`

Notes:

- the biggest architectural correction in this phase is removing browser-direct Supabase estimate creation from the main user workflow
- keep send, accept, and decline flows server-authoritative
- provisional local ids are acceptable for drafts as long as reconciliation is deterministic

Exit criteria:

- calculator draft survives reload from durable local storage
- estimate save no longer blocks the user on server completion
- draft quote edits no longer regenerate artifacts synchronously on each save
- quote preview can render without waiting for a fresh stored draft PDF

## Phase 3: forms, notes, and task-style autosave

Goal:

- make common forms feel instant with local draft state and background sync

Work:

- migrate project detail forms to local-first autosave on blur and idle
- migrate contact detail forms to the same pattern
- migrate estimate internal notes and similar note fields
- migrate lightweight checkbox and task completion edits where local-first semantics are safe
- keep explicit save buttons only where they still add user trust or where the interaction is batch-oriented
- patch React Query caches from local working state first, then reconcile after server success
- add visible sync state near the edited surface where ambiguity would otherwise remain

Primary files:

- `apps/portal/components/projects/ProjectPage/ProjectDetailsSidebar.client.tsx`
- `apps/portal/app/staff/projects/[projectId]/ProjectDetailLiteClient.tsx`
- `apps/portal/components/projects/ProjectPage/ProjectTasksSidebar.client.tsx`
- `apps/portal/components/projects/ProjectPage/tabs/EstimatesTab.tsx`
- `apps/portal/app/staff/contacts/[contactId]/ContactDetailClient.tsx`
- `apps/portal/app/staff/projects/new/ProjectCreateClient.tsx`
- `apps/portal/lib/queries/projectCache.ts`

Notes:

- start with edit-in-place surfaces, not create-from-scratch flows with complex validation
- use conservative autosave timing to avoid excessive churn
- retain server validation for invalid payloads and permission issues

Exit criteria:

- project detail edits feel immediate
- contact edits feel immediate
- notes no longer require explicit save-wait-refresh loops
- local changes survive temporary offline or network failure

## Phase 4: shared optimistic editing across the portal

Goal:

- converge spreadsheet and non-spreadsheet editing onto one mutation model

Work:

- refactor the spreadsheet optimistic-editing layer to use the shared local-first queue under the hood
- keep spreadsheet-specific keyboard and cell UX intact
- standardize queue behavior for:
  - retry
  - conflict
  - toast messages
  - pending indicators
- migrate running jobs, design packages, and job packs to the shared engine
- remove duplicated optimistic-edit code where the common layer can replace it cleanly
- keep row-level conflict semantics that already work well

Primary files:

- `apps/portal/components/spreadsheet/useSpreadsheetOptimisticEditing.ts`
- `apps/portal/app/staff/projects/running-jobs/useRunningJobsSpreadsheetAdapter.tsx`
- `apps/portal/app/staff/projects/design-packages/useDesignListSpreadsheetAdapter.tsx`
- `apps/portal/components/projects/ProjectPage/tabs/useJobPackSpreadsheetAdapter.tsx`

Notes:

- this phase should reuse, not throw away, the existing spreadsheet interaction model
- do not regress keyboard-driven editing while unifying the persistence engine

Exit criteria:

- spreadsheet rows persist through the same shared queue infrastructure
- row-level conflicts still behave correctly
- spreadsheet saving indicators reflect entity sync state rather than only component-local state

## Phase 5: schedule refinement

Goal:

- make schedule interactions feel immediate locally while preserving server ownership of complex scheduling rules

Work:

- introduce durable pending state for schedule mutations so the UI can survive reload during in-flight changes
- preserve immediate local ghost state for drag, pin, duration, and days-remaining edits
- keep server confirmation for:
  - cascading impacts
  - commitment changes
  - lock and force checks
  - schedule-wide recompute consequences
- improve rollback behavior when the server rejects a local schedule intent
- make schedule-specific conflict and confirmation UI consistent with the rest of the local-first model
- avoid browser-direct list reads or writes that bypass the queue for active schedule edits

Primary files:

- `apps/portal/app/staff/schedule/ScheduleClient.tsx`
- `apps/portal/app/staff/schedule/SiteVisitsView.tsx`
- `apps/portal/lib/repo/scheduleRepo.ts`
- `apps/portal/lib/repo/scheduleV2Repo.ts`
- `apps/portal/lib/queries/schedule.ts`

Notes:

- schedule is intentionally later because it is the most rule-dense shared workflow in the portal
- the design target is hybrid local-first UX, not full browser authority

Exit criteria:

- schedule edits show immediate local feedback
- rejected schedule mutations roll back cleanly and explain why
- lock-sensitive and cascading schedule rules remain server-controlled

## Phase 6: background side effects and heavy artifact work

Goal:

- move slow side effects off the user-facing write path and make them observable

Work:

- add a server-side background job mechanism for heavy post-write work
- move quote PDF generation and render-artifact refresh behind that job mechanism
- separate:
  - durable entity write completion
  - artifact generation completion
- expose artifact/job state to the UI where useful:
  - ready
  - refreshing
  - failed
- preserve immediate access to last known good artifacts while background regeneration runs
- add telemetry for:
  - queue latency
  - conflict rate
  - background-job duration
  - artifact cache hit rate

Primary files:

- `apps/portal/lib/quotes/serverCore.ts`
- `apps/portal/lib/quotes/serverEmail.ts`
- `apps/portal/app/api/quotes/[quoteVersionId]/pdf/route.ts`
- `apps/portal/app/api/quotes/[quoteVersionId]/preview/route.ts`
- potential new background-job infrastructure under `apps/portal/lib/`
- likely supporting schema migration(s) for durable server-side job orchestration

Notes:

- this is the first phase where schema migration is likely justified
- quote send and resend should still ensure required attachments exist before final delivery, but draft-edit flows should not pay that cost synchronously

Exit criteria:

- quote create and draft save no longer wait on full artifact regeneration
- the UI can distinguish entity save success from artifact refresh success
- background-job durations are measurable

## Cross-phase implementation rules

### Feature flags

Add feature flags or scoped rollout switches for each migrated surface.

Reason:

- local-first migrations change persistence behavior
- rollout should be reversible per feature area

### Backward compatibility

During migration:

- preserve existing routes where possible
- keep non-migrated surfaces working against current server behavior
- adapt the shared queue incrementally rather than requiring an all-or-nothing cutover

### Telemetry

Add instrumentation from Phase 1 onward for:

- queue enqueue time
- queue drain time
- sync success/failure
- conflict rate
- average time spent in `syncing`
- background-job duration

### QA focus

Regression testing should prioritize:

- reload during pending sync
- offline edit then reconnect
- stale-tab conflict
- multi-tab same-entity editing
- draft quote preview during unsynced local edits
- schedule mutation rollback after server rejection

## Suggested milestone order inside the rollout

Milestone 1:

- Phase 1 foundation behind flags

Milestone 2:

- Phase 2 calculator and estimates

Milestone 3:

- Phase 2 draft quotes and preview path

Milestone 4:

- Phase 3 project/contact forms and notes

Milestone 5:

- Phase 4 spreadsheet convergence

Milestone 6:

- Phase 5 schedule refinement

Milestone 7:

- Phase 6 background jobs and artifact offloading

## Risks and mitigations

### Risk: duplicated local and server state drifts

Mitigation:

- keep clear entity ownership
- require explicit reconciliation after server success
- pause only the affected entity on conflict

### Risk: local-first hides important failures

Mitigation:

- show entity sync state clearly
- preserve error and conflict visibility
- avoid pretending final server-only actions succeeded before confirmation

### Risk: schedule complexity explodes if migrated too early

Mitigation:

- keep schedule in Phase 5
- preserve server confirmations for cascading changes

### Risk: background-job infra delays user-facing wins

Mitigation:

- do not wait for Phase 6 to deliver value
- ship local-first draft editing first, then move heavy side effects out later

## Final recommendation

Treat this as a UX architecture program, not a storage swap.

The target is:

- portal-first editing
- local durable drafts
- background sync
- server-authoritative convergence
- background artifact generation

That is the most practical way to remove the current wait-heavy experience without weakening the shared business rules the portal already depends on.
