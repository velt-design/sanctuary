# Security, Privacy, And Quality

This doc combines operational controls for tracking, consent, security, and quality gates.

## Consent Categories

- `essential`: required for core site behavior.
- `analytics`: measurement and site performance analysis.
- `marketing`: advertising attribution and remarketing.

Optional categories must not load before explicit consent.

## Tracking Register

| Integration | Category | Load Path | Purpose | Owner |
| --- | --- | --- | --- | --- |
| Google Tag Manager | analytics / marketing | `apps/marketing/components/GoogleTagManager.tsx` | Container for Google Ads conversion tags, conversion linker, and future vendor tags; consent defaults are denied before the container loads | Marketing and Engineering |
| Google Analytics GA4 | analytics | `apps/marketing/components/Analytics.tsx`, `apps/marketing/app/runtime-ga.js/route.ts` | Page and Web Vitals analytics | Marketing and Engineering |
| Google Ads attribution foundation | marketing | `apps/marketing/lib/attribution.ts`, `apps/marketing/app/api/enquiry/route.ts`, portal `audit_events` | Captures UTM plus `gclid`/`gbraid`/`wbraid` for new enquiries and records high-value lifecycle milestones for later Ads import | Marketing and Engineering |
| Meta Pixel browser | marketing | `apps/marketing/components/MetaPixel.tsx`, `apps/marketing/app/runtime-meta.js/route.ts` | Browser-side lead attribution | Marketing |
| Meta Conversions API | marketing | `apps/marketing/app/api/contact/route.ts` | Server-side lead conversion reporting | Marketing and Engineering |
| ArchiPro Pixel | marketing | `apps/marketing/components/ArchiproPixel.tsx`, `apps/marketing/app/runtime-archipro.js/route.ts` | Campaign performance tracking | Marketing |

When adding or removing tracking, update this table and the privacy behavior.

## Portal Operational Performance Telemetry

Authenticated portal Web Vitals are operational telemetry, not marketing analytics. `PortalVitalsReporter` submits CLS, FCP, INP, LCP, and TTFB to the first-party staff API with `sendBeacon` and a keepalive-fetch fallback. Failure is silent and never delays navigation.

The event contract accepts only a closed route-template allowlist, metric value/rating, navigation type, device class, and an optional build ID. Raw URLs, query strings, record IDs, names, email addresses, user IDs, user-agent strings, and free-form text are not accepted or stored. Staff may insert through the authenticated route; only admins may read the grouped 7- or 30-day p75/p95 summary. Clients cannot update or delete metrics. A locked-down daily database job deletes rows older than 30 days.

GTM migration note: the coded GA4 loader remains active while the GTM container is being configured. The public enquiry form pushes a non-PII `lead_submitted` dataLayer event after `/api/enquiry` succeeds so Google Ads conversion tracking can trigger without relying on a thank-you page. Server-side forward attribution now records `marketing.lead_submitted`, `marketing.site_visit_booked`, `marketing.quote_accepted`, and `marketing.deposit_received` in `audit_events`; Google Ads API upload/enhanced conversions remain a later integration once conversion action IDs and credentials are available. Once GA4 and Google Ads conversion tags are owned by GTM, remove or disable the coded GA4 loader to avoid duplicate page view or event reporting.

## Durable Background-Job Boundary

The JOB-01 foundation defines one logged PGMQ queue, a durable job ledger, a private frozen-payload table, append-only events, effect checkpoints, worker heartbeats, and service-role-only security-definer RPCs. It is foundation code only: no deployment evidence is recorded, no worker runtime or workflow producer is live, and JOB-02 through JOB-08 remain pending.

Security invariants:

- A PGMQ message contains exactly `jobId` and `contractVersion`. It must never contain recipients, email addresses, tokens, attachments, generated content, customer data, or the frozen execution payload.
- Frozen versioned input lives in `private.background_job_payloads`. Direct access is revoked from browser roles and `service_role`; a worker may read it only through the lease-fenced RPC after a valid claim.
- Browser roles have no PGMQ schema, ledger, event, effect, worker, payload, or job RPC access. Direct PGMQ/private-schema access is revoked from `service_role` too; server workers use only explicitly granted security-definer RPCs.
- Every protected payload read and worker-owned lifecycle/effect mutation is fenced by worker ID plus a random per-claim lease token. An expired or stale claimant must not be able to report progress, checkpoint an effect, schedule its retry, acknowledge cancellation, or complete the job; administrative cancellation, retry, recovery, and repair stay separate service-role RPCs.
- Safe progress, result, error, event, and effect metadata must pass the bounded safe-JSON rules. Staff-facing status comes only from the fixed registry mapping and omits raw phases, hashes, leases, provider IDs, and raw errors. Provider dispatch and provider acceptance are not business completion; durable effect and state history must reconcile before finalisation.
- Static SQL inspection is necessary but not sufficient. Before any rollout, run the Docker-backed `npm run test:jobs:db` harness and review grants, lease behaviour, logged queue persistence, atomic enqueue, and terminal archive there. A configured CI workflow is not evidence until it succeeds.

## Repository Key Incident

Commit `db20ed2e` removed tracked private-key material after the repository security test discovered it. Removal from the current tree does not revoke the credential and does not remove it from Git history. Treat the material as compromised until the owning credential is rotated or revoked and downstream use has been audited. History rewriting is explicitly out of scope and must not be attempted; remediation is rotation/revocation plus access review. A passing current-tree secret scan does not close this incident by itself.

## Security Rules

- Never commit secrets or env files.
- Keep service-role Supabase access server-only.
- Use portal auth helpers for staff/admin API routes.
- No-auth QA routes must be disabled by default, render baked sample data only, and must not initiate domain/customer-table reads. The project-mutation timing fixture requires `ENABLE_PORTAL_QA_FIXTURES=1`; its intercepted sample request must never contain a customer or durable record ID.
- Keep public quote and invoice flows token-bound.
- Keep automation, email outbox, and audit side effects aligned with `docs/automation-email-audit.md`.
- Keep durable background-job messages minimal and payloads private; keep all worker access behind service-role RPCs and every worker-owned payload read/mutation lease-fenced.
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
- Run `npm run test:jobs` for JOB-01 contract, migration, and repository-security checks. These are static/unit checks and do not replace live isolated-database execution.

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
npx vitest run apps/portal/lib/performance/webVitals.test.ts apps/portal/app/api/staff/v1/performance/web-vitals/route.test.ts apps/portal/app/api/admin/performance/web-vitals/route.test.ts
```

## Ownership

Engineering owns headers, CSP, CI guardrails, secret boundaries, and technical remediation.

Marketing owns third-party pixel purpose, retention decisions, campaign attribution needs, and privacy copy review.
