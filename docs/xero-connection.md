# Xero connection

Status: deployed to a disabled preview; staging storage installed; connector password, live authorisation and production release outstanding.

## First slice

The portal owns the read-only accounting connection. Staff and ordinary admins
receive no integration navigation, status or controls. The direct developer page
is `/staff/developer/xero`. Its server page and every interactive endpoint require
an active portal membership plus the server-verified, confirmed email
`jordan@sanctuarypergolas.co.nz`. This is a separate developer capability, not a
new broadly assignable admin role. It does not provision or elevate any account.
The Xero authorising account may be Sanctuary's existing info account.

Initial app registration: Sanctuary Portal, standard web app, app identifier
`27d2260e-308a-4100-9b37-9946f06205c6`. This is not a client secret or organisation
ID. The registered callback is
`https://portal.sanctuarypergolas.co.nz/api/integrations/xero/callback`.

## Ownership and limits

- `apps/portal/lib/xero` owns configuration, encryption, provider reads and connection storage.
- `apps/portal/app/api/integrations/xero` owns developer OAuth, candidate review and scheduled maintenance.
- `xero_private` stores encrypted tokens, single-use authorisation attempts and append-only connection audit. No customer accounting data is mirrored here.
- Daily maintenance renews access and verifies the pinned tenant; reads renew on demand. This is continuous authorisation, not yet automatic invoice/payment synchronisation.
- Candidate inspection reads an exact invoice number or exact Xero contact name for RECEIVE bank transactions, at most 20 records. Empty results do not prove absence of payment. No fuzzy matching, allocation, backfill or payment mutation occurs.
- No staff UI, commercial ledger, invoice issue flow, marketing event, Praxis projection or Velt connector changes in this slice.
- Xero API data is not used to train/fine-tune/adapt models. Praxis or Meta reuse requires separate review of Xero's current terms and permitted use case.

## Configuration

All variables are portal-server-only, never browser-prefixed:

| Variable | Purpose |
| --- | --- |
| `XERO_ENABLED` | Exactly `true` enables routes; absent/false remains dark. |
| `XERO_CLIENT_ID`, `XERO_CLIENT_SECRET` | Web-app credentials from Xero, held in the deployment secret manager. |
| `XERO_PORTAL_ORIGIN` | Explicit HTTPS origin; no path, credentials, query or fragment. |
| `XERO_TENANT_ID` | Exact approved Xero organisation UUID; never the developer app ID. Callback refuses any other tenant. |
| `XERO_TOKEN_ENCRYPTION_KEY` | Base64 encoding of 32 random bytes; AES-256-GCM key outside the database. |
| `XERO_DATABASE_URL` | Dedicated connector LOGIN only; remote URLs must use `sslmode=verify-full`. |
| `CRON_SECRET` | At least 32 characters; authenticates maintenance. |

Requested scopes: `offline_access`, `accounting.contacts.read`,
`accounting.invoices.read`, `accounting.payments.read`,
`accounting.banktransactions.read`. No accounting write permission.

## Security and recovery

OAuth starts only from a same-origin POST. A Secure/HttpOnly/SameSite=Lax host
cookie binds encrypted state to the current user for ten minutes. A database
attempt is consumed before code exchange to reject replay. Callback redirects
only to the configured origin and removes its cookie. Tokens and provider error
bodies never appear in responses or logs. Private responses are no-store and
no-referrer. Developer access is rechecked on callback and candidate reads.

A singleton row lock serialises token refresh and reconnect writes across
instances. Rotated tokens commit before subsequent accounting reads. A failed
refresh is recorded with a fixed error code; invalid authorisation requires
reconnection. Transient failures may be retried by maintenance. If a refresh
response was lost, Xero's existing-token grace period supports retry; prolonged
failure may require reconnecting. Last verification is not an accounting sync
timestamp and must not be presented as proof that all business data is current.

Monitor the maintenance route's non-2xx responses and a verification age over
48 hours in existing hosting monitoring, directed to the developer. This slice
does not send notifications or expose technical alerts to ordinary admins.
The daily cron runs at 03:17 UTC via the portal's Vercel configuration. Deployment
must verify the project's scheduler supports and actually invokes that route.

## Provisioning and release gates

1. Apply the forward migration to a disposable database, then approved staging.
2. Provision an environment-specific LOGIN inheriting only `sanctuary_xero_connector`, with no superuser, role/database creation, replication or RLS bypass, no extra direct grants and no portal business-table access. The runtime rejects elevated/group-contaminated identities. Never use the existing service-role or database-owner connection.
3. Put credentials/key in the secret manager; do not paste them into chat or commit them. Re-encrypt stored tokens before rotating the encryption key, or explicitly reconnect; simply replacing the key makes stored tokens unreadable.
4. Configure the exact tenant UUID and callback for the target environment. Use Xero's demo organisation for first live proof; do not substitute a guessed UUID or silently use the first tenant returned.
5. Verify Jordan has normal active portal access and a verified email. Provisioning that user remains a separate authorised operation.
6. Test allowed/denied users, OAuth cancellation/replay, renewal/reconnect, provider failure, and candidate reads on staging. Capture secret-free evidence.
7. Production release, database provisioning and accounting authorisation require explicit approval after review. No production mutations or live Xero calls were made by building this code.

## Verification

Run `npx vitest run apps/portal/lib/xero`,
`node scripts/test-xero-connection-db.mjs`, portal TypeScript, lint and build.
The disposable PGlite harness proves migration rollback/application, staff denial,
connector grants, one-use state and audit deletion denial. It does not prove
multi-connection locking, hosted TLS, Xero consent/refresh or Vercel scheduling;
these remain required staging release gates.

Local evidence (2026-09-14): 18 focused tests passed; disposable PostgreSQL contracts passed; portal TypeScript and repository lint passed; production build passed using synthetic Supabase configuration and Xero disabled. No authenticated browser, real Xero, concurrent PostgreSQL or hosted scheduler proof is claimed.

Setup evidence (2026-09-14): commit `e558475` deployed successfully to Vercel Preview (GitHub deployment `6428756662`). The owner saved `XERO_CLIENT_SECRET` as a Secret restricted to `codex/xero-read-connection`; its value was not inspected. A new deployment will be needed after configuration is complete. No other Xero variables were present at the initial configuration check.

On staging `tnsiprehuldksnuowubv`, read-only preflight found one confirmed Jordan auth identity and no Xero schema or connector role. An equivalent, reformatted migration rehearsal inside a rolled-back transaction passed: authenticated schema usage was denied and connector update access allowed. Independent postflight confirmed both schema and role absent, with project/contact counts unchanged at 13 each. This is not an exact-file migration application or full hosted permission/concurrency proof. Persistent storage, dedicated LOGIN, remaining secrets, tenant pinning, callback configuration and live authorisation remain outstanding.

Subsequent authorised staging installation (2026-09-14): the migration SQL passed another rollback rehearsal, then was applied with ledger version `20260914000001`. The browser paste introduced CRLF and two extra blank lines; stored-body MD5 is `6ce09cedb64fb3ac30b2e522dca8c1b2`. Removing CR and doubled newlines yields `ca3eaf263854e362262755220ae2d27a`, matching the checked-in LF body. No historical ledger was repaired. A dedicated `sanctuary_xero_staging` identity was created with only connector membership, connection limit 4, no elevated capabilities, and login disabled pending owner password entry. Its creation transaction refused any table privilege in public/auth/storage/private and passed. Postflight: 13 projects, 13 contacts, one empty connection row, zero events, denied anon/authenticated schema usage, allowed connector connection update, denied connector audit deletion, login disabled. Hosted TLS, login and concurrency remain unverified.

The owner explicitly authorised completion through tested read-only production release and Peter Harvey deposit investigation and requested an active goal. Accounting writes and automatic portal payment updates are excluded. Credential entry and consent handoffs still follow the browser's applicable rules. The staging password handoff prepares `XERO_DATABASE_URL` as a branch-only Secret using the displayed IPv4 session pooler `aws-0-ap-northeast-1.pooler.supabase.com:5432`, user `sanctuary_xero_staging.tnsiprehuldksnuowubv`, database `postgres`, and `sslmode=verify-full`; the pending form contains only a placeholder and has not been saved.

Manual business-case proof (2026-09-14): authenticated Xero and portal browser inspection found the selected customer's reconciled Receive Money deposit and the matching open portal invoice with no payment ledger entries. Private record links and amounts are retained locally in ignored `test-results/xero/peter-deposit-evidence.md`. This validates the need for the existing BankTransactions candidate path; it is not proof of the new connector's OAuth, refresh, hosted permissions or API read. No accounting or payment data was mutated.
