# Staff portal auth (NextAuth Credentials)

The staff portal uses NextAuth “Credentials” (email + password) and **requires env vars** in production.

## Required env vars (Vercel)

Set these in **Vercel → Project Settings → Environment Variables** for **Production** (and usually **Preview** too):

- `NEXTAUTH_URL` (production: `https://www.sanctuarypergolas.co.nz`)
- `NEXTAUTH_SECRET`
- `STAFF_ADMIN_EMAIL`
- `STAFF_ADMIN_PASSWORD` (or `STAFF_ADMIN_HASH`)
- `STAFF_USER_EMAILS` (or `STAFF_USER_EMAIL`)
- `STAFF_USER_PASSWORD` (or `STAFF_USER_HASH`)

If `NEXTAUTH_SECRET` is missing in production, NextAuth will 500 and you’ll see the generic **“Server error / problem with the server configuration”** page.

## Generate values

### 1) `NEXTAUTH_SECRET`

Run locally:

```sh
openssl rand -base64 32
```

Paste the output into Vercel as `NEXTAUTH_SECRET`.

### 2) Plaintext passwords (quickest)

Set:

- `STAFF_ADMIN_PASSWORD` to whatever you want
- `STAFF_USER_PASSWORD` to whatever you want
- `STAFF_USER_EMAILS` to a comma-separated list of staff emails (all share the same password)

### 3) Password hashes (recommended)

Instead of plaintext, you can store bcrypt hashes in env vars.

Run locally from the repo root:

```sh
node -e "const bcrypt=require('bcryptjs'); bcrypt.hash('YOUR_PASSWORD', 12).then(console.log)"
```

Paste the output into `STAFF_ADMIN_HASH` / `STAFF_USER_HASH` (and leave the plaintext vars empty).

## Verification

After saving env vars, click **Redeploy** (or push a new commit), then verify:

- `https://www.sanctuarypergolas.co.nz/api/auth/session` returns `200` (not `500`)
- `/login` successfully signs in and redirects to `/staff/*`
