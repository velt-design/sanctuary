# Automation, Email, And Audit

Status: Current.

This doc owns current-state guidance for portal automation events, project tasks, follow-ups, email outbox, email previews, audit events, and marketing enquiry email side effects. Quote/invoice transactional side effects remain owned by `docs/quotes-invoices-job-packs.md`.

## Read First

- Use `## Ownership` and `## Current Data Flow` to locate the request-bound or durable email owner before changing a send.
- Use `## Access Boundaries` and `## Guardrails` before changing provider transport, webhook reconciliation, outbox state, or logs.
- Use `docs/quotes-invoices-job-packs.md` for quote/invoice lifecycle behavior and `docs/supabase-schema-map.md` for durable receipt/RPC ownership.

## Ownership

- Automation runner: `apps/portal/lib/automation/AutomationRunner.ts`; canonical task/follow-up persistence and business-calendar due dates live in `taskPersistence.ts`.
- Automation cache keys: `apps/portal/lib/cache/automationCache.ts`.
- Portal transactional email helpers/templates: `apps/portal/lib/emails`.
- Shared provider contract: `packages/email-provider` (`@sp/email-provider`).
- Durable provider-effect coordinator: `apps/worker/src/effects/durableEmailEffect.ts` (not yet registered by a business handler).
- Signed provider webhook and narrow persistence owner: `apps/portal/app/api/webhooks/resend/route.ts` and `apps/portal/lib/backgroundJobs/providerWebhookRepository.ts`.
- Project action routes that emit automation events: `apps/portal/app/api/staff/v1/projects/[projectId]/action`.
- Email preview route: `apps/portal/app/api/staff/v1/projects/[projectId]/emails/[emailId]/preview/route.ts`.
- Marketing enquiry/contact routes: `apps/marketing/app/api/contact` and `apps/marketing/app/api/enquiry`.
- Marketing autoresponder helpers/templates: `apps/marketing/lib/email` and `apps/marketing/emails`.
- Schema ownership map: `docs/supabase-schema-map.md`.

## Tables

- `audit_events`: idempotent automation event log.
- `tasks`: project tasks created by automation.
- `followup_plans` and `followup_tasks`: quote follow-up sequences.
- `email_templates`: DB-backed template metadata and fallback HTML.
- `email_outbox`: queued, sent, failed, or cancelled project email records.
- `site_visit_events`: site visit state that automation may create or update.
- `enquiry_requests`: public enquiry intake records.
- `design_package_tickets`: legacy/transitional automation ticket table; Design List now uses `design_package_requests`.

## Current Data Flow

Staff project action routes call `automationRunner.runEvent()` or directly perform a route-owned side effect. `AutomationRunner` writes an idempotent `audit_events` row first; duplicate idempotency keys stop repeated handling.

Event handlers can:

- create project tasks
- enqueue or record email outbox rows
- create or update site visit events
- create quote follow-up plans and tasks
- cancel open follow-ups when pipeline stage changes make them irrelevant

`REVIEW_NEW_LEAD` is persisted with a 5:00pm Auckland next-business-day due timestamp using weekend, national/Auckland holiday, and company-closure data. Marking a project contacted persists the existing two-business-day cadence as `FOLLOWUP_CALL`; AutomationRunner no longer writes project next-action columns. Open automation/follow-up rows are canonical command-centre candidates.

Canonical task/follow-up tables are select-only to authenticated portal users. Automation persistence stays in the server-only service-role adapter, while Design Package task creation/status/due changes use the bounded `project_command_sync_design_task` RPC instead of direct authenticated table writes.

Marketing enquiry routes can create public lead/enquiry records and send or log autoresponder email behavior. `marketing_enquiry_intake` owns contact, project, and enquiry creation as one database transaction. A browser-generated `submission_id`, unique constraint, and transaction advisory lock make retries and concurrent duplicates return the original IDs. The RPC persists the same nullable indicative-pricing fields used by the autoresponder, so production schema readiness includes `20260724043000_marketing_enquiry_budget_columns.sql`; a root baseline `CREATE TABLE IF NOT EXISTS` is not evidence that an existing table has those columns. Keep public marketing writes narrow and server-owned; public responses expose stable validation/service messages, never raw Supabase errors.

Portal transactional email and marketing contact/enquiry email now use thin server-only adapters over `@sp/email-provider`. The package normalizes the message, enforces a bounded timeout/abort contract, classifies provider outcomes, and keeps raw provider responses out of app errors and logs. Existing stable marketing IDs are forwarded as compatibility idempotency keys where available. Quote/invoice delivery remains request-bound until JOB-04/JOB-05, while automation and `email_outbox` delivery remain under their current owners until JOB-07; the shared gateway does not by itself move either workflow to the worker.

The durable JOB-03 email coordinator is a reusable worker primitive, not an enabled handler. It freezes one exact job/effect-derived Resend key, recipients, subject, content, attachments, tags, token bytes, request hash, and 20-hour automatic retry expiry. Its checkpoints are `prepared`, `dispatch_started`, `provider_accepted`, `finalised`, and `uncertain`. A retry after uncertainty may use only that same key and byte-identical request before expiry/attempt exhaustion; it must never manufacture a new key. Provider acceptance is evidence to resume an idempotent business finaliser, not business completion.

Resend `email.sent` callbacks enter through `/api/webhooks/resend`. The route bounds the streamed body to 256 KiB, decodes UTF-8 strictly, verifies the untouched body and Svix headers with the server-only webhook secret, then passes only event/message identity and the safe `job_id`/opaque `effect_ref` correlation fields to one service-role RPC. Account-wide callbacks for request-bound legacy sends have no durable correlation tags, so they are acknowledged and ignored without persisting provider/customer fields; a partially present or malformed durable tag pair fails closed. Correlated receipts are minimal and append-only. Verified acceptance may supersede only named stale provider-outcome classifications. Exact payload/key/message/effect conflicts stay operator-visible; the worker's lease-fenced local acceptance RPC atomically quarantines a different or cross-job-colliding provider message, and a conflicting callback after success/cancellation reclassifies the durable job for attention. Non-conflicting acceptance may wake finalisation, but neither reconciliation path mutates quote, invoice, outbox, or other unrelated business state.

Forward marketing attribution is recorded as project audit events only. New enquiries store compact UTM and Google click identifiers in `enquiry_requests.raw_payload.attribution`; later high-value lifecycle events are `marketing.lead_submitted`, `marketing.site_visit_booked`, `marketing.quote_accepted`, and `marketing.deposit_received`. These rows are a foundation for later Google Ads upload, not an Ads API integration.

Current website enquiry autoresponders keep the existing payload shape for preview compatibility, but new base pergola estimates are sent and stored as a single lower-only amount by setting equal low/high values. Historical rows with unequal low/high values still preview as ranges. Optional blinds remain range-based, use the shared corrected `@sp/costing` baseline, and persist into the generated calculator draft with No cover unless staff later selects a flashing or pelmet.

The email preview route renders an outbox row by template ID and variables. It uses repo-rendered website autoresponder templates, portal transactional templates, or DB `email_templates` fallback HTML.

`/staff/email-previews` is the fixture-only staging review surface for the website autoresponder. Its staff-authenticated API renders the same stable template IDs, subject, preheader, HTML and plain text used by the production customer sender. Residential, residential without blinds, commercial, commercial with blinds and professional variants use repository fixtures only. Preview delivery reads `RESEND_API_KEY_PREVIEW` and the single `EMAIL_PREVIEW_TO` recipient on the server, omits the production BCC, and is unavailable unless `EMAIL_PREVIEW_ENABLED=true` in a Vercel Preview deployment (or local development/test). The browser may select only a fixture variant; it cannot supply recipients or provider credentials. This path does not call enquiry intake or write contacts, projects, estimates, enquiries, outbox rows or audit records.

Residential, commercial, and professional enquiry file uploads are stored, not just counted. The browser mints signed upload URLs via `apps/marketing/app/api/enquiry/attachments/sign` and uploads directly to the private `enquiry-attachments` Supabase Storage bucket (bypassing the serverless request-body limit); the enquiry payload carries only storage paths. Signing is same-origin, durably rate-limited, and creates a 15-minute server-owned session bound to the client submission UUID, a token hash, and the exact expected paths/metadata. Intake accepts at most eight PDF/JPEG/PNG/WebP files and 20 MB total, checks matching extensions, sizes, private path ownership, session expiry/consumption, and downloaded content signatures before the atomic RPC consumes the session. A path or session from another submission cannot be attached.

On send, `apps/marketing/app/api/enquiry` either inlines verified files as autoresponder attachments (total <= 8 MB) or adds 7-day signed download links to the matching residential, commercial, or professional template. Staff receive the same files or links via the autoresponder BCC. Storage transport remains best-effort: a missing client configuration or failed direct upload degrades that file to validated metadata-only and does not block the enquiry. Requires `NEXT_PUBLIC_SUPABASE_ANON_KEY` for direct browser upload. The authenticated daily cleanup route removes objects for expired unconsumed sessions; database retention removes stale rate-limit state after two days and consumed session bindings after 30 days.

The legacy JSON-only `/api/contact` compatibility send also uses the durable database limiter. It rejects multipart bodies; all public file intake belongs to the signed, submission-bound `/api/enquiry` path.

## Access Boundaries

- `AutomationRunner` and its server-only `taskPersistence.ts` adapter intentionally use service-role access. The runner owns orchestration; `taskPersistence.ts` is the narrow persistence boundary for business-calendar reads plus idempotent automation task/follow-up writes. Both paths are named in the exact-match boundary allowlist so a new service-role consumer still fails the security test.
- Staff project action and preview routes must use staff auth helpers.
- Public marketing enquiry/contact routes may write lead and email/audit records from server code, but must not expose staff workflow data.
- Marketing enquiry autoresponder budgets and auto-created estimate drafts share one canonical costing snapshot. Saved calculator inputs must describe that snapshot (including the two-post standard assumption); do not recalculate separately for email and persistence.
- The public Resend webhook is not a browser data surface. It verifies signatures before any database call and the repository may call only `background_job_reconcile_verified_provider_acceptance`; raw bodies, signatures, recipients, subjects, content, and arbitrary provider fields do not cross that repository boundary.
- Browser task and activity access should use current project/dashboard APIs and query helpers. Do not reintroduce direct browser automation table writes; prefer staff API routes for new write behavior.
- Manual project-task checkboxes may show optimistic local feedback, but the owning staff API remains authoritative for `project_task_checks`, pipeline transitions, and automation events. Concurrent saves must roll back only the rejected task, expose explicit retry, and never claim an auto-advance side effect before the response confirms it.
- Service-role keys, raw email provider responses, and private customer data must not reach client props, logs, generated documents, or public routes.
- Preview-only Resend credentials and the fixed preview recipient stay server-owned. Preview-send requests accept only a repository fixture variant and never a browser-supplied address.

## Guardrails

- Side effects must be idempotent. Use stable idempotency keys for automation events, emails, tasks, and follow-ups.
- For durable provider uncertainty, reuse only the frozen provider key and exact request while the 20-hour retry window and attempt budget remain live. Expired or unresolved work needs staff attention; changing delivery inputs creates a new workflow intent, not a mutation beneath the old key.
- Do not duplicate quote, invoice, token, PDF, or job-pack side effects here; those belong to `docs/quotes-invoices-job-packs.md`.
- Record email failures in `email_outbox` where the user needs visibility.
- Keep outbox status transitions explicit: `QUEUED`, `SENT`, `FAILED`, or `CANCELLED`.
- Template IDs must be stable because outbox rows use them for previews and auditability.
- If a route sends an email immediately, also make the outbox/audit state clear enough for staff to understand what happened.
- Site visit notification changes must stay aligned with `docs/schedule.md` and `docs/projects-contacts-estimates-calculator.md`.
- Pricing rollout audit events must be compact and server-owned. Estimate saves and blocked `workbench_solved` readiness attempts record source, requested source, gate version, blocking codes, IDs, and actor/request metadata. Quote version create/refresh/revision events that copy pricing source metadata record quote version IDs, estimate IDs, copied source, source metadata hash, actor, and copy reason. Do not store raw public tokens, service-role details, or oversized commercial payloads.
- Required pricing rollout event types are `estimate.pricing_source_saved`, `estimate.pricing_source_blocked`, and quote metadata-copy events when the rollout implementation creates or refreshes quote-version source metadata.
- Pricing rollout audit payloads include estimate or quote IDs, actor/request metadata, requested source, selected source, gate version, blocking gate codes, commercial input hash, parity report hash/version, and rollback provenance.
- Pricing rollout audit payloads must exclude raw public tokens, token hashes, service-role details, raw commercial payloads, generated PDF contents, and email body token URLs.
- Post-enable audit checks must verify blocked attempts have no paired estimate mutation, successful `workbench_solved` saves have source metadata, and rollback saves show `rollbackProvenance: explicit_calculator_live`.
- Costing configuration publication uses its dedicated append-only `costing_configuration_audit_events` table. The atomic publish RPC records actor ID/email, immutable version ID/hash, previous current version, audit note, exact package-generated diff, and representative-scenario impact. Draft keystrokes are not audit events. Published rows and audit events cannot be updated or deleted by authenticated callers; rollback creates and publishes a new version.

## Common Tasks

### Adding An Automation Event

1. Add or reuse a stable event type.
2. Build an idempotency key from project, event type, stage or primary ID.
3. Add handler behavior in `AutomationRunner`.
4. Update tables/RLS only through ordered migrations.
5. Verify duplicate event handling does not repeat side effects.

### Adding An Email Template

1. Decide whether the template is repo-rendered or DB fallback.
2. Keep the template ID stable.
3. Seed DB template metadata when needed.
4. Confirm preview behavior through the email preview route.
5. Verify missing env, provider failure, and outbox status behavior.

### Changing Marketing Enquiry Email Behavior

1. Keep public route writes server-owned and narrow.
2. Preserve consent/tracking rules from `docs/security-privacy-quality.md`.
3. Verify `email_outbox` and `audit_events` logging for success and failure states.
4. Check customer/internal email template output when copy or variables change.

## Verification

Focused commands depend on the changed path. If no direct test exists yet, use the closest email, route, project snapshot, or marketing enquiry test and add coverage when the change is risky.

```bash
rg -n "automationRunner|email_outbox|audit_events|followup_tasks" apps/portal apps/marketing supabase docs
npm run test:email-provider
npm run test:worker -- apps/worker/src/effects
npm run test:portal -- apps/portal/lib/emails/sendTransactionalEmail.test.ts apps/portal/app/api/webhooks/resend/route.test.ts apps/portal/lib/backgroundJobs/providerWebhookRepository.test.ts
npm run test:marketing -- apps/marketing/lib/email apps/marketing/app/api/contact/route.test.ts apps/marketing/app/api/enquiry/route.test.ts
npm run test:portal -- "apps/portal/app/api/staff/v1/email-previews/website-autoresponder/route.test.ts"
npm run test:portal -- apps/portal/lib/emails/invoice.test.ts
npm run test:portal -- apps/portal/app/api/contacts/route.test.ts "apps/portal/app/api/contacts/[contactId]/route.test.ts"
npm run test:marketing -- apps/marketing/emails/utils/callWindow.test.ts
```

These tests inject or mock provider transport and webhook signatures. Do not use production/shared database credentials or send a real email as part of repository verification. JOB-03 local provider, integration, worker, contract, typecheck, lint, and production-build gates pass. Background Jobs [run 29723041212](https://github.com/velt-design/sanctuary/actions/runs/29723041212) passes all seven migrations on upstream PostgreSQL 18/PGMQ 1.10.0 and Supabase PostgreSQL 17/PGMQ 1.5.1, plus the contracts/integrations and worker artifact/container gates.

Manual checks should cover:

- Project action emits one audit event and does not repeat side effects on duplicate trigger.
- Expected task, follow-up, site visit, or outbox row appears on the project page.
- Email preview renders repo templates and DB fallback templates.
- Email provider failure is visible as an outbox failure where staff need to act.
- Marketing enquiry success/failure does not expose staff-only data.
