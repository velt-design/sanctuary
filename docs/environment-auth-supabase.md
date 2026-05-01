# Environment, Auth, And Supabase

This repo uses Supabase for app data and Supabase Auth for the staff portal.

## Core Environment Variables

Most local portal work needs:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Common optional or feature-specific variables:

- `RESEND_API_KEY`
- `EMAIL_FROM`
- `EMAIL_REPLY_TO`
- `EMAIL_TO_RESIDENTIAL`
- `EMAIL_TO_PROFESSIONAL`
- `EMAIL_TO_COMMERCIAL`
- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_MARKETING_SITE_URL`
- `NEXT_PUBLIC_GA_MEASUREMENT_ID`
- `NEXT_PUBLIC_FB_PIXEL_ID`
- `META_CONVERSIONS_API_TOKEN`
- `META_GRAPH_API_VERSION`
- `META_CAPI_TEST_EVENT_CODE`
- `PORTAL_TEST_EMAIL`
- `PORTAL_TEST_PASSWORD`
- `PORTAL_BASE_URL`
- `PORTAL_DRAWING_URL`
- `NEXTAUTH_SECRET` or `AUTH_SECRET` for legacy NextAuth-backed paths.

Never commit real env files. `.env*` is ignored.

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

Schedule V2 currently depends on migrations through the Schedule V2 RPC command migrations and later repair migrations. After deploy, confirm:

```bash
GET /api/staff/v1/schedule/readiness
```

The route should return `200` before schedule changes are considered ready.

## Service Role Boundaries

Use `SUPABASE_SERVICE_ROLE_KEY` only in server-owned flows:

- Auth admin user management.
- Imports and migration/maintenance scripts.
- Public token flows for quote or invoice viewing.
- Background automation and email flows.
- Server-side operations that intentionally bypass RLS.

Do not expose service-role access to client components.

For route-level service-role and auth-bound Supabase client boundaries, see `docs/staff-api-auth-contracts.md`.

## RLS And Permissions

The security hardening migration removes legacy blanket grants and reasserts RLS for app-owned tables. Authenticated portal users can operate through allowed policies and RPC functions; admin-only actions are still enforced in portal code.

When adding tables:

- Add a forward migration.
- Enable or explicitly document RLS.
- Grant only required roles.
- Add server/API access through the appropriate helper.
- Update `docs/supabase-schema-map.md` and the owning feature doc.

## Troubleshooting

- Missing `public.contacts` or schema-cache errors usually mean migrations were not applied or Supabase schema cache has not refreshed.
- Portal `no_access` means the Supabase user exists but lacks a `portal_users` role.
- Portal `lookup_failed` means the role lookup errored.
- Schedule fallback activation means Schedule V2 schema or client readiness failed and should be investigated before release.
