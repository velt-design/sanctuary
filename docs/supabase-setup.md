# Supabase setup (Contacts + Projects)

## 1) Env vars

Copy `.env.example` → `.env.local`, then set:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Optional (recommended once you enable RLS):

- `SUPABASE_SERVICE_ROLE_KEY`

## 2) Create tables

In Supabase dashboard → **SQL Editor**, run:

- `supabase/contacts_projects.sql`

If the portal shows **“schema cache”** / **“Could not find the table `public.contacts`”**, re-run the SQL and refresh after ~10 seconds.

