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
- `MARKETING_ABUSE_HASH_SECRET` (preferred production server-only HMAC key for durable public rate-limit identifiers; when absent, marketing derives a domain-separated HMAC subkey from the already-required `SUPABASE_SERVICE_ROLE_KEY`, and still fails closed if neither secret exists)
- `CRON_SECRET` (server-only bearer secret used by the scheduled abandoned-enquiry-upload cleanup route)
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

If a linked environment has a sparse or historically divergent migration ledger, do not use a blanket `db push` or repair unrelated versions. Positively classify the target, inspect prerequisites and collision counts, run the exact forward file in a rollback transaction, apply only that reviewed file, record only its version, and verify the resulting schema/function body. Production remains a separate reviewed deployment.

Marketing enquiry intake requires both `20260723_000001_marketing_enquiry_intake_security.sql` and the forward compatibility migration `20260724043000_marketing_enquiry_budget_columns.sql`. The latter adds nullable pricing snapshot columns to installations whose existing `enquiry_requests` table predates those fields.

Schedule V2 currently depends on migrations through the Schedule V2 RPC command migrations and later repair migrations. After deploy, confirm:

```bash
GET /api/staff/v1/schedule/readiness
```

The route should return `200` before schedule changes are considered ready.

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
- Schedule fallback activation means Schedule V2 schema or client readiness failed and should be investigated before release.
