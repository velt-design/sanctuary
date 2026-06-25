# Automation, Email, And Audit

Status: Current.

This doc owns current-state guidance for portal automation events, project tasks, follow-ups, email outbox, email previews, audit events, and marketing enquiry email side effects. Quote/invoice transactional side effects remain owned by `docs/quotes-invoices-job-packs.md`.

## Ownership

- Automation runner: `apps/portal/lib/automation/AutomationRunner.ts`.
- Automation cache keys: `apps/portal/lib/cache/automationCache.ts`.
- Portal transactional email helpers/templates: `apps/portal/lib/emails`.
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

Marketing enquiry routes can create public lead/enquiry records and send or log autoresponder email behavior. Keep public marketing writes narrow and server-owned.

Forward marketing attribution is recorded as project audit events only. New enquiries store compact UTM and Google click identifiers in `enquiry_requests.raw_payload.attribution`; later high-value lifecycle events are `marketing.lead_submitted`, `marketing.site_visit_booked`, `marketing.quote_accepted`, and `marketing.deposit_received`. These rows are a foundation for later Google Ads upload, not an Ads API integration.

Current website enquiry autoresponders keep the existing payload shape for preview compatibility, but new base pergola estimates are sent and stored as a single lower-only amount by setting equal low/high values. Historical rows with unequal low/high values still preview as ranges. Optional blinds remain range-based.

The email preview route renders an outbox row by template ID and variables. It uses repo-rendered website autoresponder templates, portal transactional templates, or DB `email_templates` fallback HTML.

## Access Boundaries

- `AutomationRunner` is server-only and uses service-role access intentionally.
- Staff project action and preview routes must use staff auth helpers.
- Public marketing enquiry/contact routes may write lead and email/audit records from server code, but must not expose staff workflow data.
- Browser task and activity access should use current project/dashboard APIs and query helpers. Do not reintroduce direct browser automation table writes; prefer staff API routes for new write behavior.
- Service-role keys, raw email provider responses, and private customer data must not reach client props, logs, generated documents, or public routes.

## Guardrails

- Side effects must be idempotent. Use stable idempotency keys for automation events, emails, tasks, and follow-ups.
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
npm run test:portal -- apps/portal/lib/emails/invoice.test.ts
npm run test:portal -- apps/portal/app/api/contacts/route.test.ts "apps/portal/app/api/contacts/[contactId]/route.test.ts"
npm run test:marketing -- apps/marketing/emails/utils/callWindow.test.ts
```

Manual checks should cover:

- Project action emits one audit event and does not repeat side effects on duplicate trigger.
- Expected task, follow-up, site visit, or outbox row appears on the project page.
- Email preview renders repo templates and DB fallback templates.
- Email provider failure is visible as an outbox failure where staff need to act.
- Marketing enquiry success/failure does not expose staff-only data.
