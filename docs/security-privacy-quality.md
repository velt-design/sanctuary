# Security, Privacy, And Quality

This doc combines operational controls for tracking, consent, security, and quality gates.

## Portal One-Time Authentication

Controlled local/staging one-time staff sign-in exchanges a hashed Supabase
`magiclink` token at `/login/callback`. The server must verify the token through
the anon-key auth client, durably set the resulting session cookie, remove the
token from the redirect URL, reject external/backslash/control-character
callbacks, and return `private, no-store` plus
`Referrer-Policy: no-referrer`. Do not place access or refresh tokens in a
protected-route fragment: middleware runs before browser session hydration and
may preserve those credentials on the login URL. Do not log, screenshot,
persist, or use this controlled QA path as a routine production login flow.

## Consent Categories

- `essential`: required for core site behavior.
- `analytics`: measurement and site performance analysis.
- `marketing`: advertising attribution and remarketing.

Optional categories load only when the applicable regional tracking decision
allows them. The browser starts denied while the first-party
`/api/tracking-region` boundary reads Vercel's country code. `NZ` enables
analytics and marketing by regional default without an initial banner. Every
other country, a missing/invalid header, or a failed lookup remains denied and
opens the existing choice banner. A previously saved explicit choice always
takes priority, including an opt-out by an NZ visitor.

The coarse `nz_automatic` or `consent_required` result is kept only in
`sessionStorage`; precise location is neither requested nor stored for this
decision. The region API is private/no-store and asynchronous, so public pages
remain static and cacheable. GTM loads after either an explicit choice or the NZ
regional default enables a relevant category and first receives the exact
consent-mode state. Meta and ArchiPro still require marketing to be enabled;
Web Vitals and GA events require analytics. There is no GTM noscript iframe or
other unconditional vendor request. The executable browser boundary is
`playwright/marketing.consent.spec.ts`.

## Tracking Register

| Integration | Category | Load Path | Purpose | Owner |
| --- | --- | --- | --- | --- |
| Google Tag Manager | analytics / marketing | `apps/marketing/components/GoogleTagManager.tsx` | Container for Google Ads conversion tags, conversion linker, and future vendor tags; it loads after an explicit enabling choice or the NZ regional default and receives the exact category state first | Marketing and Engineering |
| Google Analytics GA4 | analytics | GTM via `apps/marketing/components/GoogleTagManager.tsx`; Web Vitals originate in `apps/marketing/components/WebVitals.tsx`; enabled downstream lifecycle events use `apps/marketing/app/api/marketing-conversions/deliver` | Page, Web Vitals, enquiry, qualified-lead, quote, won, and lost lifecycle measurement | Marketing and Engineering |
| Google Ads attribution foundation | marketing | `apps/marketing/lib/attribution.ts`, `apps/marketing/app/api/enquiry/route.ts`, portal `audit_events` | Captures UTM plus enabled `gclid`/`gbraid`/`wbraid` and records whether the basis was a user choice or NZ regional default; a direct Ads offline upload remains a later integration | Marketing and Engineering |
| Meta Pixel browser | marketing | `apps/marketing/components/MetaPixel.tsx`, `apps/marketing/app/runtime-meta.js/route.ts` | Browser-side lead attribution | Marketing |
| Meta Conversions API | marketing | `apps/marketing/app/api/contact/route.ts` | Legacy server-side lead conversion reporting; requires an explicit marketing-consent flag | Marketing and Engineering |
| ArchiPro Pixel | marketing | `apps/marketing/components/ArchiproPixel.tsx`, `apps/marketing/app/runtime-archipro.js/route.ts` | Campaign performance tracking | Marketing |
| Homepage design-conversation events | analytics | `apps/marketing/app/_home/HomepageDesignConversationTracker.tsx` | Measures the production `/` view, first-question start and answer, governed matched-project views, project opens, project-reference selection, capability/support navigation and general-enquiry exits while analytics is enabled | Marketing and Engineering |
| Guided-home experiment events | analytics | `apps/marketing/app/home-journey/JourneyTracker.tsx` | Measures the noindex `/home-journey` experiment view, closed answer and Back choices, and the single final enquiry exit while analytics is enabled | Marketing and Engineering |
| Guided design-conversation events | analytics | `apps/marketing/app/_home-guided/GuidedHomepageTracker.ts` | Measures the noindex `/home-guided` view, closed question/answer/change/reset values, five stable results and the primary destination click while analytics is enabled | Marketing and Engineering |

When adding or removing tracking, update this table and the privacy behavior.

Homepage design-conversation events contain only the stable event name,
`design_conversation_home_v3` variant, viewport category, link destination,
closed non-personal project-intent values, canonical project slugs, the two
governed matched-project slugs, step number and validated enquiry audience
where known. They do not contain form values, photos, dimensions, contact
details or other project/customer data. The route-local listener is inactive
unless analytics is enabled and does not backfill earlier interactions.
Radio selection by Arrow, Home or End follows the same tracking-gated activation
path as pointer selection, so keyboard engagement is neither dropped nor
double-counted. The shared header exposes its validated route audience to the
homepage listener; the canonical root therefore records `residential` on its
header enquiry without inferring any customer-entered data.
Homepage enquiry links may pass a validated `residential`, `commercial` or
`professional` audience so the contact form opens on the promised pathway; no
customer-entered data is placed in the URL.

The guided-home experiment uses the separate `guided_home_v1` variant and
closed, allowlisted question, answer and result identifiers. Its listener can
also record the numeric step and final link destination, but does not read or
emit visitor-entered content, dimensions, contact details or image data. It is
inactive until analytics consent is enabled and does not backfill choices made
before consent.

The staged guided design conversation uses the separate
`guided_design_conversation_home_v1` variant and only allowlisted audience,
question, answer, result, focus and destination values. Valid destination
continuation may add the complete non-personal trio `source_experience:
guided-home-v1`, `source_pathway` and `source_focus` to an embedded enquiry.
The pathway and focus are closed values from the same guided contract. Partial,
unknown, duplicate-valued and arbitrary input is discarded, and the URL never
contains visitor-entered text or personal information.

Enquiry conversion events retain their category gates and event names. Where
available they also include validated `source_path`, `source_component`,
`source_project`, `source_product`, `source_experience`, `source_pathway`, and
`source_focus` values from the shared enquiry-context
contract. These properties use known paths, component identifiers, and canonical
project/product slugs only. Names, contact details, messages, dimensions, upload
names, and upload contents must not be placed in enquiry URLs or analytics events.
Every direct or embedded enquiry form declares a POST fallback through
`/api/enquiry/fallback` so a pre-hydration or no-JavaScript submission cannot
serialize personal fields into the page URL. The adapter retains the submitted
route context and repeated project options, assigns a server UUID, and redirects
a successful submission to a noindex confirmation route. Optional file inputs
remain disabled until enhancement because signed private uploads require
JavaScript. Project type, name, phone and email are required through the same
client/server intake contract.
The enhanced success event's `lead_event_id` reuses the browser-generated
submission UUID that the intake boundary already validates. This non-personal
opaque identifier allows one analytics success event to reconcile exactly with
one accepted submission without exposing form content.

Major public enquiry links use `buildEnquiryHref`. The global header resolves
audience and item context through the parity-tested route index in
`apps/marketing/lib/enquiryContext.ts`: known commercial and residential
projects carry their governed audience and slug, while product routes carry the
product slug without inventing a residential audience. Direct `/contact`, mixed
collections and unknown routes remain audience-neutral. Analytics assembly
removes caller-supplied canonical context keys before applying the validated,
lower-case properties, so later event data cannot overwrite them.

## Public Marketing Release Identity

Every marketing response exposes `X-Sanctuary-Release` so production evidence
can identify the exact repository revision instead of inferring it from visible
copy or cache behavior. The value accepts only a 7-to-40-character hexadecimal
commit SHA. Build resolution prefers an explicit `MARKETING_RELEASE_SHA`, then
Vercel's `VERCEL_GIT_COMMIT_SHA`, then `GITHUB_SHA`; invalid values are ignored
and local development reports the non-production sentinel `local`.

The header must contain no deployment URL, environment name, account, secret,
token or private infrastructure identifier. Production validation requires the
same SHA on normal and cache-busted responses across the primary route matrix;
`MARKETING_EXPECTED_RELEASE_SHA` may pin the exact expected revision in a
post-deployment check.

## Portal Operational Performance Telemetry

Authenticated portal Web Vitals are operational telemetry, not marketing analytics. `PortalVitalsReporter` submits CLS, FCP, INP, LCP, and TTFB to the first-party staff API with `sendBeacon` and a keepalive-fetch fallback. Failure is silent and never delays navigation.

The event contract accepts only a closed route-template allowlist, metric value/rating, navigation type, device class, and an optional build ID. Raw URLs, query strings, record IDs, names, email addresses, user IDs, user-agent strings, and free-form text are not accepted or stored. Staff may insert through the authenticated route; only admins may read the grouped 7- or 30-day p75/p95 summary. Clients cannot update or delete metrics. A locked-down daily database job deletes rows older than 30 days.

GTM owns GA4 and Google Ads browser tags; there is no separate coded browser GA4 loader. The marketing CSP must permit every resource surfaced by GTM container diagnostics in both its enforced and report-only policies; the current allowlist includes `https://www.googletagmanager.com` for tag images and `https://ad.doubleclick.net` for measurement connections. The public enquiry form pushes a non-PII `lead_submitted` dataLayer event after `/api/enquiry` succeeds; GTM maps it to GA4 `generate_lead` without relying on a thank-you page, and no vendor runtime can transmit it until the applicable category boundary opens.

The same accepted enquiry stores the first-party GA client ID only when analytics is enabled. Campaign fields, click identifiers, landing URL, and referrer require marketing to be enabled; landing/referrer query strings and fragments are removed. The server re-applies those category gates rather than trusting browser filtering, while keeping the exact analytics/marketing snapshot plus `user_choice` or `regional_default` basis used at submission. Portal lifecycle audit events are `marketing.site_visit_booked` for confirmed visits only, `marketing.quote_accepted`, `marketing.deposit_received`, and `marketing.project_lost` for the closed structured loss allowlist. The database trigger creates a durable GA4 outbox row; a five-minute cron claims it with a lease and maps those events to `qualify_lead`, `quote_accepted`, `close_convert_lead`, and `close_unconvert_lead`. Quote acceptance and deposit received include only the authoritative GST-inclusive quote value and `NZD` currency; the won event reads the frozen quote total from its open deposit invoice. GA4 key events are `generate_lead`, `qualify_lead`, `quote_accepted`, and `close_convert_lead`; `close_unconvert_lead` is deliberately diagnostic and must not become a bidding conversion. Delivery uses the originating visitor identity, never a staff browser identity, sends no project/contact IDs, email addresses, free text, or unapproved UTM fields, skips events without enabled analytics or a valid client ID, and bounds retries to eight attempts and GA4's 72-hour backdating window. Claiming one row immediately before dispatch reduces lease overlap, but GA4 Measurement Protocol does not provide generic non-purchase event deduplication: if GA4 accepts a request and the completion checkpoint fails, a retry can duplicate that analytics event. The outbox is therefore at-least-once, not exactly-once, and its stable delivery identity remains available for reconciliation. GA4 Measurement Protocol secrets remain server-only. Direct Google Ads API upload or enhanced conversions remain a later integration once the required action IDs and credentials are available.

## Durable Background-Job Boundary

The durable foundation defines one logged PGMQ queue, a durable job ledger, a private frozen-payload table, append-only events, effect checkpoints, worker heartbeats, and service-role-only security-definer RPCs. JOB-02 adds a dark-by-default Node worker with strict response validation, safe structured logs, cached health output, bounded execution, and an RPC-only Supabase adapter. JOB-03 adds the Node-only `@sp/email-provider` contract, durable email-effect coordinator, private append-only provider receipts, and signed provider-acceptance reconciliation. No deployment evidence, workflow producer, or commercial handler is enabled yet; JOB-04 through JOB-08 remain pending.

Security invariants:

- A PGMQ message contains exactly `jobId` and `contractVersion`. It must never contain recipients, email addresses, tokens, attachments, generated content, customer data, or the frozen execution payload.
- Frozen versioned input lives in `private.background_job_payloads`. Direct access is revoked from browser roles and `service_role`; a worker may read it only through the lease-fenced RPC after a valid claim.
- A durable Resend attempt freezes one job/effect-derived idempotency key, exact normalized request body and hash, and exactly two safe tags: the job UUID plus an opaque effect digest. Provider keys, recipients, subjects, content, attachments, tokens, raw provider responses, and arbitrary tags stay out of safe logs, receipts, public payloads, and staff projections.
- Automatic retry is bounded to a database-frozen 20 hours inside Resend's documented 24-hour idempotency retention and must repeat the same key, recipients, subject, content, attachments, tags, and token bytes. The package fixes both time constants and the database rejects a Resend expiry later than effect `created_at + 24 hours`; callers cannot rebase a durable effect's frozen expiry. A timeout, lost response, crash, or unresolved provider outcome never authorises a fresh key. Expiry, attempt exhaustion, or identity conflict moves the job to `needs_attention`.
- Browser roles have no PGMQ schema, ledger, event, effect, worker, payload, or job RPC access. Direct PGMQ/private-schema access is revoked from `service_role` too; server workers use only explicitly granted security-definer RPCs.
- Worker production code may read the service-role key only in `apps/worker/src/config.ts` and construct the private client only in `apps/worker/src/backgroundJobsRpcClient.ts`. Boundary tests forbid direct table/schema access, browser or Next.js imports, cross-app imports, and raw console logging elsewhere in the worker.
- Every protected payload read and worker-owned lifecycle/effect mutation is fenced by worker ID plus a random per-claim lease token. An expired or stale claimant must not be able to report progress, checkpoint an effect, schedule its retry, acknowledge cancellation, or complete the job; administrative cancellation, retry, recovery, and repair stay separate service-role RPCs.
- Abort is advisory until handler code settles. The runtime keeps the lease heartbeat active through settlement and terminal mutation, signal-fences every handler RPC, never releases or retries while old handler code is live, and exits before lease recovery if an aborted handler will not settle. CPU-heavy handlers must yield or be offloaded inside the heartbeat budget.
- Safe progress, result, error, event, effect, and worker metadata use separate flat allowlisted contracts with strict byte/count limits plus value-level rejection of obvious recipients, URLs, credentials, hashes, names, and provider payloads. Staff-safe inspection RPCs project an explicit column list and omit leases, queue IDs, hashes, raw errors, cancellation detail, protected payloads, and provider internals. Provider dispatch and provider acceptance are not business completion; durable effect and state history must reconcile before finalisation.
- `/api/webhooks/resend` rejects an invalid advertised length or streamed body above 256 KiB before buffering beyond that cap or performing signature work, decodes bounded UTF-8 strictly, verifies the untouched bytes with the server-only `RESEND_WEBHOOK_SECRET`, and ignores unrelated signed event types plus untagged account-wide callbacks from request-bound legacy sends. A partially present or malformed durable tag pair fails closed. Only bounded correlated `email.sent` identity fields reach the allowlisted service-role repository/RPC, and minimal receipts are append-only. Verified acceptance may supersede named stale local outcomes and wake matching durable finalisation, but exact request/key/message/identity conflicts remain operator-visible; late conflicts after success/cancellation move the durable job to attention without replaying business finalisation. Invalid signatures fail closed, and raw bodies/signatures are never logged or persisted.
- Static SQL inspection is necessary but not sufficient. Background Jobs [run 29713940507](https://github.com/velt-design/sanctuary/actions/runs/29713940507) passed the six JOB-01/JOB-02 migrations on both supported real-PGMQ images, including grants, lease behaviour, logged queue persistence, atomic enqueue, runtime projections, and terminal archive; the same run passed the worker's strict service-role and non-root container gates. Preserve that gate for every migration or worker-artifact change; it does not replace shared-environment deployment review.
- JOB-03 local provider, integration, worker, contract, typecheck, lint, security, and production-build gates pass. Background Jobs [run 29723041212](https://github.com/velt-design/sanctuary/actions/runs/29723041212) passes the seven-migration executable contract on upstream PostgreSQL 18/PGMQ 1.10.0 and Supabase PostgreSQL 17/PGMQ 1.5.1, plus contracts/integrations, the strict service-role boundary, and the non-root worker container build. No shared database, production deployment, real email, enabled handler/producer, or rollout is part of the repository-only checkpoint.

## Repository Key Incident

Commit `db20ed2e` removed tracked private-key material after the repository security test discovered it. Removal from the current tree does not revoke the credential and does not remove it from Git history. Treat the material as compromised until the owning credential is rotated or revoked and downstream use has been audited. History rewriting is explicitly out of scope and must not be attempted; remediation is rotation/revocation plus access review. A passing current-tree secret scan does not close this incident by itself.

## Security Rules

- Never commit secrets or env files.
- Keep service-role Supabase access server-only.
- Use portal auth helpers for staff/admin API routes.
- No-auth QA routes must be disabled by default, render baked sample data only, and must not initiate domain/customer-table reads. The project-mutation timing fixture requires `ENABLE_PORTAL_QA_FIXTURES=1`; its intercepted sample request must never contain a customer or durable record ID.
- Keep public quote and invoice flows token-bound.
- Resolve quote and invoice token expiry through `apps/marketing/lib/publicTokenAccess.ts` before loading customer-facing records, artifacts, or mutations. Expired tokens must not render quote/invoice data, accept a quote, download invoice/source-quote PDFs, or download quote attachments.
- Public enquiry submission and attachment signing must pass same-origin/allowlisted-origin checks and durable database rate limits. Rate-limit identifiers use the dedicated marketing HMAC secret when configured, otherwise a domain-separated subkey derived from the required server-only service credential; production fails closed if neither is available. Stored attachments require an unexpired submission-bound upload session, strict metadata plus content-signature validation, and private-bucket cleanup for abandoned uploads.
- Keep automation, email outbox, and audit side effects aligned with `docs/automation-email-audit.md`.
- Keep durable background-job messages minimal and payloads private; keep all worker access behind service-role RPCs and every worker-owned payload read/mutation lease-fenced.
- Keep provider transport and webhook verification in `@sp/email-provider`; app adapters and routes may expose only typed safe failures and verified correlation fields.
- Run production dependency audits for governance checks.
- Preserve CSP reporting and review unexpected report volume.

## Quality Gates

Marketing Lighthouse thresholds:

- Performance: at least `0.90` mobile and `0.95` desktop.
- Accessibility: at least `0.95`.
- Best Practices: at least `0.95`.
- SEO: `1.00`.

Security:

- No unresolved critical/high production vulnerabilities from `npm audit --omit=dev`.
- The workspace, Portal, and Marketing PostCSS overrides must resolve to the same patched version; verify with `npm ls postcss` after dependency changes.
- Portal Quality runs `npm run audit:security` as a blocking pull-request gate; Governance Monthly also runs the production dependency audit as part of the broader marketing/governance sweep.
- Run `npm run test:email-provider` for provider normalization/transport/webhook contracts, `npm run test:jobs` for durable contract, migration, and repository-security checks, and `npm run test:worker` for the Node runtime and hard-crash effect recovery. These are static/unit checks and do not replace live isolated-database or container execution.

Privacy:

- Tracking behavior must match consent and privacy copy.
- New third-party scripts need owner, purpose, consent category, and privacy review.

## Guard Commands

```bash
npm run audit:security
npm run audit:lighthouse
npm run audit:governance
npm run text:mojibake
npm run brand:forbid
npm run cache:forbid
npm run test:jobs
npm run test:jobs:db
npm run test:worker
npm run test:email-provider
npx vitest run apps/portal/lib/performance/webVitals.test.ts apps/portal/app/api/staff/v1/performance/web-vitals/route.test.ts apps/portal/app/api/admin/performance/web-vitals/route.test.ts
```

## Ownership

Engineering owns headers, CSP, CI guardrails, secret boundaries, and technical remediation.

Marketing owns third-party pixel purpose, retention decisions, campaign attribution needs, and privacy copy review.
