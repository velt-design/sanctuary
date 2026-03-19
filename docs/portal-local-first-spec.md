# Portal Local-First UX Spec

Date: 2026-03-19
Status: Planning ready

## Goal

Make the portal feel instant for day-to-day staff work by treating the browser as the primary editing surface, then syncing to the server in the background.

The target model is:

- portal working copy
- local mutation queue
- server convergence
- background side effects

This is not a proposal to make the database a passive backup or to make irreversible business workflows browser-authoritative. The right long-term model is portal-first UX with server-authoritative convergence.

## Scope

In scope:

- local-first drafting for calculator, estimates, draft quotes, project forms, notes, and task-style edits
- a shared local mutation queue and sync-state model
- a common conflict-handling pattern across forms and spreadsheet-like surfaces
- schedule interactions that feel immediate locally while preserving server rule checks
- moving heavy artifact work such as quote PDF regeneration out of the main user-facing save path
- telemetry and rollout controls for the migration

Out of scope:

- making quote send, accept, decline, payment, invoice, or admin access actions browser-authoritative
- replacing shared server truth with peer-to-peer or browser-only truth
- CRDT adoption
- a full offline-first rewrite of every route before shipping any user benefit
- changing product rules such as quote locks, estimate locks, or schedule commitment rules unless required by implementation

## Repo-specific findings

These decisions are based on the code that exists today.

### 1. The calculator already has local draft behavior, but not local-first persistence

- Calculator inputs are restored from `sessionStorage`.
- Calculator save and generate actions still wait on server reads and writes before the user can continue.
- Estimate generation currently uses a browser-side repo flow that reads existing estimates before inserting the new row.

Relevant files:

- `apps/portal/app/staff/calculator/CalculatorGridClient.tsx`
- `apps/portal/lib/repo/estimatesRepo.ts`

### 2. The current save indicator is not a sync engine

- `saveTracker` tracks in-flight non-GET requests.
- It does not persist pending mutations locally.
- It does not queue offline edits.
- It does not support entity-level conflict states.

Relevant files:

- `apps/portal/lib/sync/saveTracker.ts`
- `apps/portal/lib/repo/apiClient.ts`
- `components/layout/SaveStatusPill.tsx`

### 3. The portal already has a strong optimistic-editing pattern in spreadsheet surfaces

- Running jobs, design packages, and job packs already apply local UI edits first.
- They persist through a queue per row.
- They support conflict detection and rollback messaging.

Relevant files:

- `apps/portal/components/spreadsheet/useSpreadsheetOptimisticEditing.ts`
- `apps/portal/app/staff/projects/running-jobs/useRunningJobsSpreadsheetAdapter.tsx`
- `apps/portal/app/staff/projects/design-packages/useDesignListSpreadsheetAdapter.tsx`
- `apps/portal/components/projects/ProjectPage/tabs/useJobPackSpreadsheetAdapter.tsx`

### 4. Some project-detail surfaces already patch cached state locally after save

- Project details update query caches immediately after a successful save.
- Project tasks and follow-up actions use optimistic local state before refresh.
- Stage transitions already have a small optimistic UI layer.

Relevant files:

- `apps/portal/components/projects/ProjectPage/ProjectDetailsSidebar.client.tsx`
- `apps/portal/components/projects/ProjectPage/ProjectTasksSidebar.client.tsx`
- `apps/portal/app/staff/projects/[projectId]/ProjectDetailLiteClient.tsx`
- `apps/portal/lib/queries/projectCache.ts`

### 5. Quote creation and draft updates still do too much synchronous server work

- Quote creation inserts rows, updates stage, loads detail, regenerates artifacts, then reloads detail again before returning.
- Draft quote save clears artifacts and regenerates them on the critical path.
- Inline quote PDF preview for drafts requests `inline` PDF output, which intentionally bypasses cached draft PDFs.
- The browser then parses and renders the PDF page by page.

Relevant files:

- `apps/portal/lib/quotes/serverCore.ts`
- `apps/portal/lib/quotes/serverEmail.ts`
- `apps/portal/components/projects/ProjectPage/tabs/QuotesTab.tsx`
- `apps/portal/components/projects/ProjectPage/tabs/QuotePdfInlinePreview.tsx`
- `apps/portal/app/api/quotes/[quoteVersionId]/pdf/route.ts`

### 6. Schedule already uses a hybrid model and should stay that way

- Schedule has immediate local UI interactions.
- Server mutations still own rule enforcement, force confirmations, and schedule-wide cascading impacts.
- This is the right shape for scheduling and should be refined, not replaced with pure browser authority.

Relevant files:

- `apps/portal/app/staff/schedule/ScheduleClient.tsx`
- `apps/portal/app/staff/schedule/SiteVisitsView.tsx`

### 7. Read caching exists, but mutation durability does not

- Quote queries use React Query caching with generous stale times.
- Staff warmup preloads projects and contacts.
- These patterns improve read speed but do not yet make editing local-first.

Relevant files:

- `apps/portal/lib/queries/quotes.ts`
- `components/sync/StaffCacheWarmup.tsx`

## Canonical ownership

The portal should not create new ambiguity about what is authoritative.

### Portal working copies

The browser should own the live editing experience for:

- calculator inputs and derived working result
- unsaved estimate edits
- unsaved draft quote edits
- project detail form drafts
- contact detail form drafts
- notes and checkbox-style edits before sync
- spreadsheet cell edits before sync
- schedule drag intent and local ghost state before server confirmation

### Server-authoritative records

The server remains authoritative for:

- persisted estimate rows
- persisted quote versions and line items
- quote send logs, accept tokens, and lock state
- quote PDF and file artifacts
- project stage transitions and related audit trail
- schedule commitments, crew allocation, and lock-sensitive mutations
- design request workflow state
- payment and invoice workflow state
- authentication, authorization, and access-control state

### Mutation classes

All user mutations should fit one of these classes.

#### Class A: local-first syncable mutations

Use local working copy first, then background sync:

- calculator edits
- estimate save
- draft quote edits
- project and contact form edits
- notes
- spreadsheet cell edits

#### Class B: optimistic but server-authoritative mutations

Show immediate local intent, but require server confirmation before treating the action as final:

- stage transitions
- schedule assignment, reschedule, pin, duration, and completion changes
- design workflow state changes

#### Class C: server-only final actions

Do not claim success until the server confirms:

- send quote
- resend quote
- accept quote
- decline quote
- create deposit invoice
- payment-received actions
- destructive admin actions

## Product principles

### 1. Routine editing must not wait on the network

- Typing, changing fields, and shaping a draft should never block on a spinner.
- Save should usually mean "queued locally and syncing" rather than "round-trip finished."

### 2. Sync state must be explicit

The UI should clearly distinguish:

- local only
- syncing
- synced
- offline
- conflict
- error

### 3. Conflicts should pause the affected entity, not the whole portal

- A conflicting quote draft should not block project-note sync.
- A schedule conflict should not block calculator sync.

### 4. Background jobs should follow durable business writes

- First persist the business entity.
- Then trigger PDF generation, artifact refresh, and similar heavy work in the background.

### 5. Shared workflows still need a shared truth

- Local-first UX does not remove the need for server validation on locks, permissions, and irreversible business actions.

## Local-first architecture

### Working copies

Each editable surface should have a local working copy keyed by stable entity identity.

Examples:

- calculator draft: project id + mode key
- estimate edit draft: estimate id
- quote draft: quote version id
- project details: project id
- contact details: contact id
- spreadsheet row queue: row id

### Durable local store

Use a persistent browser store for:

- working copies
- pending mutations
- sync state per entity
- last known server snapshot metadata
- conflict payloads for recovery

`sessionStorage` can remain a temporary rescue layer where it already exists, but the long-term durable layer should be IndexedDB-backed.

### Mutation queue

Each queued mutation should store enough information to retry safely.

Minimum fields:

- local mutation id
- entity kind
- entity id
- operation kind
- base server version or row version
- payload
- created at
- retry count
- last error
- current queue status

### Sync semantics

- Queue writes per entity in order.
- Allow unrelated entities to sync independently.
- Retry transient failures automatically.
- Pause on conflict or validation failure until the user resolves the issue.

### Conflict semantics

- If the server reports a conflicting newer version, preserve the local working copy.
- Mark the entity as conflicted.
- Show the latest server state and the local unsynced state side by side when needed.
- Do not silently discard local edits.

### Read path

Preferred read order:

1. current local working copy when actively editing
2. cached query data
3. server fetch

The user should see existing local work immediately when reopening a page.

## Phase definitions

### Phase 1: local-first foundation

Outcome:

- the portal gains a shared local mutation queue, sync-state model, and durable working-copy store

Phase-1 scope:

- sync engine
- queue status model
- entity-level conflict state
- save-pill upgrade
- shared hooks and helpers

### Phase 2: calculator, estimates, and draft quotes

Outcome:

- core quoting and estimating work becomes local-first

Phase-2 scope:

- calculator working copy persistence
- estimate create and update via local queue
- draft quote create and edit via local queue
- quote preview sourced from local draft state where possible
- synchronous artifact generation removed from routine edit flows

### Phase 3: forms, notes, and task-style autosave

Outcome:

- standard forms feel instant and save in the background

Phase-3 scope:

- project details
- contact details
- internal notes
- checkbox and lightweight task edits
- create-form draft persistence where useful

### Phase 4: shared optimistic editing across the portal

Outcome:

- spreadsheet and non-spreadsheet surfaces use one mutation model

Phase-4 scope:

- adapt existing spreadsheet optimistic editing to the shared queue
- converge conflict UI and retry behavior
- remove ad hoc optimistic patterns where the shared engine can replace them

### Phase 5: schedule refinement

Outcome:

- schedule interactions feel immediate without relaxing server control over complex scheduling rules

Phase-5 scope:

- local ghost and pending state for schedule edits
- entity-level pending status
- better rollback and conflict messaging
- no pure browser authority for cascading schedule consequences

### Phase 6: background side effects and heavy artifact work

Outcome:

- slow side effects move out of user-visible save paths

Phase-6 scope:

- quote PDF generation
- quote render artifact refresh
- similar heavy background derivations where user-facing latency matters
- operational telemetry for queue and job durations

## User experience decisions

### Local-first editing surfaces

For local-first surfaces:

- edits appear immediately
- the user can continue working without waiting for the database
- navigation should not depend on sync completion unless the next route truly requires the server record
- sync state is visible but non-blocking

### Server-authoritative action surfaces

For final actions:

- the UI may show a pending state immediately
- success is only declared after server confirmation
- downstream side effects such as email delivery or lock transitions remain server-owned

### Draft quote preview

The portal should not require a fully regenerated stored PDF just to preview a draft quote while editing it.

Preferred behavior:

- text and email previews render from local draft state
- draft PDF preview uses the latest local quote model where feasible
- stored artifact regeneration happens after durable save, not before the preview can open

### Save-state language

Recommended state labels:

- `Saved`
- `Syncing`
- `Offline`
- `Conflict`
- `Error`

Avoid showing `Saving...` for long periods when the user can already continue working.

## Non-goals and guardrails

### 1. Do not make the browser the only truth for shared business state

- A browser tab cannot be trusted as the only source for quote acceptance, schedule locking, or payment state.

### 2. Do not block the whole portal on one broken mutation

- Queue isolation is required.

### 3. Do not start with CRDT complexity

- Most portal workflows are forms and ordered mutations, not collaborative freeform text editing.

### 4. Do not migrate every surface before shipping value

- Start with the slowest and most annoying workflows first.

## Success measures

### User-facing success

- estimate save feels immediate
- quote draft save feels immediate
- quote preview opens without waiting on full artifact regeneration
- project-detail edits no longer feel gated by explicit save-and-wait loops
- users can continue working while sync is in progress

### Technical success

- queued edits survive reloads
- offline edits resume on reconnect
- conflicts are isolated to the affected entity
- background side effects are measurable separately from durable data writes

## Recommended rollout order

Implement in this order:

1. Phase 1 foundation
2. Phase 2 calculator, estimates, and draft quotes
3. Phase 3 forms, notes, and task-style autosave
4. Phase 4 shared optimistic editing across the portal
5. Phase 5 schedule refinement
6. Phase 6 background side effects and heavy artifact work

Reason:

- Phase 2 addresses the highest user pain and the clearest local-first opportunity.
- Phase 3 then spreads the pattern to the broadest set of everyday edits.
- Phase 4 unifies the interaction model after the foundation proves itself.
- Phase 5 is intentionally later because scheduling is more rule-dense and shared.
- Phase 6 finishes the performance model by removing the heaviest synchronous work from user flows.
