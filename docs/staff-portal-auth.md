# Staff portal auth (Supabase)

The staff portal now uses **Supabase Auth (email + password)** and a `portal_users` table for roles.

## Required env vars (Vercel)

Set these in **Vercel → Project Settings → Environment Variables** for **Production** (and **Preview**):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (required for invite tooling + server-side admin actions)

## Supabase dashboard setup

1) **Auth → Providers**
- Enable **Email**

2) **Auth → URL Configuration**
- **Site URL**: your portal base URL (e.g. `https://portal.sanctuarypergolas.co.nz`)
- **Redirect URLs**: include
  - `https://portal.sanctuarypergolas.co.nz/*`
  - `http://localhost:3001/*` (local dev)
  - Any Vercel preview domains you use

## Create users + assign roles

### Recommended (script)

From the repo root:

```sh
npm run portal:invite -- --email user@domain.com --role admin
npm run portal:invite -- --email user@domain.com --role staff --password TEMP_PASSWORD
```

- Without `--password`, Supabase sends an invite email so the user sets their own password.
- With `--password`, the user can sign in immediately (and you can ask them to reset it).

### Manual (Supabase UI + SQL)

1) **Auth → Users** → “Add user” or “Invite user”
2) Insert a role row (SQL Editor):

```sql
insert into public.portal_users (user_id, role)
values ('AUTH_USER_ID_HERE', 'admin');
```

## Verification checklist

- `/login` signs in successfully
- Admin users can access `/admin/*`
- Staff users are redirected away from admin-only routes

If a user can sign in but sees no data, check that they have a row in `public.portal_users`.
