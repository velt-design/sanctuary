# Supabase Schema Map

Status: Current.

This doc maps active Supabase tables and RPCs to the portal workflow that owns them. Feature docs own behavior; this schema map owns table/RPC routing, write-path boundaries, access rules, and migration sources.

Use this before changing schema, RLS, grants, route Supabase access, RPC commands, or table-backed workflow behavior.

## Read First

- Start with `## Global Rules` before changing schema, RLS, grants, RPCs, or Supabase clients.
- Use the domain table sections to route changed tables/RPCs to owner docs and write paths.
- Use `## Schedule, Site Visits, And Running Jobs` for Schedule V2 and running-job storage boundaries.
- Use `## Durable Background Jobs` for the logged PGMQ queue, ledger, protected payload, worker RPCs, and rollout boundary.
- Use `## Marketing, Automation, And Supporting Tables` for enquiry, email, audit, and support tables.
- Finish with `## Verification` to choose migration, access, and route checks.

## Global Rules

- Apply ordered forward migrations from `supabase/migrations/`; do not edit old applied migrations without explicit instruction.
- Treat root SQL files in `supabase/` as setup helpers, snapshots, or legacy baselines unless an active doc says a file is the current deployment source.
- Feature docs own business behavior. This map owns which tables/RPCs belong to which workflow and where writes should enter.
- Browser UI should not create new direct table writes. Use API routes, query helpers, local-first handlers, or owned server/domain helpers.
- Public quote and invoice token surfaces must remain hash/token scoped and private/no-store for artifacts.
- Schedule V2 writes must stay behind staff API routes and `schedule_v2_*` RPC commands.
- If schema-affecting work changes a workflow, update the owning feature doc, this map, RLS/grants notes, and focused verification guidance in the same task.

## Core Portal Records

Owner docs: `docs/projects-contacts-estimates-calculator.md`, `docs/local-first-sync.md`, `docs/staff-api-auth-contracts.md`, and `docs/environment-auth-supabase.md`.

Tables/RPCs:

- `contacts`
- `projects`
- `estimates`
- `project_task_checks`
- `project_notes`
- `portal_users`
- `has_portal_access()`
- `is_portal_admin()`

Primary write path:

- Contact/project create and update routes under `apps/portal/app/api/contacts`, `apps/portal/app/api/projects`, and `apps/portal/app/api/staff/v1/projects`.
- Estimate create/update routes under `apps/portal/app/api/projects/[projectId]/estimates` and `apps/portal/app/api/estimates/[estimateId]`, usually reached through local-first mutation handlers.
- Project task action routes and project snapshot action routes under `apps/portal/app/api/staff/v1/projects`.
- Project notes (Activity tab) writes through `apps/portal/app/api/staff/v1/projects/[projectId]/notes` and `[noteId]`, reached through `portal.project.note.{create,update,delete}` local-first handlers.
- Portal user creation through auth/admin helpers and invite/admin tooling, not general staff UI table writes.
- Estimate pricing source fields were added by ordered forward migration: `estimates.pricing_source`, `estimates.pricing_source_metadata`, and nullable `estimates.commercial_design_input`; estimate write routes remain the only normal staff path for populating them.

Primary read path:

- `apps/portal/lib/projects/getProjectPageSnapshot.ts`.
- Project, contact, and estimate server/query helpers under `apps/portal/lib/projects`, `apps/portal/lib/estimates`, and related app routes.
- Auth role lookup through `apps/portal/lib/portalAccess.ts` and server auth helpers.

Access rule:

- Staff/admin routes use `requireStaffSession`, `requireStaffContext`, `requireAdminSession`, or `requireAdminContext`.
- Browser code should use routes, query helpers, or local-first adapters for writes.
- `portal_users` gates staff/admin access and must remain server/admin governed.
- Estimate writes must preserve quote-backed edit locks such as `ESTIMATE_LOCKED`.
- `project_notes` row-level security restricts inserts to the authenticated portal user (the row's `author_id` must equal `auth.uid()`); updates and deletes are restricted to the author or any admin (`is_portal_admin()`). Notes are soft-deleted (`deleted_at`); queries that surface notes to staff filter `deleted_at IS NULL`.

Migration source:

- Current ordered history in `supabase/migrations/`, including `20260208_000001_project_task_checks.sql`, `20260210_000002_portal_auth.sql`, estimate cleanup migrations, security hardening, `20260510_000001_project_notes.sql` for the Activity tab notes table, and forward backfills such as the project-note author display-name cleanup.
- Older root files such as `supabase/contacts_projects.sql` and `supabase/portal_schema.sql` are baseline/setup references, not the preferred path for new changes.

## Quotes, Invoices, Artifacts, And Job Packs

Owner doc: `docs/quotes-invoices-job-packs.md`.

Tables/RPCs:

- `quotes`
- `quote_versions`
- `quote_line_items`
- `quote_send_logs`
- `deposit_invoices`
- `deposit_invoice_send_logs`
- `file_artifacts`
- `job_pack_generations`
- `job_pack_sheet_overrides`
- `next_quote_ref()`
- `next_deposit_invoice_ref()`

Primary write path:

- Staff quote routes under `apps/portal/app/api/quotes` and `apps/portal/app/api/staff/v1/quotes`.
- Quote domain helpers under `apps/portal/lib/quotes`.
- Quote-version pricing source metadata is nullable, not backfilled, and copied only by quote domain helpers from the saved estimate metadata boundary when quote line items are created, refreshed, or revised.
- Invoice domain helpers under `apps/portal/lib/invoices`.
- Email and artifact helpers under `apps/portal/lib/emails`, `apps/portal/lib/outputs`, and quote/invoice/job-pack server helpers.
- Public accept/decline and public invoice actions through token-bound marketing routes only after server-side token validation.
- Public token routes and generated artifacts should continue to read quote-version totals and line items, not raw commercial payloads.
- `quote_versions.pricing_source` and `quote_versions.pricing_source_metadata` store compact provenance only. Raw `estimates.commercial_design_input` must not be copied into quote versions, public token routes, invoices, PDFs, emails, or job-pack outputs.

Primary read path:

- Portal quote tab and project snapshot helpers.
- Public quote helpers in `apps/marketing/lib/quotes/publicQuote.ts`.
- Public invoice helpers in `apps/marketing/lib/invoices/publicInvoice.ts`.
- Job-pack helpers under `apps/portal/lib/jobPacks`.

Access rule:

- Staff writes are server-owned and should not bypass quote/invoice domain helpers.
- Public quote links use `quote_versions.accept_token_hash`; public invoice links use `deposit_invoices.portal_token_hash`.
- Token comparisons must stay hash-based. Raw token values and service-role clients must never reach client components, logs, PDFs, or public props.
- File artifacts and PDFs must stay token-scoped for public downloads.

Migration source:

- Quote and invoice migrations under `supabase/migrations/20260209_*`, `20260216_*`, `20260220_*`, `20260314_*`, `20260318_000002_job_pack_sheet_overrides.sql`, `20260320_000001_job_pack_generations.sql`, `20260321_000001_job_pack_generations_schema_reload.sql`, `20260408_000001_portal_security_hardening.sql`, and quote-version source metadata migration `20260504_000002_quote_version_pricing_source_metadata.sql`.
- `supabase/portal_schema.sql` is a legacy baseline/snapshot reference for these tables.

## Schedule, Site Visits, And Running Jobs

Owner docs: `docs/schedule.md` and `docs/running-jobs.md`.

Tables/RPCs:

- Legacy schedule: `schedule_crews`, `schedule_items`
- Schedule V2: `scheduled_jobs`, `crew_schedule_items`, `crew_downtimes`, `planned_commitment_history`, `nz_holidays`, `company_closures`
- Schedule V2 RPCs: `schedule_v2_reorder_queue`, `schedule_v2_set_days_remaining`, `schedule_v2_unassign_job`, `schedule_v2_delete_downtime`, `schedule_v2_mark_done`, `schedule_v2_apply_job_patch`, `schedule_v2_apply_commitment`, `schedule_v2_ack_client_update`, `schedule_v2_assign_job`, `schedule_v2_create_downtime`, `schedule_v2_update_downtime`
- Site visits: `site_visit_events`
- Running jobs: `project_running_job_meta`, `running_job_legacy_import_batches`, `running_job_legacy_rows`

Primary write path:

- Schedule writes through staff schedule routes under `apps/portal/app/api/staff/v1/schedule` and command helpers in `apps/portal/lib/scheduling`.
- Site visit booking, assignment, confirmation, cancellation, rescheduling, and unscheduling through project action routes and site-visit server helpers.
- Running Jobs spreadsheet writes through `apps/portal/app/api/staff/v1/running-jobs` and `apps/portal/lib/runningJobs/writeOps.ts`.
- Legacy running-job imports through `scripts/import-running-jobs-legacy.ts`.

Primary read path:

- Schedule query helpers under `apps/portal/lib/queries/schedule.ts`.
- Schedule repos and snapshot builders under `apps/portal/lib/repo/scheduleRepo.ts`, `apps/portal/lib/repo/scheduleV2Repo.ts`, and `apps/portal/lib/scheduling`.
- Running Jobs server helpers under `apps/portal/lib/runningJobs`.
- Project snapshot reads for site visit, schedule, and running-job readiness.

Access rule:

- Schedule V2 mutation must use staff API/RPC command boundaries; do not add browser direct writes to V2 tables.
- Legacy schedule fallback is isolated and should not become the normal write path.
- Running Jobs may write manual running-job metadata, but estimate-derived fields remain read-only and schedule-owned fields must route through schedule-safe helpers.
- Site visit writes are staff-server owned and may trigger email/outbox side effects.

Migration source:

- `supabase/migrations/20260210_000003_schedule_v2_schema.sql`, `20260212_000004_schedule_v2_commitments.sql`, `20260407_*schedule_v2*_rpc_commands.sql`, and `20260414_*schedule_v2*_repair.sql`.
- `supabase/migrations/20260315_000001_running_job_list_phase1.sql` and `20260316_000001_running_job_legacy_import.sql`.
- `supabase/migrations/20260208_000003_site_visit_backfill.sql`, `supabase/automation_phase_a.sql`, `supabase/site_visits.sql`, and security hardening.
- `supabase/schedule.sql` and `supabase/schedule_engine.sql` are legacy schedule setup references.

## Design List, Theme, Costing, And Admin

Owner docs: `docs/design-list.md`, `docs/costing-and-geometry.md`, `docs/staff-api-auth-contracts.md`, and `docs/security-privacy-quality.md`.

Tables/RPCs:

- Design List: `design_package_requests`
- Portal theme: `portal_user_theme_settings`, `portal_user_theme_presets`
- Costing overrides: `material_cost_overrides`, `install_action_minutes_overrides`, `install_driver_curve_overrides`

Primary write path:

- Design List request and cell/action routes under `apps/portal/app/api/staff/v1/design-packages`.
- Theme routes under `apps/portal/app/api/staff/v1/theme`.
- Costing/admin override routes under `apps/portal/app/api/admin`.

Primary read path:

- Design package server/domain helpers under `apps/portal/lib/designPackages`.
- Theme server helpers under `apps/portal/lib/theme`.
- Costing override helpers under `apps/portal/lib/costing/overrides.ts`, feeding `packages/costing` consumers without copying costing engine logic.

Access rule:

- Design List writes are staff-owned and should touch only request-owned fields.
- Theme rows are user-scoped and must preserve own-user RLS behavior.
- Costing override writes are admin-owned. Costing source-of-truth logic remains in `packages/costing`; tables only store portal override data.

Migration source:

- `supabase/migrations/20260317_000001_design_package_requests.sql`.
- `supabase/migrations/20260307_000001_portal_theme_settings.sql`, `20260308_000002_portal_theme_user_presets.sql`, and `20260318_000001_portal_theme_stone_olive_default.sql`.
- `supabase/costing_overrides.sql`, `supabase/migrations/20260326_000001_install_driver_curve_overrides.sql`, and security hardening.

## Durable Background Jobs

Owner docs: this schema map owns the current database boundary; `docs/target-architecture.md` owns the long-term worker path, while `docs/security-privacy-quality.md`, `docs/environment-auth-supabase.md`, and `docs/testing-and-qa.md` own security, setup, and verification. Each business job kind still belongs to its existing workflow doc until a later task migrates that producer and handler.

Current scope:

- JOB-01 is a foundation only. No app producer, worker runtime, or workflow handler consumes it yet; current quote, invoice, job-pack, automation, and email paths remain unchanged.
- The shared `@sp/jobs` registry declares versioned policy for `deposit_invoice_prepare_and_send`, `quote_send`, `quote_resend`, `job_pack_generate`, `automation_event`, and `email_outbox_deliver`, with every default rollout mode still `legacy`.
- Registry policy keeps `requiredHandlerCheckpoints` for domain-owned freeze/stage/business-finalisation milestones separate from allowed and required external effects. The database snapshots `has_external_side_effect`, `allowed_effect_kinds`, `required_effect_kinds`, and cancellation policy onto each accepted job so a later registry edit cannot change policy beneath durable work. `background_job_complete` rejects success until every recorded worker effect is terminal and every required kind has a durable `finalised` checkpoint; shadow work may retain prepared checkpoints but cannot dispatch.
- JOB-02 through JOB-08 remain pending. The presence of kinds, tables, or RPCs is not rollout evidence.

Queue, tables, and history:

- Logged PGMQ queue: `portal_background_jobs`. Its message contract is exactly a UUID-string `jobId` plus a positive-integer `contractVersion`; the queue is only a wake-up pointer. Migration fails closed if that canonical name already belongs to an unlogged queue.
- Policy and durable state: `background_job_kinds`, `background_jobs`.
- Frozen protected input: `private.background_job_payloads`. Rows are immutable and direct access is revoked, including from `service_role`.
- External-effect checkpoints and provider identity: `background_job_effects`, with strict effect-state transitions, one stable effect key per job, and unique non-null provider message and idempotency identities. Same-identity failed work may re-enter dispatch; uncertain work may re-enter dispatch only inside its live idempotency window.
- Append-only state/effect audit history: `background_job_events`. Event content is immutable; only database foreign-key cleanup may clear the nullable job or actor reference.
- Worker liveness and drain/health state: `background_workers`.

Service-role RPC boundary:

- Enqueue: `background_job_enqueue_staff`, `background_job_enqueue_system`. The `staff` name records user attribution; it is still executable only by `service_role`, not by the browser `authenticated` role.
- Claim and lease: `background_jobs_claim`, `background_job_read_payload`, `background_job_read_effects`, `background_job_heartbeat`, `background_worker_heartbeat`. The effect read is a current-lease worker projection containing only the frozen identity needed to resume a checkpoint after restart; it is not a staff-safe read.
- Lifecycle and effects: `background_job_record_progress`, `background_job_record_effect_checkpoint`, `background_job_complete`, `background_job_schedule_retry`, `background_job_mark_needs_attention`, `background_job_mark_permanent_failure`, `background_job_request_cancellation`, `background_job_acknowledge_cancellation`, `background_job_release_lease`, `background_job_manual_retry`.
- Recovery and inspection: `background_jobs_recover_expired_leases`, `background_jobs_reconcile`, `background_jobs_queue_health`, `background_job_get_safe`, `background_jobs_list_safe`, `background_job_event_history_safe`.

Primary write path:

- One security-definer enqueue transaction validates the registered kind/version, rollout owner, stable intent key, and frozen input. A transaction-level advisory lock serialises concurrent first-enqueue calls for the same kind/intent. PostgreSQL computes the canonical SHA-256 from normalized `jsonb`, persists it as `input_hash`, then creates or reuses the ledger row, inserts the private payload, sends the minimal logged queue message, stores the canonical message ID, and appends the enqueue event. Callers do not supply or claim a matching hash because JavaScript serialization is not PostgreSQL `jsonb` canonicalization; `inputHash` is durable output/identity evidence.
- Workers use the granted RPCs only. Claim creates a random per-claim lease token; payload reads and every worker lifecycle/effect mutation require the same worker ID and current unexpired token.
- Generic progress cannot enter `dispatching`. Provider dispatch goes through the effect-checkpoint RPC with frozen provider/idempotency identity and a live expiry; a restarted lease owner retrieves that same identity through `background_job_read_effects`. Expired in-flight dispatch becomes `uncertain`, and unresolved, expired, or attempt-exhausted uncertainty moves to `needs_attention` before a generic retry-exhaustion branch can hide it as an ordinary failure.
- Retry, cancellation, expired-lease recovery, orphan/duplicate repair, canonical message archive, and terminal business status remain explicit RPC state transitions. A cancellation request fences retry/failure/attention/release mutations until the current worker acknowledges it, and reconciliation durably records a missing canonical message before repair. Queue visibility or archive alone is not business completion.
- Automatic retry is blocked for raw `dispatch_started`, provider-accepted/finalised work, exhausted attempts/windows, and uncertainty whose provider idempotency window would expire by the planned delay.

Primary read path:

- Future server/admin surfaces should use the explicit safe inspection RPC projections, not direct tables. No JOB-01 browser or portal UI read path exists.
- Workers receive the minimal claim record first and may retrieve frozen execution input and frozen effect replay identity only through `background_job_read_payload` and `background_job_read_effects` while they own the current lease. Neither projection is browser-safe or browser-executable.

Access rule:

- RLS is enabled on every public job table, and public/anonymous/authenticated table and function access is revoked. Browser roles also have no PGMQ schema access.
- Direct service-role job-table, PGMQ, and private-schema access is revoked. Explicitly granted security-definer RPCs are the service-role capability boundary.
- Progress, result, effect, event, and worker summaries each use an explicit flat field allowlist, bounded counts/bytes, and value-level rejection of obvious recipient, URL, credential, hash, name, and provider content. Safe staff inspection uses explicit columns rather than returning table rows. Sensitive payloads must never be copied into queue messages, safe summaries, logs, or public props.

Migration and test source:

- `supabase/migrations/20260720_000001_background_job_foundation.sql`: PGMQ queue, enums, policy seed, ledger, private payload, effects, events, workers, transition guards, RLS, and revokes.
- `supabase/migrations/20260720_000002_background_job_enqueue_claim.sql`: atomic enqueue, canonical queue message, claim, payload read, application heartbeat, and worker heartbeat.
- `supabase/migrations/20260720_000003_background_job_lifecycle.sql`: progress, effect checkpoints, completion, retry, attention/failure, cancellation, lease release, and manual retry.
- `supabase/migrations/20260720_000004_background_job_reconciliation.sql`: expired-lease recovery, queue reconciliation/repair, health, and safe inspection.
- `supabase/migrations/20260720_000005_background_job_contract_hardening.sql`: frozen allowed-effect/cancellation policy, context-safe summaries and explicit safe projections, exact queue-body validation and repair, restart-safe lease-fenced effect identity, provider-window/max-attempt uncertainty guards, and narrowed grants.
- `supabase/tests/background_jobs_bootstrap.sql` creates only the disposable auth/projects/role prerequisites needed by the isolated contract; it is test support, not a production migration.
- `supabase/tests/background_jobs.sql` is the rollback-wrapped executable database contract. `npm run test:jobs` covers TypeScript plus static SQL/security assertions; `npm run test:jobs:db` is the Docker-backed real-PGMQ harness.

Verification status:

- `npm run test:jobs` passed locally on 2026-07-20 with 4 files and 71 tests across package contracts, package policy, static migration contracts, and repository security.
- `npm run test:jobs:db` was attempted locally and stopped at the Docker readiness check with `spawnSync docker ENOENT`; no local container started and no SQL executed. Background Jobs [run 29710584022](https://github.com/velt-design/sanctuary/actions/runs/29710584022) passed the rollback-wrapped contract against upstream PostgreSQL 18/PGMQ 1.10.0 and Supabase PostgreSQL 17/PGMQ 1.5.1. JOB-01 is database-verified for this scoped harness, but no shared-environment migration or rollout is implied.

## Portal Performance Telemetry

Owner docs: `docs/security-privacy-quality.md` and `docs/testing-and-qa.md`.

Tables/RPCs:

- `portal_performance_metrics`
- `portal_performance_summary(integer)`
- `purge_portal_performance_metrics()`

Primary write path:

- `PortalVitalsReporter` sends the closed, identifier-free event contract to `POST /api/staff/v1/performance/web-vitals`.
- Staff inserts use an auth-bound Supabase client. Browser code does not read or mutate the table directly.

Primary read path:

- Admin-only grouped summaries use `GET /api/admin/performance/web-vitals?days=7|30`, backed by `portal_performance_summary`.

Access and retention rule:

- Portal staff may insert; only portal admins may select summaries; authenticated clients have no update/delete grant.
- Route templates are allowlisted and raw URLs, identifiers, free-form text, user IDs, and user-agent strings are not stored.
- `pg_cron` invokes the non-client-executable `purge_portal_performance_metrics()` daily and removes rows older than 30 days.

Migration source:

- `supabase/migrations/20260718_000001_portal_performance_metrics.sql`.

## Marketing, Automation, And Supporting Tables

Owner docs: `docs/automation-email-audit.md`, `docs/platform-workflow.md`, `docs/security-privacy-quality.md`, `docs/projects-contacts-estimates-calculator.md`, and `docs/staff-api-auth-contracts.md`.

Tables/RPCs:

- Marketing/enquiries: `enquiry_requests`
- Email and automation: `email_templates`, `email_outbox`, `audit_events`, `tasks`, `design_package_tickets`, `followup_plans`, `followup_tasks`
- Site-visit automation support: `site_visit_events`
- Dashboard/supporting RPC: `dashboard_snapshot_v1()`
- Personal dashboard tasks: `portal_dashboard_tasks`

Primary write path:

- Marketing enquiry APIs under `apps/marketing/app/api/contact` and `apps/marketing/app/api/enquiry`.
- Portal automation runner under `apps/portal/lib/automation`.
- Project action routes that enqueue or preview email/outbox entries.
- Dashboard snapshot is read-oriented and should not become a generic write boundary.
- Personal dashboard task writes go through staff-only dashboard task APIs under `apps/portal/app/api/dashboard/tasks`.

Primary read path:

- Marketing lead and enquiry route handlers.
- Portal project snapshot, dashboard task, and automation helpers under `apps/portal/lib/projects`, `apps/portal/lib/dashboard`, and `apps/portal/lib/automation`.
- Dashboard cached snapshot helper under `apps/portal/lib/dashboard/getDashboardSnapshotCached.ts`.
- Dashboard data helpers under `apps/portal/lib/dashboard` read recent project-note activity and user-owned dashboard tasks.

Access rule:

- Marketing public routes can create lead/enquiry records through server code, but must not expose broad staff data.
- Email/outbox and audit writes are server-owned side effects.
- Automation may use service-role access only on the server and only for intentional bypasses documented by the owning workflow.
- Audit/supporting tables should stay append-oriented where possible.
- Personal dashboard tasks are owned by `owner_id = auth.uid()` and are independent from automation/project workflow `tasks`.

Migration source:

- `supabase/enquiry_requests.sql`, `supabase/automation_phase_a.sql`, `supabase/email_templates_website_autoresponder.sql`, `supabase/dashboard_snapshot_v1.sql`, and security hardening.
- Personal dashboard tasks use ordered migrations under `supabase/migrations`.
- If a supporting table becomes part of a new first-class workflow, add an ordered migration and update this map plus the owning feature doc.

## Verification

Schema-affecting work should verify the owner doc and this map together.

Focused checks:

```bash
rg -n "table_or_rpc_name" supabase apps docs
npm run test:jobs
npm run test:jobs:db
npm run text:mojibake
```

`npm run test:jobs:db` requires Docker and creates/removes its own disposable logged-PGMQ Postgres container. It applies only the test bootstrap plus JOB-01 migrations because the historical migration chain is not independently bootstrappable; a static pass or missing local Docker must never be reported as a live database pass.

When changing auth, RLS, grants, or API access, also use `docs/staff-api-auth-contracts.md` and `docs/environment-auth-supabase.md` for route/auth verification. When changing Schedule V2 tables or RPCs, run the readiness checks in `docs/schedule.md`.
