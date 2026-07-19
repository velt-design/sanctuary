# Staff API And Auth Contracts

This doc is the current-state reference for staff, admin, and public-token route boundaries. Use it before editing API routes, Supabase access, auth checks, diagnostics, or server-owned side effects.

## Route Families

- Staff workflow routes live mainly under `apps/portal/app/api/staff/v1` plus older staff-owned routes under `apps/portal/app/api/contacts`, `apps/portal/app/api/projects`, `apps/portal/app/api/estimates`, and `apps/portal/app/api/quotes`.
- `GET /api/staff/v1/projects/index?archive=active|archived|all` is the staff-authenticated Projects-list read model. It uses `requireStaffContext()`, returns project/contact row-count and truncation metadata with diagnostics, and is always `private, no-store`.
- `GET /api/staff/v1/contacts/index` is the staff-authenticated Contacts-list read model. It uses `requireStaffContext()` and the canonical paginated contact loader, returns row-count and truncation metadata with diagnostics, and is always `private, no-store`.
- Admin routes live under `apps/portal/app/api/admin` and must enforce admin role checks.
- Public quote routes live under `apps/marketing/app/quote/[quoteId]` and `apps/marketing/app/api/quotes`.
- Public invoice routes live under `apps/marketing/app/invoice/[invoiceId]` and `apps/marketing/app/api/invoices`.
- Marketing lead and enquiry APIs live under `apps/marketing/app/api/contact` and `apps/marketing/app/api/enquiry`.

Route behavior belongs to the feature owner doc. This doc owns the cross-cutting route/auth contract.

## Auth Helpers

Staff routes should use helpers from `apps/portal/lib/api/staffApi.ts`:

- `requireStaffSession()` when the route only needs the authenticated staff session.
- `requireStaffContext()` when the route also needs an auth-bound Supabase server client.
- `jsonOk()`, `jsonError()`, and `parseJsonBody()` for consistent response shape and invalid JSON handling.

Admin routes should use helpers from `apps/portal/lib/api/adminApi.ts`:

- `requireAdminSession()` when the route only needs an admin session check.
- `requireAdminContext()` when the route also needs an auth-bound Supabase server client.
- Admin-only failures should distinguish `401 Unauthorized` from `403 Forbidden`.

Do not add ad hoc session checks to new staff/admin routes when a helper already exists.

## Supabase Client Boundaries

- Auth-bound staff/admin server routes should use the Supabase client returned by `requireStaffContext()` or `requireAdminContext()`.
- Browser UI should use API routes, query helpers, or local-first mutation layers rather than direct table writes.
- Service-role access is server-only. It is reserved for admin tooling, imports, public token flows, automation, and intentional RLS bypasses.
- Service-role keys must never reach client components, browser bundles, public props, logs, or generated documents.
- Run `npm run service-role:changed` before handoff when touching service-role access. `npm run service-role:report` is the broad advisory inventory; `apps/portal/lib/supabaseClient.boundaries.test.ts` is the narrower portal-only hard allowlist.
- When adding tables, pair route changes with ordered forward migrations, RLS/grants, and the relevant feature doc.

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
- Estimate persistence may return `409 ESTIMATE_PRICING_SOURCE_BLOCKED` with a compact readiness report when the server-owned pricing source flag requests `workbench_solved` before all gates pass; routes must leave estimate rows unchanged in that state.

## Route Ownership

- Contacts, projects, snapshots, estimates, and calculator estimate mutations: `docs/projects-contacts-estimates-calculator.md`.
- Quotes, invoices, public tokens, PDFs, email sending, and job packs: `docs/quotes-invoices-job-packs.md`.
- Design List APIs: `docs/design-list.md`.
- Running Jobs APIs: `docs/running-jobs.md`.
- Schedule, site visits, readiness, and Schedule V2 command routes: `docs/schedule.md`.
- Automation events, project tasks, follow-ups, email previews, and audit routes: `docs/automation-email-audit.md`.
- Tracking, consent, CSP reports, Lighthouse, and audit routes: `docs/security-privacy-quality.md`.
- Auth, role setup, Supabase env, RLS, and migration readiness: `docs/environment-auth-supabase.md`.

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
