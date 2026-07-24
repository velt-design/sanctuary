# Security, Privacy, And Quality

This doc combines operational controls for tracking, consent, security, and quality gates.

## Consent Categories

- `essential`: required for core site behavior.
- `analytics`: measurement and site performance analysis.
- `marketing`: advertising attribution and remarketing.

Optional categories must not load before explicit consent.

The initial browser state denies both optional categories. GA loads only after
analytics consent; Meta and ArchiPro load only after marketing consent; GTM
loads after either relevant category and receives a consent-mode update that
keeps the other category denied. There is no
GTM noscript iframe or other unconditional vendor request. Consent updates are
queued before a newly permitted loader runs, and declining or not choosing
causes no GA, GTM, Meta, or ArchiPro network request. The executable browser
boundary is `playwright/marketing.consent.spec.ts`.

## Tracking Register

| Integration | Category | Load Path | Purpose | Owner |
| --- | --- | --- | --- | --- |
| Google Tag Manager | analytics / marketing | `apps/marketing/components/GoogleTagManager.tsx` | Container for Google Ads conversion tags, conversion linker, and future vendor tags; it loads only after at least one relevant optional category is explicitly granted and receives the exact category consent state first | Marketing and Engineering |
| Google Analytics GA4 | analytics | `apps/marketing/components/Analytics.tsx`, `apps/marketing/app/runtime-ga.js/route.ts` | Page and Web Vitals analytics | Marketing and Engineering |
| Google Ads attribution foundation | marketing | `apps/marketing/lib/attribution.ts`, `apps/marketing/app/api/enquiry/route.ts`, portal `audit_events` | Captures UTM plus `gclid`/`gbraid`/`wbraid` for new enquiries and records high-value lifecycle milestones for later Ads import | Marketing and Engineering |
| Meta Pixel browser | marketing | `apps/marketing/components/MetaPixel.tsx`, `apps/marketing/app/runtime-meta.js/route.ts` | Browser-side lead attribution | Marketing |
| Meta Conversions API | marketing | `apps/marketing/app/api/contact/route.ts` | Legacy server-side lead conversion reporting; requires an explicit marketing-consent flag | Marketing and Engineering |
| ArchiPro Pixel | marketing | `apps/marketing/components/ArchiproPixel.tsx`, `apps/marketing/app/runtime-archipro.js/route.ts` | Campaign performance tracking | Marketing |
| Homepage interaction events | analytics | `apps/marketing/app/home-v2/HomepageInteractionTracker.tsx` | Distinguishes non-PII hero, pathway, product, project, disclosure, review-control, guide and enquiry-link interactions on `/` after analytics consent, segmented by mobile, tablet or desktop viewport | Marketing and Engineering |

When adding or removing tracking, update this table and the privacy behavior.

Homepage interaction events contain only the stable event name, homepage variant, viewport category, link destination and optional editorial card label. They do not contain form values, photos, dimensions, contact details or other project/customer data, and the route-local listener is inactive unless analytics consent is granted. Homepage enquiry links may pass the non-sensitive `residential`, `commercial` or `professional` enquiry type so the contact form opens on the promised pathway; no customer-entered data is placed in the URL.

## Portal Operational Performance Telemetry

Authenticated portal Web Vitals are operational telemetry, not marketing analytics. `PortalVitalsReporter` submits CLS, FCP, INP, LCP, and TTFB to the first-party staff API with `sendBeacon` and a keepalive-fetch fallback. Failure is silent and never delays navigation.

The event contract accepts only a closed route-template allowlist, metric value/rating, navigation type, device class, and an optional build ID. Raw URLs, query strings, record IDs, names, email addresses, user IDs, user-agent strings, and free-form text are not accepted or stored. Staff may insert through the authenticated route; only admins may read the grouped 7- or 30-day p75/p95 summary. Clients cannot update or delete metrics. A locked-down daily database job deletes rows older than 30 days.

GTM migration note: the coded GA4 loader remains active while the GTM container is being configured. The public enquiry form pushes a non-PII `lead_submitted` dataLayer event after `/api/enquiry` succeeds so Google Ads conversion tracking can trigger without relying on a thank-you page, but no vendor runtime can transmit it until its consent boundary opens. Server-side forward attribution now records `marketing.lead_submitted`, `marketing.site_visit_booked`, `marketing.quote_accepted`, and `marketing.deposit_received` in `audit_events`; Google Ads API upload/enhanced conversions remain a later integration once conversion action IDs and credentials are available. Once GA4 and Google Ads conversion tags are owned by GTM, remove or disable the coded GA4 loader to avoid duplicate page view or event reporting.

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
