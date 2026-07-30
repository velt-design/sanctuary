# Staff API And Auth Contracts

This doc is the current-state reference for staff, admin, and public-token route boundaries. Use it before editing API routes, Supabase access, auth checks, diagnostics, or server-owned side effects.

## Route Families

- Staff workflow routes live mainly under `apps/portal/app/api/staff/v1` plus older staff-owned routes under `apps/portal/app/api/contacts`, `apps/portal/app/api/projects`, `apps/portal/app/api/estimates`, and `apps/portal/app/api/quotes`.
- `GET /api/staff/v1/projects/index` is the staff-authenticated Projects-list read model. It accepts bounded `archive`, `q`, `status`, `due`, `today`, `page`, `pageSize`, and `sort` parameters; calls `staff_projects_index_v1()` through the request's auth-bound client; returns one exact-count project page plus its linked contact display rows and query identity; and is always `private, no-store`. Missing RPC schema returns `503 PROJECTS_INDEX_SCHEMA_NOT_READY`.
- `POST /api/staff/v1/projects` is the staff-authenticated project-create command. It validates stable project/contact IDs and delegates duplicate detection plus contact/project/setup coordination to `createProjectCommand()`. A normal success returns a `server_confirmed` record receipt with `setupAutomation=confirmed`; a matching replay returns the same durable records with `setupAutomation=not_rechecked`. If initial setup automation fails after the records are confirmed, the route preserves them and returns `202` with `setupAutomation=needs_attention`, so clients open the saved project and surface administrator review rather than retrying record creation. Strong duplicate candidates return `409 CONTACT_DUPLICATE_CANDIDATES`; a stable ID already tied to different details returns `409 PROJECT_CREATION_COMMAND_CONFLICT` and requires a form reload. Missing migration returns `503 PROJECT_CREATION_SCHEMA_NOT_READY`. An indeterminate write or unverifiable compensating cleanup returns `500 PROJECT_CREATION_REVIEW_REQUIRED`; clients must not retry that command.
- `GET /api/staff/v1/projects/[projectId]/summary` is the staff-authenticated direct-link shell read. It returns only the RLS-visible project/contact summary needed to make the header and tabs useful while the existing complete snapshot query continues; it is always `private, no-store`.
- `GET /api/projects/[projectId]/snapshot` is the staff-authenticated complete Project Detail snapshot. It uses `requireStaffContext()` and the auth-bound client, retains the request diagnostics contract, and sends every success, authentication failure, validation failure, not-found result, and server failure as `private, no-store`.
- `GET /api/staff/v1/projects/[projectId]/command-centre` is the staff-authenticated Project Overview read model. It uses `requireStaffContext()` and the auth-bound client, resolves quote/estimate truth plus canonical owners/actions/conflicts/audit on the server, returns only bounded normalized facts, and is always `private, no-store`.
- `GET /api/staff/v1/work-items/queue` is the staff-authenticated one-row-per-project Work Queue read model. It uses `requireStaffContext()` and the auth-bound client, reads V2 marker inventory and operational state through direct bounded owners, composes durable work/recovery/state rows with canonical specialist candidates on the server, and returns bounded command metadata for normal staff actions. Dashboard consumes a limited preview of the same owner; personal reminders remain a separate route and table. Missing marker/state tables, missing queue RPC schema (`PGRST200`, `PGRST202`, or `PGRST205`), or a truncated marker inventory return `503 WORK_ITEMS_UNAVAILABLE`; clients render the named not-ready state and must not expose stale actions.
- `GET /api/admin/project-work/legacy-contacted` is an admin-only, read-only classifier for unmarked Contacted projects. It requires `requireAdminContext()`, returns project identity plus bounded follow-up/recommendation/evidence fields and an opaque server evidence fingerprint, and deliberately excludes linked customer email, phone, address, attachments, and message content.
- `POST /api/admin/project-work/legacy-contacted/[projectId]/migrate` requires admin context and accepts one reviewed project, one stable command ID, optimistic project timestamp plus evidence fingerprint, reason, and explicit disposition. The database recomputes the fingerprint before any V2 write and rejects changed related evidence. It cannot bulk migrate, archive, contact a customer, or start the new-lead email cadence.
- `POST /api/admin/project-work/confirmations/correct` requires admin context, the exact project and confirmation event IDs, a stable command ID, and a reason. It appends a retraction and durable review signal; it never deletes history or automatically reverses later project/commercial facts.
- `POST /api/admin/project-work/confirmations/reconcile` requires admin context, the exact repair-signal ID and expected row version, a stable command ID, and a review reason. It resolves only that unchanged confirmation-correction signal after the project has been checked, retains the correction and audit event, and has no email, stage, commercial, or cadence side effect.
- `GET /api/staff/v1/staff-directory`, `PATCH .../command-centre/owners`, `POST .../command-centre/primary-action/commands`, and `GET /api/staff/v1/dashboard/project-exceptions` own Stage 2 staff-directory, command, and exception contracts. Project-owner changes are admin-only and accept only the approved Jordan/JP/Joe/Bruce keys. Every success and error is `private, no-store`; mutations require UUID command IDs and optimistic versions.
- `GET /api/staff/v1/contacts/index` is the staff-authenticated Contacts-list read model. It accepts bounded `q`, `page`, `pageSize`, and `sort` parameters; calls `staff_contacts_index_v1()` through the request's auth-bound client; returns one exact-count page plus query identity; and is always `private, no-store`. Missing RPC schema returns `503 CONTACTS_INDEX_SCHEMA_NOT_READY`.
- `GET /api/contacts/[contactId]` is a bounded authenticated record lookup used by project creation to restore a preselected contact. It returns only the mapped contact, remains `private, no-store`, and never exposes broad contact-list data.
- `GET /api/staff/v1/search?q=...` is the staff-authenticated global header search read model. It requires 2-80 characters and performs one `portal_search_v1()` call through the request's auth-bound client. The `SECURITY INVOKER` function verifies `has_portal_access()` in-band while existing RLS remains authoritative, then returns at most five ranked Projects followed by five Contacts. Projects and Contacts retain authenticated `portal_access_all` policies for every operation; their row-independent membership helper is wrapped in a scalar `SELECT` so PostgreSQL evaluates the same decision once per statement. Projects match name, saved reference, site address, or linked contact name; Contacts match name, email, phone, or address. The route emits diagnostics and is always `private, no-store`.
- Admin routes live under `apps/portal/app/api/admin` and must enforce admin role checks.
- Calculator Brain routes under `/api/admin/costing/configurations` use `requireAdminContext()` and its auth-bound client for list, clone/create, draft read/save, compare, and publish. Browser components never mutate the version tables. Publish additionally passes through the database's `is_portal_admin()` check and atomic RPC.
- Public quote routes live under `apps/marketing/app/quote/[quoteId]` and `apps/marketing/app/api/quotes`.
- Public invoice routes live under `apps/marketing/app/invoice/[invoiceId]` and `apps/marketing/app/api/invoices`.
- Marketing lead and enquiry APIs live under `apps/marketing/app/api/contact` and `apps/marketing/app/api/enquiry`.
- Fixture-only website autoresponder review lives at `GET`/`POST /api/staff/v1/email-previews/website-autoresponder`. It uses `requireStaffSession()`, accepts only a named fixture variant, returns `private, no-store`, and delegates fixed-recipient preview delivery to the server-only marketing email adapter.

Route behavior belongs to the feature owner doc. This doc owns the cross-cutting route/auth contract.

## Auth Helpers

Staff routes should use helpers from `apps/portal/lib/api/staffApi.ts`:

- `requireStaffSession()` when the route only needs the authenticated staff session.
- `requireStaffContext()` when the route also needs an auth-bound Supabase server client.
- `jsonOk()`, `jsonError()`, and `parseJsonBody()` for consistent response shape and invalid JSON handling.

Admin routes should use helpers from `apps/portal/lib/api/adminApi.ts`:

- `requireAdminSession()` when the route only needs an admin session check.
- `requireAdminContext()` when the route also needs an auth-bound Supabase server client.
- `jsonOk()` and `jsonError()` for admin responses; both enforce `Cache-Control: private, no-store` so authenticated admin data and errors are never shared or reused by an intermediary cache.
- Admin-only failures should distinguish `401 Unauthorized` from `403 Forbidden`.

Do not add ad hoc session checks to new staff/admin routes when a helper already exists.

Global header search has one measured, domain-specific exception to the general helper shape. `searchPortalForRequest()` creates the same cookie-bound server client but deliberately avoids preliminary `auth.getUser()` and `portal_users` provider calls. Its only allowed operation is the authenticated-only `portal_search_v1()` RPC: PostgREST verifies the access token, the function reports portal membership in-band, and `SECURITY INVOKER` preserves Projects/Contacts RLS. Missing or invalid authentication maps to `401`, an authenticated user without portal membership maps to `403`, and database/schema failures remain `500`. Do not generalize this path to mutations, privileged reads, service-role access, or RPCs without an equivalent tested access result.

Nested server layouts and pages share one request-scoped portal-access lookup through React `cache()`. That lookup performs one verified `auth.getUser()` call and one `portal_users` role lookup for the render, but it is never stored in a process-wide or cross-request cache. API requests independently reverify access and continue to use auth-bound Supabase clients, so request memoisation cannot cross users or weaken RLS.

Verified-claims auth was measured as an alternative. In the current fresh-server CI shape, the JWKS/auth cold path made every cold route slower, so the boundary remains one request-scoped `getUser()` plus the database role lookup until a cold-safe claims strategy is proven. Do not trade server verification for browser claims or a process-global private cache.

## Supabase Client Boundaries

- Auth-bound staff/admin server routes should use the Supabase client returned by `requireStaffContext()` or `requireAdminContext()`. The global-search exception remains isolated behind `searchPortalForRequest()` and its database-verified access contract.
- Browser UI should use API routes, query helpers, or local-first mutation layers rather than direct table writes.
- Service-role access is server-only. It is reserved for admin tooling, imports, public token flows, automation, server-owned compatibility projection, and intentional RLS bypasses. Project creation uses one additional narrow exception: after an auth-bound new-contact insert and a definitively failed project write, `createProjectCommand()` may delete only that stable contact command ID after verifying it is unused. Confirmed projects are never service-role deleted because later setup automation failed. A cleanup or write-verification error becomes a do-not-retry administrator-reconciliation state rather than a false success or retry-safe failure. The Stage 2 project-action route uses service role only after a committed/auth-bound command to update the non-authoritative Schedule projection through an RPC revoked from `authenticated`.
- Service-role keys must never reach client components, browser bundles, public props, logs, or generated documents.
- Run `npm run service-role:changed` before handoff when touching service-role access. `npm run service-role:report` is the broad advisory inventory; `apps/portal/lib/supabaseClient.boundaries.test.ts` is the narrower portal-only hard allowlist.
- When adding tables, pair route changes with ordered forward migrations, RLS/grants, and the relevant feature doc.
- Commercial transaction and email-intent RPCs are revoked from browser roles and executable only through narrow server-owned service-role adapters after staff auth or public-token validation. `private.commercial_email_intents` is never a browser read model.

Use `docs/supabase-schema-map.md` for table/RPC ownership, write paths, access boundaries, and migration sources. Use `docs/environment-auth-supabase.md` for environment setup, role concepts, and migration readiness.

## Public Token Routes

Public quote and invoice routes are server-owned public access surfaces, not staff-auth routes.

- Quote links use `quote_versions.accept_token_hash`.
- Invoice links use `deposit_invoices.portal_token_hash`.
- Token comparison must stay hash-based.
- Missing, invalid, expired, accepted, declined, void, and unavailable-artifact states must be explicit access states.
- Public PDF and attachment downloads must stay token-scoped and private/no-store.
- Public token routes may use server-side privileged access only to verify token-bound access and serve the allowed artifact or side effect.

Do not expose raw token values, token hashes, service-role clients, or broad file access to client components.

## Diagnostics And Responses

Use `apps/portal/lib/api/routeDiagnostics.ts` when a route needs request IDs, server timing, or structured server logging.

- `createRouteDiagnostics(req, route)` creates the request context.
- Pass diagnostics into `jsonOk()` and `jsonError()` when the route should emit `x-portal-request-id` and `server-timing`.
- Use `logPortalServerError()` or `logPortalServerWarn()` for route-owned server logs.
- Keep response bodies stable and small: success payloads should return the resource or `{ ok: true }`; errors should return `{ error: string }` plus documented extra fields such as conflict codes.
- Validate JSON with `parseJsonBody()` before reading request payload fields.
- Complete project snapshots reject an errored subordinate relationship read. Network or database failure must remain a refresh failure with Retry, not a fresh response containing misleading empty workflow arrays.
- Global search performs one bounded indexed RPC, escapes literal `%`, `_`, and backslash characters before `ilike`, ranks and de-duplicates canonical application IDs in PostgreSQL, and fails the whole response when that operation fails; it must not silently present an incomplete group as a fresh result.
- Command-centre reads likewise reject an errored bounded relationship or selected-estimate detail read. Missing exact quote source and missing stored quote price are successful explicit unavailable states, not opportunities to substitute another estimate.
- Command-centre mutations return stable `400`/`403`/`404`/`409`/`500` failures. If the database command committed but the refreshed read fails, return `200` with `committed: true` and `refreshRequired: true`; clients must refresh and must not repeat the command.
- Work Queue commands use the existing project work-item and confirmation endpoints with optimistic row versions and stable command IDs. Ambiguous retry preserves the same command ID; `409` stale/conflict responses require a refreshed queue rather than blind replay.
- Legacy Contacted migration maps invalid disposition evidence to `400`, non-admin access to `401`/`403`, missing projects to `404`, and stale project/evidence or already-migrated conflict to `409`. A classifier recommendation is never treated as command authority.
- Confirmation correction maps missing/invalid input to `400`, non-admin access to `401`/`403`, missing original evidence to `404`, and an existing retraction or stale integrity conflict to `409`.
- Confirmation correction reconciliation maps an absent exact signal to `404` and a resolved or row-version-changed signal to `409`; clients refresh the queue and never retry against a different open signal.
- Estimate persistence may return `409 ESTIMATE_PRICING_SOURCE_BLOCKED` with a compact readiness report when the server-owned pricing source flag requests `workbench_solved` before all gates pass; routes must leave estimate rows unchanged in that state.
- Estimate actual-cost calibration uses `requireStaffContext()` and the returned auth-bound client. Blank or non-negative actuals may be saved as a draft; completing a review requires materials, install, and overhead. Invalid payloads return `400`, missing estimates return `404`, and table/schema failures remain `500`.
- Quote create and estimate-refresh routes return `422` when the shared estimate-to-quote mapper reports a commercial blocker such as an invalid blind. This validation failure must not be treated as a transient server error or silently replaced with a zero-dollar line.
- Estimate create accepts a stable `clientIntentId` and the exact `calculator_snapshot`. A matching committed intent may replay without resending the snapshot; a new intent without it returns `409` and must not substitute the latest saved estimate.
- Quote draft PATCH requires `expectedCommercialRevision`; stale revisions return `409` and delivery-prepared/locked versions return `423`. Send/resend requires a stable delivery `intentId` plus the same expected revision. Shared parsing, attachment limits, and error mapping live in `apps/portal/app/api/quotes/_lib/quoteDeliveryRoute.ts`.
- `GET`/`POST /api/quotes/[quoteVersionId]/prepared-delivery` is staff-authenticated recovery only. GET exposes a token-redacted frozen summary; POST can replay only that server-owned intent and expected revision, never browser-supplied replacement content.
- Staff/public acceptance delegates to the atomic commercial acceptance command. Public routes validate the hash-bound active token before calling it. Invoice delivery failure does not roll back acceptance and the response reports the real invoice delivery state.
- Costing draft validation returns `422` with path-specific issues. Stale draft hashes or compare-time publication IDs return `409`; clients must refresh rather than overwrite. Immediate legacy material/action/curve PATCH routes also return `409` and direct admins to `/admin/costing`.

## Route Ownership

- Contacts, projects, snapshots, estimates, and calculator estimate mutations: `docs/projects-contacts-estimates-calculator.md`.
- Quotes, invoices, public tokens, PDFs, email sending, and job packs: `docs/quotes-invoices-job-packs.md`.
- Design List APIs: `docs/design-list.md`.
- Running Jobs APIs: `docs/running-jobs.md`.
- Schedule, site visits, readiness, and Schedule V2 command routes: `docs/schedule.md`.
- Automation events, V2 project work, Work Queue, legacy Contacted review, follow-ups, email previews, and audit routes: `docs/automation-email-audit.md` and `docs/project-work-items-and-follow-up.md`.
- Tracking, consent, CSP reports, Lighthouse, and audit routes: `docs/security-privacy-quality.md`.
- Auth, role setup, Supabase env, RLS, and migration readiness: `docs/environment-auth-supabase.md`.
- Costing configuration, version publication, and estimate provenance: `docs/costing-and-geometry.md`.

If a route crosses feature boundaries, keep the side effect in the owning route/domain helper and add an explicit contract instead of duplicating logic.

## Verification

Focused commands:

```bash
npm run test:portal -- apps/portal/lib/api
npm run test:portal -- apps/portal/app/api
npm run test:marketing -- apps/marketing/app/api
```

Manual or browser checks should cover:

- Staff route without a session returns `401`.
- Admin route with staff-only role returns `403`.
- Authenticated staff route returns diagnostics headers when diagnostics are used.
- Invalid JSON returns a stable `400` response.
- Public quote/invoice links reject missing, invalid, expired, and void/declined states as appropriate.
- Public PDF/attachment routes require the matching token-bound access.
