# Project Work Items And Lead Follow-Up

Status: Approved product contract. The Project Work foundation and portfolio rollout migration `20260731000002_project_work_portfolio_rollout.sql` are deployed. Application consumers and authenticated read-only production verification are complete through postflight `6832a9dd`.

Current repository follow-up: the Pipeline Accountability slice adds the forward, read-only `20260731000003_project_pipeline_accountability_reads.sql` contract. It makes Project Owner filterable before Projects pagination, adds page-scoped authoritative next-action summaries, adds search/owner/stage/When filtering to the full Work Queue, aligns Dashboard's compact preview to the same owner/action/reason/timing language, and makes every stage correction explicit about Project Work recalculation. The exact file is applied only in positively identified staging; production is not upgraded. Anonymous readiness and authenticated read-only staging checks prove the 11-project V3 index, unassigned-owner filter, state context, and nine-row queue without writing project or customer data.

Purpose: define the project-work model, email-only lead cadence, pipeline disposition rules, and legacy-task retirement boundary, and record the controlled rollout state.

This document is intentionally UI-agnostic. The Project Overview redesign is now separately approved and governed by `project-command-centre-architecture.md` section `Approved Overview V2 Implementation Handover (READ FIRST)`.

## Current Repository State

The current change set completes the portfolio-wide V2 model:

- a new staff-created project is created through `project_create_v2`;
- browser project creation reaches that command only through the authenticated staff API; the former direct table-insert helper is retired;
- a newly created `New` project linked by its intake enquiry is initialized as V2; the trigger's narrow creation-time check prevents an old project from being activated by a later enquiry row;
- initialization records `Active` state and one first-email obligation, due after two Auckland open hours with a separate four-hour SLA;
- a missing contact email blocks that first obligation until the email is supplied;
- lead and quote cadences advance only from durable domain evidence or an explicit staff confirmation;
- the Overview consumes one server projection through one Project Work region while preserving the current portal visual system;
- every existing project receives a V2 marker/state at one fixed rollout timestamp and behaves as if it just entered its stored stage;
- `New` uses the existing lead initializer; later non-terminal stages receive one five-business-day stage review when no stronger current work exists; `Paid` becomes `Closed - Complete`; Archived receives no active work;
- a future stage change replaces only prior `STAGE_REVIEW` work and preserves cadence, commercial, design, confirmation, and specialist facts;
- Call and Site Visit work items are absent; stage-aware Site Visit guidance is a server-owned specialist candidate, never a stored task;
- the staff-wide Work Queue and Dashboard preview consume one server-composed current row per project, and the full queue is searchable/filterable by effective owner, detailed stage, and urgency before it is paged without truncating the portfolio;
- marker inventory, operational state, and project enrichment are direct bounded reads rather than fragile embedded PostgREST relationships; full-portfolio state, commercial-candidate, and relevant-confirmation inventories begin concurrently, then filter through authoritative active-state IDs; missing or truncated authoritative inventory fails closed;
- Overview, snapshot, summary, Work Queue, and Dashboard cache changes run through `projectWorkCache.ts`: V2 projection fan-out has one helper, `patchProjectCommandCentreCache` is the sole complete command-centre response patch owner, and one invalidator refreshes every Project Work consumer after accepted commands;
- cached or background-refresh-failed Project Work is visible but read-only, while an unavailable V2 contract fails closed as a named not-ready state;
- normal work-item commands are available from the queue, while personal Dashboard reminders remain separate;
- admins can retract an incorrect confirmation without deleting its history;
- Site Visits is hidden from normal navigation and stays outside work items; the shared server ranking can route `Contacted` and `Site Visit` projects to the retained booking/confirmation workflow, while the completion fact remains separate and manual; and
- Schedule, Running Jobs, quotes, and invoices retain their specialist source-of-truth boundaries; and
- legacy task/follow-up/action rows remain only as guarded audit/rollback evidence, with product readers, writers, actions, routes, and navigation retired.

Migration `20260729_000002_project_work_items_v2.sql` was applied in staging on 2026-07-29. The first rehearsal exposed a hosted PostgREST schema-cache miss for its new marker/state tables, so project-detail reads failed before legacy/V2 classification. All queue classifiers now use direct server-owned marker/state reads. On 2026-07-30 the exact reviewed `20260729_000003_project_work_items_v2_schema_cache.sql` and `20260729_000004_project_work_queue_and_legacy_triage.sql` files were each rehearsed in a rollback transaction and replay-applied to the positively identified staging project. Readiness passed before and after; catalog verification proved the two exact single cascade relationships, V3 queue and guarded classifier/migration bodies, authenticated-only execution, and denied anonymous execution. The authenticated GET-only staging smoke then returned `200` for Work Queue, a disposable synthetic legacy-project snapshot, and its Command Centre; the rendered states were fresh/ready, the legacy boundary was preserved, and every non-read browser request was blocked. The exact synthetic legacy project and contact were removed after that check.

The final command smoke then created one clearly labelled synthetic V2 project through the authenticated staff API. It proved server-confirmed creation, the initial `OPEN` first-email item at row version 1, a real `BLOCK` command at row version 2, and an exact same-command replay that stayed at row version 2 without a duplicate event. Supported V2 archive cleanup removed the project from active work and cancelled the item at row version 3 while preserving append-only audit evidence. Authenticated work-item, Work Queue, Command Centre, snapshot, integrity, and rendered Overview checks passed; the Overview reported Archived with zero open or blocked work. The synthetic QA role was restored to `staff`. No confirmation was recorded, and no email/outbox, quote, invoice, legacy task, follow-up, Site Visit, Schedule, Running Jobs, repair, or legacy-residue row was created. The archived synthetic project and contact remain intentionally as staging audit evidence because that V2 command smoke did not invoke the separate destructive admin project-delete route.

The earlier production cutover intentionally left pre-cutover projects unmarked, which is why Work Queue was ready but empty. The current rollout closes that adoption gap. Its forward migration uses one statement timestamp, deterministic source keys, project locks, a private project-independent cohort ledger, and one `PORTFOLIO_ROLLOUT_APPLIED` event per pre-rollout project. Every project present at that timestamp is processed once, including projects that already had a complete V2 marker/state pair, so its current saved stage receives fresh rollout timing without replaying on a later migration run. The ledger keeps replay closed even when the initial cohort was empty or its projects are later hard-deleted. Partial marker/state rows converge, active prohibited Call/Site Visit and `LEGACY_REVIEW` work is cancelled with audit evidence, and retired review work cannot be reopened or retyped through the generic command. A deferred project-insert invariant initializes projects created through retained import/bootstrap writers after their transaction's canonical initializer has had first ownership. The database rejects future prohibited work even when a caller bypasses the HTTP route, while cascade-aware guards preserve the existing admin hard-delete of a complete project graph. `staff_projects_index_v3`, `staff_project_state_counts_v1`, and the queue fail closed when any project is still missing its marker or state. V3 retains V2 as a compatibility reader and adds Project Owner plus Waiting/Closed context. A caller may reuse V3's proven active state only for an exact page-scoped queue read; the queue validates that subset and still runs the independent portfolio-completeness RPC.

Migration must precede the application release. The old deployed application can read V2 projects; the new application requires the portfolio invariant and new index/count RPCs. Presence of the migration file does not mean production is upgraded.

The business calendar has verified Auckland coverage for 2026 and 2027 only. Coverage must be extended before a V2 deadline can cross into 2028. The server Work Queue emits at most one current row per project and groups it as Overdue, Today, Next seven business days, Blocked, or Needs triage. Its repository pages the hosted durable RPC result in 1,000-row ranges and starts that read alongside strict portfolio completeness plus bounded active-state, non-archived commercial-candidate, and relevant-confirmation inventories. Full-portfolio composition filters the latter inventories through authoritative active-state IDs; project-scoped composition keeps V2-ID validation and bounded ID chunks. Every inventory fails closed at its explicit 5,000-row safety ceiling. Composition prefers durable recovery and urgent work, then the canonical specialist candidate, future work, and triage; the Dashboard shows only a compact preview and links to the full queue. Confirmation correction is append-only and always opens an explicit review signal rather than reversing later lifecycle or commercial facts.

## 1. Product Model

Keep three questions separate:

| Concept | Question it answers |
| --- | --- |
| Pipeline stage | Where did the project reach? |
| Project state | Is the project currently live? |
| Work item | What does a Sanctuary staff member need to do next? |

Pipeline inventory must not be treated as a task list. A project does not receive a task merely because it exists in a pipeline stage.

## 2. Journey Phases

Journey phases group the existing pipeline stages without replacing their underlying meaning.

| Journey phase | Pipeline stages |
| --- | --- |
| Enquiry | New, Contacted |
| Proposal | Site Visit, Quoting, Sent |
| Confirmed | Deposit |
| Delivery | Scheduled, Completed |
| Settled | Paid |

A project closed as lost retains the last pipeline stage it genuinely reached. For example, a project can remain at `Sent` while its project state records `Closed - Lost`.

## 3. Project States

### Active

Sanctuary is currently progressing the project.

An active project should have at least one of:

- one current staff work item;
- one authoritative specialist-domain action;
- one explicit blocker; or
- a `Needs triage` exception.

### Waiting

There is intentionally nothing to do until a chosen date.

Waiting requires:

- a wake-up date;
- a short reason; and
- the staff member who made the decision.

Waiting projects do not appear in the current-work queue until their wake-up date.

### Closed

The project is no longer active.

Supported outcomes should remain deliberately small:

- `Lost - No response`
- `Lost - Budget or price`
- `Lost - Chose another supplier`
- `Lost - Timing or project deferred`
- `Lost - Not suitable or out of scope`
- `Cancelled`
- `Complete`

Closing is a deliberate staff action. For a structured `Lost` outcome, the selected outcome is the business reason and no duplicate free-text reason is required; staff may add an optional note when useful. The server records a neutral outcome-derived cancellation explanation for any remaining open work. `Cancelled`, `Complete`, and `Waiting` retain their explicit reason requirements. The proposed lead cadence never closes a project automatically.

A later customer response may reopen the project as Active. Reopening preserves the last pipeline stage it genuinely reached.

### Archived

Archive is administrative housekeeping only:

- duplicate;
- test record;
- invalid record; or
- imported record that should not remain operationally visible.

Archive must not be used as a synonym for a lost opportunity.

## 4. Email-Only Lead Cadence

Sanctuary starts lead communication by email. The proposed task system must not create call tasks or use calling as an automatic fallback.

Except for the existing autoresponder, every customer communication and closure decision is manual.

### Business calendar

All lead-service calculations use:

- `Pacific/Auckland` local time, including New Zealand daylight-saving changes;
- Monday to Friday, 9:00am to 5:00pm;
- New Zealand national and Auckland regional holidays;
- recorded company closures; and
- no half-day calendar rules in the first version.

The personal-email target is two open business hours after enquiry receipt. The maximum service deadline is four open business hours after receipt. Time outside business hours starts or resumes at the next opening time.

Date-based follow-up and review reminders are due at 5:00pm on the calculated business day. Calculated timestamps are stored as UTC instants. A later calendar edit does not silently move an existing work item; any change is an explicit audited reschedule.

"Five business days later" counts the next five open business dates and excludes the date on which the preceding email was sent.

### Step 1 - Autoresponder

- Sent immediately after a valid enquiry is accepted.
- Automatic.
- Confirms receipt only.
- Does not mark the project as Contacted.
- Does not create multiple future follow-up tasks.

### Step 2 - Personal Staff Email

- Target: two Sanctuary business hours after receipt.
- Maximum service deadline: four Sanctuary business hours after receipt.
- Sent manually by staff.
- The work item is `Send first enquiry email`.
- Its normal due time is the two-hour target and its separate SLA breach time is the four-hour maximum.
- Staff records completion only after the email has actually been sent.
- The project may then be deliberately marked Contacted.

### Step 3 - One Follow-Up

- Created only after the personal staff email is recorded as sent.
- Due at 5:00pm five business days later.
- Created only if the customer has not responded.
- The work item is `Send enquiry follow-up email`.
- Staff sends the email manually.
- There is no second follow-up.

### Step 4 - Close Review

- Created only after the follow-up email is recorded as sent.
- Due at 5:00pm five business days later.
- Created only if the customer has not responded.
- The work item is `Review unresponsive enquiry`.
- Staff manually chooses whether to:
  - close as `Lost - No response`;
  - keep active and create a new work item;
  - move to Waiting with a wake-up date; or
  - record another appropriate outcome.

The reminder itself never closes the project.

### Cadence Summary

```text
Autoresponder immediately
        |
Manual staff email: target 2 business hours, maximum 4
        |
One manual follow-up: 5 business days later
        |
Manual close review: 5 business days later
```

Only one lead-cadence work item is open at a time.

## 5. Response And Delivery Rules

When a customer responds:

- stop the pending no-response cadence;
- do not create another automatic follow-up reminder;
- create a staff reply obligation only when a reply is genuinely required; and
- let staff choose the appropriate project stage or Waiting state.

When an email attempt fails:

- do not treat the email as sent;
- do not start the next follow-up clock;
- expose a delivery exception with a manual recovery path; and
- do not create a call task as fallback.

Provider acceptance, delivery, customer response, and lifecycle progress remain distinct facts.

The email-only cadence must retain accurate Sanctuary sender identification and the approved stop-contact mechanism. Email compliance remains owned by `automation-email-audit.md` and `security-privacy-quality.md`.

### Manual communication recording

The first version does not integrate Gmail or Outlook.

- Staff send personal messages in their normal email client.
- After sending, staff explicitly record `Email sent`.
- After receiving a reply, staff explicitly record `Customer replied`.
- Each record action atomically updates the matching cadence work item; staff do not separately tick both a confirmation and a task.
- The occurrence time defaults to now but remains distinct from the later database recording time.
- The confirmation stores the communication type, context, actor, and timestamps, not the email body.
- Detailed context may remain in a project note instead of being duplicated in the task record.
- Recording an email fact may reconcile the cadence, but it does not silently advance the pipeline stage.
- System-sent messages use their authoritative quote, invoice, or outbox evidence rather than a manual confirmation.

## 6. Quote Follow-Up Cadence

Status: Approved on 2026-07-29.

The current quote owner already distinguishes a prepared request, provider acceptance, durable quote finalisation, resend, failure, acceptance, decline, and expiry. The cadence must start from that commercial truth, not from the project's `Sent` stage alone.

1. After the current quote is durably finalised as sent, create one manual `Send quote follow-up email` work item.
2. It is due at 5:00pm on the fifth Auckland business day after send.
3. If the quote expires sooner, it is due at 5:00pm on the last business day on or before expiry.
4. A prepared, failed, uncertain, or not-yet-finalised delivery does not start the cadence. Its owning recovery action takes precedence.
5. Staff send the follow-up manually and record `Quote follow-up email sent`.
6. There is no second follow-up.
7. After the follow-up is recorded, create one `Review unanswered quote` work item due at 5:00pm on the first Auckland business day after quote expiry.
8. The review choices are:
   - close with an approved Lost reason;
   - move to Waiting with a wake date;
   - revise and send a new quote; or
   - keep active with one explicit work item.
9. Acceptance, decline, a recorded customer reply, or a superseding quote revision cancels the open cadence idempotently.
10. A same-version resend reschedules an open follow-up from the durable resend time without duplicating it. It does not restart a cadence whose follow-up was already completed.

Quote expiry never automatically declines or closes the project.

## 7. Work-Item Contract

A work item is a real Sanctuary obligation that a person should complete by a date.

Minimum future fields:

- project;
- clear action title;
- status: `open`, `blocked`, `done`, or `cancelled`;
- due date or time;
- optional separate SLA breach time for a policy-backed obligation;
- optional explicit assignee, otherwise Project Owner is the effective owner;
- responsibility area: customer, design, commercial, operations, or admin;
- priority: normal or critical;
- required reason when critical or blocked;
- origin: manual, automation, or reviewed migration;
- bounded source type and optional authoritative subject identity;
- stable source key for idempotent automated creation;
- row version;
- creation, update, completion, and cancellation actors/timestamps; and
- optional completion outcome.

Do not add initially:

- P1/P2/P3 priority levels;
- subtasks;
- general dependency graphs;
- recurrence;
- labels;
- watchers;
- task comments;
- task attachments; or
- a separate manual-action record type.

Rescheduling is a due-date change recorded in history. Skipping is cancellation with a reason.

## 8. Permissions

The first version uses the portal's current flat staff/admin model.

All authenticated staff may:

- view team project work;
- create, edit, assign, block, complete, cancel, and reschedule normal work items;
- set or clear Critical with a reason;
- record sent-email and customer-reply confirmations;
- move an individual project between Active, Waiting, and Closed with the required evidence; and
- assign a work item to an active staff member.

Assignee is accountability, not an access-control boundary.

Admin-only operations are:

- change Project Owner;
- archive or restore a project;
- manage staff and business-calendar data;
- correct or retract durable confirmations; and
- run reconciliation;
- read the bounded legacy Contacted classification; and
- migrate one explicitly reviewed Contacted project at a time.

Only server-owned automation may set automation origin, source type, or source key. A task permission never grants permission to send or accept a quote, record payment, change Design, mutate Schedule, or complete a Running Job.

## 9. Primary Work Item

Primary work is a server-derived projection, not another independently editable task record.

For unblocked work items:

1. Critical.
2. Overdue.
3. Due today.
4. Earliest future due date.
5. Oldest creation time as the stable tie-breaker.

Blocked work appears as an exception rather than the actionable primary item.

Manual and automated work rank equally. The initial replacement does not include manual pinning, outranking hashes, or selection-conflict machinery.

Across the Project Command Centre, precedence is:

1. Safe recovery for an incomplete authoritative domain command.
2. A Critical, overdue, or due-today work item.
3. One ready action declared by the authoritative owner for the current lifecycle stage.
4. The earliest future work item.
5. `Needs triage`.

A blocker without a safe recovery command is an exception, not an enabled primary action. A specialist action must include its reason, owner, prerequisite state, and expected result. It is referenced from its owning domain and is never copied into the work-item table.

## 10. Lifecycle Boundary

Completing a work item only completes that work item.

It must never by itself:

- change pipeline stage;
- record payment;
- accept or send a quote;
- confirm Schedule V2;
- complete a Design request;
- mark a Running Job complete;
- send an email; or
- create a customer artifact.

The owning domain commits first. It may then idempotently complete or cancel a related work item.

## 11. Confirmations

A confirmation records manually asserted evidence, not work.

A confirmation:

- has no assignee;
- has no due date;
- is never the primary work item;
- records actor and timestamp; and
- never triggers stage changes or external side effects by itself.

An approved cadence confirmation may atomically complete, cancel, or create its next reminder as described above.

If a canonical specialist domain already proves a fact, derive it instead of adding a confirmation checkbox.

The bounded initial confirmation types are:

- first enquiry email sent;
- enquiry follow-up email sent;
- enquiry customer response received;
- quote follow-up email sent;
- quote customer response received; and
- site visit completed.

A correction appends a retraction event with a required reason. It does not overwrite the original history, reverse later lifecycle or commercial facts, or silently restart a cadence. It creates a durable review signal that remains ahead of ordinary work for that project. The queue carries that exact signal ID and row version. After checking current work and lifecycle state, an admin explicitly resolves only that signal with a second reasoned, idempotent command; stale or already-resolved metadata returns a conflict and cannot clear another correction. Resolution retains both confirmation events and adds an audit event.

## 12. Site Visit And Quote Journey Rule

Site Visits remains a Schedule-owned specialist capability rather than a general navigation or task surface. The normal lead-to-quote ranking is:

- hide Site Visits from global navigation and generic discovery surfaces;
- do not link project work items to the Site Visits page;
- keep `New` focused on enquiry qualification, first contact, and response evidence;
- at `Contacted`, expose one server-owned `Arrange the site visit` specialist action to the retained direct booking/confirmation workflow;
- at `Site Visit`, expose one server-owned completion-oriented action with explicit `Book or confirm site visit` and `Record visit complete` controls until the durable completion fact exists;
- after `SITE_VISIT_COMPLETED`, remove the visit action and allow the remaining authoritative work/ranking to surface;
- expose `Prepare the quote` only at `Quoting` when the current commercial projection contains a valid estimate, or after staff explicitly correct the stage to `Quoting` with the required no-visit reason;
- stop generating `BOOK_SITE_VISIT` and `ATTEND_SITE_VISIT` task candidates;
- retain existing route/data code as dormant unless a later retirement review proves deletion safe; and
- if staff need the fact, use one bounded manual `site_visit_completed` confirmation.

The specialist link, completion confirmation, and stage correction are distinct commands. None automatically changes Schedule, creates a quote, sends a customer message, or advances the project stage.

## 13. Personal Reminders

Personal Dashboard reminders remain separate.

They are:

- private scratch items for one staff member;
- not project truth;
- not eligible as the project's primary work item; and
- not visible as team accountability.

If work needs to be accountable to the project team, staff must create a project work item.

## 14. Existing-Portfolio Conversion

The 2026-07-29 Contacted counts were a read-only historical baseline, not lifecycle evidence. They did not prove that any customer was lost, and the rollout does not automatically close or archive them.

All existing projects now cross the V2 boundary in one server-owned migration from their stored stage:

- the rollout timestamp is treated as a fresh stage-entry timestamp;
- Contacted receives `Review enquiry progress` due after five Auckland business days, not a resurrected call/email cadence;
- other non-terminal stages receive the bounded review mapped in the rollout contract;
- Paid alone receives the deterministic `Complete` closed outcome;
- staff later use the normal Waiting/Closed/work commands to make real decisions; and
- archived projects remain administrative history outside current work.

The former Contacted classifier and one-at-a-time migration UI/API are retired. Their database functions have no normal authenticated execute grant. Legacy evidence is retained only for privileged audit/rollback work.

## 15. Replacement Boundary

Retired legacy evidence remains stored across:

- code-defined stage tasks and `project_task_checks`;
- automation `tasks`;
- `followup_plans` and `followup_tasks`;
- `project_manual_actions`;
- primary-selection/control/version tables; and
- compatibility `projects.next_action*` and `follow_up_date` fields.

Every project uses:

- `project_operational_states` for Active, Waiting, and Closed state;
- one canonical `project_work_items` store for human obligations;
- one append-only work-item event history;
- a small bounded confirmation model where manual evidence is unavoidable;
- one server-derived primary work item; and
- specialist-domain actions kept with their authoritative owners.

The V2 marker is the one-way boundary. The portfolio migration fails if it cannot converge every project to one marker and operational-state row, and portfolio RPCs refuse an incomplete rollout. A one-way compatibility projection updates `projects.next_action*` and `follow_up_date` from the highest-ranked open V2 item for any remaining compatibility consumer; it never imports those fields back into V2 truth and does not project blocked or specialist actions. Personal Dashboard reminders remain outside this replacement.

## 16. Migration Principles

1. Use forward migrations; do not edit applied migration history.
2. Add the replacement tables, RLS, commands, idempotency, and audit before switching readers.
3. Move automation and manual writers to the replacement service.
4. Seed only the bounded obligation justified by current stage and authoritative specialist facts; do not copy legacy task rows into V2 work.
5. Retain legacy history as read-only evidence; do not turn stage checkboxes, Site Visit automation, or mirrored domain tasks into current obligations.
6. Move payment, Schedule, Design, Running Jobs, and other domain facts to their owning contracts.
7. Retarget the temporary `projects.next_action*` and `follow_up_date` projection because existing project-list, dashboard, and Schedule consumers still depend on it.
8. Switch Command Centre, exception, dashboard, and project readers.
9. Revoke legacy writes and retain old rows read-only for a verification window.
10. Retire old code after consumer proof; retain old tables until a later separately reviewed data-deletion decision.

Do not introduce a permanent bidirectional dual-write layer.

## 17. Verified Rollout Record

1. `20260731000002_project_work_portfolio_rollout.sql` was applied before consumers requiring `staff_projects_index_v2` and `staff_project_state_counts_v1` were released.
2. Production postflight `6832a9dd` closed migration identity, catalogue/schema-cache, portfolio completeness, state-count, queue, Command Centre, Overview, and authenticated GET-only verification.
3. Shared-data verification remained read-only; it did not manufacture or mutate customer, project, quote, invoice, task, Schedule, Running Jobs, or payment records.
4. Extend verified Auckland calendar coverage before any deadline can cross beyond 2027.
5. Treat readiness, specialist summaries, normalized activity, and further lifecycle automation as separate contracts.

## 18. Deferred Decisions

The following remain outside this document:

- Project Overview layout and visual direction, now owned by the approved implementation handover in `project-command-centre-architecture.md`;
- future Site Visits reactivation; and
- advanced task features not supported by observed operating needs.
