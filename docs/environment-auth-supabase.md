# Environment, Auth, And Supabase

This repo uses Supabase for app data and Supabase Auth for the staff portal.

## Read First

- Use `## Core Environment Variables` before running local portal, browser, email, Supabase, or operational commands.
- Use `## Staff Portal Auth` and `## Authenticated Browser Test Account` before auth or Playwright work.
- Use `## Supabase Setup`, `## Service Role Boundaries`, and `## RLS And Permissions` before schema, service-role, or access-policy changes.
- Use `## Durable Background-Job Database Setup` before applying or testing JOB-01/JOB-02/JOB-03 migrations or configuring the worker/provider reconciliation boundary.
- Use `## Troubleshooting` for missing role rows, schema-cache issues, readiness failures, or schedule fallback.

## Core Environment Variables

Most local portal work needs:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Common optional or feature-specific variables:

- `RESEND_API_KEY`
- `RESEND_API_KEY_PREVIEW` (server-only, sending-only Resend key used only by the authenticated website-autoresponder review flow in Vercel Preview deployments)
- `EMAIL_PREVIEW_ENABLED` (must be exactly `true` for the fixture-only review route; keep unset or false in Production)
- `EMAIL_PREVIEW_TO` (one server-configured review recipient; the browser cannot override it)
- `RESEND_WEBHOOK_SECRET` (portal server only; verifies the untouched raw Resend/Svix webhook body at `/api/webhooks/resend` before reconciliation)
- `EMAIL_FROM`
- `EMAIL_REPLY_TO`
- `EMAIL_TO_RESIDENTIAL`
- `EMAIL_TO_PROFESSIONAL`
- `EMAIL_TO_COMMERCIAL`
- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_MARKETING_SITE_URL`
- `NEXT_PUBLIC_FB_PIXEL_ID`
- `NEXT_PUBLIC_GTM_CONTAINER_ID` (optional; falls back to the current checked container ID and loads only after an explicit analytics or marketing choice, with consent mode preserving the denied category)
- `GA4_MEASUREMENT_ID` (server-only Measurement Protocol stream ID for downstream consented lifecycle events; currently the same web stream used by GTM)
- `GA4_MEASUREMENT_PROTOCOL_API_SECRET` (server-only GA4 data-stream API secret; never use a browser-prefixed variable or log the request URL)
- `MARKETING_ABUSE_HASH_SECRET` (preferred production server-only HMAC key for durable public rate-limit identifiers; when absent, marketing derives a domain-separated HMAC subkey from the already-required `SUPABASE_SERVICE_ROLE_KEY`, and still fails closed if neither secret exists)
- `CRON_SECRET` (server-only bearer secret used by the scheduled abandoned-enquiry-upload cleanup and GA4 lifecycle-delivery routes)
- `META_CONVERSIONS_API_TOKEN`
- `META_GRAPH_API_VERSION`
- `META_CAPI_TEST_EVENT_CODE`
- `GOOGLE_PLACES_API_KEY` (server-only; powers the live Google review badge via `apps/marketing/lib/googleReviews.ts`. First-party server fetch with 24h ISR, no client script or consent category. Falls back to the baseline in `apps/marketing/data/reviews.ts` when absent, so local/CI builds work without it.)
- `PORTAL_TEST_EMAIL`
- `PORTAL_TEST_PASSWORD`
- `PORTAL_BASE_URL`
- `PORTAL_DRAWING_URL`
- `NEXTAUTH_SECRET` or `AUTH_SECRET` for legacy NextAuth-backed paths.

Never commit real env files. `.env*` is ignored.

Authenticated staff can render and compare the marketing autoresponder workbench in production, but production is deliberately read-only. Inbox delivery is available only when the portal runs in a Vercel Preview environment, or locally in development/test, and `EMAIL_PREVIEW_ENABLED=true`. Configure all three preview variables on the `sanctuary-portal` Vercel project for Preview only. `RESEND_API_KEY_PREVIEW` must contain the actual Resend secret value (normally beginning `re_`), not the display name assigned to that key in Resend. Redeploy the branch after adding or changing any preview variable because an already-built deployment does not receive the new value. The current review recipient is `jordan@sanctuarypergolas.co.nz`. The staff preview page reports the exact safe configuration reason when sending is not ready. Each alternative is sent with a distinct `[Preview: <layout>]` subject; the browser cannot override the recipient or email content.

## Staff Portal Auth

The portal uses Supabase Auth plus `public.portal_users`.

- Valid roles: `admin`, `staff`.
- Access state is resolved in `apps/portal/lib/portalAccess.ts`.
- Server session helpers live in `apps/portal/lib/auth.ts`.
- Staff APIs should call `requireStaffSession` or `requireStaffContext`.
- Admin APIs should call `requireAdminSession` or `requireAdminContext`.
- Browser auth state is provided by `apps/portal/components/auth/PortalAuthProvider.tsx`.
- Route helper selection, diagnostics, response conventions, and public token route boundaries are documented in `docs/staff-api-auth-contracts.md`.

`PortalAuthProvider` seeds its state from the server-verified render and then
reconciles the browser session. A browser `getSession()` or token-refresh
transport failure is not evidence that the user signed out: the provider keeps
an existing server-known authenticated or unauthenticated state, maps only an
unresolved loading state to `lookup_failed`, and must not leave an unhandled
promise that can take over a development or QA page. A successful browser
session read remains authoritative and continues through the normal role check.

If a user can sign in but sees no portal data, check that they have a `portal_users` row.

## Authenticated Browser Test Account

Authenticated Playwright smoke and performance gates use `PORTAL_TEST_EMAIL` and `PORTAL_TEST_PASSWORD`. The test account must have an active `staff` or `admin` portal role, a compatible migrated portal schema, Schedule V2 readiness returning `200` with `ok: true`, and at least one visible project so project-list and route-performance coverage can run.

Use `npm run portal:auth-env` to check credential presence and `npm run portal:auth-runtime` to check the role, session, schedule readiness, and minimum dataset before running deeper authenticated browser gates.

To provision or reset a local/staging browser-test account, use the explicit service-role command:

```bash
PORTAL_TEST_PROVISION_TARGET=local npm run portal:test-user:ensure
PORTAL_TEST_PROVISION_TARGET=staging npm run portal:agent-access:provision
PORTAL_TEST_SCENARIO_TARGET=local npm run portal:scenarios:ensure
PORTAL_TEST_PROVISION_TARGET=staging PORTAL_TEST_SCENARIO_TARGET=staging npm run portal:agent-scenarios:provision
```

Provisioning requires `PORTAL_TEST_EMAIL`, `PORTAL_TEST_PASSWORD`, `NEXT_PUBLIC_SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY`. `PORTAL_TEST_ROLE=staff|admin` is optional and defaults to `staff`. The command refuses missing targets and `production`; routine browser gates never provision or mutate users.

Seeded scenario provisioning uses the same credential and service-role boundary with `PORTAL_TEST_SCENARIO_TARGET=local|staging`. It writes deterministic local/staging `[Agent Scenario]` contact, project, estimate, and quote records, then saves non-secret route IDs to `playwright/.auth/portal-scenarios.json`. Routine scenario browser gates read that file only.

Controlled local/staging one-time sign-in uses
`/login/callback?token_hash=...&callbackUrl=...`. The callback verifies only a
Supabase `magiclink` token through the normal anon-key server client, requires
the session cookie write to succeed, removes the token from the next URL, and
accepts only a normalized same-origin callback path. Its responses remain
`private, no-store` with `Referrer-Policy: no-referrer`. Never redirect an
admin-generated action link straight to a protected page: middleware runs
before a fragment session exists and can strand access/refresh tokens on the
login URL. Never log, screenshot, or persist either token form. One-time QA
links should be opened from a signed-out/private context and must remain a
controlled local/staging tool rather than a routine production login flow.

## Creating Portal Users

Use the invite script from the repo root:

```bash
npm run portal:invite -- --email user@example.com --role admin
npm run portal:invite -- --email user@example.com --role staff --password TEMP_PASSWORD
```

Without `--password`, Supabase sends an invite email. With `--password`, the user can sign in immediately.

## Supabase Setup

Apply ordered migrations in `supabase/migrations/` for current portal behavior. Legacy baseline SQL files in `supabase/` are snapshots and should not be treated as the preferred migration path.

Use `docs/supabase-schema-map.md` to confirm table/RPC ownership, write paths, access boundaries, and migration sources before schema-affecting changes.

Commercial workflow trust requires `20260728_000001_commercial_workflow_trust.sql` followed by `20260728000002_commercial_quote_stale_conflict.sql`. Validate both with `npm run test:commercial:db` before a shared-environment apply. The correction keeps stale quote revisions as an application conflict rather than PostgreSQL SQLSTATE `40001`, which infrastructure may retry.

If a linked environment has a sparse or historically divergent migration ledger, do not use a blanket `db push` or repair unrelated versions. Positively classify the target, inspect prerequisites and collision counts, run the exact forward file in a rollback transaction, apply only that reviewed file, and verify the resulting schema/function body. Record the version only when it is unambiguous. Supabase CLI treats the digits before the first underscore as the version, so date-only siblings such as `20260729_000001` through `_000004` collide as remote version `20260729`; do not use `db push`, `migration up`, or `migration repair 20260729` for that group. Preserve exact-file hashes and deployment evidence separately until the naming/ledger convention is repaired. Production remains a separate reviewed deployment.

Project Work V2 has a read-only staging readiness preflight:

```powershell
$env:PORTAL_PROJECT_WORK_V2_READINESS_TARGET='staging'
$env:PORTAL_PROJECT_WORK_V2_STAGING_PROJECT_REF='tnsiprehuldksnuowubv'
$env:PORTAL_PRODUCTION_SUPABASE_PROJECT_REF='iytanftukulcnavossmd'
npm run portal:project-work-v2-readiness
```

These public project references identify `SP-Staff-Portal-Staging` and the
Supabase project currently configured on the Vercel `sanctuary-portal`
Production environment, respectively. They were reverified on 2026-07-30.
Recording the production reference strengthens the staging refusal guard; it
does not authorise a production migration or expose a credential.

The command requires the declared staging ref to exactly match the configured
`NEXT_PUBLIC_SUPABASE_URL`, rejects production/local/unknown targets before any
network request, uses only `NEXT_PUBLIC_SUPABASE_ANON_KEY`, requests no table
rows, and checks that the Work Queue plus current V3 portfolio index/state RPCs are present
while anonymous access remains denied. It reports `000002`, `000003`, `000004`,
`20260731000002`, or `20260731000003` separately when that prerequisite contract is absent. It
does not apply migrations, create records, authenticate staff, or exercise any
lifecycle/customer side effect.

Project Work V2 entered production on 2026-07-30 through a controlled exact-file
apply to the positively identified `SP-Staff-Portal-DB` project
`iytanftukulcnavossmd`, after portal release merge `c9e73651` was deployed and a
completed physical backup was confirmed. The canonical-LF SHA-256 values were
`9186b67413de119f472e6d457290d4866d403a742ef3ed09a089c82f10e47274` for
`20260729_000002`, `c34875fba9d1419586732c7e480bbf945a538cf94403c76a28808dc792f60dfc`
for `000003`, and
`c0f023548bcb40313ed7df94d15324a587e9d756bfc29396c359139595e341cf` for
`000004`. Each reviewed file was applied individually through the linked query
boundary; `db push`, `migration up`, and migration repair were not used, and the
colliding `20260729` remote-ledger entry remains untouched. Postflight catalog
checks found all nine V2 tables with RLS enabled, the authenticated-only queue
function, the two canonical cascade relationships, and zero model markers,
operational states, work items, work events, confirmation events, or repair
signals. No pre-cutover project was migrated or backfilled, and the read-only
production QA changed no customer, project, quote, invoice, schedule, task, or
payment row.

The portfolio rollout `20260731000002_project_work_portfolio_rollout.sql` is now
deployed across all 1,151 production projects and its application/postflight is
complete through `6832a9dd`. The later
`20260731000003_project_pipeline_accountability_reads.sql` is a separate
read-only forward contract. Its exact SHA-256
`4297d1acd87d9ec523b71d13e962379fe8a47f4c12393d9bb6ad028e75a00c0b`
was rollback-rehearsed and applied to positively identified staging. On
2026-08-01 the same hash was rollback-rehearsed and applied to positively
identified production after a completed physical backup check; its unique
ledger version is recorded. Anonymous execution is denied. The immediate
authenticated GET-only production rerun restored Projects from `503` to `200`
and passed Projects, Dashboard, Work Queue, and Overview without a business
data write.

For a new environment, deploy the portfolio rollout first and the Pipeline
Accountability read migration second because the matching application
uses strict `staff_projects_index_v3()` and `staff_project_state_counts_v1()`
readers that reject an incomplete portfolio:

1. Positively identify the target project and environment, confirm a completed
   backup and a quiet write window, inspect the `000002`-`000004` prerequisites
   and migration ledger, and record the exact reviewed rollout file hash.
2. Rehearse that exact file in a disposable non-production database or rollback
   transaction. Do not use blanket `db push`, `migration up`, or migration
   repair for the colliding date-only `20260729` family.
3. Apply only `20260731000002_project_work_portfolio_rollout.sql`, then
   `20260731000003_project_pipeline_accountability_reads.sql`, then deploy the
   matching application immediately in the same controlled window. The
   migration intentionally writes portfolio marker/state/work and Running Jobs
   fact rows; it does not send email, accept a quote, create an invoice, record
   payment, schedule work, or contact a customer.
4. Keep postflight read-only. Confirm marker and state counts equal the project
   count with zero missing rows; inspect state/reason/work distributions; verify
   `staff_projects_index_v3()`, `staff_project_state_counts_v1()`, and
   `project_work_queue_v3()` bodies, grants, RLS, anonymous denial, and queue
   results beyond 500 rows where the fixture permits. Confirm legacy rows still
   exist while their DML, trigger, action/sync, and Contacted review RPC paths
   are revoked through catalog inspection, not a production write attempt.
5. Use an authenticated GET-only smoke for Projects, Work Queue, Dashboard, and
   Overview. Confirm Active/Waiting/Closed/Archived truth, Site Visits hidden,
   and no application request outside `GET`, `HEAD`, or `OPTIONS`. Never mutate
   shared customer, project, quote, invoice, schedule, task, or payment data
   during postflight.

Project-linked Design Booklets entered the production schema on 2026-07-31
through an exact-file apply of
`20260731_000001_project_design_booklets.sql` to the same positively identified
`SP-Staff-Portal-DB` project. Its SHA-256 was
`3af810d27c9406f2ba125cb74c0af6c09386b0ce703ba5bd2539c431d646a14e`.
The file passed a rollback rehearsal before apply. Postflight verified the two
RLS-enabled tables, six policies, eight authenticated grants, zero anonymous
grants, both timestamp triggers, the private Storage bucket contract, and zero
new booklet, asset, or Storage object rows. The date-only migration ledger was
left untouched, and no blanket migration command or repair was used.

The forward migration
`20260810_000001_project_design_booklet_pdf_drawings.sql` extends that boundary
for original drawing PDFs and verified page counts. It was applied to the
positively identified production `SP-Staff-Portal-DB` project on 2026-08-11
after a rollback rehearsal and confirmation of a completed physical backup.
Its SHA-256 was
`05ea530365da4de946bf36fc44d77557a666166d811df507e9a2c4c5fdaa0f0`.
Postflight verified all 82 existing asset rows retained `page_count = 1`, both
bounded constraints, and a successful PostgREST `page_count` select. The
colliding `20260810_000002` payment migration and the date-only migration ledger
were left untouched; no blanket push, migration-up, or repair command was used.
This is production evidence only; shared staging still requires its own
positive target check and exact-file apply before testing PDF drawing writes.

Commercial internal names entered the production schema on 2026-08-11 through
an exact-file apply of
`20260811000001_commercial_internal_names.sql` to the positively identified
`SP-Staff-Portal-DB` project `iytanftukulcnavossmd`. Its canonical-LF SHA-256
was `12929b6cf433bddcbc5e99ebebdca110bbfa11868294998e17552566c2ff0ceb`.
The exact file passed a rollback rehearsal after completed physical backup
`1340446792` was confirmed. Postflight verified nullable text columns and the
120-character constraints on both `estimates` and `quotes`, zero invalid or
backfilled names, successful PostgREST selects, and the unambiguous
`20260811000001` migration-ledger entry. No customer or commercial row was
changed.

The final commercial idempotency and truth boundaries entered the same
positively identified production project on 2026-08-18 through exact-file
application of `20260813000002_commercial_admin_action_idempotency.sql` and
`20260813000003_commercial_truth_invariants.sql`. Completed physical backup
`1395554116` was confirmed first. The reviewed SHA-256 values were
`a2fc31d070fece1c455895cadf65f31cffb1459fe7d038a1831336e2acac0626` and
`5e1a5a84ade2298d164a9b712524d6bc01662754f53452f869569593260f4018`.
Production preflight showed that the earlier commercial schema through
`20260813000001` was already structurally present despite its sparse ledger, so
those files were neither replayed nor repaired. The exact two-file transaction
passed a rollback rehearsal, then committed atomically with unambiguous ledger
entries whose stored bodies matched the reviewed files. Postflight verified the
new columns and unique indexes, fourteen security-definer truth/locking
functions, six enabled reconciliation/guard triggers, the service-role-only
acceptance and admin-invoice grants, revocation of the unguarded internal
acceptance function from `service_role`, zero long-running transactions, and
unchanged counts of 488 quote versions, 31 invoices, 182 quote families, and
1,168 estimates. No real quote was accepted and no invoice or email was sent
during deployment; a controlled end-to-end acceptance journey remains separate
release evidence.

Marketing enquiry intake requires both `20260723_000001_marketing_enquiry_intake_security.sql` and the forward compatibility migration `20260724043000_marketing_enquiry_budget_columns.sql`. The latter adds nullable pricing snapshot columns to installations whose existing `enquiry_requests` table predates those fields.

Project owner handoffs and the authoritative stale-Enquiry dry run require `20260801_000001_project_owner_handoffs_and_enquiry_inactivity.sql`. Apply it before running `npm run portal:enquiries:inactive`; that command is read-only and does not close or advance projects.

Schedule V2 currently depends on migrations through the Schedule V2 RPC command migrations and later repair migrations. After deploy, confirm:

```bash
GET /api/staff/v1/schedule/readiness
```

The route should return `200` before schedule changes are considered ready.

## Sanctuary AI Task-Ledger Database Setup

PR-AI-004 and PR-AI-005 add the ordered forward migrations `20260818000002_ai_task_ledger.sql` and `20260818000003_ai_approval_envelopes.sql`. They require the existing Supabase `auth.users`, `public.projects`, `public.has_portal_access()`, and `public.is_portal_admin()` boundaries plus `pgcrypto` in the protected `extensions` schema. The migrations create only synthetic, effect-free, zero-cost task and exact-approval state; they do not configure a model provider, worker, OpenClaw, customer/project mutation, external communication, or rollout.

Run `npm run test:ai` for the package/static boundary and `npm run test:ai:db` for the live disposable-database contract. The database harness applies only `supabase/tests/ai_task_ledger_bootstrap.sql`, rehearses each exact AI migration independently inside `BEGIN`/`ROLLBACK`, asserts that its objects do not survive, applies the same exact file in order, then executes `supabase/tests/ai_task_ledger.sql` and `supabase/tests/ai_approval_envelopes.sql`. It never reads Supabase URL or service-role environment variables and must never be redirected to a shared local, staging, or production database.

As of 2026-08-18, this workstation still has no Docker, Podman, PostgreSQL, or Supabase CLI command. The local live attempt stopped at `spawnSync docker ENOENT` before a container or SQL execution. The dedicated `AI Foundation` workflow supplies the required Supabase PostgreSQL 17 and upstream PostgreSQL 18 rollback/application evidence before deployment review. Do not claim that evidence until the PR workflow is green.

For a real Supabase target, first classify the target and verify prerequisites/collisions. Rehearse the exact file with a transaction on a disposable compatible database, then apply only the reviewed file. Do not use blanket `db push` or infer deployment from repository/CI state. Production requires a separate confirmation and post-apply privilege/function-body verification.

## Durable Background-Job Database Setup

JOB-01 through JOB-03 add seven ordered forward migrations, `20260720_000001_background_job_foundation.sql` through `20260720_000007_background_job_provider_reconciliation.sql`. They require a Supabase-compatible Postgres target with `pgcrypto`, PGMQ extension support, `auth.users`, and the existing `public.projects` prerequisite. The sixth migration adds lease-fenced runtime timing plus aggregate queue/job and safe worker-health projections. The seventh adds the bounded provider-idempotency contract, private append-only minimal receipts, the service-role-only verified-webhook reconciliation RPC, and a separate lease-fenced local acceptance RPC that quarantines provider message conflicts. None enables a producer, commercial handler, or rollout. Applying files in the repository is not evidence that any local, staging, or production database has received them.

The checked-in executable database contract is `supabase/tests/background_jobs.sql`. `npm run test:jobs:db` uses `scripts/test-background-jobs-db.mjs` to create and remove a disposable logged-PGMQ Postgres container, apply the test-only `supabase/tests/background_jobs_bootstrap.sql`, discover and transactionally apply the seven ordered background-job migrations, and execute the rollback-wrapped contract. Never point the SQL at a shared local, staging, or production database.

The historical ordered migration directory is not currently independently bootstrappable from an empty database, so the background-job database harness must not claim to validate the entire migration history. Its valid scope is the minimal test roles/auth/projects prerequisite schema plus the seven background-job migrations and the rollback-wrapped SQL assertions. The bootstrap file is test support, not a production migration.

As of 2026-07-20, this workstation had no `docker`, `psql`, or Supabase CLI command available. The local `npm run test:jobs:db` attempt therefore stopped at `spawnSync docker ENOENT` before starting a container. Background Jobs [run 29713940507](https://github.com/velt-design/sanctuary/actions/runs/29713940507) supplied the JOB-01/JOB-02 real-database and worker-artifact evidence: contracts and the rollback-wrapped six-migration harness passed against upstream PostgreSQL 18/PGMQ 1.10.0 and Supabase PostgreSQL 17/PGMQ 1.5.1, and the non-root worker container built successfully. No local, staging, production, or other shared database received these migrations, so deployment review remains separate.

JOB-03 local provider, integration, worker, contract, typecheck, lint, security, and production-build gates pass. Background Jobs [run 29723041212](https://github.com/velt-design/sanctuary/actions/runs/29723041212) passes its seven-migration real-PGMQ matrix and worker artifact/container gates. Configure `RESEND_WEBHOOK_SECRET` only in the portal server secret store; do not put it in public/browser-prefixed env, marketing client config, worker logs, or test fixtures with real credentials. Repository tests use injected/mocked provider transport and signed fixtures only, never a real email delivery.

## Dedicated Background Worker Environment

`apps/worker` is a Node 22 server process. Every database-backed command requires `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`; browser-prefixed Supabase variables are not accepted. The worker defaults to `BACKGROUND_JOBS_WORKER_MODE=dark`, and `active`, `once`, or `drain` additionally requires `BACKGROUND_JOBS_WORKER_ACTIVE_ENABLED=true`. JOB-02 intentionally registers no commercial handlers, so executing modes remain fail-closed until later workflow checkpoints supply complete handler coverage.

The canonical variable list, bounds, health endpoints, container command, and local/hosting runbook live in `apps/worker/README.md`. Preserve its coupled lease-safety rule: heartbeat interval, RPC timeout, abort-settlement grace, and safety margin must fit strictly inside queue visibility. Store the service-role key in the hosting secret store; an optional configured worker ID is only a safe replica prefix because the process appends a per-boot UUID. Use an immutable build label and deploy dark before any producer or rollout change.

## Service Role Boundaries

Use `SUPABASE_SERVICE_ROLE_KEY` only in server-owned flows:

- Auth admin user management.
- Imports and migration/maintenance scripts.
- Public token flows for quote or invoice viewing.
- Background automation and email flows.
- Scheduled GA4 lifecycle delivery through the leased `marketing_conversion_delivery_claim` and `marketing_conversion_delivery_complete` RPCs.
- Durable background-job enqueue, worker lifecycle, safe inspection, provider-webhook reconciliation, and repair RPCs. Direct access to job/PGMQ/private-payload/private-receipt tables is not part of this permission.
- Server-side operations that intentionally bypass RLS.

Do not expose service-role access to client components.

Use `npm run service-role:report` for the broad advisory inventory and `npm run service-role:changed` before handoff when touching service-role access. The portal still has a narrower hard allowlist test in `apps/portal/lib/supabaseClient.boundaries.test.ts`.

For route-level service-role and auth-bound Supabase client boundaries, see `docs/staff-api-auth-contracts.md`.

## RLS And Permissions

The security hardening migration removes legacy blanket grants and reasserts RLS for app-owned tables. Authenticated portal users can operate through allowed policies and RPC functions; admin-only actions are still enforced in portal code.

When adding tables:

- Add a forward migration.
- Enable or explicitly document RLS.
- Grant only required roles.
- Add server/API access through the appropriate helper.
- Update `docs/supabase-schema-map.md` and the owning feature doc.

For JOB-01/JOB-02/JOB-03, the public job tables have RLS enabled with browser-role grants revoked, and direct job-table, PGMQ, private-payload, and private provider-receipt access is revoked from `service_role` as well. The service role reaches the system only through explicitly granted security-definer RPCs, including worker runtime projections, lease-fenced local provider acceptance, and verified-webhook reconciliation; `background_job_enqueue_staff` records staff attribution but is not executable by the authenticated browser role.

## Troubleshooting

- Missing `public.contacts` or schema-cache errors usually mean migrations were not applied or Supabase schema cache has not refreshed.
- `Unable to save enquiry` after the public rate-limit check can mean `marketing_enquiry_intake` is installed but its `enquiry_requests` pricing columns are not; apply `20260724043000_marketing_enquiry_budget_columns.sql` and rerun a rollback-only RPC contract.
- Portal `no_access` means the Supabase user exists but lacks a `portal_users` role.
- Portal `lookup_failed` means the role lookup errored.
- A browser-only `Failed to fetch` during session refresh should leave the
  server-known page usable. If it reaches an unhandled-error overlay, check the
  `PortalAuthProvider` session-read boundary before treating it as a sign-out or
  a route failure.
- Schedule fallback activation means Schedule V2 schema or client readiness failed and should be investigated before release.
