# Supabase Schema Map

Status: Current.

This doc maps active Supabase tables and RPCs to the portal workflow that owns them. Feature docs own behavior; this schema map owns table/RPC routing, write-path boundaries, access rules, and migration sources.

Use this before changing schema, RLS, grants, route Supabase access, RPC commands, or table-backed workflow behavior.

## Read First

- Start with `## Global Rules` before changing schema, RLS, grants, RPCs, or Supabase clients.
- Use the domain table sections to route changed tables/RPCs to owner docs and write paths.
- Use `## Schedule, Site Visits, And Running Jobs` for Schedule V2 and running-job storage boundaries.
- Use `## Durable Background Jobs` for the logged PGMQ queue, ledger, protected payload, provider receipts/reconciliation, worker RPCs, and rollout boundary.
- Use `docs/staging-supabase-readiness.md` for the current staging identity, exact deployed hashes, ledger exceptions, dark durable-job/AI state, and deterministic QA-data controls.
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
- `estimate_cost_actuals`
- `project_task_checks` (retained read-only legacy evidence)
- `project_notes`
- `portal_users`
- `has_portal_access()`
- `is_portal_admin()`
- `portal_search_v1()`
- `portal_search_document()`
- `portal_search_bigrams()`
- `staff_find_contact_duplicates_v1()`
- `staff_contacts_index_v1()`
- `staff_projects_index_v1()`
- `staff_projects_index_v2()`
- `staff_projects_index_v3()`
- `staff_project_state_counts_v1()`

Primary write path:

- Contact/project create and update routes under `apps/portal/app/api/contacts`, `apps/portal/app/api/projects`, and `apps/portal/app/api/staff/v1/projects`.
- Estimate create/update routes under `apps/portal/app/api/projects/[projectId]/estimates` and `apps/portal/app/api/estimates/[estimateId]`, usually reached through local-first mutation handlers.
- Staff actual-cost calibration reads/writes use `/api/staff/v1/estimates/[estimateId]/actual-costs`, the request's auth-bound Supabase client, and `apps/portal/lib/estimateActuals/server.ts`. The comparison always reads the frozen estimate snapshot; it does not invoke a costing engine or reprice history.
- Project lifecycle, Project Work, confirmation, and owner writes use the auth-bound staff routes and their named semantic commands under `apps/portal/app/api/staff/v1/projects`.
- Project notes (Activity tab) writes through `apps/portal/app/api/staff/v1/projects/[projectId]/notes` and `[noteId]`, reached through `portal.project.note.{create,update,delete}` local-first handlers.
- Portal user creation through auth/admin helpers and invite/admin tooling, not general staff UI table writes.
- Estimate pricing source fields were added by ordered forward migration: `estimates.pricing_source`, `estimates.pricing_source_metadata`, and nullable `estimates.commercial_design_input`; estimate write routes remain the only normal staff path for populating them.
- `estimates.internal_name` is nullable, bounded staff-only identity metadata. Estimate create/rename routes own it independently of historical pricing locks; customer outputs do not consume it.

Primary read path:

- `apps/portal/lib/projects/getProjectPageSnapshot.ts`.
- Project, contact, and estimate server/query helpers under `apps/portal/lib/projects`, `apps/portal/lib/contacts`, `apps/portal/lib/estimates`, and related app routes. Ordinary Projects/Contacts lists call their bounded index RPC through authenticated staff routes; browser components never call those RPCs directly.
- Auth role lookup through `apps/portal/lib/portalAccess.ts` and server auth helpers.
- Global Projects/Contacts discovery through `GET /api/staff/v1/search`, whose domain helper makes one auth-bound `portal_search_v1()` call.

Access rule:

- Staff/admin routes use `requireStaffSession`, `requireStaffContext`, `requireAdminSession`, or `requireAdminContext`.
- Browser code should use routes, query helpers, or local-first adapters for writes.
- `portal_users` gates staff/admin access and must remain server/admin governed.
- `portal_search_v1()` is executable only by `authenticated` and `service_role`, remains `SECURITY INVOKER`, reports `has_portal_access()` in-band, and relies on Projects/Contacts RLS. `portal_search_document()` and `portal_search_bigrams()` are immutable, data-free helpers with the same execute grants. Projects materializes `portal_search_document` and `portal_search_bigrams`; Contacts also materializes `portal_search_name_bigrams` for linked-project discovery. GIN indexes cover those generated columns so RLS planning does not fall back to rebuilding arrays per row. The Projects and Contacts `portal_access_all` policies retain the same authenticated `has_portal_access()` decision for every operation but wrap the stable helper in a scalar `SELECT` so PostgreSQL evaluates it once per statement. Browser code must continue to use the staff API rather than call these RPCs directly.
- `staff_contacts_index_v1()` and the retained `staff_projects_index_v1()`/`staff_projects_index_v2()` compatibility readers are `SECURITY INVOKER`, exact-count, stable-order read models with a maximum page size of 100. The current project list uses `staff_projects_index_v3()`, which preserves V2 journey/stage/state behavior and adds Project Owner filtering plus `project_owner_key`, `waiting_until`, `waiting_reason`, and `closed_outcome` fields. Owner filtering occurs before pagination. `staff_project_state_counts_v1()` returns whole-portfolio state counts. Both current project RPCs fail with `PROJECT_WORK_ROLLOUT_INCOMPLETE` if any project lacks its marker or state. `staff_find_contact_duplicates_v1()` returns at most ten exact normalized email/phone matches for server-owned project creation. These staff RPCs are revoked from `public`/`anon`, granted only to `authenticated`/`service_role`, and remain behind staff routes and existing RLS.
- Estimate writes must preserve quote-backed edit locks such as `ESTIMATE_LOCKED`.
- `estimate_cost_actuals` is one staff-owned downstream record per estimate. Authenticated table access is RLS-gated through `has_portal_access()`; insert/update must stamp `updated_by = auth.uid()`. The ordered owner migration is `supabase/migrations/20260722_000005_estimate_cost_actuals.sql`.
- `project_notes` row-level security restricts inserts to the authenticated portal user (the row's `author_id` must equal `auth.uid()`); updates and deletes are restricted to the author or any admin (`is_portal_admin()`). Notes are soft-deleted (`deleted_at`); queries that surface notes to staff filter `deleted_at IS NULL`.

Migration source:

- Current ordered history in `supabase/migrations/`, including `20260208_000001_project_task_checks.sql`, `20260210_000002_portal_auth.sql`, estimate cleanup migrations, security hardening, `20260510_000001_project_notes.sql` for the Activity tab notes table, forward backfills such as the project-note author display-name cleanup, `20260722_000001_portal_search_v1.sql` for the bounded search RPC plus initial trigram/join indexes, `20260722_000002_portal_search_bigram_indexes.sql` for the immutable normalized/bigram helpers, `20260722_000003_portal_search_materialized_columns.sql` for generated search columns plus their GIN indexes, `20260722_000004_portal_search_rls_initplan.sql` for statement-cached Projects/Contacts membership policy evaluation, `20260729_000001_portal_operational_lists.sql` for the bounded Projects/Contacts index and duplicate-detection RPCs, `20260731000002_project_work_portfolio_rollout.sql` for the strict portfolio/state-count contract, `20260731000003_project_pipeline_accountability_reads.sql` for the Project Owner-aware V3 Projects index, and `20260801_000001_project_owner_handoffs_and_enquiry_inactivity.sql` for Enquiry ownership and the read-only inactivity evidence boundary.
- Older root files such as `supabase/contacts_projects.sql` and `supabase/portal_schema.sql` are baseline/setup references, not the preferred path for new changes.

## Project Design Booklets

Owner doc: `docs/design-booklets.md`.

Tables and Storage:

- `project_design_booklets`: one active schema-v2 draft per project, with an optimistic `revision`.
- `project_design_booklet_assets`: private image or drawing-PDF metadata keyed by project and stable booklet `asset_key`; PDF rows include a verified `page_count`.
- private Storage bucket `design-booklet-assets`: project-folder image/document objects and one replaceable `exports/latest.pdf`.

Primary write path:

- `PUT /api/staff/v1/projects/[projectId]/design-booklet` validates and autosaves the draft through the request's auth-bound Supabase client.
- The asset `sign`, `complete`, and `copy` routes under the same project boundary prepare a short-lived direct upload, verify/normalize stored image or PDF bytes, and upsert metadata only after Storage succeeds. Drawing PDFs retain their original bytes; their selected-page JPEG preview is a separate asset.
- `POST .../design-booklet/pdf` reads the saved draft/assets, generates the customer PDF, replaces the project's private latest export, and returns a short-lived signed download URL.

Primary read path:

- `GET /api/staff/v1/projects/[projectId]/design-booklet` returns the saved draft, fresh signed preview URLs, and project return identity. A missing row returns the Toni structure with project customer identity and revision zero; the first autosave creates the row.

Access rule:

- Both metadata tables grant authenticated CRUD but enforce `has_portal_access()` through RLS.
- Storage is private. Authenticated Storage policies require portal access and a first path segment matching an accessible `projects.id`; browser access uses only API-prepared signed URLs.
- Browser code never writes either table directly. Failed uploads remain visible and must not create metadata-only asset rows.

Migration source:

- `supabase/migrations/20260731_000001_project_design_booklets.sql`.
- `supabase/migrations/20260810_000001_project_design_booklet_pdf_drawings.sql` adds PDF asset media metadata and bounded page counts. It was applied to the positively identified production `SP-Staff-Portal-DB` project on 2026-08-11; shared staging still requires a separate exact-file apply and verification before exercising PDF drawing writes there.

## Quotes, Invoices, Artifacts, And Job Packs

Owner doc: `docs/quotes-invoices-job-packs.md`.

Tables/RPCs:

- `quotes`
- `quote_versions`
- `quote_line_items`
- `quote_send_logs`
- `deposit_invoices`
- `deposit_invoice_send_logs`
- `project_payment_entries`
- `project_payment_allocations`
- `project_invoice_plan_items`
- `private.commercial_email_intents`
- `file_artifacts`
- `job_pack_generations`
- `job_pack_sheet_overrides`
- `next_quote_ref()`
- `next_deposit_invoice_ref()`
- `commercial_quote_create_draft(...)`
- `commercial_quote_update_draft(...)`
- `commercial_quote_prepare_delivery_email(...)`
- `commercial_accept_quote_and_ensure_invoice(...)`
- `commercial_record_project_payment_entry(...)`
- `commercial_mark_invoice_paid_and_record_payment(...)`
- `commercial_replace_payment_allocations(...)`
- `commercial_reverse_payment_entry(...)`
- `commercial_create_admin_invoice(...)`
- `commercial_create_admin_invoice_idempotent(...)`
- `commercial_email_intent_prepare(...)` plus the bounded read/checkpoint/finalisation RPCs

Primary write path:

- Staff quote routes under `apps/portal/app/api/quotes` and `apps/portal/app/api/staff/v1/quotes`.
- Quote domain helpers under `apps/portal/lib/quotes`.
- Cross-quote/invoice commands, commercial audit, and durable email intent adapters under `apps/portal/lib/commercial`.
- Quote-version pricing source metadata is nullable, not backfilled, and copied only by quote domain helpers from the saved estimate metadata boundary when quote line items are created, refreshed, or revised.
- `quotes.internal_name` is nullable, bounded staff-only family metadata shared by all `quote_versions`. Staff rename it through the authenticated quote-domain route; it is not selected by public quote helpers or artifact models.
- `estimates.commercial_scope_id` and `quotes.commercial_scope_id` are null for the original contract and hold one stable UUID for each independent project add-on. Estimate-led add-ons share the estimate family UUID; standalone manual add-ons created after base acceptance use a deterministic UUID derived from the stable create intent. The base family has one partial unique quote row per project; each non-null project/scope pair has one quote family and its own reference/version chain.
- Invoice domain helpers under `apps/portal/lib/invoices`.
- Email and artifact helpers under `apps/portal/lib/emails`, `apps/portal/lib/outputs`, and quote/invoice/job-pack server helpers.
- Public accept/decline and public invoice actions through token-bound marketing routes only after server-side token validation.
- Public token routes and generated artifacts should continue to read quote-version totals and line items, not raw commercial payloads.
- `quote_versions.pricing_source` and `quote_versions.pricing_source_metadata` store compact provenance only. Raw `estimates.commercial_design_input` must not be copied into quote versions, public token routes, invoices, PDFs, emails, or job-pack outputs.
- `quote_versions.payment_terms` is the frozen default schedule of fixed-dollar and percentage-of-remainder terms, including resolved cents. `project_invoice_plan_items` stores future instalments created by an admin split; only the first is invoiced immediately. `deposit_invoices.payment_term_*` binds each non-void whole invoice to one base or add-on quote stage, while `creation_mode` and `creation_override_reason` preserve admin creation evidence. There is no partial-payment amount field.
- `project_payment_entries` is the append-only job payment/adjustment/reversal ledger. `project_payment_allocations` is reversible allocation history from positive entries to quote-version payment stages. A paid invoice creates one job payment entry transactionally; backfilled paid historical invoices intentionally start unallocated. `commercial_current_accepted_quote_versions()` selects one current accepted lifecycle version per quote family without reviving a tombstoned acceptance. `commercial_project_financial_truth()` owns Accepted/Paid/Open/Remaining/Over-committed totals from current accepted versions, net ledger entries, and all whole open project invoices. Allocation affects stage presentation rather than invoice identity.
- Admin-created invoices and project payment entries carry nullable caller-generated client intent IDs with unique project-scoped indexes. Admin invoice rows also freeze the creation command's planned-item count and remaining-before/after values so a later replay returns the original result rather than reconstructing it from newer job state. The idempotent invoice wrapper and intent-aware payment RPC return the committed record for a replay, while preserving the original transaction, allocation and audit owners.
- `quote_versions.status = 'SUPERSEDED'` is a manual admin retirement state for a previously `SENT` or `ACCEPTED` version. `superseded_at` and `superseded_by` record that transition; accepted, delivery, PDF, invoice, and payment evidence remain unchanged. `commercial_mark_quote_superseded()` and `commercial_mark_quote_declined()` serialize terminal quote changes with invoice creation and write audit evidence transactionally. `commercial_complete_project_operational_state_command()` proves settlement from the financial-truth RPC before delegating to the existing state command; legacy paid-date columns cannot bypass ledger truth.

Primary read path:

- Portal quote tab and project snapshot helpers.
- Public quote helpers in `apps/marketing/lib/quotes/publicQuote.ts`.
- Public invoice helpers in `apps/marketing/lib/invoices/publicInvoice.ts`.
- Job-pack helpers under `apps/portal/lib/jobPacks`.

Access rule:

- Staff writes are server-owned and should not bypass quote/invoice domain helpers. Staff read reconciled job totals through `apps/portal/app/api/staff/v1/projects/[projectId]/invoice-schedule`; payment-entry detail is included only for an admin session. Invoice creation, paid-state changes, ledger writes, allocation replacement and reversals are admin-only through the routes under `apps/portal/app/api/admin`. Manual quote superseding remains admin-only through `apps/portal/app/api/admin/quotes/[quoteVersionId]/supersede`.
- Commercial transaction and intent RPCs are revoked from `anon` and `authenticated`; narrow server-owned service-role adapters call them only after staff auth or public-token validation.
- `private.commercial_email_intents` freezes request identity and checkpoints. It is not a browser table, public read model, or substitute for quote/invoice send logs.
- Public quote links use `quote_versions.accept_token_hash`; public invoice links use `deposit_invoices.portal_token_hash`.
- Token comparisons must stay hash-based. Raw token values and service-role clients must never reach client components, logs, PDFs, or public props.
- File artifacts and PDFs must stay token-scoped for public downloads.

Migration source:

- Quote and invoice migrations under `supabase/migrations/20260209_*`, `20260216_*`, `20260220_*`, `20260314_*`, `20260318_000002_job_pack_sheet_overrides.sql`, `20260320_000001_job_pack_generations.sql`, `20260321_000001_job_pack_generations_schema_reload.sql`, `20260408_000001_portal_security_hardening.sql`, quote-version source metadata migration `20260504_000002_quote_version_pricing_source_metadata.sql`, commercial trust migration `20260728_000001_commercial_workflow_trust.sql`, payment schedule/whole-invoice payment migration `20260810_000002_quote_payment_schedules_and_invoice_payments.sql`, manual quote retirement migration `20260810000003_manual_quote_superseded_status.sql`, payment reconciliation migration `20260810000004_admin_payment_reconciliation.sql`, add-on scope migration `20260811000002_project_commercial_add_on_scopes.sql`, and manual-quote migration `20260813000001_manual_quotes_without_estimates.sql`.
- `supabase/migrations/20260813000002_commercial_admin_action_idempotency.sql` adds admin invoice/payment client intents, their uniqueness boundaries, the idempotent invoice wrapper, and the intent-aware payment RPC overload. `20260813000003_commercial_truth_invariants.sql` adds project-scoped transaction locks, authoritative accepted-quote and financial-truth projections, guarded lifecycle/payment wrappers, reconciliation triggers, and the service-role-only quote-acceptance boundary.
- The final two commercial migrations were exact-file applied to the positively identified production project on 2026-08-18 after a completed physical-backup check and rollback rehearsal. Postflight matched both stored migration bodies, all expected columns/indexes/functions/triggers and the intended grants, retained the preflight commercial row counts, and confirmed `commercial_accept_quote_with_project_lock(uuid, text)` uses the project-scoped transaction advisory lock. Earlier structurally present but unrecorded commercial migrations were not replayed or repaired.
- `supabase/migrations/20260818000001_rehome_sent_manual_variation.sql` rehomes one known sent variation from an already-accepted base family into an independent add-on family after strict no-acceptance/no-invoice precondition checks; the application prevents recurrence by scoping post-acceptance manual creates independently. It was exact-file applied to positively identified production on 2026-08-18 after a completed physical-backup check in the same controlled commercial rollout window and two rollback rehearsals, including a full acceptance/invoice proof with mocked reference allocators. The canonical-LF SHA-256 is `4f012c0b0884036e72e350065f945836cf8faf3e74de3f136f16067d094cf508`; the Windows/ledger CRLF body is 3,329 bytes with SHA-256 `fc805f0a9bc1ab5bf73e1050da651246e4896fb8ae271c7f250f9aff1ca530ea`. Postflight matched the stored body, independent scope, version `1`, one repair audit event, `SENT` status, and zero invoices; no acceptance or customer email was committed.
- `supabase/migrations/20260811000001_commercial_internal_names.sql` adds bounded staff-only names to estimates and quote families without backfilling historical rows. It was exact-file applied to production on 2026-08-11; postflight verified both columns, constraints, PostgREST visibility, zero backfilled names, and the unique migration-ledger entry.
- `supabase/portal_schema.sql` is a legacy baseline/snapshot reference for these tables.

## Schedule, Site Visits, And Running Jobs

Owner docs: `docs/schedule.md` and `docs/running-jobs.md`.

Tables/RPCs:

- Legacy schedule: `schedule_crews`, `schedule_items`
- Schedule V2: `scheduled_jobs`, `crew_schedule_items`, `crew_downtimes`, `planned_commitment_history`, `nz_holidays`, `company_closures`
- Schedule V2 RPCs: `schedule_v2_reorder_queue`, `schedule_v2_set_days_remaining`, `schedule_v2_unassign_job`, `schedule_v2_delete_downtime`, `schedule_v2_mark_done`, `schedule_v2_apply_job_patch`, `schedule_v2_apply_commitment`, `schedule_v2_ack_client_update`, `schedule_v2_assign_job`, `schedule_v2_create_downtime`, `schedule_v2_update_downtime`
- Site visits: `site_visit_events`
- Lifecycle occurrence fields: immutable, database-owned `site_visit_events.confirmed_at` and `projects.deposit_received_at`; existing terminal rows remain null and fail closed rather than being backfilled from mutable `updated_at`
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
- Versioned costing: `costing_configuration_versions`, `costing_configuration_publication`, `costing_configuration_audit_events`
- Legacy costing compatibility (read-only after this migration): `material_cost_overrides`, `install_action_minutes_overrides`, `install_driver_curve_overrides`
- Estimate provenance: nullable `estimates.costing_config_version_id`

Primary write path:

- Design List request and cell/action routes under `apps/portal/app/api/staff/v1/design-packages`.
- Theme routes under `apps/portal/app/api/staff/v1/theme`.
- Costing drafts and publication go through admin-guarded routes under `apps/portal/app/api/admin/costing/configurations`. Version `name` and `purpose` are bounded identity metadata and remain separate from `publish_note`. Draft save uses the expected content hash plus `updated_at` so metadata-only concurrent edits are not silently overwritten. Publish uses the admin-only atomic `publish_costing_configuration_version(...)` RPC with the expected current version, expected draft hash, audit note, package-generated diff, and package-generated impact preview.
- `/api/admin/costing/validate` is a non-mutating package-validation boundary. `/api/admin/costing/estimates` and the per-draft `estimate-preview` route perform bounded, auth-bound estimate/project reads only; they never update estimate or configuration rows.

Primary read path:

- Design package server/domain helpers under `apps/portal/lib/designPackages`.
- Theme server helpers under `apps/portal/lib/theme`.
- `apps/portal/lib/costing/configurationResolver.ts` reads the singleton publication pointer, validates and hashes the immutable JSON version against `@sp/costing`, and applies it through the package contract. Until the first publication it snapshots the effective legacy overrides through `overrides.ts`; database failures after schema creation fail closed.
- `apps/portal/lib/costing/configurationEstimatePreview.ts` reads recent or selected estimate inputs and project identity through the auth-bound admin client, normalizes supported historical calculator input versions, and delegates active-versus-draft component totals to `@sp/costing`.

Migration source:

- `supabase/migrations/20260723_000001_costing_configuration_versions.sql`
- `supabase/migrations/20260724_000001_costing_configuration_metadata.sql`

Access rule:

- Design List writes are staff-owned and should touch only request-owned fields.
- Theme rows are user-scoped and must preserve own-user RLS behavior.
- Costing draft rows are admin-owned and RLS-protected. Published rows are immutable by trigger; current selection lives in a separate one-row table. Staff may read the current published version for server costing. The audit table is append-only to authenticated callers and receives publish events only through the security-definer RPC.
- Configuration JSON contains only the package-defined typed values. Executable formulas and calculation algorithms remain in `packages/costing`.
- Estimate provenance may reference only a published version; a database trigger enforces that rule and foreign-key deletion is `restrict`. Existing estimate inputs/outputs remain frozen.

Migration source:

- `supabase/migrations/20260317_000001_design_package_requests.sql`.
- `supabase/migrations/20260307_000001_portal_theme_settings.sql`, `20260308_000002_portal_theme_user_presets.sql`, and `20260318_000001_portal_theme_stone_olive_default.sql`.
- `supabase/costing_overrides.sql`, `supabase/migrations/20260326_000001_install_driver_curve_overrides.sql`, and security hardening.
- `supabase/migrations/20260723_000001_costing_configuration_versions.sql` adds versioning, immutable publication, publish audit, and estimate provenance. It is forward-only; legacy override rows remain for pre-first-publish compatibility and historical operational inspection.

## Sanctuary AI Task Ledger

Owner docs: `docs/ai/README.md` routes the programme, `docs/ai/sanctuary-ai-master-plan.md` owns the proposed long-term sequence, and accepted ADRs under `docs/ai/09-decisions/` own the hosted-control-state, provider-neutral, existing-jobs-spine, and exact-approval decisions.

Current PR-AI-004 through PR-AI-007 scope:

- Safe staff-visible task state lives in `public.ai_tasks`; append-only safe history lives in `public.ai_task_events`.
- Frozen objective and fixture input live only in `private.ai_task_payloads`. Exact command replay evidence lives only in append-only `private.ai_task_command_receipts`.
- `ai_task_create_synthetic` accepts only the fixed `echo_v1` and `classification_v1` fixtures. It snapshots `execution_mode = synthetic`, `effect_class = none`, and zero maximum/actual cost; PostgreSQL computes the canonical JSONB SHA-256 and atomically creates the task, payload, and first event.
- `ai_task_cancel_synthetic` is requester/admin-only, accepts only effect-free synthetic tasks, and uses an exact single-use command ID plus immutable receipt. Same-input replay is stable; changed-input command reuse fails closed.
- Authenticated staff may select only RLS-filtered safe task/event rows and invoke the two semantic commands. They have no direct mutation grant. Anonymous and service-role roles receive no AI task table access; private schema access is revoked from application roles.
- PR-AI-006 adds the read-only staff boundary at `GET /api/staff/v1/ai/tasks` and `GET /api/staff/v1/ai/tasks/[taskId]`. Both use the request's auth-bound client, select only explicit public safe columns, validate the projection before returning it, and are always `private, no-store`. RLS-hidden cross-project detail is indistinguishable from a missing task. The gated `/qa/ai-activity-fixture` renders checked-in synthetic data and never queries Supabase.
- PR-AI-007 links an eligible synthetic task to exactly one `ai_synthetic_v1` durable job through the service-role-only `ai_task_enqueue_synthetic` RPC. Exact replay returns the existing link. Task state follows durable job state, and successful completion atomically validates the fixed result, records one zero-unit/zero-cost usage row plus one deterministic passing evaluation, and advances the task to evaluated.
- `ai_task_jobs`, `ai_usage_records`, and `ai_evaluations` are append-only. Staff-safe reads inherit parent-task RLS visibility; raw job payload/hash/lease/queue identity remains private. Linked task-only cancellation is rejected so task and job state cannot diverge.
- The synthetic handler and producer have no model/provider integration, OpenClaw integration, customer/project mutation, external communication, or production effect. The production migration and worker rollout remain separate and unapplied.

PR-AI-005 approval boundary:

- Staff-safe exact-envelope metadata lives in `public.ai_approvals`; the exact frozen action payload lives only in `private.ai_approval_envelopes`; append-only request/approve/reject/consume/invalidate replay evidence lives in `private.ai_approval_command_receipts`.
- `ai_approval_request_synthetic` derives the exact action payload and PostgreSQL hash from the immutable AI task input. It accepts only synthetic, effect-free tasks, fixes the required role to admin, bounds expiry to 30 minutes, and reuses an identical active envelope.
- `ai_approval_decide_synthetic` requires current admin authority and records an immutable approved/rejected decision. `ai_approval_consume_synthetic` atomically checks the exact public/private/task hashes, expiry, prior decision role, task cancellation, and single-use status before recording a synthetic receipt with no external effect. `ai_approval_invalidate_synthetic` is exact-hash-bound and requester/admin-only.
- Expiry and cancellation fail closed. Invalidation or expiry after approval preserves the original decision identity and time. Same-command replay is stable; changed command identity, wrong role/hash, and a second consumption fail closed.
- Authenticated staff may select only approvals visible through the parent task RLS policy and invoke the semantic commands. They have no direct mutation grant. Anonymous and service-role roles receive no approval table/function capability, and application roles receive no private approval data access.

Migration and test source:

- `supabase/migrations/20260818000002_ai_task_ledger.sql`
- `supabase/migrations/20260818000003_ai_approval_envelopes.sql`
- `supabase/migrations/20260818000004_ai_synthetic_execution.sql`
- `supabase/tests/ai_task_ledger_bootstrap.sql`, `supabase/tests/ai_task_ledger.sql`, `supabase/tests/ai_approval_envelopes.sql`, and `supabase/tests/ai_synthetic_execution.sql`
- `test/ai-task-ledger-migration.test.ts`, `test/ai-approval-migration.test.ts`, `test/ai-synthetic-execution-migration.test.ts`, `scripts/test-ai-task-ledger-db.mjs`, and `scripts/test-background-jobs-db.mjs`
- `npm run test:ai` is the package/static contract. `npm run test:ai:db` applies the exact forward file inside a transaction and rolls it back, proves no AI objects remain, then reapplies it and executes the RLS/replay/immutability contract in a disposable database.

No shared local, staging, or production database receives this migration from the test harness. Production application remains a separate reviewed exact-file deployment after green disposable-database evidence.

Primary read path:

- Portal consumers use the two staff API routes above and the server-only `apps/portal/lib/ai/serverActivity.ts` adapter. Browser code does not read the AI tables directly.
- The detail response contains the RLS-visible task, safe append-only events, and safe approval/validation evidence. It omits private input/envelopes/receipts, requesting and deciding user IDs, input and idempotency identities, and every service-role capability.

## Praxis Reporting Projection V1

Migration `20260903000001_praxis_context_reporting_v1.sql` owns the server-only Praxis read boundary. It creates the `praxis_reporting` schema, a non-login `sanctuary_praxis_reader` group role, one environment-provisioned database identity row, 12 explicit versioned projections, and the bounded `context_page_v1` keyset function. The resources are enquiry request, contact, project, estimate, quote, quote version, quote line item, invoice, invoice plan item, payment, payment allocation, and canonical project financial truth.

The financial projection wraps `commercial_current_accepted_quote_versions` and `commercial_project_financial_truth`; it does not reimplement pricing, acceptance, GST, invoice, payment, or allocation rules in the connector or Velt. `quotes.updated_at` and `project_invoice_plan_items.updated_at`, with source-owned triggers, provide freshness evidence for quote metadata and later invoice-plan assignment/cancellation changes. Published record versions are recomputed by the server from recursively key-sorted compact JSON so the hash is stable across PostgreSQL and TypeScript runtimes.

The allowlist keeps customer identity, contact, project, commercial, and financial facts while excluding raw enquiry payloads, attachments and storage paths, raw commercial design input, token hashes, PDF/email bodies and recipients, provider identifiers/errors, credentials, private execution data, and unrestricted audit JSON. The complete assembled record passes through the versioned recursive sanitizer, including ordinary free-text fields. Safe business shape such as `inputs.modules[].attachmentSide` and the validated lowercase 64-hex `commercialInputHash` remains; forbidden keys are removed and recognisable credential strings become `[redacted]`. Each record and page carries the sanitizer policy plus redaction/omission counts and sorted categories, so transformed data is never presented as complete. Payloads are capped at 65,536 UTF-8 bytes, depth 8 from the root at depth 0, and 256 aggregate retained object keys plus array elements. Over-bound values become the exact marker `{ "_praxisOmitted": "source_bounds_v1" }`. The reader receives only schema/function/view access needed for these projections. It receives no base-table, private/auth/storage, sequence, write-RPC, or unexpected callable security-definer access. A separate per-environment LOGIN and exact identity row are deliberately not created by the migration and remain deployment work.

The HTTP boundary permits only full authoritative replacement snapshots. `changedAfter` is rejected because Sanctuary's permitted hard-delete paths do not yet emit reporting tombstones; Velt must replace the scoped snapshot only after every page succeeds. The internal SQL filter remains covered for freshness diagnostics but is not an externally supported synchronisation contract.

`npm run test:praxis:db:fast` is a fast PGlite contract check. `npm run test:praxis:db` is the authoritative disposable PostgreSQL 17 role/grant denial proof, including an exact LOGIN with read-only default, writes attempted again after disabling that default, and representative commercial write-RPC denial. Neither command targets a shared database.

## Durable Background Jobs

Owner docs: this schema map owns the current database boundary; `docs/target-architecture.md` owns the long-term worker path, while `docs/security-privacy-quality.md`, `docs/environment-auth-supabase.md`, and `docs/testing-and-qa.md` own security, setup, and verification. Each business job kind still belongs to its existing workflow doc until a later task migrates that producer and handler.

Current scope:

- JOB-01 is the proven durable database foundation. JOB-02 adds an RPC-only worker runtime plus safe runtime-context, aggregate-metrics, and worker-health projections. JOB-03 adds the shared durable email-effect/provider contract, a signed provider-acceptance reconciliation boundary, and lease-fenced local acceptance conflict quarantine. No app producer or commercial workflow handler consumes the worker path yet. Quote/invoice delivery remains request-bound but now uses its own private commercial intent/checkpoint boundary; automation/outbox ownership remains unchanged until its named rollout.
- The shared `@sp/jobs` registry declares versioned policy for `deposit_invoice_prepare_and_send`, `quote_send`, `quote_resend`, `job_pack_generate`, `automation_event`, and `email_outbox_deliver`, with every commercial default rollout mode still `legacy`. PR-AI-007 adds `ai_synthetic_v1` as the only `worker_enabled` kind and the only registered handler; it is deterministic and has no external effect.
- Registry policy keeps `requiredHandlerCheckpoints` for domain-owned freeze/stage/business-finalisation milestones separate from allowed and required external effects. The database snapshots `has_external_side_effect`, `allowed_effect_kinds`, `required_effect_kinds`, and cancellation policy onto each accepted job so a later registry edit cannot change policy beneath durable work. `background_job_complete` rejects success until every recorded worker effect is terminal and every required kind has a durable `finalised` checkpoint; shadow work may retain prepared checkpoints but cannot dispatch.
- JOB-04 through JOB-08 remain pending. The presence of kinds, tables, RPCs, a provider gateway, or a dark worker artifact is not producer, handler, deployment, or rollout evidence.

Queue, tables, and history:

- Logged PGMQ queue: `portal_background_jobs`. Its message contract is exactly a UUID-string `jobId` plus a positive-integer `contractVersion`; the queue is only a wake-up pointer. Migration fails closed if that canonical name already belongs to an unlogged queue.
- Policy and durable state: `background_job_kinds`, `background_jobs`.
- Frozen protected input: `private.background_job_payloads`. Rows are immutable and direct access is revoked, including from `service_role`.
- External-effect checkpoints and provider identity: `background_job_effects`, with strict effect-state transitions, one stable effect key per job, and unique non-null provider message and idempotency identities. Same-identity failed work may re-enter dispatch; uncertain work may re-enter dispatch only inside its live idempotency window.
- Verified provider evidence: `private.background_job_provider_receipts`. Rows are append-only and contain only bounded provider/event/message identity, provider timestamp, safe job/effect correlation, reconciliation outcome, matched IDs, and receipt time. Raw webhook bodies/signatures, recipients, subjects, content, arbitrary tags, provider reasons, and frozen idempotency keys are not stored.
- Append-only state/effect audit history: `background_job_events`. Event content is immutable; only database foreign-key cleanup may clear the nullable job or actor reference.
- Worker liveness and drain/health state: `background_workers`.

Service-role RPC boundary:

- Enqueue: `background_job_enqueue_staff`, `background_job_enqueue_system`. The `staff` name records user attribution; it is still executable only by `service_role`, not by the browser `authenticated` role.
- Claim and lease: `background_jobs_claim`, `background_job_read_payload`, `background_job_read_effects`, `background_job_read_runtime_context`, `background_job_heartbeat`, `background_worker_heartbeat`. Payload, effect, and runtime-context reads require the current lease; the effect projection contains only the frozen identity needed to resume a checkpoint after restart and is not a staff-safe read.
- Lifecycle and effects: `background_job_record_progress`, `background_job_record_effect_checkpoint`, `background_job_record_provider_acceptance`, `background_job_complete`, `background_job_schedule_retry`, `background_job_mark_needs_attention`, `background_job_mark_permanent_failure`, `background_job_request_cancellation`, `background_job_acknowledge_cancellation`, `background_job_release_lease`, `background_job_manual_retry`. Local `provider_accepted` writes use the specialised lease-fenced acceptance RPC; all other effect checkpoints use the generic RPC.
- Verified webhook reconciliation: `background_job_reconcile_verified_provider_acceptance`. Only the portal webhook repository may invoke this service-role RPC after bounded raw-body Svix verification; the database does not verify public HTTP signatures.
- Recovery and inspection: `background_jobs_recover_expired_leases`, `background_jobs_reconcile`, `background_jobs_queue_health`, `background_jobs_runtime_metrics`, `background_workers_list_safe`, `background_job_get_safe`, `background_jobs_list_safe`, `background_job_event_history_safe`.

Primary write path:

- One security-definer enqueue transaction validates the registered kind/version, rollout owner, stable intent key, and frozen input. A transaction-level advisory lock serialises concurrent first-enqueue calls for the same kind/intent. PostgreSQL computes the canonical SHA-256 from normalized `jsonb`, persists it as `input_hash`, then creates or reuses the ledger row, inserts the private payload, sends the minimal logged queue message, stores the canonical message ID, and appends the enqueue event. Callers do not supply or claim a matching hash because JavaScript serialization is not PostgreSQL `jsonb` canonicalization; `inputHash` is durable output/identity evidence.
- Workers use the granted RPCs only. Claim creates a random per-claim lease token; payload reads and every worker lifecycle/effect mutation require the same worker ID and current unexpired token.
- Generic progress cannot enter `dispatching`. Provider dispatch goes through the effect-checkpoint RPC with frozen provider/idempotency identity and a live expiry; a restarted lease owner retrieves that same identity through `background_job_read_effects`. Expired in-flight dispatch becomes `uncertain`, and unresolved, expired, or attempt-exhausted uncertainty moves to `needs_attention` before a generic retry-exhaustion branch can hide it as an ordinary failure.
- Durable email dispatch freezes one job/effect-derived provider key, exact normalized request body and SHA-256, `job_id` plus opaque `effect_ref` tags, and a 20-hour automatic retry expiry inside Resend's documented 24-hour retention window. The package fixes both configuration constants; the database freezes the chosen expiry on the effect and rejects a Resend expiry later than effect `created_at + 24 hours`. Recovery may retry only the same key and request before that expiry and the attempt limit; it never creates a new key after an uncertain outcome. Expiry blocks redispatch, not later signature-verified acceptance evidence.
- `POST /api/webhooks/resend` caps the streamed body before buffering beyond 256 KiB or verifying the untouched UTF-8 bytes and Svix headers, acknowledges untagged account-wide callbacks from request-bound legacy sends without persistence, and rejects a partial/malformed durable tag pair. `apps/portal/lib/backgroundJobs/providerWebhookRepository.ts` passes only a bounded correlated envelope to `background_job_reconcile_verified_provider_acceptance`. Signed acceptance advances matching `dispatch_started`/`uncertain`/`failed` evidence but reactivates an operator-terminal job only for the named stale provider-outcome classifications. Exact request, key, provider-message, and effect-identity conflicts remain operator-visible. A local response conflicting with an already-recorded webhook message, or colliding with another effect's message ID, is atomically archived and moved to `needs_attention` by `background_job_record_provider_acceptance`; heartbeat renewal is drained around that terminal-capable RPC. A conflicting signed callback found after success or cancellation also moves the durable job to attention while preserving the finalised effect and prior completion evidence. Neither RPC performs quote, invoice, outbox, or other business finalisation. Correlated-but-unmatched evidence is recorded without mutating a job.
- Retry, cancellation, expired-lease recovery, orphan/duplicate repair, canonical message archive, and terminal business status remain explicit RPC state transitions. A cancellation request fences retry/failure/attention/release mutations until the current worker acknowledges it, and reconciliation durably records a missing canonical message before repair. Queue visibility or archive alone is not business completion.
- Automatic retry may absorb one lost provider-outcome checkpoint only by atomically converting exactly one `dispatch_started` effect to `uncertain` while preserving its frozen provider identity. It is blocked for missing or ambiguous dispatch evidence, provider-accepted/finalised work, exhausted attempts/windows, and uncertainty whose provider idempotency window would expire by the planned delay.

Primary read path:

- Future server/admin surfaces should use the explicit safe inspection RPC projections, not direct tables. No JOB-01/JOB-02/JOB-03 browser or portal UI read path exists; the public provider route is a write-only verified reconciliation boundary, not an inspection surface.
- Workers receive the minimal claim record first and may retrieve frozen execution input and frozen effect replay identity only through `background_job_read_payload` and `background_job_read_effects` while they own the current lease. Neither projection is browser-safe or browser-executable.

Access rule:

- RLS is enabled on every public job table, and public/anonymous/authenticated table and function access is revoked. Browser roles also have no PGMQ schema access.
- Direct service-role job-table, PGMQ, private payload, and private provider-receipt access is revoked. Explicitly granted security-definer RPCs are the service-role capability boundary.
- Progress, result, effect, event, and worker summaries each use an explicit flat field allowlist, bounded counts/bytes, and value-level rejection of obvious recipient, URL, credential, hash, name, and provider content. Safe staff inspection uses explicit columns rather than returning table rows. Sensitive payloads must never be copied into queue messages, safe summaries, logs, or public props.

Migration and test source:

- `supabase/migrations/20260720_000001_background_job_foundation.sql`: PGMQ queue, enums, policy seed, ledger, private payload, effects, events, workers, transition guards, RLS, and revokes.
- `supabase/migrations/20260720_000002_background_job_enqueue_claim.sql`: atomic enqueue, canonical queue message, claim, payload read, application heartbeat, and worker heartbeat.
- `supabase/migrations/20260720_000003_background_job_lifecycle.sql`: progress, effect checkpoints, completion, retry, attention/failure, cancellation, lease release, and manual retry.
- `supabase/migrations/20260720_000004_background_job_reconciliation.sql`: expired-lease recovery, queue reconciliation/repair, health, and safe inspection.
- `supabase/migrations/20260720_000005_background_job_contract_hardening.sql`: frozen allowed-effect/cancellation policy, context-safe summaries and explicit safe projections, exact queue-body validation and repair, restart-safe lease-fenced effect identity, provider-window/max-attempt uncertainty guards, and narrowed grants.
- `supabase/migrations/20260720_000006_background_job_worker_runtime.sql`: lease-fenced runtime context, aggregate queue/job/worker lifecycle metrics, safe worker listing, and explicit service-role-only grants.
- `supabase/migrations/20260720_000007_background_job_provider_reconciliation.sql`: bounded Resend idempotency expiry, append-only minimal provider receipts, verified acceptance reconciliation, lease-fenced local provider acceptance and message-ID conflict quarantine, late-terminal conflict attention, same-key uncertainty recovery, finalisation wake-up, and narrowed grants.
- `supabase/migrations/20260818000004_ai_synthetic_execution.sql`: `ai_synthetic_v1` policy, immutable task/job linkage, zero-cost usage/evaluation evidence, service-only exact enqueue, linked lifecycle synchronisation, and atomic deterministic completion validation.
- `supabase/tests/background_jobs_bootstrap.sql` creates only the disposable auth/projects/role prerequisites needed by the isolated contract; it is test support, not a production migration.
- `supabase/tests/background_jobs.sql` and `supabase/tests/ai_synthetic_execution.sql` are executable database contracts. `npm run test:jobs` covers TypeScript plus static SQL/security assertions; `npm run test:jobs:db` is the Docker-backed real-PGMQ harness and performs the exact PR-AI-007 rollback rehearsal before applying and testing it.

Verification status:

- `npm run test:email-provider` passed locally on 2026-07-20 with 3 files and 47 tests; `npm run test:email-integrations` passed 8 files and 38 tests; `npm run test:jobs` passed 8 files and 144 tests across provider/package contracts, static migration contracts, and repository security; and `npm run test:worker` passed 12 files and 134 tests. Worker/portal typechecks and the prior checkpoint build, scoped lint, architecture, and security gates are green and are rerun before the checkpoint commit.
- `npm run test:jobs:db` was attempted locally and stopped at the Docker readiness check with `spawnSync docker ENOENT`; no local container started and no SQL executed. Background Jobs [run 29723041212](https://github.com/velt-design/sanctuary/actions/runs/29723041212) passes the rollback-wrapped seven-migration JOB-01/JOB-02/JOB-03 contract against upstream PostgreSQL 18/PGMQ 1.10.0 and Supabase PostgreSQL 17/PGMQ 1.5.1, including the concurrent enqueue and provider-message collision contracts, plus job/security contracts, application integrations, worker runtime, strict service-role, and non-root container gates. No shared-environment migration or rollout is implied.
- JOB-03 local provider, integration, worker, contract, typecheck, lint, security, and production-build gates pass, and the seven-migration checkpoint CI evidence is green in run 29723041212. No shared database was touched, no production deployment occurred, no real email was sent, and no handler, producer, or rollout was enabled.

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

Owner docs: `docs/automation-email-audit.md`, `docs/project-work-items-and-follow-up.md`, `docs/project-work-items-technical-plan.md`, `docs/platform-workflow.md`, `docs/security-privacy-quality.md`, `docs/projects-contacts-estimates-calculator.md`, and `docs/staff-api-auth-contracts.md`.

Tables/RPCs:

- Marketing/enquiries: `enquiry_requests` (`submission_id` is the idempotency key), `project_enquiry_attachments`, append-only `project_enquiry_attachment_events`, service-only `project_enquiry_attachment_backfill_runs`, `marketing_public_rate_limits`, `marketing_enquiry_upload_sessions`, `marketing_conversion_deliveries`
- Marketing conversion delivery RPCs: `marketing_conversion_delivery_claim()` and `marketing_conversion_delivery_complete()`
- Email and automation: `email_templates`, `email_outbox`, `audit_events`, `design_package_tickets`; `tasks`, `followup_plans`, and `followup_tasks` remain read-only legacy evidence
- Project command centre: `project_owner_assignments` and `project_command_audit`; `project_manual_actions`, `project_action_controls`, `project_primary_action_selections`, `project_action_versions`, and `project_role_assignments` remain read-only legacy evidence
- Project Work V2: `project_work_model_versions`, `project_operational_states`, `project_state_events`, `project_work_items`, `project_work_item_events`, `project_confirmation_events`, `project_command_receipts`, `project_work_repair_signals`, and `business_calendar_year_coverage`
- Project Work V2 RPCs: `project_create_v2()`, `project_work_item_command()`, `project_operational_state_command()`, `project_confirmation_command()`, `project_work_archive_command()`, `project_work_integrity_report_v2()`, `project_work_queue_v3()`, `staff_projects_index_v2()`, `staff_project_state_counts_v1()`, and server reconciliation/fact commands
- Admin correction RPCs: `project_confirmation_retraction_command()` and exact-signal/version `project_confirmation_retraction_review_command()`. The former Contacted classifier, evidence helper, and one-project migration RPCs are retired and have no `public`, `anon`, `authenticated`, or `service_role` execution grant.
- Site-visit automation support: `site_visit_events`
- Dashboard/supporting RPC: `dashboard_snapshot_v1()`
- Personal dashboard tasks: `portal_dashboard_tasks`

Primary write path:

- Marketing enquiry APIs under `apps/marketing/app/api/contact` and `apps/marketing/app/api/enquiry`. Contact/project/enquiry intake goes through the service-only `marketing_enquiry_intake` RPC; durable public rate limits and upload session preparation/cleanup use the narrow `marketing_public_rate_limit_take` and `marketing_enquiry_*upload*` RPCs.
- New enquiry-file linkage is an `AFTER INSERT` trigger in the same intake transaction. It requires the exact private `storage.objects` path and copies the existing validated JSON metadata into `project_enquiry_attachments`; explicit enquiry project reassignment follows to the link table and is audited. Authenticated staff may read metadata through RLS. After an exact auth-bound project/file lookup, only the server-owned client can sign the private object for 60 seconds; authenticated browser sessions have no enquiry-bucket object-read policy and cannot bypass the audited route. Historical application is service-only, run-ID idempotent, and accepts only a separately reviewed exact dry-run candidate payload; see `docs/project-enquiry-attachments.md`.
- `20260827000001`, its schema-cache reload `20260827000002`, and signing-boundary correction `20260827000003` were exact-file applied and ledgered in positively identified staging and production on 2026-08-27 after completed physical backups and rollback rehearsals. The final correction removed the authenticated enquiry-object Storage read policy in both environments; its canonical-LF SHA-256 is `a30875a29b713ccf7dd6f410dde41145f6fcc66ea26fc69a0921dfaa50932f70`. Production migration created no link rows. Its dry run found 59 exact candidates plus 22 ambiguous declarations and nine changed-project entries, so the historical backfill remains unapplied pending separate exact-report review.
- Eligible downstream marketing `audit_events` inserts enqueue one GA4 outbox row through the database trigger. The scheduled marketing delivery route claims and completes rows only through the leased service-role RPCs; it never writes the outbox table directly.
- Portal automation under `apps/portal/lib/automation` remains for owned audit, email, and specialist side effects; it is not a legacy project-task writer.
- Project action routes that enqueue or preview email/outbox entries.
- Dashboard snapshot is read-oriented and should not become a generic write boundary.
- Personal dashboard task writes go through staff-only dashboard task APIs under `apps/portal/app/api/dashboard/tasks`.
- Project owner writes go through `project_command_set_owner`. The legacy `project_command_action` and `project_command_sync_design_task` mutation paths are revoked by the portfolio rollout; specialist owners write their own current facts.
- V2 work, operational state, bounded confirmation, archive, and Running Jobs fact changes go through their semantic RPC commands. Governed tables and append-only history reject direct writes; accepted commands refresh the one-way `projects.next_action*`/`follow_up_date` compatibility projection.
- Confirmation correction is admin-only and appends a retraction, command receipt, and open review signal. Review resolution locks and updates only the supplied signal ID when its row version is unchanged. It does not update or delete the original confirmation.
- A server trigger owns real pipeline-stage entry. It cancels only the prior active `STAGE_REVIEW`, preserves manual/cadence/specialist/reviewed work, and creates at most one five-Auckland-business-day `STAGE_REVIEW` obligation for active non-`NEW`/non-`PAID` stages. Same-stage and case-only replays do nothing, and missing calendar coverage fails the transition atomically. `SITE_VISIT` creates only a proposal-review obligation; it never creates or links a Site Visit task.

Primary read path:

- Marketing lead and enquiry route handlers.
- The scheduled marketing conversion route reads only the explicit claim projection returned by `marketing_conversion_delivery_claim()`.
- Portal project snapshot, dashboard task, and automation helpers under `apps/portal/lib/projects`, `apps/portal/lib/dashboard`, and `apps/portal/lib/automation`.
- Dashboard cached snapshot helper under `apps/portal/lib/dashboard/getDashboardSnapshotCached.ts`.
- Dashboard data helpers under `apps/portal/lib/dashboard` read recent project-note activity and user-owned dashboard tasks.
- The full staff Work Queue and Dashboard preview call `project_work_queue_v3()` through the auth-bound server repository and compose canonical specialist candidates in `apps/portal/lib/projects/workItems/teamQueue.ts`. The repository reads 1,000-row hosted-safe ranges, fails closed when the explicit 5,000-row SQL ceiling is reached, and separately calls `staff_project_state_counts_v1()` to prove whole-portfolio marker/state completeness before returning rows. Projects and Dashboard state counts use the same strict project/state RPCs, not browser-derived lifecycle truth.

Access rule:

- Marketing public routes can create lead/enquiry records through server code, but must not expose broad staff data.
- Browser roles have no table or function access to marketing rate-limit/upload-session state. Direct table access is revoked from `service_role`; server routes use only the explicit security-definer RPCs.
- Browser roles and `service_role` have no direct `marketing_conversion_deliveries` table access. Only `service_role` may execute its leased claim/complete RPCs.
- `marketing_enquiry_intake` serializes a submission UUID, returns the existing contact/project/enquiry IDs on replay, validates and consumes any short-lived upload binding, and creates all three business rows in one transaction.
- Email/outbox and audit writes are server-owned side effects.
- Automation may use service-role access only on the server and only for intentional bypasses documented by the owning workflow.
- Audit/supporting tables should stay append-oriented where possible.
- Personal dashboard tasks are owned by `owner_id = auth.uid()` and are independent from automation/project workflow `tasks`.
- Legacy command-centre/task/follow-up/check tables allow only the portal reads needed for historical evidence. Their DML grants, write triggers, old action/sync commands, and Contacted classifier/migration execution are retired. The project-owner command remains admin-only and accepts Ellen, Jordan, JP, Joe, Bruce, or Dave. Active New/Contacted projects are transactionally kept with Ellen; Proposal and Dave handoffs remain manual. The append-only command audit retains actor IDs where available. `project_enquiry_inactivity_report_v1()` is admin/service read-only, excludes migration/system-only V2 events, and reports future Waiting protection plus an evidence fingerprint. `project_enquiry_bulk_close_v1()` is an authenticated-admin-only, receipt-backed command: it accepts a bounded exact candidate list, locks and revalidates every original/current activity record before writing, rejects the whole transaction on drift or future Waiting protection, and delegates each `Lost - No response` transition to `project_operational_state_command()`. `project_enquiry_close_batches` is RLS-enabled with no direct grants and stores only top-level idempotency receipts. `20260801000002` is applied in positively identified staging and production from exact SHA-256 `f04793197301526f4c0b5d15e434bbede43ef51ace73f48b903bdf769d10a8ef`; production postflight had zero receipts and therefore zero deployment-time closes.
- V2 work tables expose only the RLS reads required by portal staff; writes are governed by semantic command functions. Database write guards reject prohibited Call/Site Visit work and reopening/retyping retired `LEGACY_REVIEW` rows even through direct RPC execution while allowing the rollout to cancel existing rows. Governed and append-only child guards distinguish a real quote/project cascade from a direct delete, preserving the existing confirmed admin project-delete route without opening child-row deletion. Staff queue reads require portal access, and confirmation correction remains admin-only.
- Personal Dashboard reminders remain private user-owned scratch data and never enter `project_work_queue_v3()` or project primary-action precedence.

Migration source:

- `supabase/enquiry_requests.sql`, `supabase/automation_phase_a.sql`, `supabase/email_templates_website_autoresponder.sql`, `supabase/dashboard_snapshot_v1.sql`, and security hardening.
- `20260723_000001_marketing_enquiry_intake_security.sql` adds the enquiry idempotency constraint, atomic intake, durable rate limiting, submission-bound upload sessions, cleanup RPCs, RLS/revokes, and retention schedule. Apply it before deploying the matching marketing routes.
- `20260724043000_marketing_enquiry_budget_columns.sql` forward-adds the nullable indicative-pricing columns consumed by `marketing_enquiry_intake`; the root `enquiry_requests.sql` baseline does not evolve an already-existing table.
- `20260801_000001_project_owner_handoffs_and_enquiry_inactivity.sql` extends the Project Owner roster, applies the Ellen Enquiry policy on create/re-entry, backfills current active Enquiry ownership with audit evidence, keeps later handoffs manual, and adds the read-only inactivity report.
- `20260730_000001_marketing_conversion_delivery.sql` adds the RLS-protected GA4 outbox, eligible-audit trigger, 72-hour nearby-event backfill, and leased service-role-only delivery RPCs. Apply it before enabling the scheduled sender.
- Personal dashboard tasks use ordered migrations under `supabase/migrations`.
- `20260720_000008_project_command_centre_stage2.sql` promotes task/follow-up setup into ordered truth and owns command-centre tables, RLS/grants/indexes/backfills/RPCs, and compatibility projection columns.
- `20260721_000001_project_command_single_owner.sql` replaces the three-role owner contract with one named project owner, performs the deterministic legacy backfill, and replaces the owner command.
- `20260729_000002_project_work_items_v2.sql` adds the model marker, state/work/confirmation/receipt/event/repair/calendar truth, semantic commands, initial V2 queue, one-way compatibility, and new-project-only initialization.
- `20260729_000003_project_work_items_v2_schema_cache.sql` canonicalizes the named `project_work_model_versions.project_id -> projects.id ON DELETE CASCADE` and `project_operational_states.project_id -> projects.id ON DELETE CASCADE` foreign keys, removing conflicting same-relationship constraints, then requests the PostgREST schema reload after commit.
- `20260729_000004_project_work_queue_and_legacy_triage.sql` adds the richer queue, append-only confirmation correction, admin-only no-contact-field Contacted classifier, and guarded one-project reviewed migration, then requests its PostgREST schema reload after commit. It is forward-only and does not backfill or mutate the Contacted cohort when applied.
- `20260731000002_project_work_portfolio_rollout.sql` supersedes the mixed-mode/legacy-review rollout. In one idempotent transaction it closes the cohort through the private project-independent `project_work_portfolio_rollouts` ledger, records one rollout event for every project present at the fixed timestamp including already-V2 projects, repairs partial marker/state rows, applies current-stage timing once, maps Archived and Paid projects without active work, and cancels active legacy-review or prohibited Call/Site Visit work with audit evidence. The independent ledger prevents later replay after an empty cohort or valid project deletion. A deferred constraint trigger initializes later projects inserted through retained import/bootstrap writers after the canonical create RPC has had first ownership. The migration preserves staff-entered states, non-prohibited work, confirmations, notes, commercial/project facts, and legacy rows; backfills Running Jobs facts from legacy checks before making legacy workflow tables read-only; makes retired review rows terminal, rejects future prohibited work at the database boundary, preserves the existing admin hard-delete cascade including repair signals, revokes retired legacy-review/action execution, adds the strict project/state read RPCs, and raises the queue cap to 5,000. This true 14-digit migration is applied in positively identified staging and production. Production execution used the exact reviewed SHA-256 `a9e91e48e0a894bbe9201cc39c7ba5e83c4d33b9d8912c0b6d369bf058755ef3` after a rollback rehearsal and completed physical-backup check; the migration ledger records version `20260731000002`.
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

`npm run test:jobs:db` requires Docker and creates/removes its own disposable logged-PGMQ Postgres container. It applies only the test bootstrap plus the seven JOB-01/JOB-02/JOB-03 migrations because the historical migration chain is not independently bootstrappable; a static pass or missing local Docker must never be reported as a live database pass.

When changing auth, RLS, grants, or API access, also use `docs/staff-api-auth-contracts.md` and `docs/environment-auth-supabase.md` for route/auth verification. When changing Schedule V2 tables or RPCs, run the readiness checks in `docs/schedule.md`.
