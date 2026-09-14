# Xero connection

Status: production connected and live read-only accounting access verified on 2026-09-14. Vercel-triggered production maintenance returned 200 and advanced the saved verification time. Hosted natural token renewal, cancellation recovery and ordinary-admin denial were verified on staging.

## Current verification

PR #126 merged as `d70d75ea500dbd43e3c409719436c4de25e1d5fb` after required CI passed at `34463c4`. Production deployment `dpl_GZbn15psvUsmuf7YbjbbJHNzahaw` is Ready on `portal.sanctuarypergolas.co.nz`. Owner consent connected Sanctuary Pergolas Limited at 06:42:44 UTC. Independent SQL confirmed encrypted tokens present and no connection error. The live developer receipt lookup succeeded at 06:45:24 UTC. The private evidence records the comparison with the portal: a reconciled receipt exists in Xero, while the portal has no corresponding payment entry. Neither system's accounting/payment records were changed.

Vercel has the enabled daily 03:17 UTC maintenance job. Its Run control invoked the production route at 06:45:43 UTC with HTTP 200; independent SQL confirmed `last_verified_at` advanced to 06:45:43.838395 UTC with the original connection time preserved and no error. An unauthenticated production maintenance request returned 401, and an unauthenticated review request returned 403. This proves Vercel-triggered maintenance, not an elapsed daily timer or production token-expiry rotation. Natural expiry renewal was proven on staging; production expiry was not forced.

Preview revision `c7a2bfe`, deployment `GMB4N8hFbruBjhT9VGQZrkHtBCsA`, is Ready with the approved tenant pinned and temporary discovery disabled. Owner consent completed; the saved connection identifies Sanctuary Pergolas Limited. An exact-contact receipt lookup returned the previously inspected reconciled deposit through the new API connection. Current private customer evidence stays in ignored `.codex-tmp/xero-evidence/`, outside Playwright output cleanup.

Hosted staging checks confirmed token ciphertext is present, the OAuth attempt is consumed, one connection event exists, anonymous/authenticated schema access is denied, and the connector cannot delete audit events. A bounded competing `FOR UPDATE` transaction caused a safe unavailable response; a read succeeded after rollback. This proves hosted lock contention and recovery. After natural access-token expiry, two reads submitted together succeeded at 04:36:14 UTC. The stored ciphertext fingerprint changed, last_error remained null, and the original connection timestamp and single connected event were unchanged. This proves live renewal without another sign-in; paired browser submissions do not establish exact server-side overlap.

Hosted access checks used an existing staging QA identity temporarily assigned admin, then restored to its original staff role. Its fresh developer-page request returned 404; a receipt request from an already-open page returned Forbidden, and reconnect initiation failed without leaving the portal. Independent SQL confirmed role restoration, and Jordan's session was restored. Cancelling a reconnect at Xero also preserved the existing connection and a subsequent receipt read succeeded. Direct callback navigation was blocked by the browser; callback-specific denial/replay remains covered by route tests, not claimed as hosted proof.

After explicit owner approval, production migration `20260914000001` and restricted `sanctuary_xero_production` role were installed. Initial independent postflight confirmed login disabled, only connector membership, no elevated capabilities, no business-table access, denied anonymous/staff schema access and denied audit deletion. The ledger body exactly matches the LF migration (`ca3eaf263854e362262755220ae2d27a`); project/contact counts were unchanged. Token storage was empty at that provisioning checkpoint. The owner subsequently enabled the restricted login; a real credentialed connection passed certificate and hostname verification. Production database URL, separate encryption/maintenance secrets, tenant, client ID and origin were configured before release with Xero disabled. The subsequent enabled production release, connection and maintenance proof are recorded above. The dashboard reported resource pressure; no compute change was made.

## Deposit pilot production release

PR #128 merged as `de3b0754d22de21c07c1d5c17b6a32d14396e5b6` at 08:50:13 UTC on 2026-09-14 after all six checks passed at `e5d9d71` and the customer-name review issue was resolved. Production deployment `dpl_Beo8sYbfTyp9VcxLQpCP694KcDTK` is Ready at that merge revision and serves `portal.sanctuarypergolas.co.nz`. The production pilot flag is enabled.

The three reviewed pilot migrations were installed atomically in production. Their stored source hashes match the staging-tested files listed below. Only the verified Jordan account has a nonrevoked approval grant. Independent postflight found zero matches, zero notes and zero entries for the first proposed project's payment ledger; its invoice remained OPEN. Database privilege checks denied browser access/direct match insertion and allowed only the intended service command boundary.

Jordan's existing production session opened `/staff/payments/review` and completed a live proposed-match review at 08:54:40 UTC. The expected reconciled receipt and exact receipt identity were returned; the screen showed a full-deposit proposal, customer-win consequence and zero remaining deposit if approved. The explicit confirmation remained unchecked and no payment was recorded. Xero did not supply an invoice reference, so human ownership confirmation remains required. Private customer identifiers stay in ignored operator evidence. An unauthenticated production command returned 403 with private/no-store caching.

The owner subsequently explicitly approved that exact receipt-to-invoice match. A fresh production review revalidated the receipt identity, amount, date and open invoice before the single approval submission at 09:14:33 UTC. The portal returned success. A new review at 09:14:53 UTC showed the deposit invoice PAID, no remaining deposit and customer won, with the existing receipt blocked from another approval. Independent SQL confirmed exactly one payment, one active source match, an equal full allocation, one match-approval audit event and one invoice-paid audit event. Receipt date remained the original received date; approval time records when the portal match was confirmed. Xero remained read-only. Exact customer amounts and identifiers remain in private operator evidence.

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

### Deposit approval pilot (released; first real approval verified)

The developer page adds an exact portal invoice lookup and a live Xero receipt comparison through `POST /api/integrations/xero/payment-suggestions`. The invoice customer name supplies the default exact Xero contact search; an alternate name can be entered, but a differing name blocks the proposed outcome pending identity review. Searches accept 1–240 characters, including short and punctuated customer names; query values are escaped as Xero string literals using doubled quotation marks, never supplied as expressions. The dedicated Xero identity remains read-only and receives no portal business-table grants.

Authenticated staging browser verification on 2026-09-14 confirmed the synthetic invoice's outstanding balance and reversed history, blocked a real customer's receipt against that unrelated synthetic project, and saved an investigation note that persisted after a fresh provider review. No real payment was approved. Preview `dpl_8KKALFM4NrieN6eNZjdudmFy1cxc` at application revision `27162b6` also verified that Xero accepts quoted/backslash names. Short and parenthesized names succeeded in the preceding preview. Backslash-escaped quotation marks were rejected by the provider; doubled quotes succeeded. The subsequent production release is recorded below.

The owner rule confirmed on 2026-09-14 is: **any verified positive deposit counts as a customer win**, including a partial deposit. The pilot at `/staff/payments/review` separates this outcome from remaining deposit and whole-invoice status. No project stage or marketing conversion is changed. Jordan is the sole pilot approver; automatic approval is excluded.

`apps/portal/lib/invoices/paymentMatchReview.ts` is a server-only, developer-gated service-role read adapter for the exact invoice and existence of project payment history. It reads explicit bounded columns and fails closed on missing/duplicate invoices or failed ledger reads. The pure `paymentSuggestions.ts` owner blocks non-open/non-first-stage invoices, standalone invoices, invalid/nonpositive/over-invoice amounts, missing dates, non-NZD currency, unreconciled/unauthorised receipts, differing customer names and existing project payment history. Multiple receipts remain separate; twenty results is explicitly incomplete. Names and amounts are evidence, never proof of ownership or global duplicate exclusion.

The pilot uses `POST /api/payments/xero` and the server-only service-role adapter `lib/invoices/xeroMatchRepository.ts`. Access requires the default-dark `XERO_PAYMENT_MATCHING_ENABLED=true`, an active verified Jordan session, a separate nonrevoked `xero_payment_approvers` grant, and same-origin requests. A generic admin role does not grant approval. Migrations `20260914000002` through `20260914000004` create the empty grant store, receipt provenance, atomic commands and append-only investigation/rejection notes; they do not provision an approver.

Review creates a ten-minute encrypted approval envelope bound to the actor, tenant, exact receipt, invoice, amount and server-owned evidence fingerprints. Its key is purpose-derived from the connector encryption key. Approval re-reads the exact Xero receipt ID and compares its evidence, then the database command rechecks invoice and ledger snapshots under the canonical project lock. The global source lock and unique active tenant/receipt key prevent a receipt being recorded twice across projects. Lost-response retries recover the same approval ID; a separate status action remains usable after envelope expiry. Browser recovery storage contains only the approval ID.

Approved partial receipts use the existing append-only payment ledger with no invoice allocation. At the exact whole-invoice total, the same entries are allocated and the invoice becomes PAID atomically; no extra full-invoice payment is created. Manual mark-paid commands are guarded against duplicate import or premature settlement. An explicit correction with a reason uses the canonical equal/opposite reversal, releases invoice allocations and reopens a previously paid invoice. Match provenance and review notes remain available. A reversed receipt can be assigned again only through a fresh approval. Xero remains read-only throughout.

Investigation and rejection notes do not alter money or prove an accounting match. They are shown on subsequent reviews, and approval requires the reviewer to confirm that earlier concerns have been resolved. The pilot uses exact customer-name searches and requires a human to establish project ownership; matching name and amount alone never approves a receipt.

Focused tests cover positive partial deposits down to one cent, blocked evidence, existing history, identity ambiguity, failed reads, actor/origin denial, changed provider records, stale ledger snapshots, lost-response recovery, duplicate identity, canonical settlement, reversal and transaction rollback. The PGlite command suite loads the actual commercial SQL owners. Authenticated hosted pilot browser proof is recorded above. The pilot is released, and the first owner-approved live match is independently verified in the production evidence above.

On 2026-09-14, staging `tnsiprehuldksnuowubv` installed the three pilot migrations atomically, with zero approvers and zero matches. The stored migration source MD5 values match the local bytes: `20260914000002` = `85ad54d762094ff0f570b4e3905102ff`; `20260914000003` = `b462acc72f953b632a6c3fb64a3bbacd`; `20260914000004` = `6064bd0b57f7c9e02bca469e81e755f8`. A hosted transaction created synthetic invoice/quote/project records, proved partial win, same-ID retry, duplicate refusal, two-receipt settlement, allocations, successive reversals, review note and approval audit, then rolled back. Independent final counts were zero pilot approvers, matches, notes and synthetic projects. No production payment was touched. Local focused verification passed 136 tests, portal TypeScript, scoped ESLint, architecture/docs checks and a production build with synthetic build-only credentials.

Subsequent staging concurrency proof provisioned only the verified Jordan grant and a named synthetic project/invoice `INV-990001`. Two separate hosted sessions submitted the same fake source receipt with different approval IDs from one reviewed snapshot. The first held the source lock for eight seconds and committed; the competing attempt waited and was refused as already recorded. Postflight asserted one payment and one approval event, then reversed the synthetic payment through the canonical command. Final net was zero cents, zero active matches, one retained approval event and one reversal event. Hosted privilege checks denied anon/authenticated match reads, service-role direct insert, authenticated approval execution and connector business access; service-role command execution remained available. The synthetic invoice stays in staging for browser checks and is not a real customer payment.

Preview `dpl_9NLZ7ZfwtBrkmcprq2DiYMZ3YHPv` is Ready at exact application revision `adfdf43908da71638b10ff9d179d509e81a6e36e`. Its explicit Git source SHA uses the existing `codex/xero-read-connection` preview configuration and callback alias; no branch history or secrets were changed. `XERO_PAYMENT_MATCHING_ENABLED=true` was added only for that staging preview branch. Production was still disabled at that checkpoint. Local browser testing of the actual component with synthetic responses verified readable partial-deposit evidence, explicit confirmation and lost-response recovery. The subsequent authenticated hosted checks above separately prove the real review and note wiring.

- `apps/portal/lib/xero` owns configuration, encryption, provider reads and connection storage.
- `apps/portal/app/api/integrations/xero` owns developer OAuth, candidate review and scheduled maintenance.
- `xero_private` stores encrypted tokens, single-use authorisation attempts and append-only connection audit. No customer accounting data is mirrored here.
- Daily maintenance renews access and verifies the pinned tenant; reads renew on demand. This is continuous authorisation, not yet automatic invoice/payment synchronisation.
- Candidate inspection reads an exact invoice number or exact Xero contact name for RECEIVE bank transactions, at most 20 records. Empty results do not prove absence of payment. Approval fetches the exact selected receipt independently of search pagination.
- Invoice issue flow, accounting writes, backfills, marketing events, Praxis projections and Velt connectors remain outside the pilot.
- Xero API data is not used to train/fine-tune/adapt models. Praxis or Meta reuse requires separate review of Xero's current terms and permitted use case.

## Next stage: everyday finance

Status: active owner-approved delivery goal (2026-09-14). Discovery is underway; the finance expansion is not implemented or released. The released pilot retains read-only Xero permissions and its Jordan-only approval grant until the separately tested activation.

The intended outcome is that the person responsible for finance can use the portal to see issued invoices, their corresponding Xero records, received and outstanding amounts, suggested payment matches and unresolved exceptions. They can approve an evidenced match or record an investigation/correction without needing developer controls or this chat.

The work should extend the existing invoice and canonical payment owners:

- Keep invoice creation, customer sending and initiation of invoice corrections in the portal. The owner confirmed that issued portal invoices initially create matching drafts in Xero for finance to check before posting. Propagate supported corrections to the matching draft or flag them for finance review. Independently changed Xero records must create an exception rather than silently overwriting either system; posted-invoice edits, voids and credits need explicit supported transitions. Avoid duplicate sending and duplicate accounting records.
- Give Ellen, the owner-nominated day-to-day finance operator, a separate, auditable approval capability, with Jordan retaining access. A read-only account check confirmed `ellen@sanctuarypergolas.co.nz` already has verified portal access. A general admin role must not automatically confer payment approval. Test the separate capability before live activation; this planning decision has not granted it.
- Replace one-at-a-time invoice searching as the everyday entry point with a bounded queue of outstanding invoices, suggested matches and exceptions. Show data freshness, the supporting evidence, the business effect and the next action.
- Make invoice transfer and receipt matching retry-safe, detect existing Xero invoices/receipts, preserve partial/full payment distinctions and handle corrections through the existing audit and ledger owners. Never create another Xero receipt to account for money already reconciled there.
- Show actionable failures and provide a manual fallback. Prove routine and exceptional cases in staging, then a bounded live rollout with the finance operator before expanding volume or automation.

Resolved decisions confirmed by the owner on 2026-09-14 are Xero drafts for finance review, Ellen as the daily finance operator with Jordan retaining access, and the portal as the owner of invoice corrections. The three-question interview is complete. Existing chart-of-accounts, tax configuration and invoice conventions should be investigated from authorised sources before asking the owner to restate them.

Start with one newly issued portal invoice becoming one traceable Xero draft. Prove customer/account/tax/line-item mapping, exact totals, repeat delivery without a duplicate and visible failure recovery before increasing volume. Then add Ellen's capability and the daily payment/exception queue, reusing the already-proven receipt command. Finish with supported correction/conflict paths and an observed daily finance rehearsal.

Acceptance means Ellen can identify what needs attention, follow an invoice to its Xero draft, review a receipt with evidence, approve a safe match, see the correct remaining balance/customer-win outcome and investigate or correct an exception without developer controls. The test set must include a failed/retried transfer, an existing Xero invoice, partial and full deposits, an ambiguous/duplicate receipt, an invoice correction and an independent Xero change. Staging proof precedes a bounded live rollout; finish with Ellen demonstrating the workflow rather than relying only on code checks. These are acceptance requirements, not completed evidence.

New Xero writes require a separately reviewed connector scope and activation; the current read-only connection does not permit invoice creation. Automated payment-match approval, historical bulk imports, supplier purchasing, marketing feedback and wider Velt ingestion are not included in this first finance rollout. Those remain governed by the [owner delivery priorities](ai/00-vision.md#owner-outcomes-and-delivery-order).

### First-slice implementation findings

Unapplied migration `20260914000008` adds dispatch and finalisation RPCs. Dispatch rechecks mapping/lease/expiry and records the canonical effect before writes. Finalisation consumes the portal's independently verified GET result and atomically binds the unique tenant/invoice, finalises the effect and appends events. Read recovery uses the existing uncertain/failed -> provider-accepted edge; it never simulates redispatch or extends expiry. Local tests prove audit failure rolls confirmation back, using the real effect identity/transition trigger but test enqueue/checkpoint adapters. Real-PGMQ and hosted concurrency proof remain required.

`xeroInvoiceTransferRepository.ts` owns RPC access. `POST /api/integrations/xero/worker` requires a separate gateway secret plus exact job ID/current lease; it accepts no client amount, invoice or tenant override. The worker receives only fixed safe results/errors. Portal-owned credentials and invoice contents are never sent to the worker. Its handler is registered only with `XERO_INVOICE_WORKER_ENABLED=true`, an exact HTTPS `XERO_INVOICE_PORTAL_ORIGIN`, and `XERO_INVOICE_GATEWAY_SECRET` (at least 32 random characters), while existing worker active-mode gates still apply. The secret is shared only by portal and approved worker and is not a Xero/database credential. It has not been provisioned. The handler refreshes canonical effects before completion and preserves resumed finalisation state.

Implementation in progress: `invoiceDraftMapping.ts` builds a server-only DRAFT request from issued invoice evidence and an explicit tenant/contact/account/tax mapping; `invoiceDraftReconciliation.ts` compares a fresh provider read with that request, including identity, lines, dates, amounts and unexpected accounting edits. Focused tests exercise both modules together. The worker gateway and transfer repository now consume these helpers; local tests do not prove live transfer. No new Xero permissions or finance grants have been activated.

Migration `20260914000005_xero_invoice_transfer_intents.sql` adds a disabled private issuance control and one immutable invoice-to-job identity. Its deferred trigger covers direct issued inserts and DRAFT-to-issued transitions, reads the completed invoice, and atomically enqueues `xero_invoice_draft_v1` through the existing jobs owner. It skips unissued/voided invoices and ordinary payment-status changes; enabling it does not scan history. An enqueue failure rolls the issuing transaction back. The job payload carries only transfer/invoice/tenant identity. The migration is not applied to shared environments; the control must stay disabled until the handler, lease-fenced gateway, account/contact/tax mappings and expanded consent are verified.

Local trigger tests execute the production migration with a recording enqueue adapter, proving deferral, capture, transaction rollback and access denial. They do not prove PGMQ delivery or worker leases. The full `test:jobs:db` gate is still required; Docker was unavailable in the current Windows shell during initial development. Registry/contract tests and the existing worker suite pass, with the Xero handler registered only behind its explicit gateway gate.

`invoiceTransfer.ts` now owns the tested prepare/read/dispatch/read-back/finalise sequence. It recovers a lost response by reading the existing invoice, refuses to adopt pre-existing records without prior dispatch evidence, and never invents a new request key after uncertainty. `invoiceTransferProvider.ts` implements bounded, pinned-tenant reads and an exact-body DRAFT PUT; writes require `XERO_INVOICE_TRANSFERS_ENABLED=true` and recorded `accounting.invoices` scope. Token storage now retains the returned scope list; old tokens without that evidence cannot write. OAuth defaults to the existing read scopes. A separate `XERO_INVOICE_CONSENT_ENABLED=true` gate with a pinned tenant requests invoice write and settings read permission. The encrypted one-use attempt binds that scope choice; disabling consent before callback refuses the expansion. Renewal validates against the existing encrypted grant, independently of rollout flags, so pausing transfers preserves connection renewal. Unexpected write scopes remain refused. The repository, authenticated gateway and worker handler are wired in code, but this is local test evidence only, not a functioning live transfer.

The next unapplied migrations, `20260914000006` and `20260914000007`, add verified customer/account/tax mapping storage, a contact identity frozen at issuance, the lease-scoped `xero_invoice_transfer_context` read, and `xero_invoice_prepare_request`. Preparation validates DRAFT/customer/number/dates/accounts/tax/amounts against the issued invoice and verified mapping, then persists one exact body, database-computed SHA-256, key and five-minute expiry. Repeat preparation returns that same request; changing its body/key/expiry or deleting it is refused. Local tests execute these migrations and the actual jobs lease-lock function, including the SQL-context -> TypeScript mapper -> SQL-prepare boundary. The enqueue adapter is still a test double, and shared-environment proof remains outstanding. Real mappings have not been populated.

- Invoice issuance is the accounting trigger, independently of email delivery. `commercial_invoice_issue_draft` commits before the application attempts sending; legacy quote acceptance and administrator invoice commands also create issued invoices. The durable transfer must cover those authoritative issuance paths without depending on a successful email or a browser remaining open. Do not export unissued portal drafts or historical invoices merely because the feature becomes enabled.
- Quote-linked invoice content describes the full quoted scope while the invoice total can be only one scheduled payment. Never export the full quoted line total as the deposit amount. Standalone invoices bill their own item total. Use immutable issued amounts and content; verify exact subtotal, tax and total against the returned Xero record.
- The existing correction contract is void-and-recreate for an incorrect issued invoice. Preserve that contract. Correcting a portal draft before issue produces no Xero change; voiding an issued invoice with a linked Xero draft requires a tracked finance action. A posted or independently changed Xero invoice is an exception, not permission to overwrite accounting history.
- Xero's [idempotency contract](https://developer.xero.com/documentation/guides/idempotent-requests/idempotency/) retains keys for only six minutes. Persist the request identity, exact payload and first dispatch time before writing. Retry uncertainty only within a conservative bounded window using the same request; after expiry, reconcile or require attention rather than issuing another blind create. The existing email provider's longer retry window is not applicable to Xero.
- Xero's [invoice contract](https://developer.xero.com/documentation/api/accounting/invoices) provides a unique sales-invoice number and DRAFT status. Use the portal invoice identity, an explicit DRAFT status and verified contact/account/tax mapping. Existing records require comparison and a visible conflict path; a matching number alone does not authorize adoption or changes.
- OAuth start/callback and renewal now have distinct tested scope boundaries. Expanded consent replaces invoice-read with invoice-write and adds settings-read; contacts, payments and bank transactions remain read-only. The provider may retain invoice-read alongside the expanded grant. Neither this configuration nor consent alone enables writes. Xero [scope consent is additive](https://developer.xero.com/documentation/guides/oauth2/scopes/), so disabling transfer must stop application writes without breaking renewal of an already expanded connection. No expanded consent has been requested yet.

The prior proof PR #129 remains blocked by its shared staging calculator check: the published costing manifest is v2.7 while that application's engine is v2.6. Both latest finance-independent quality checks passed; the performance capture failed on incompatible pricing configuration. Resolve environment compatibility through the costing owner before rerunning that check. Do not roll back another task's publication, change live prices or weaken checks to release finance documentation.

## Configuration

All variables are portal-server-only, never browser-prefixed:

| Variable | Purpose |
| --- | --- |
| `XERO_ENABLED` | Exactly `true` enables routes; absent/false remains dark. |
| `XERO_PAYMENT_MATCHING_ENABLED` | Exactly `true` enables the separately authorized deposit pilot after migrations and Jordan's grant are verified. Default dark; independent of connection enablement. |
| `XERO_INVOICE_TRANSFERS_ENABLED` | In-progress invoice adapter write gate; default dark and not deployed/enabled. Requires separately verified invoice OAuth scope as well as the database issuance gate and a working handler. Disabling it prevents draft PUTs. |
| `XERO_INVOICE_CONSENT_ENABLED` | Exactly `true`, with a pinned tenant, enables expanded developer consent for invoice drafts and settings reads. Default dark; separate from transfer activation. Switching it off does not revoke or break renewal of an existing expanded grant. |
| `XERO_CLIENT_ID`, `XERO_CLIENT_SECRET` | Web-app credentials from Xero, held in the deployment secret manager. |
| `XERO_PORTAL_ORIGIN` | Explicit HTTPS origin; no path, credentials, query or fragment. |
| `XERO_TENANT_ID` | Exact approved Xero organisation UUID; never the developer app ID. Callback refuses any other tenant. |
| `XERO_DISCOVERY` | Temporary setup only: exactly `true` permits authorisation without a tenant pin to discover organisation names/IDs. No tokens are retained or accounting reads allowed. Remove after setting the approved tenant UUID. |
| `XERO_TOKEN_ENCRYPTION_KEY` | Base64 encoding of 32 random bytes; AES-256-GCM key outside the database. |
| `XERO_DATABASE_URL` | Dedicated connector LOGIN only; remote URLs must use `sslmode=verify-full`. |
| `CRON_SECRET` | At least 32 characters; authenticates maintenance. |

Requested scopes: `offline_access`, `accounting.contacts.read`,
`accounting.invoices.read`, `accounting.payments.read`,
`accounting.banktransactions.read`. No accounting write permission.

## Security and recovery

The verified developer page reports fixed setup-error categories for configuration,
database authentication, permissions and TLS. It never reflects raw database or
provider exception text, connection strings or credentials. Ordinary admins still
cannot access this page.

Managed Supabase pooler/direct hosts additionally trust the public Supabase Root
2021 CA downloaded from the dashboard's SSL configuration, as required by
[Supabase's verify-full setup](https://supabase.com/docs/guides/platform/ssl-enforcement).
The checked-in public certificate expires 2031-04-26;
SHA-256 fingerprint `807025AD50D4ED219D2C9C7D299C004F824EB00CF7F65AFEF607D07B72E6CAFA`.
It supplements Node's public roots only for explicit Supabase hostname patterns.
Certificate-chain and hostname verification remain enabled; other remote hosts
use their normal public trust roots. Update the CA before expiry or provider rotation.

OAuth starts only from a same-origin POST. A Secure/HttpOnly/SameSite=Lax host
cookie binds encrypted state to the current user for ten minutes. A database
attempt is created before the POST returns an allowlisted Xero authorisation URL;
the client then navigates there. This preserves the portal's `form-action 'self'`
policy instead of permitting external form submissions. A database
attempt is consumed before code exchange to reject replay. Callback redirects
only to the configured origin and removes its cookie. Tokens and provider error
bodies never appear in responses or logs. Private responses are no-store and
no-referrer. Developer access is rechecked on callback and candidate reads.

A singleton row lock serialises token refresh and reconnect writes across
instances. Rotated tokens commit before subsequent accounting reads. A failed
refresh is recorded with a fixed error code; invalid authorisation requires
reconnection. Accounting-read 401 responses also persist reconnect-required state under the row lock, only if the rejected token still matches the stored token; a concurrent newer connection is preserved. Malformed search bodies return 400 before touching credentials or Xero. Transient failures may be retried by maintenance. If a refresh
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
4. Register the callback for the target environment. If the tenant UUID is unknown, temporarily set `XERO_DISCOVERY=true`, authorise, and verify the returned organisation name/UUID on the developer page. Discovery discards tokens and retains only encrypted, user-bound organisation metadata in a ten-minute cookie. Set the explicitly approved `XERO_TENANT_ID`, remove discovery mode, redeploy and connect again. Use Xero's demo organisation for first live proof; never guess or silently select the first tenant returned. Storage and accounting access reject an absent pin even in discovery mode.
5. Verify Jordan has normal active portal access and a verified email. Provisioning that user remains a separate authorised operation.
6. Test allowed/denied users, OAuth cancellation/replay, renewal/reconnect, provider failure, and candidate reads on staging. Capture secret-free evidence.
7. Production release, database provisioning and accounting authorisation require explicit approval after review. No production mutations or live Xero calls were made by building this code.

## Operator tooling

Prefer authenticated provider CLIs/APIs for supported setup and verification. Supabase CLI `db query --linked --file <reviewed-sql-file>` supports the Management API; verify the linked project reference before use. This operator capability must never replace the restricted connector identity used by the portal. Vercel CLI supports scoped environment metadata, secret submission through stdin and deployment inspection. Never print credentials, pass secret values in command arguments or save them to temporary files.

For Windows 1Password desktop integration, reuse one persistent parent process and group necessary reads. Separate shells and helper processes require separate approvals; do not disable vault locking to compensate. Transfer only the requested credential to its approved destination, in memory. A branch-specific Vercel variable cannot also target production; provide a separate production entry while preserving staging scope.

## Verification

Run `npx vitest run apps/portal/lib/xero`,
`node scripts/test-xero-connection-db.mjs`, portal TypeScript, lint and build.
The disposable PGlite harness proves migration rollback/application, staff denial,
connector grants, one-use state and audit deletion denial. It does not prove
multi-connection locking, hosted TLS, Xero consent/refresh or Vercel scheduling;
these remain required staging release gates.

Local validation at revision `c7a2bfe` passed 25 focused tests, disposable database contracts, portal TypeScript, lint, architecture/documentation guards and a production build using synthetic configuration. The automated route tests cover developer denial, CSRF, state binding/replay, scope validation and maintenance authentication. They do not replace hosted browser or scheduler evidence.

Staging migration `20260914000001` is installed with the restricted `sanctuary_xero_staging` login. Browser paste introduced CRLF and two extra blank lines in the ledger body; its stored MD5 is `6ce09cedb64fb3ac30b2e522dca8c1b2`. Normalising those differences gives `ca3eaf263854e362262755220ae2d27a`, matching the checked-in LF migration. The historical ledger was not rewritten. Hosted status and accounting reads prove the dedicated login, role check and verified TLS work together.

The owner saved staging credentials in Vercel Secrets restricted to Preview branch `codex/xero-read-connection`. The stable preview callback is registered, the approved organisation is pinned, and discovery is disabled. Credential values were not inspected. The production installer has passed a local rollback, privilege-contamination refusal, disabled-login and duplicate-install rehearsal; its production application and independent permission postflight subsequently passed.

The current hosted results are summarised above. Production release, connection, live accounting read and Vercel-triggered maintenance are verified. Continue monitoring the daily job and verification age. Unauthenticated external preview requests were intercepted by Vercel deployment protection, so those preview responses do not prove the application's own denial behaviour; production denial results are recorded above.

The owner authorised completion through tested read-only production release and deposit investigation. Accounting writes and automatic portal payment updates are excluded. Credential entry and consent follow applicable browser handoff rules. Current private customer records and execution evidence are in ignored `.codex-tmp/xero-evidence/`. Earlier local test-results artifacts were removed by Playwright output cleanup; the continuation record explicitly distinguishes reconstructed history from newly captured evidence.

Real database checkpoint: [run 34833881659](https://github.com/velt-design/sanctuary/actions/runs/34833881659) passed the new rollback-wrapped invoice contract on both PostgreSQL/PGMQ matrix targets at `86898c2`. Actual issuance, queue, lease and effect helpers replace the lightweight test adapters in this gate. The test found and corrected the issuance actor classification before activation. No shared migrations or provider writes occurred. Full business rollout, real mappings and Ellen rehearsal remain incomplete.

Finance access implementation now uses a confirmed active portal session and the current nonrevoked database grant, rather than a hardcoded Jordan email. Ellen and Jordan can use the same approval path after separately verified provisioning; ordinary admin status grants nothing. Migration `20260914000009` adds append-only grant/revocation history without issuing grants or rewriting existing access. It is unapplied; Ellen has not been provisioned. Developer controls still use Jordan-only identity.

Finance review implementation: `/staff/payments` is a bounded, grant-gated invoice list with search/pagination, recorded invoice amounts, remaining allocated/matched balances, transfer freshness and correction/transfer warnings. Migration10 owns the service-only `xero_finance_review` read and rechecks the current approver grant. It excludes unissued drafts, does not export historical invoices, and changes no money. Active allocations and pilot matches are counted once; reversals are excluded. Unassigned project receipts and inconsistent recorded-paid balances suppress a misleading remaining balance pending investigation. The screen links to the existing explicit deposit approval workflow. Browser rehearsal and shared-database migration validation remain outstanding; this page is not live. Xero draft-recorded labels are historical transfer evidence, not current Xero posting/payment state. Mapping and correction resolution commands still need implementation.

Finance mapping implementation: `/staff/payments/mapping?invoice=<uuid>` uses a grant-gated same-origin server action to inspect existing active Xero contacts and revenue accounts/applicable taxes, then explicitly confirm a customer mapping and business-wide account/tax defaults. Confirmation re-reads Xero, validates the issued invoice tax against the chosen effective rate, and rechecks the frozen/current portal contact. Migration11 saves private provenance with a command ID, rejects conflicting replays, and does not activate transfers or retry stopped jobs. A request-insert guard checks the selected tax rate against every future invoice. Context reads lock the invoice/project during save; existing transfers with missing frozen contacts cannot silently adopt a new project contact. The server-only mapping provider returns bounded review fields and excludes bank data. No real mapping/consent has been saved. Browser rehearsal, full database migration proof and stopped-job resumption remain outstanding. New Xero customer creation/deduplication is still unfinished; the temporary form directs unmatched contacts to Xero rather than pretending they were created automatically.

Provider contracts: [Xero contact records](https://developer.xero.com/documentation/api/accounting/contacts), [account records](https://developer.xero.com/documentation/api/accounting/accounts), and [tax selection](https://developer.xero.com/documentation/guides/how-to-guides/tax-in-xero) govern the mapping lookup. Never assume the synthetic account or tax codes used by tests are Sanctuary's configuration.

Finance recovery: migration12 adds `xero_finance_resume`, called from the confirmed mapping screen only when transfers are activated. It requires the current finance grant, pinned tenant, enabled issuance gate and verified mapping. It delegates to the existing manual-retry owner for the same job and returns existing queued/running state on repeat. Any prepared request, provider effect or invoice binding requires reconciliation instead; no request is reset and no replacement intent is created. Isolated tests cover this wrapper with a recording retry adapter; the real jobs harness now executes migrations10–12 and a mapping/save/resume/balance/revocation contract against canonical PGMQ helpers. Hosted proof and uncertain-provider recovery remain required before rollout.

Real finance workflow evidence: [run34836432934](https://github.com/velt-design/sanctuary/actions/runs/34836432934) at `face622` passed both database targets, including migrations05–12, mapping save/replay, canonical stopped-job resume without duplicate queue identity, balance aggregation and revoked-access denial. The earlier Supabase image-rate-limit failure cleared on this fresh changed-code run. This remains isolated proof, not shared rollout or provider-write evidence.

`invoiceObservation.ts` now compares an already-bound Xero invoice with its original request. It recognises unchanged finance posting separately from edits, tracks portal-vs-Xero void differences, and treats Xero payment totals as evidence requiring payment matching rather than recording portal money. It does not relax the DRAFT-only creation finaliser. Seven focused cases pass; persistence, refresh scheduling and UI integration of this observer remain unfinished.

Invoice observations are now wired in code: migration13 fences concurrent reads with a per-transfer generation and rejects a saved result when the portal status changed. Private append-only observations preserve evidence; repeated identical saves do not refresh timestamps. The finance list retrieves bounded, grant-checked observations, shows posting/conflicts/correction status and check times, warns after24 hours, and offers Check Xero now. Failed provider reads become unavailable evidence. No observation records a portal receipt or changes a Xero invoice.

`XERO_INVOICE_OBSERVATION_ENABLED=true` activates manual and scheduled reads; default absent/false is dark. The dedicated authenticated `/api/integrations/xero/observe` cron runs once per minute and selects up to three oldest linked invoices that have not been checked in15 minutes. Large cohorts may take longer; displayed check times remain authoritative. This is application scheduling, not a Codex follow-up. Its route is included in portal Vercel configuration but is not live. Local SQL/route tests pass; the real jobs harness now applies migration13 and checks post-finalisation observation visibility. Browser rehearsal, actual background operation and full CI evidence for this change remain pending.

Observation database evidence: [run34837427002](https://github.com/velt-design/sanctuary/actions/runs/34837427002) at `1ea3f39` passed both database matrix targets, now exercising the post-mapping tax guard, transfer finalisation, persisted observation visibility and suppression of freshly checked scheduler targets. Local Xero/observation verification passes215 tests. This does not prove deployed cron operation or real Xero correctness.

The invoice-payment provider read is implemented separately from the bank-receipt pilot. It reads only Payments for an explicitly bound receivable invoice in the pinned tenant, requires recorded payment-read consent, and supports exact payment-ID revalidation. Results are bounded to20 plus a continuation warning; repeated payment identities, wrong invoice ownership and provider validation failures are refused. Amounts remain in invoice currency, never substituted from BankAmount; deleted/unreconciled states and missing/invalid evidence remain visible for subsequent eligibility checks. The selected response excludes bank-account details. Local Xero/observation verification passes228 tests. This adapter is not yet connected to finance review or approval: source-aware ledger provenance, cross-source duplicate prevention and approval across invoice stages remain required before activation. Existing bank-receipt approvals are unchanged.

Forward migration14 adds explicit BANK_TRANSACTION/INVOICE_PAYMENT provenance to the existing match records; historical rows retain bank-receipt identity. Both commands use one private ledger owner, retaining grant checks, project/source locks, reviewed fingerprints, source uniqueness, atomic audit and canonical reversals. The original pilot entry point remains restricted to first-stage quote deposits. The new service-only invoice-payment command verifies the pinned transferred invoice and frozen customer identity and accepts later quote stages or standalone invoices. Mixed active bank/invoice-payment history within a project is refused for reconciliation; this is an exception gate, not automatic equivalence detection or a resolution workflow.

Standalone instalments remain unallocated until full coverage, then those same receipts are allocated to that exact standalone invoice. The existing allocation guard now recognises these approved instalments, refuses quoted targets/duplicate allocations, and the general reallocation command requires reversal instead of repurposing them. Existing whole-invoice/manual commands remain covered against their current SQL owners. Migration14 is unapplied outside disposable tests. Application review envelopes, fresh provider revalidation and finance UI wiring are still required: no caller currently exposes the new approval command. Real PostgreSQL concurrency, shared migration-chain validation and rollout remain pending.
