# Supabase setup (Contacts + Projects)

## 1) Env vars

Copy `.env.example` → `.env.local`, then set:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Optional (recommended once you enable RLS):

- `SUPABASE_SERVICE_ROLE_KEY`

### Vercel deploys

Vercel does **not** use your local `.env.local`.

In Vercel → **Project Settings** → **Environment Variables**, add the same variables (at least `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`) for **Production** and **Preview**, then redeploy.

## 2) Create tables + portal auth

If you’re using migrations, apply everything in `supabase/migrations/` (includes `portal_users` + RLS).

For the current staff schedule surface, the minimum required migration cutoff is:

- `20260407_000005_schedule_v2_update_downtime_rpc_command.sql`

If you prefer manual SQL in Supabase dashboard → **SQL Editor**, run:

- `supabase/portal_schema.sql`
- `supabase/migrations/20260210_000002_portal_auth.sql`

If the portal shows **“schema cache”** / **“Could not find the table `public.contacts`”**, re-run the SQL and refresh after ~10 seconds.

## 3) Schedule readiness after deploy

Schedule deploys are not ready until both of these are true:

- schedule read paths load successfully
- `GET /api/staff/v1/schedule/readiness` returns `200`

The portal smoke suite now checks that readiness route so missing `schedule_v2_*` RPC functions fail CI before release.
