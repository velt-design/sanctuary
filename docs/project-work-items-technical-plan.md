# Project Work Items Technical And Cutover Plan

Status: The approved new-project V2, Work Queue/legacy-review, and Overview V2 slices are production-deployed. Release merge `c9e73651` entered production before the exact reviewed `20260729_000002`, `000003`, and `000004` files were applied individually to the positively identified production database on 2026-07-30; snapshot-cache hotfix merge `809f2c5e` followed. Postflight catalog, RLS, grant, relationship, and empty-state checks passed; authenticated production Work Queue, legacy snapshot, and Command Centre reads returned `200`, and the complete snapshot now enforces `private, no-store` on every explicit response path. Marker count was zero at the 2026-07-30 cutover check, so the ready Work Queue was correctly empty. No pre-cutover project was migrated or backfilled; only one explicitly reviewed project can ever cross through the guarded command.

Purpose: replace the competing legacy project-task systems with one small, durable work-item foundation without weakening lifecycle, commercial, local-first, authentication, public-token, or side-effect boundaries.

This plan supplies the trusted Project Work contract consumed by the separately approved Project Overview redesign. It does not own layout or visual direction.

## Current Repository State

`20260729_000002_project_work_items_v2.sql` and the associated server/API adapters implement the coherent foundation for newly created projects. Staff creation reaches `project_create_v2` only through the authenticated staff API; the former browser-direct project insert helper is retired. A newly created `New` project linked by its intake enquiry initializes the same model. A narrow creation-time check prevents an old project from being activated by a later enquiry insert. Existing projects are not marked, backfilled, or classified. The Contacted population is unchanged.

The first staging application completed the DDL but PostgREST continued to report the new marker/state tables and their project relationship as absent from its schema cache (`PGRST205`/`PGRST200`). That made every project-detail snapshot fail at classification. Project and queue classifiers now read model markers and operational state through direct bounded owners rather than embedded relationships; authoritative queue inventory fails closed if unavailable or truncated. Forward migration `20260729_000003_project_work_items_v2_schema_cache.sql` canonicalizes the named `project_id -> projects.id ON DELETE CASCADE` keys and sends the PostgREST reload only after DDL commit; `20260729_000004` follows the same post-commit rule. Both exact files were rollback-rehearsed and replay-applied to staging on 2026-07-30, and the read-only readiness plus direct catalog/body/permission checks passed. The authenticated GET-only Work Queue, legacy snapshot, and Command Centre smoke also passed against a disposable synthetic staging project, with the legacy boundary preserved and the fixture removed afterward.

The final authenticated command smoke created one clearly labelled synthetic V2 project through the staff API and proved the durable transition `OPEN r1 -> BLOCKED r2 -> exact replay r2 -> ARCHIVED/CANCELLED r3`. Work-item, Work Queue, Command Centre, snapshot, integrity, and rendered Overview checks agreed; the archived project was omitted from active work and reported zero open/blocked items. The exact replay produced no duplicate work event. The temporary synthetic-QA role elevation required for the supported archive command was restored to `staff`. No confirmation, email/outbox, quote, invoice, legacy task/follow-up, Site Visit, Schedule, Running Jobs, repair, or legacy-residue record was created. The archived synthetic project/contact and append-only events intentionally remain as staging audit evidence; V2 exposes no hard-delete command.

The repository implementation includes the V2 state, work-item, confirmation, receipt, event, calendar, authoritative team queue, compatibility, archive, Schedule, Running Jobs, lead-cadence, quote-reconciliation, confirmation-correction, and one-project legacy-review boundaries described below. `projectWorkCache.ts` is the sole cache patch/invalidation module: it owns V2 projection fan-out, complete command-centre response patching through `patchProjectCommandCentreCache`, and the shared Project Work invalidation set. Cached or refresh-failed data remains visible but read-only; an absent V2 contract renders a named not-ready state with no retry loop or mutation controls. The Overview V2 presentation consumes one server projection through one mixed-model Project Work region. Its route-owned composition, orientation, section/list/controls, separate V2 and legacy command controllers, conflict/history presenters, and shared visibility policy do not change the durable command contract. V2 actions remain server-owned; legacy stage rows are filtered read-only, Call and Site Visit work is hidden, a prohibited selected legacy action becomes `Legacy work needs review` without browser ranking, and a server-returned blocked primary remains a visible exception with no enabled item command. Work Queue owns the staff-wide operational list and Dashboard owns its compact preview as the only home-page project-work surface; legacy action aggregates and the old snapshot queue payload are not exposed to the browser, while personal reminders remain separate. The positively identified staging rehearsal, authenticated non-destructive QA, and focused repository gates recorded for the Project Work foundation remain valid historical rollout evidence. Overview V2's focused, fixture, responsive/accessibility, unchanged Project Detail budget, build/static, manual authenticated inspection, and automated authenticated read-only staging evidence passed on 2026-07-30. Overview V2 completion is accepted under the narrow user-approved exception for the unrelated baseline Contacts/Calculator overruns; their ceilings remain unchanged and optimization stays outside this data-cutover plan. Production promotion is complete; monitoring remains bounded to naturally created V2 projects and read-only integrity signals.

Known boundaries and limitations before broad rollout:

- Auckland calendar coverage is verified only for 2026 and 2027 and fails closed beyond covered years;
- the specialist primary-action adapter currently covers quote-delivery recovery, draft-quote send, and estimate-to-quote only;
- project-specific Command Centre, snapshot, work-item, full Work Queue, and Dashboard reads share the same server-owned action composition;
- Contacted classification is recommendation-only and cannot prove historical outreach when structured evidence is absent; and
- broad existing-project migration and legacy retirement remain separate reviewed operations.

Staff confirmed on 2026-07-30 that the legacy task surfaces have not been used
as an operational company workflow; the portal has primarily supported
quoting. That removes historical task adoption as a launch blocker, but it
does not authorise an automatic backfill. Existing projects remain legacy by
default, and any later opt-in stays one explicitly reviewed project at a time.

## 1. Evidence And Existing Risk

For unmarked legacy projects, work remains spread across:

- code-defined stage checks in `pipelineDefinition.ts` and `project_task_checks`;
- automation `tasks`;
- `followup_plans` and `followup_tasks`;
- `project_manual_actions`;
- action controls, manual primary selection, audit, and version tables; and
- compatibility fields on `projects`: `next_action*` and `follow_up_date`.

The resulting problems are structural:

- the same next-action truth is derived in browser code, server code, and SQL;
- automation items can outrank more urgent manual work;
- Critical does not consistently control ranking;
- generic completion paths can mutate stages, invoices, or Schedule;
- Design and Running Jobs facts are copied into task records;
- the durable quote-send path does not reliably start the old follow-up plan;
- an automation event can be recorded before its handler succeeds, making a failed retry unsafe; and
- specialist mutations do not consistently invalidate Command Centre data.

`portal_dashboard_tasks` is a separate personal-reminder system and is not part of this replacement.

## 2. Target Ownership Rules

There will be one source for each kind of truth:

| Truth | Authoritative owner |
| --- | --- |
| Human obligation | `project_work_items` |
| Work-item history | `project_work_item_events` |
| Manual evidence | `project_confirmation_events` |
| Active, Waiting, or Closed | `project_operational_states` |
| Administrative archive | existing `projects.archived_at` |
| Project owner | existing `project_owner_assignments` |
| Pipeline stage | existing project lifecycle owner |
| Quote, invoice, and payment facts | commercial domain |
| Design state | Design domain |
| Schedule and installation facts | Schedule V2 |
| Running-job facts | Running Jobs |
| Primary action | server-derived projection; never stored as a second editable choice |

Specialist domains may expose an action candidate to the Command Centre. They must not copy that candidate into `project_work_items`.

## 3. Implemented Repository Data Contract

The names below reflect the current repository migration contract. Later changes must use forward migrations and must not edit applied migration history.

### `project_operational_states`

One row per classified operational project:

| Field | Rule |
| --- | --- |
| `project_id` | UUID primary key, references `projects` |
| `state` | `ACTIVE`, `WAITING`, or `CLOSED` |
| `waiting_until` | Required only for `WAITING`; stored as a UTC instant |
| `waiting_reason` | Required only for `WAITING`; 1-500 characters |
| `closed_outcome` | Required only for `CLOSED`; bounded approved values |
| `closed_note` | Optional, maximum 1,000 characters |
| `row_version` | Positive integer, incremented by every accepted command |
| `created_at`, `updated_at` | Server timestamps |
| `created_by`, `updated_by` | Nullable portal-user references for retained audit history |

Approved `closed_outcome` values:

- `LOST_NO_RESPONSE`
- `LOST_BUDGET_PRICE`
- `LOST_OTHER_SUPPLIER`
- `LOST_TIMING_DEFERRED`
- `LOST_NOT_SUITABLE`
- `CANCELLED`
- `COMPLETE`

Database checks enforce the Waiting and Closed field combinations. Archive remains independent. When `projects.archived_at` is set, read models expose the effective state as Archived and exclude the project from operational queues.

New post-cutover projects receive `ACTIVE` in the same transaction that makes them operationally visible. Existing projects are initialised only from reliable evidence:

- an archived project remains effectively Archived;
- an existing project with a current authoritative specialist action may be reviewed or safely seeded Active;
- no project is inferred to be Waiting or Closed from age, stage, or `follow_up_date`; and
- an ambiguous pre-cutover project has no state row and is projected as `LEGACY_UNCLASSIFIED`.

`LEGACY_UNCLASSIFIED` is a temporary read-model value, not a fourth operational state. It stays out of the company work queue and appears only in the admin backlog review until staff records Active, Waiting, Closed, or a valid archive reason. Reconciliation reports the remaining count until it reaches zero.

### `project_work_model_versions`

One row marks that a project has crossed the writer boundary:

| Field | Rule |
| --- | --- |
| `project_id` | UUID primary key |
| `model_version` | `2` for the replacement model |
| `cutover_at` | Server timestamp |
| `cutover_by` | Nullable portal-user actor |
| `reason` | `NEW_PROJECT`, `REVIEWED_MIGRATION`, or `ADMIN_REPAIR` |

No row means legacy writers remain authoritative and the replacement model is shadow-only. A version-2 row means:

- legacy task and follow-up generators must reject or skip the project;
- code-defined legacy stage-task candidates must not be shown;
- legacy projection triggers must not update its `projects.next_action*` fields;
- new commands and the new compatibility projection are authoritative; and
- the project cannot return to legacy writers.

For a reviewed existing project, the operational-state row, approved imported work, version marker, and initial compatibility projection commit in one transaction. A new post-cutover project receives `ACTIVE`, model version 2, and its first applicable work item atomically.

### `project_state_events`

Append-only history:

- event UUID;
- project UUID;
- command UUID and event sequence;
- event type;
- before and after state JSON;
- reason;
- actor;
- occurred timestamp; and
- unique `(command_id, event_sequence)`.

Rows cannot be updated or deleted by browser or ordinary staff API paths.

### `project_work_items`

One row per real staff obligation:

| Field | Rule |
| --- | --- |
| `id` | UUID primary key |
| `project_id` | Required project reference |
| `title` | Trimmed, 1-160 characters |
| `responsibility_area` | `CUSTOMER`, `DESIGN`, `COMMERCIAL`, `OPERATIONS`, or `ADMIN` |
| `status` | `OPEN`, `BLOCKED`, `DONE`, or `CANCELLED` |
| `due_at` | Required UTC instant |
| `sla_breach_at` | Optional UTC instant; cannot precede `due_at` |
| `deadline_policy` | Optional bounded policy name for calculated deadlines |
| `calendar_revision` | Required when a deadline was calculated by the Auckland calendar |
| `assignee_user_id` | Optional active portal-user reference |
| `priority` | `NORMAL` or `CRITICAL` |
| `priority_reason` | Required only for `CRITICAL`; 1-500 characters |
| `blocked_reason` | Required only for `BLOCKED`; 1-500 characters |
| `origin` | `MANUAL`, `AUTOMATION`, or `REVIEWED_MIGRATION` |
| `source_type` | Bounded server-owned source type |
| `source_key` | Required and unique for non-manual origins |
| `series_key` | Required for cadence items; identifies the lead or quote cadence |
| `subject_kind`, `subject_id` | Optional authoritative record reference |
| `row_version` | Positive integer, incremented by every accepted mutation |
| actor/timestamps | Created, updated, completed, and cancelled evidence |
| `outcome` | Optional completion text, maximum 1,000 characters |
| `cancellation_reason` | Required for cancellation, maximum 500 characters |

An explicit assignee overrides responsibility for that item. If absent, the existing Project Owner is the effective responsible party. The assignee affects accountability and filtering, not access.

The read model keeps those identities explicit:

- `{ kind: "staff", userId }` for an explicit active portal-user assignee;
- `{ kind: "projectOwner", ownerKey }` for Project Owner fallback; or
- `{ kind: "unassigned" }` when neither exists.

It does not guess a portal account from an owner display name.

No hard-delete command is provided.

Initial `source_type` values:

- `LEAD_CADENCE`
- `QUOTE_CADENCE`
- `MANUAL`
- `LEGACY_REVIEW`

Adding a source type requires a named server adapter, an idempotency key definition, and contract tests.

Delivery recovery and specialist exceptions remain read-only candidates from their authoritative domains. They become work items only when staff deliberately creates a distinct human obligation; the authoritative exception itself is never copied.

### `project_work_item_events`

Append-only history for every accepted work-item command:

- event UUID;
- work-item and project UUIDs;
- command UUID and sequence;
- event type;
- actor;
- before and after state JSON;
- reason;
- occurred timestamp; and
- unique `(command_id, event_sequence)`.

Initial event types:

- `CREATED`
- `COMPLETED`
- `CANCELLED`
- `RESCHEDULED`
- `REASSIGNED`
- `BLOCKED`
- `UNBLOCKED`
- `PRIORITY_CHANGED`
- `REOPENED`
- `SYSTEM_RECONCILED`

### `project_confirmation_events`

Append-only manual evidence:

| Field | Rule |
| --- | --- |
| `id` | UUID primary key |
| `project_id` | Required project reference |
| `event_kind` | `CONFIRMED` or `RETRACTED` |
| `confirmation_type` | Bounded approved type |
| `subject_kind`, `subject_id` | Required for quote confirmations and any type tied to an authoritative record |
| `occurred_at` | When the real event occurred |
| `recorded_at`, `recorded_by` | When and by whom it was entered |
| `source_key` | Optional server-owned idempotency key |
| `retracts_event_id` | Set only by a correction event |
| `reason` | Required for a retraction |

Initial confirmation types:

- `FIRST_ENQUIRY_EMAIL_SENT`
- `ENQUIRY_FOLLOW_UP_EMAIL_SENT`
- `ENQUIRY_CUSTOMER_REPLY_RECEIVED`
- `QUOTE_FOLLOW_UP_EMAIL_SENT`
- `QUOTE_CUSTOMER_REPLY_RECEIVED`
- `SITE_VISIT_COMPLETED`

Confirmation rows are never edited or deleted. A correction appends a `RETRACTED` event with the same confirmation type and a reference to the original `CONFIRMED` event.

A retraction must match the same project, confirmation type, and subject; only one retraction is allowed for an event. Retracting a quote confirmation always retains the exact `quote_version_id` subject.

### `project_command_receipts`

Shared idempotency evidence for state, work-item, and confirmation commands:

- command UUID primary key;
- project UUID;
- command type;
- intent hash;
- actor;
- committed result JSON;
- committed timestamp.

Reusing a command UUID with the same intent returns the committed result. Reusing it with a different intent is rejected.

### `project_work_repair_signals`

Durable recovery evidence for a quote lifecycle fact that committed before its V2 cadence reconciliation succeeded:

- the original deterministic reconciliation command UUID is unique;
- project, quote version, and event identity are retained;
- status is `OPEN` or `RESOLVED`;
- only bounded staff-safe error code and copy are stored;
- repeat failures increment attempt and row versions; and
- a later successful authoritative reconciliation resolves the affected quote-family signals.

Authenticated staff can read these rows but cannot write them. Only the server-side service-role command may open or resolve a signal. An open signal outranks normal project work and enters the SQL queue; raw provider, database, and service details are never persisted in this staff-visible table.

### Business calendar ownership

Reuse the existing Schedule-owned calendar sources:

- `nz_holidays` for observed national and regional public-holiday dates;
- `company_closures` for Sanctuary closures; and
- `apps/portal/lib/scheduling/workingDays.ts` for current working-date semantics.

Do not create a second holiday or closure table. The work-item calendar adapter consumes these owners read-only and adds only the 9:00am-5:00pm open-clock calculation needed by lead service levels.

A small `business_calendar_year_coverage` table may record `(region, local_year, source_version, verified_at, verified_by)` for each completely verified year. The deadline stores a deterministic `calendar_revision` derived from the sorted relevant holiday/closure rows and coverage source version.

Observed public-holiday data remains checked in or loaded through a verified server process; deadline calculation does not make a runtime network request. Calculation fails with a visible recovery result when its target could extend beyond verified coverage.

Calendar edits affect new calculations only. Changing a date does not rewrite existing work-item deadlines.

## 4. Integrity, Access, And Indexes

The forward migration must:

- enable RLS on every new table;
- allow authenticated staff to select operational rows through current staff access checks;
- revoke authenticated insert, update, and delete grants;
- expose writes only through narrowly scoped transactional commands;
- use fixed-search-path `SECURITY DEFINER` RPCs with internal staff/admin checks where database commands require them;
- revoke RPC execution from `public` and `anon`;
- grant authenticated execution only for staff-callable commands;
- leave system reconciliation RPCs ungranted to authenticated users;
- keep service-role access server-only;
- validate project, work-item, subject, assignee, status, and row version inside the transaction;
- require model version 2 for normal replacement commands;
- reject edits to archived projects except an authorised restore flow;
- prevent a source key from creating duplicate live or historical items; and
- retain actor history when a portal account is later disabled.

Required indexes:

- open work by project and due time;
- open work by assignee and due time;
- actionable work ordered by priority and due time;
- one `OPEN` or `BLOCKED` item per non-null cadence `series_key`;
- operational state and wake time;
- project event history by newest first;
- confirmation history by project and type; and
- unique automated source key.

The migration should use partial indexes for `OPEN` and `BLOCKED` rows rather than indexing completed history as active work.

## 5. Transactional Commands

### Staff work-item commands

- create;
- complete;
- cancel with reason;
- reschedule;
- reassign or return to Project Owner;
- block with reason;
- unblock;
- set or clear Critical with reason; and
- reopen a completed or cancelled item with reason.

### Project-state commands

- move to Active;
- move to Waiting with wake time and reason;
- close with bounded outcome and optional note; and
- reopen as Active while preserving pipeline stage.

Archive and restore remain admin commands using the existing archive owner, updated to reconcile the effective operational projection atomically.

Admin-only calendar commands are a later coordinated Schedule integration. They add, correct, or remove a company closure or load a verified public-holiday year through the existing calendar owners. Calendar changes are audited and never silently reschedule existing work.

State-transition invariants:

- moving to Waiting is rejected while an actionable item remains unless the command explicitly cancels each affected item with a reason;
- closing or archiving explicitly cancels remaining open and blocked items in the same transaction and records an event for each;
- reopening does not silently revive cancelled items;
- reaching a Waiting wake time does not automatically activate the project; and
- no state command infers or rewrites pipeline stage;
- `COMPLETE` is rejected while authoritative commercial or delivery obligations remain; and
- any later admin override requires a reason and is visible in reconciliation history.

### Confirmation commands

- record bounded confirmation; and
- admin-only retract with reason.

Recording a cadence confirmation is one atomic command: append the confirmation, complete the matching current work item, cancel any superseded cadence item, and ensure the next item when applicable. It does not send the email or change pipeline stage. A cadence item cannot be completed through the generic work-item command without its required confirmation.

The API exposes semantic composite commands such as `RECORD_FIRST_ENQUIRY_EMAIL_SENT`, `RECORD_ENQUIRY_CUSTOMER_REPLY`, `RECORD_QUOTE_FOLLOW_UP_SENT`, and `RECORD_QUOTE_CUSTOMER_REPLY`. Each locks the project and cadence series, then commits one receipt covering confirmation and work-item events.

Retracting a confirmation does not reverse later lifecycle or commercial facts or restart a cadence. It raises an admin reconciliation result so the correction can be handled explicitly.

### Server reconciliation commands

- ensure one system item by source key;
- complete one system item after authoritative success;
- cancel one system item when no longer applicable;
- reschedule one system item from new authoritative evidence; and
- reconcile a project without performing the specialist-domain action.

Every command requires:

- a fresh command UUID;
- expected work-item or state `row_version` where a mutable row exists;
- a validated staff or system actor;
- one database transaction;
- a command receipt; and
- append-only events.

Stable API outcomes:

- `401` missing or invalid staff session;
- `400` invalid command or payload;
- `403` insufficient permission;
- `404` project or work item not found;
- `409` stale version or command-ID conflict; and
- `503` required authoritative owner or verified calendar unavailable; and
- `200` committed result, including idempotent replay.

Success means the database transaction committed. The response includes `replayed`, the new row version, the affected projection, and `refreshRequired` when another read model should be refreshed.

The receipt and all events commit in the same transaction as the state change. A failed handler leaves no success receipt, so retry cannot be skipped incorrectly.

### Hard side-effect boundary

A work-item, state, or confirmation command must not:

- send email;
- send, accept, revise, or decline a quote;
- mutate an invoice or payment;
- change Design;
- mutate Schedule;
- complete a Running Job;
- generate a PDF or customer artifact; or
- change pipeline stage unless the explicit lifecycle command owns that transition.

The specialist owner commits its fact first, then calls an idempotent reconciliation command.

## 6. Read Models And Routes

Implemented thin staff/admin routes:

- `GET /api/staff/v1/projects/{projectId}/work-items`
- `POST /api/staff/v1/projects/{projectId}/work-items/commands`
- `POST /api/staff/v1/projects/{projectId}/state/commands`
- `POST /api/staff/v1/projects/{projectId}/confirmations/commands`
- `GET /api/staff/v1/work-items/queue`
- `POST /api/admin/project-work/confirmations/correct`
- `POST /api/admin/project-work/confirmations/reconcile`
- `GET /api/admin/project-work/legacy-contacted`
- `POST /api/admin/project-work/legacy-contacted/{projectId}/migrate`

Staff routes use the current staff-session helper and auth-bound server client. The classifier, correction, and migration routes require admin context and still use the request's auth-bound client; database functions perform their own `is_portal_admin()` check. Browser code never writes directly to Supabase.

### Project work projection

The project projection returns:

- operational and effective archive state;
- Project Owner and effective work-item assignee;
- primary actionable work item;
- all open and blocked work items;
- recent work-item and confirmation events;
- specialist-domain primary candidate;
- recovery action;
- explicit exceptions;
- server revision and generated timestamp; and
- freshness or unavailable state for each partial owner.

### Team queue projection

The company queue returns at most one current action per project, grouped as:

1. Overdue
2. Today
3. Next seven business days
4. Blocked
5. Needs triage

Waiting, Closed, and Archived projects are excluded unless their wake condition is now due or the user explicitly requests history.

When a Waiting wake time arrives, the state remains Waiting and the server exposes `Review waiting project` as its state-owned action. Staff deliberately choose Active, a new Waiting date, or Closed; time passing does not silently change project state.

`project_work_queue_v3()` returns durable repair, work-item, blocked, Waiting-review, and triage candidates plus optimistic row versions and effective responsibility. Repair rows include the exact repair-signal ID and row version; confirmation reconciliation must use both and may update only that signal. `teamQueue.ts` composes that batch read with direct marker inventory, direct operational-state reads, and the same canonical quote/estimate specialist selectors used by project-specific reads, without assembling lifecycle or commercial truth in the browser. The full route groups Overdue, Today, Next seven business days, Blocked, and Needs triage; the Dashboard receives only a bounded preview. Far-future-only projects remain out of the operational surface.

Queue work-item rows expose the existing semantic commands: Email sent, Customer replied, Complete, reassign, reschedule, block, and unblock. Commands preserve one stable attempt ID, reject duplicate in-flight submission, show success only after durable confirmation, and invalidate queue, Dashboard, project snapshot, summary, and Command Centre reads after acceptance.

### Primary-action precedence

Across work and specialist domains:

1. safe recovery for an incomplete authoritative command;
2. Critical, overdue, or due-today work item;
3. ready action declared by the current specialist domain;
4. earliest future work item; and
5. Needs triage.

Within actionable work items:

1. Critical;
2. overdue;
3. due today;
4. earliest future due time; and
5. oldest creation time as a deterministic tie-break.

A blocked item is an exception, not an enabled primary action.

### Compatibility projection

Existing consumers of `projects.next_action`, `next_action_type`, `next_action_at`, `next_action_date`, and `follow_up_date` include Projects, the legacy Dashboard snapshot RPC, project snapshots, and Schedule paths. Dashboard application responses no longer expose the RPC's legacy action aggregates or old queue rows. Removing that remaining server-side snapshot dependency requires a forward migration rather than editing applied SQL.

During migration:

- the new server projection is authoritative;
- a one-way adapter updates compatibility fields from the new primary work item in the same transaction as each accepted new-model command;
- legacy fields never create or update a new work item;
- no bidirectional dual-write is introduced; and
- the columns remain until all consumers are migrated and a separate retirement check is approved.

For a model-version-2 project, every legacy generator, trigger, route, and code-defined candidate path must skip or reject the project. For an unmarked project, the new model remains shadow-only. There is no project for which both writer sets are authoritative.

Exact compatibility mapping:

- `next_action` = primary work-item title;
- `next_action_at` = primary work-item `due_at`;
- `next_action_date` and `follow_up_date` = the Auckland local date of `due_at`;
- `next_action_type` = null for a new work item unless a specialist candidate maps losslessly to an existing supported type; and
- all five fields = null when there is no actionable primary work item.

An email item is never projected as legacy `call`, and Site Visit is never projected merely to satisfy the old enum.

Specialist mutations must invalidate or refresh the unified project projection through `projectWorkCache.ts`; complete command-centre response patches must use its sole `patchProjectCommandCentreCache` owner rather than a caller-local `setQueryData`.

## 7. Auckland Business Calendar

Create one server-owned business-calendar module:

- IANA zone `Pacific/Auckland`, so NZST and NZDT are handled correctly;
- Monday-Friday, 9:00am-5:00pm;
- New Zealand national holidays;
- Auckland regional holidays;
- recorded full-day company closures; and
- no half-day rules in version one.

Rules:

- the first personal lead email is due after two open business hours;
- its SLA breach is after four open business hours;
- time outside opening hours resumes at the next opening;
- date-based reminders are due at 5:00pm on the calculated business day;
- all persisted instants are UTC;
- calendar changes do not silently move existing items;
- a reschedule is explicit and audited; and
- if the required calendar cannot be resolved, create a visible recovery exception rather than guessing a weekday-only result.

Focused tests must cover Auckland daylight-saving boundaries, holidays, closures, Friday evenings, weekends, and enquiries received just before closing.

"Five business days later" means the next five open local business dates, excluding the local occurrence date, with the deadline at 5:00pm on day five. A quote resend recomputes:

```text
minimum(resend + five business dates, last open business date on or before expiry)
```

The created or rescheduled item records the calendar revision and deadline policy used.

## 8. Cadence State Machines

Each state machine uses stable source keys and ensures only one open cadence item at a time.

For staff, `Email sent` and `Customer replied` are single commands rather than a checkbox followed by separate task editing. The email itself remains manual and external to the portal.

Cadence creation consumes authoritative server evidence only:

- the accepted-enquiry server owner ensures the lead item after the project is durable;
- the public enquiry request cannot call staff work-item commands directly;
- the quote server owner reconciles only after durable send finalisation; and
- if cross-owner reconciliation fails after the authoritative fact commits, a durable recovery result supports idempotent retry.

Public-token and browser code cannot invoke system reconciliation.

### Approved lead cadence

Series key: `lead:{projectId}:v1`.

| Event | Result |
| --- | --- |
| Valid enquiry accepted | Existing automatic autoresponder; ensure `lead:first-email:{projectId}:v1` |
| First email recorded sent | Complete first item; if no reply, ensure `lead:follow-up:{projectId}:v1` for five business days later |
| Customer reply recorded | Cancel any pending lead-cadence item |
| Follow-up recorded sent | Complete follow-up; if no reply, ensure `lead:close-review:{projectId}:v1` for five business days later |
| Close review reached | Staff explicitly chooses Active work, Waiting, Closed, or valid archive via the owning command |
| Authoritative progress makes enquiry follow-up obsolete | Cancel the pending lead cadence without creating another item |

No call, second follow-up, automatic close, or automatic stage change occurs.

### Approved quote cadence

Series key: `quote:{quoteVersionId}:v1`.

| Event | Result |
| --- | --- |
| Current quote durably finalised as Sent | Ensure `quote:follow-up:{quoteVersionId}:v1` |
| Delivery is prepared, failed, uncertain, or unfinalised | Do not start cadence; expose commercial recovery |
| Quote follow-up recorded sent | Complete follow-up; ensure `quote:outcome-review:{quoteVersionId}:v1` for first business day after expiry |
| Accepted, declined, replied, or superseded | Cancel open cadence item |
| Same-version resend before follow-up completion | Reschedule the same item five business days from durable resend |
| Same-version resend after follow-up completion | Do not restart cadence |

The follow-up is due at 5:00pm on business day five, or the last business day on or before an earlier expiry. There is one follow-up only. Expiry never automatically declines the quote or closes the project.

The quote cadence was approved on 2026-07-29.

## 9. Legacy Classification

| Legacy item | Treatment |
| --- | --- |
| `call_enquiry` | Replace with first-email item for post-cutover leads only; no backlog creation |
| `call_again_later_contacted` | Retire; classify backlog first |
| Any `FOLLOWUP_CALL` | Retire |
| `FOLLOWUP_EMAIL` | Import only after evidence confirms it is a real approved-cadence obligation |
| `book_site_visit`, `BOOK_SITE_VISIT`, `ATTEND_SITE_VISIT` | Retire and hide; optional manual Site Visit confirmation only |
| `generate_costing` | Calculator/estimate-domain action, not a work item |
| `create_quote`, `FINALIZE_SEND_QUOTE` | Commercial-domain action, not a work item |
| `CREATE_DESIGN_PACKAGE` | Design-domain action, not a work item |
| `invoice_paid` | Invoice/payment truth |
| `schedule_install`, `confirm_schedule`, Schedule variants | Schedule V2 truth |
| `order_materials`, `roofing_ordered` | Move to audited Running Jobs-owned fields; never import as work items |
| `job_complete` | Schedule V2 actual-finish truth |
| `RESEND_EMAIL` | Delivery-recovery exception owned by the sending domain |
| completion-photo variants | At most one reviewed Operations work item |
| open Stage-2 manual actions | Import only if due-dated, active, and confirmed as a genuine human obligation |
| completed legacy checks | Retain as read-only history; do not create completed new items |
| action controls, selections, and action versions | Do not migrate; retain Critical reason only when its item is deliberately imported |

### Running Jobs prerequisite

`materials_ordered` and `roofing_ordered` are editable Running Jobs facts currently persisted through `project_task_checks`. Before a model-version-2 project can stop using that table:

- add Running Jobs-owned `materials_ordered_at/by` and `roofing_ordered_at/by` fields plus a row version to `project_running_job_meta`;
- backfill the two facts from the corresponding legacy checks, preserving available actor and occurrence time;
- route set/clear commands through the Running Jobs API with audit and optimistic concurrency;
- switch Running Jobs, project snapshot, and task-presentation consumers to the specialist fields; and
- suppress the matching code-defined stage checks for model-version-2 projects.

`job_complete` moves to Schedule V2 actual-finish truth, not Running Jobs metadata. This prerequisite changes no costing, geometry, or workbench boundary.

## 10. Contacted Backlog Plan

Read-only authenticated baseline on 2026-07-29:

- 623 active Contacted projects;
- 57 with legacy `follow_up_date` due by that date;
- 56 overdue;
- 1 due that day; and
- 36 separately archived Contacted projects.

Limitations:

- `follow_up_date` is a compatibility field, not evidence of an unanswered email;
- the repository lacks reliable structured history for manually sent lead emails and replies; and
- the aggregate list view cannot safely distinguish future dates from missing dates for the remaining 566 without exposing or inspecting individual customer data.

Therefore:

- create no new tasks for all 623;
- close or archive none automatically;
- review the 57 due projects first;
- keep the other 566 outside the new queue until evidence or a staff decision gives them a genuine item, Waiting date, Closed outcome, or archive reason; and
- treat the 36 archived records as a separate administrative population.

The read-only `project_work_classify_legacy_contacted_v1()` report returns aggregate counts, project identity, follow-up timing, bounded reason codes, boolean domain evidence, and one opaque evidence fingerprint to an admin-only review surface. The fingerprint is produced by the internal-only `project_work_legacy_contacted_evidence_v1()` helper from normalized project stage/follow-up/archive/model state and the sorted identities/status or completion fields actually used from quote versions, deposit invoices, design requests, scheduled jobs, Running Jobs metadata, tasks, follow-ups, and manual actions. Raw Running Jobs notes contribute only through a SHA-256 digest. The helper is revoked from public, anonymous, authenticated, and service-role callers. The report deliberately omits linked customer email, phone, address, attachments, and message content. That data must not be added to logs, screenshots, fixtures, or planning artifacts.

The report must use positive evidence and label recommendations rather than making decisions:

| Evidence | Review recommendation |
| --- | --- |
| Current quote, invoice, Design, Schedule, Running Job, or genuine open obligation | Review as Active and correct a stale pipeline stage separately if needed |
| Explicit future follow-up date but no current obligation | Waiting candidate; staff must supply the reason and confirm the wake date |
| Due follow-up, evidence that a personal email was sent, and no response or downstream progress | `Lost - No response` candidate; staff must confirm |
| Duplicate, test, invalid, or broken import evidence | Keep outside this migration command for a separate explicit archive review |
| Missing outreach evidence, conflicting evidence, or insufficient evidence | Needs manual classification |

Review in bounded batches, beginning with the 57 due projects, but commit only one project at a time. `project_work_migrate_legacy_contacted_v1()` requires optimistic `expected_updated_at` and `expected_evidence_fingerprint` values, a stable command ID, reason, and one explicit disposition: Active with one real work item, Active Needs triage, Waiting with a future wake time, or Closed with a bounded loss/cancellation outcome. After its project advisory and row locks, it recomputes the same fingerprint and rejects any mismatch before establishing model version 2, state, audit, optional work, and compatibility projection. It never archives, starts the new-lead email cadence, accepts all recommendations, or contacts a customer.

This is a deterministic optimistic boundary, not broad serialization of every legacy evidence writer. It observes all related commits visible when the fingerprint verification statement begins. A related writer that does not share the project advisory lock could still commit after verification and before migration commit. Closing that residual window requires every related writer to participate in the same project lock or invasive table/trigger coordination; broad locking is deliberately outside this slice.

## 11. Cutover Releases

### A. Hidden foundation

Repository status: the foundation is implemented in staging and production. Exact `20260729_000002`/`000003`/`000004` files are present in production following the controlled 2026-07-30 apply; postflight proved the catalog, RLS, grants, relationships, ready empty queue, and zero markers, operational states, work items, work-item/state events, confirmations, command receipts, or repair signals. The Contacted classifier remains read-only until explicitly invoked, and applying its definition did not seed or change projects.

- Add tables, checks, indexes, RLS, commands, repositories, read models, and tests.
- Add the per-project work-model marker and make legacy generators/projections respect it.
- Produce a read-only operational-state seed preview; do not mark existing projects yet.
- Keep all existing readers and writers active.
- Do not expose new UI.

### B. Cutover-ready integration

Repository status: implemented for new-project V2 activation, including the approved quote adapter. The command lifecycle was exercised against a disposable staging project; production verification remains intentionally read-only until ordinary staff creation supplies the first real V2 project.

- Wire the approved lead cadence, manual commands, confirmations, current-presentation adapter, and compatibility projection behind a server cutover control.
- Exercise them with fixtures and local authenticated QA only.
- Keep production writers unchanged during shadow verification.
- Wire the quote adapter only if its cadence is separately approved.

### C. Shadow comparison

Repository status: the bounded classifier and review surface are implemented locally. No Contacted project has been changed by repository implementation and no bulk comparison or decision exists.

- Classify unmarked Contacted projects read-only from positive operational evidence.
- Report aggregate counts and bounded reasons without linked customer contact fields.
- Verify that the new system creates no duplicate source keys and no specialist-domain copies.
- Do not auto-correct projects.

### D. Controlled writer and reader switch

Repository status: wired for projects initialized as V2 after the migration is applied. No existing project is switched by the current migration.

- Mark each approved project cohort as model version 2 in the same transaction as its initial new state and work.
- Start the approved lead cadence only for valid post-cutover enquiries.
- Route new manual project obligations and confirmations through the new commands.
- Stop creating call and Site Visit items.
- Enable the one-way compatibility projection.
- Import only approved open obligations.
- Switch the current task presentation, Command Centre, Projects, and Dashboard through compatibility adapters.
- Use the approved mixed-model Overview V2 composition governed by `project-command-centre-architecture.md`.
- Hide the unused Site Visits navigation entry and prevent project work-item links to it, while leaving the route and data owner dormant.
- Run Contacted review as a separate admin workflow, one reviewed project per command.
- Enable the quote adapter only if its cadence was separately approved.

### E. Freeze legacy

Repository status: legacy inserts and updates are rejected for V2 projects, while unmarked projects remain on the legacy model. This is cohort isolation, not broad legacy freeze or retirement.

- Revoke legacy browser and route writes.
- Retain legacy rows read-only for at least one release and a defined reconciliation window.
- Repair only through the new command owner.

After new-writer cutover, rollback may return readers to the previous display but must not re-enable legacy writers.

### F. Retire proven legacy

Repository status: not started. Compatibility and legacy owners remain required for existing projects.

- Remove unused task generators, browser CRUD, primary-selection machinery, and compatibility adapters only after consumer searches and reconciliation pass.
- Drop tables or columns only in a later explicit forward migration.
- Run strict dead-code and architecture checks for the retirement change.

There is no permanent dual-write phase.

## 12. Reconciliation Invariants

A server-owned report must check:

- every Active, non-archived project has work, a specialist action, an explicit blocker, or Needs triage;
- every unclassified legacy project is isolated in the admin backlog, with its count moving toward zero;
- Waiting projects have a reason and future wake time;
- Closed and Archived projects do not appear in current-work queues;
- automated source keys are unique;
- no lead or quote cadence has more than one open item;
- no call or Site Visit booking/attendance item is created after cutover;
- blocked items do not become enabled primary actions;
- compatibility fields match the new primary projection;
- completed work did not independently mutate specialist domains;
- quote cadence begins only after durable send evidence;
- accepted, declined, replied, or superseded quotes have no open cadence;
- all commands have receipts and append-only events;
- no browser or public-token path can invoke service-role reconciliation; and
- import counts equal reviewed decisions.

Failures are visible diagnostics. Reconciliation must not silently close projects, send messages, record payments, or change pipeline stages.

## 13. Code Ownership

Create a named server domain rather than expanding existing hotspots:

The migration's atomic SQL commands are the sole durable owner of business-calendar calculation and cadence transitions. TypeScript converts Auckland dates for presentation and calls the commands; it must not reimplement a second cadence planner.

```text
apps/portal/lib/projects/workItems/
  types.ts
  businessCalendar.ts
  repository.ts
  teamQueue.ts
  effectiveAssignee.ts
  commands.ts
  client.ts
  modelBoundary.ts
  primaryAction.ts
  domainActionAdapters.ts
  quoteCadenceReconciliation.ts
  routeSupport.ts
  stableCommandAttempt.ts
  systemCommandId.ts
  legacyTriage/
    types.ts
    validation.ts
    repository.ts
    commands.ts
    client.ts
```

Responsibilities:

- `types.ts`: bounded contracts only;
- `businessCalendar.ts`: presentation-only Auckland local-date conversion;
- `repository.ts`: auth-bound project projection reads;
- `teamQueue.ts`: batch team-queue composition and the only staff-wide specialist overlay;
- `effectiveAssignee.ts`: shared Project Owner/work-item assignee fallback;
- `commands.ts`: typed staff/admin/system RPC adapters for work items, state, confirmations, archive, reconciliation, and specialist facts;
- `client.ts`: browser transport only;
- `modelBoundary.ts`: server-side V2 marker check for mixed-mode callers;
- `primaryAction.ts`: the only cross-domain ranking owner;
- `domainActionAdapters.ts`: read-only specialist action candidates;
- `quoteCadenceReconciliation.ts`: server-only quote lifecycle adapter with deterministic command identity and explicit repair status;
- `routeSupport.ts`: shared staff-route validation and stable error mapping;
- `stableCommandAttempt.ts`: preserves one browser command UUID for the same ambiguous retry intent and clears it only after confirmed commit or an edited intent; and
- `systemCommandId.ts`: deterministic server reconciliation command IDs; and
- `legacyTriage`: admin-only classifier, guarded one-project migration, confirmation correction transport, validation, and stable error mapping.

The SQL command owner stores append-only confirmation evidence and exposes the per-project admin integrity report. `project_confirmation_retraction_command()` appends the correction, stores an idempotent receipt, and opens a `CONFIRMATION_RETRACTION_REVIEW` repair signal. `project_confirmation_retraction_review_command()` requires the exact signal ID, expected signal row version, stable command ID, and a second admin reason. It locks and resolves only that row, rejects stale or already-resolved metadata, and appends an audit event without changing lifecycle or commercial state. Neither command deletes the original assertion, restarts cadence, or automatically rewinds later facts. The Contacted classifier remains a read model, not another browser-side source of truth.

Thin routes validate transport shape, require staff/admin context, call one owner, and map stable errors. They do not derive lifecycle or commercial truth.

Staff routes use auth-bound adapters. System reconciliation uses a separate server-only adapter and is not reachable from browser, authenticated RPC grants, or public-token routes.

Files that should not grow:

- `ProjectTasksSidebar.client.tsx`;
- `pipelineDefinition.ts`;
- `AutomationRunner.ts`;
- `taskPersistence.ts`;
- the Stage-2 command route and SQL RPC;
- `actionResolver.ts`;
- `getProjectCommandOperations.ts`; and
- `getProjectCommandExceptions.ts`.

The current duplicated operation and exception derivation should collapse behind `primaryAction.ts` and the unified project projection. `pipelineDefinition.ts` becomes stage metadata only after task cutover. Legacy automation task handling is shrunk and then retired rather than expanded.

Route-owned presentation may adapt the new read model temporarily. Durable types, calendar rules, ranking, cadence, and commands remain reusable server-domain owners. No second client-side project-state source is created.

Overview V2 keeps that boundary through the five required top-level owners (`ProjectOverviewLayout`, `ProjectOrientationBand`, `ProjectWorkSection`, `ProjectWorkList`, and `useProjectWorkCommandController`) plus extracted subordinate owners: `ProjectWorkControls` for V2 mutation-control presentation, `useLegacyProjectWorkCommandController` for legacy stable command/cache orchestration, `LegacyProjectWorkConflict` and `LegacyProjectWorkHistory` for legacy conflict/audit presentation, and `projectWorkVisibilityPolicy` for the shared fail-closed Call/Site Visit filter. Cache patching and invalidation stay in `projectWorkCache.ts`, with `patchProjectCommandCentreCache` as the sole complete response patch owner. These presentation owners may arrange or format supplied facts and dispatch existing commands; they may not rank candidates, create replacement legacy work, infer lifecycle/readiness/commercial state, or add a second cache owner.

## 14. Verification

### Unit and component

- business-calendar and daylight-saving boundaries;
- target and SLA calculations;
- ranking and deterministic tie-breaks;
- lead and approved quote cadence transitions;
- cancellation and same-version resend rules;
- stale-version rejection and idempotent replay;
- blocked, Waiting, Closed, and Archived exclusion;
- compatibility projection; and
- current task presentation adapter states.

### Database and route contracts

- constraints, RLS, grants, and denied direct writes;
- staff versus admin permissions;
- command receipt intent conflicts;
- append-only event and confirmation history;
- confirmation correction requires admin, reason, exact original event, one retraction, receipt replay, and a visible repair signal; review resolution requires that exact signal ID/version and cannot clear a newer signal;
- concurrent completion/reschedule conflicts;
- source-key uniqueness;
- classifier reads omit linked customer contact fields and cannot mutate;
- reviewed migration enforces Contacted/unmarked/current-update and evidence-fingerprint preconditions, one project, valid disposition evidence, and no cadence seed;
- stable error mapping; and
- auth-bound client usage with no service-role reachability.

### Domain boundaries

- quote preparation/failure cannot start cadence;
- durable quote send can reconcile exactly once;
- acceptance, decline, reply, and revision cancel exactly once;
- work-item completion cannot mutate quote, invoice, payment, Design, Schedule, or Running Jobs;
- specialist success can complete its related item only after commit; and
- failed reconciliation remains safely retryable.

### Fixtures and authenticated QA

Fixtures should cover:

- new enquiry during and outside business hours;
- first email due, SLA missed, replied, followed up, and close review;
- active, Waiting, Closed, and Archived;
- Critical, overdue, today, future, blocked, and Needs triage;
- quote sent, delivery failed, expired, accepted, declined, replied, resent, and superseded;
- missing owner, unavailable specialist data, stale read model, conflict, retry, and replay; and
- legacy-import preview with zero automatic customer-data changes.
- one-project Contacted migration dispositions, stale-review rejection, replay, and no automatic first-email work.

Run desktop, tablet, narrow/mobile, keyboard, focus, screen-reader, loading, error, stale, and conflict checks on the full Work Queue, its Dashboard preview, and the admin legacy-review surface. This is regression verification, not approval to redesign the Overview.

### Repository gates

At rollout handoff, run the focused tests plus:

- worktree ownership status;
- docs guard and impact checks;
- changed-file service-role and browser-Supabase guards;
- migration and generated-type checks;
- architecture changed;
- dead-code changed for retirement work;
- TypeScript and lint gates required by `testing-and-qa.md`; and
- focused authenticated Playwright QA.

## 15. Implementation Options

### Option A - Compatibility-first

Build the foundation and compatibility projection, then keep legacy readers for longer.

- Benefit: lowest visible disruption.
- Risk: competing derivations live longer.
- Maintainability: acceptable only with a fixed removal checkpoint.

### Option B - Coherent foundation slice (recommended)

Build the schema, commands, calendar, approved lead writer, confirmation model, primary-action projection, compatibility adapter, current-presentation adapter, and reconciliation report together.

- Benefit: new truth is coherent from first writer to current UI.
- Risk: larger review and test surface.
- Maintainability: strongest safe first step; it removes the need to add more logic to legacy hotspots.

The Contacted backlog review remains a separate admin-only migration operation. The approved quote adapter is included only when application implementation is authorised.

### Option C - Full replacement plus task UI

Add the foundation, cut over all readers, process backlog, retire legacy, and design a new task presentation in one release.

- Benefit: fastest visible end state.
- Risk at the time: combined data migration, behavioural change, and then-unapproved UI decisions.
- Maintainability: clean destination but unnecessarily risky now.

## 16. Implemented V2 Slices

The current worktree implements the approved Option B foundation plus the Work Queue and guarded-review slice, ending before broad existing-project migration and legacy deletion:

1. forward schema and RLS;
2. transactional commands and append-only audit;
3. Auckland calendar;
4. post-cutover lead cadence only;
5. manual confirmations;
6. server-owned ranking and project projection;
7. Running Jobs ownership for materials- and roofing-ordered facts;
8. one-way `next_action*` and `follow_up_date` compatibility;
9. adapters for the approved Overview V2 composition governed by `project-command-centre-architecture.md`;
10. server-only quote send/outcome reconciliation with durable repair signals;
11. Schedule V2 completion/readiness ownership and Running Jobs-owned materials/roofing facts;
12. admin-only archive/restore commands; and
13. full Work Queue plus a compact Dashboard preview, with personal reminders kept separate;
14. admin-only append-only confirmation correction and explicit recovery review;
15. no-contact-field Contacted classification and one-project-at-a-time reviewed migration; and
16. focused static, unit, component, route, and boundary tests.

The foundation and exact reviewed `20260729_000002`/`000003`/`000004` files are applied in staging and production. Readiness, rollback rehearsal, schema/body verification, anonymous-access checks, the authenticated GET-only Work Queue plus legacy-project read smoke, and the disposable staging new-V2-project command smoke pass. Production postflight retained zero V2 markers, states, work, events, confirmations, receipts, or repair signals at the 2026-07-30 cutover check, so no pre-cutover project crossed models and no backlog decision was invented. The slice establishes the repository write-to-read boundary, cache coherence, stale/read-only behavior, idempotent command replay, supported archive cleanup, and safe review tooling while leaving reviewed existing-project migration, automatic backlog decisions, old-table deletion, and calendar expansion outside rollout.

## 17. Current Schedule And Parallel-Work Boundary

The Schedule and work-items integration is now present in the same worktree, but it is not deployment evidence. Schedule V2 remains authoritative for install assignment, readiness, actual start, and actual finish. Running Jobs owns materials- and roofing-ordered facts for V2. Site Visits is hidden from normal navigation, remains directly reachable as dormant Schedule-owned code, and is not linked from project work; the optional V2 completion confirmation is manual and has no stage or Schedule side effect.

Further work may proceed in parallel only with explicit non-overlapping ownership. A Schedule lane and a work-items lane must not concurrently edit the same Schedule read/write adapters, Running Jobs contracts, project snapshot, command-centre projection, migration, or canonical docs. Safe isolated work includes:

- read-only review and test planning;
- pure work-items unit tests that do not change shared contracts;
- read-only analysis that does not operate the Contacted migration command; and
- documentation that does not conflict with an active Schedule owner.

Before enabling V2 in any additional environment, integrate both lanes, run the cross-domain Schedule/Running Jobs/project regressions, and prove the migration against a disposable or positively identified database. Existing projects and the 623-project Contacted population remain outside this activation.

Migration and application deployment use one short controlled window. Constrain new project/enquiry creation and quote lifecycle mutations until both are live and the integrity smoke passes: deploying the application first makes new staff project creation fail closed, while applying the migration first can activate new marketing projects before the application adapters are available.

`CLOSE` with outcome `COMPLETE` now checks Schedule V2 actual-finish evidence and the accepted-quote/deposit commercial blockers. Lost and Cancelled outcomes remain separate. Do not reintroduce generic task mirrors for these specialist facts.

## 18. Workbench And Costing Boundary

- Applicable legacy-cull row: N/A.
- Relationship to workbench legacy: neither removes nor builds on it.
- Explicit workbench approval required: no.
- Phase 2 costing-input dependency: none.

No design-workbench, geometry, calculator-input, or costing-source boundary changes are proposed.

## 19. Production State And Remaining Decisions

Production is positively identified as Supabase project
`iytanftukulcnavossmd`. Portal release merge `c9e73651` was deployed first, then
the three original exact SQL files were applied individually in one controlled
2026-07-30 window after a completed physical backup was confirmed. Snapshot-cache
hotfix merge `809f2c5e` followed. `db push`, `migration up`, and migration repair
were not used, and the colliding `20260729` ledger state remains untouched.
Authenticated read-only verification proved a ready empty Work Queue and
matching legacy snapshot/Command Centre reads. Catalog postflight proved all
nine V2 tables with RLS, authenticated-only queue execution, anonymous denial,
and zero markers, operational states, work items, work-item/state events,
confirmations, command receipts, or repair signals at the cutover check. No
pre-cutover project was migrated or backfilled, and no customer, commercial,
Schedule, task, or payment data was changed.

The following remain controlled follow-up rather than launch blockers:

- observe the first naturally created V2 project and its server-owned first work
  item without manufacturing production QA data;
- require explicit approval and unchanged reviewed evidence for every individual
  existing-project cutover;
- extend verified Auckland calendar coverage before a deadline can cross beyond
  2027;
- retire legacy readers and tables only after a later focused reconciliation
  window; and
- keep any Overview expansion beyond the approved handover under a separate
  product and owner contract.

The approved Project Overview redesign is governed by
`project-command-centre-architecture.md` section
`Approved Overview V2 Implementation Handover (READ FIRST)`.
