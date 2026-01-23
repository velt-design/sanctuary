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

## 2) Create tables

In Supabase dashboard → **SQL Editor**, run:

- `supabase/contacts_projects.sql`

If the portal shows **“schema cache”** / **“Could not find the table `public.contacts`”**, re-run the SQL and refresh after ~10 seconds.
