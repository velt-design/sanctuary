# Automation, Email, And Audit

Status: Current.

This doc owns current-state guidance for portal automation events, project tasks, follow-ups, email outbox, email previews, audit events, and marketing enquiry email side effects. Quote/invoice transactional side effects remain owned by `docs/quotes-invoices-job-packs.md`.

## Read First

- Use `## Ownership` and `## Current Data Flow` to locate the request-bound or durable email owner before changing a send.
- Use `## Access Boundaries` and `## Guardrails` before changing provider transport, webhook reconciliation, outbox state, or logs.
- Use `docs/quotes-invoices-job-packs.md` for quote/invoice lifecycle behavior and `docs/supabase-schema-map.md` for durable receipt/RPC ownership.

## Ownership

- V2 project-work owner: `apps/portal/lib/projects/workItems`; transactional state, work-item, confirmation, calendar, receipt, event, compatibility, and reconciliation commands are defined by `20260729_000002_project_work_items_v2.sql`. Authoritative team-queue composition and guarded legacy triage live in `teamQueue.ts`, `legacyTriage/`, and forward migration `20260729_000004_project_work_queue_and_legacy_triage.sql`.
- Legacy-project automation runner: `apps/portal/lib/automation/AutomationRunner.ts`; legacy task/follow-up persistence lives in `taskPersistence.ts`.
- Automation cache keys: `qk.automation` in `apps/portal/lib/queries/keys.ts`.
- Portal transactional email helpers/templates: `apps/portal/lib/emails`.
- Quote/invoice commercial email intents and audit adapter: `apps/portal/lib/commercial/emailIntent.ts` and `apps/portal/lib/commercial/audit.ts`.
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
- `project_work_model_versions`, `project_operational_states`, `project_state_events`, `project_work_items`, `project_work_item_events`, `project_confirmation_events`, `project_command_receipts`, and `project_work_repair_signals`: V2 project-work truth, append-only evidence, idempotency, and explicit recovery.
- `business_calendar_year_coverage`, `nz_holidays`, and `company_closures`: verified Auckland deadline inputs.
- `tasks`, `followup_plans`, and `followup_tasks`: legacy-project task and quote-follow-up records.
- `email_templates`: DB-backed template metadata and fallback HTML.
- `email_outbox`: queued, sent, failed, or cancelled project email records.
- `site_visit_events`: site visit state that automation may create or update.
- `enquiry_requests`: public enquiry intake records.
- `design_package_tickets`: legacy/transitional automation ticket table; Design List now uses `design_package_requests`.

## Current Data Flow

The repository contains a new-project-only V2 path. Its foundation migration is applied only in staging and is not production-deployed; the schema-cache repair and Work Queue/legacy-review forward migration remain repository-local. Staff project creation uses `project_create_v2`; a newly created `New` project linked by its intake enquiry also initializes V2. The trigger's narrow creation-time check prevents an old project from being activated by a later enquiry insert. Initialization records `Active` plus one manual first-email obligation due after two Auckland open hours with a four-hour SLA. If the contact has no email, that item is blocked and the contact-email trigger reconciles it when an address is supplied. Existing projects receive no marker or backfill and continue on the legacy flow. There is no fallback staff-project creation path when the V2 schema is unavailable.

For V2, staff still send personal enquiry email in their normal email client and record the bounded confirmation. First-email confirmation creates one follow-up five business days later; follow-up confirmation creates one manual close review five business days later; customer reply cancels the open no-response cadence. No V2 command sends an email, creates a call task, changes project stage, or closes a project automatically.

Durable quote send/resend and quote outcome owners call the server-only V2 reconciliation adapter after their own authoritative commit. A durable send creates or reschedules one manual follow-up, capped by expiry; prepared, failed, or unfinished delivery does not start it. Acceptance, decline, customer reply, or supersession cancels it. Reconciliation uses the exact project and quote-version identity. A failure opens or updates a bounded staff-safe repair signal keyed by the deterministic reconciliation command; successful later reconciliation resolves the relevant quote-family signals. Open repair signals preempt normal project work and enter the SQL queue. Raw provider or service errors are not persisted. Browser and public-token callers cannot invoke the service-role commands.

V2 work is projected one way into `projects.next_action*` and `follow_up_date` for compatibility consumers. Legacy writers are rejected for V2 projects; compatibility fields are never imported back into V2 truth. No Contacted project has been automatically classified, migrated, closed, archived, or given a new cadence.

The staff Work Queue and Dashboard preview read the same server-owned one-row-per-project composition. Durable repair, urgent work, blockers, due Waiting review, and triage come from `project_work_queue_v3()`; the server overlays canonical quote/estimate candidates without copying those facts into project work. Work-item rows can record Email sent, Customer replied, Complete, assignment, reschedule, block, and unblock through existing semantic commands. Personal Dashboard reminders remain private scratch items and are never queue or project truth.

Admins may correct an incorrect manual confirmation only through the append-only retraction command with the original event, stable command ID, and reason. The command retains both events and opens a review signal; it does not reverse later lifecycle/commercial facts, resend an email, or restart a cadence. A second admin-only, reasoned review command requires that exact signal ID and row version, resolves only the unchanged signal after the project has been checked, and adds audit history without performing a domain side effect.

The admin Contacted classifier is read-only and omits linked customer contact fields. Its recommendations are evidence summaries, not decisions, and each row carries an opaque database evidence fingerprint. An admin can migrate only one reviewed, unchanged-project-and-evidence, unmarked Contacted project at a time into Active with real work, Active Needs triage, Waiting, or a bounded Closed outcome. The migration command does not archive, contact the customer, or create the new-project email cadence.

For unmarked legacy projects, staff action routes call `automationRunner.runEvent()` or directly perform a route-owned side effect. `AutomationRunner` writes an idempotent `audit_events` row first; duplicate idempotency keys stop repeated handling.

Event handlers can:

- create project tasks
- enqueue or record email outbox rows
- create or update site visit events
- create quote follow-up plans and tasks
- cancel open follow-ups when pipeline stage changes make them irrelevant

For legacy projects, `REVIEW_NEW_LEAD` is persisted with a 5:00pm Auckland next-business-day due timestamp using weekend, national/Auckland holiday, and company-closure data. Marking a project contacted persists the existing two-business-day cadence as `FOLLOWUP_CALL`; AutomationRunner no longer writes project next-action columns. These rows remain legacy command-centre candidates and must not be copied into V2 without a reviewed migration decision.

Canonical task/follow-up tables are select-only to authenticated portal users. Automation persistence stays in the server-only service-role adapter, while Design Package task creation/status/due changes use the bounded `project_command_sync_design_task` RPC instead of direct authenticated table writes.

Marketing enquiry routes can create public lead/enquiry records and send or log autoresponder email behavior. `marketing_enquiry_intake` owns contact, project, and enquiry creation as one database transaction. An enhanced form's browser-generated `submission_id`, or the no-JavaScript adapter's server-generated equivalent, enters the same unique constraint and transaction advisory lock. Enhanced retries and concurrent duplicates return the original IDs. The RPC persists the same nullable indicative-pricing fields used by the autoresponder, so production schema readiness includes `20260724043000_marketing_enquiry_budget_columns.sql`; a root baseline `CREATE TABLE IF NOT EXISTS` is not evidence that an existing table has those columns. Keep public marketing writes narrow and server-owned; public responses expose stable validation/service messages, never raw Supabase errors.

Direct and embedded forms use the same intake contract: project type, name,
phone and email are required, while suburb, project brief and technical detail
remain optional. Phone and email reachability validation belongs at the shared
client/server boundary rather than in route-local form branches.

Portal transactional email and marketing contact/enquiry email use thin server-only adapters over `@sp/email-provider`. The package normalizes the message, enforces a bounded timeout/abort contract, classifies provider outcomes, and keeps raw provider responses out of app errors and logs. Existing stable marketing IDs are forwarded as compatibility idempotency keys where available. Quote/invoice delivery remains request-bound but is now crash/replay safe: `private.commercial_email_intents` freezes the exact request and provider key, checkpoints provider acceptance before business finalisation, and lets a later request resume the same identity. This does not enable a worker producer/handler or move automation/outbox ownership.

The durable JOB-03 email coordinator is a reusable worker primitive, not an enabled handler. It freezes one exact job/effect-derived Resend key, recipients, subject, content, attachments, tags, token bytes, request hash, and 20-hour automatic retry expiry. Its checkpoints are `prepared`, `dispatch_started`, `provider_accepted`, `finalised`, and `uncertain`. A retry after uncertainty may use only that same key and byte-identical request before expiry/attempt exhaustion; it must never manufacture a new key. Provider acceptance is evidence to resume an idempotent business finaliser, not business completion.

Resend `email.sent` callbacks enter through `/api/webhooks/resend`. The route bounds the streamed body to 256 KiB, decodes UTF-8 strictly, verifies the untouched body and Svix headers with the server-only webhook secret, then passes only event/message identity and the safe `job_id`/opaque `effect_ref` correlation fields to one service-role RPC. Account-wide callbacks for request-bound legacy sends have no durable correlation tags, so they are acknowledged and ignored without persisting provider/customer fields; a partially present or malformed durable tag pair fails closed. Correlated receipts are minimal and append-only. Verified acceptance may supersede only named stale provider-outcome classifications. Exact payload/key/message/effect conflicts stay operator-visible; the worker's lease-fenced local acceptance RPC atomically quarantines a different or cross-job-colliding provider message, and a conflicting callback after success/cancellation reclassifies the durable job for attention. Non-conflicting acceptance may wake finalisation, but neither reconciliation path mutates quote, invoice, outbox, or other unrelated business state.

Forward marketing attribution is recorded as project audit events only. New enquiries store compact UTM and Google click identifiers in `enquiry_requests.raw_payload.attribution`; later high-value lifecycle events are `marketing.lead_submitted`, `marketing.site_visit_booked`, `marketing.quote_accepted`, and `marketing.deposit_received`. These rows are a foundation for later Google Ads upload, not an Ads API integration.

Current website enquiry autoresponders keep the existing payload shape for preview compatibility, but new base pergola estimates are sent and stored as a single lower-only amount by setting equal low/high values. Historical rows with unequal low/high values still preview as ranges. Short residential or commercial enquiries without enough dimensions for a reliable costing snapshot still receive the same confirmation, with the investment panel and estimate wording omitted. Optional blinds remain range-based, use the shared corrected `@sp/costing` baseline, and persist into the generated calculator draft with No cover unless staff later selects a flashing or pelmet.

The email preview route renders an outbox row by template ID and variables. It uses repo-rendered website autoresponder templates, portal transactional templates, or DB `email_templates` fallback HTML.

`/staff/email-previews` is the fixture-only Enquiry Email Workbench for the website autoresponder. Its staff-authenticated review surface renders the active Editorial Refined production layout alongside the preview-only Image-led and Compact alternatives from one shared enquiry content model. The review flow is explicitly ordered as project scenario, design review and inbox proof. Staff-facing copy uses project scenario, completed project and design language while keeping repository fixture identifiers behind the UI. The compact navigator synchronizes all layouts across residential and commercial enquiries with Pitched, Gable, Box perimeter and Hip forms, each with and without blinds, plus one fixed professional fixture: 17 combinations in total. It also identifies the governed completed-project image and its match quality so reviewers can verify the customer selection, image evidence and email content together.

The workbench supports side-by-side comparison and a focused single-layout mode. Desktop, narrow and mobile canvases render the email at 760, 600 and 390 px respectively, with 50%, 75% and 100% inspection zoom and controlled light/dark simulations. Zoom is applied outside the sandboxed iframe: the iframe retains the selected real pixel width and exact rendered `srcDoc`, so workbench CSS cannot alter email HTML. Each layout exposes its differentiated inbox subject, preheader, design intent, best-use guidance and plain-text fallback. Refresh re-renders the current governed fixture; Reset returns the entire review state to the default residential pitched fixture. Simulations remain comparison aids, not proof of any particular inbox client's rendering.

Preview delivery reads `RESEND_API_KEY_PREVIEW` and the single `EMAIL_PREVIEW_TO` recipient on the server, omits the production BCC, and is unavailable unless `EMAIL_PREVIEW_ENABLED=true` in a Vercel Preview deployment (or local development/test). The workbench shows the active fixture, selected layout, project image, recipient, environment and preview-only delivery mode before sending. A selected-layout send or sequential Send all action requires an in-page confirmation; confirmation focus moves to Cancel and returns to the originating Send action when cancelled. Each API call still delivers exactly one validated fixture/layout with a differentiated `[Preview: <layout>]` subject. Success feedback says the provider accepted the request and does not claim inbox delivery; batch delivery stops on the first failure, reports how many requests were accepted and offers a retry for only the failed layout. The browser may supply only a validated repository fixture ID and layout ID; it cannot supply recipients, content, provider credentials or arbitrary payload fields. This path does not call enquiry intake or write contacts, projects, estimates, enquiries, outbox rows or audit records.

Rendering and delivery have separate availability contracts. Authenticated production staff may render all governed fixtures and compare their exact HTML in a read-only workbench without preview environment variables. Provider delivery remains unavailable in production and reports `environment_not_allowed`; only a Preview/local deployment with the explicit server-owned configuration can send.

Send controls remain disabled until the authenticated preview API reports `sendReady=true`. The delivery panel must state the exact safe configuration reason (`missing_api_key`, `missing_recipient`, `invalid_recipient`, disabled flag or disallowed environment) beside the controls instead of presenting an unexplained grey button. It also keeps the fixed-recipient, no-BCC and no-write contract visible in every state. Vercel environment changes apply only to a new deployment, so adding or correcting any preview variable requires redeploying the branch. `RESEND_API_KEY_PREVIEW` must contain the actual Resend secret value, not the display name assigned to that key in Resend.

Website autoresponder hero imagery is resolved centrally by `apps/marketing/lib/websiteAutoresponderHero.ts` from the governed records in `apps/marketing/data/projects.ts`. The email identifies the image as a completed Sanctuary project and states that project's recorded roof approach; it does not claim the pictured build is an exact preview of the submitted project. The current selection policy is:

| Enquiry selection | Completed project shown | Evidence note |
| --- | --- | --- |
| Gable with mixed acrylic and solid or timber-lined roofing | Warkworth Outdoor Room | Exact published gable and mixed-roof reference |
| Gable with a solid or timber-lined roof | Riverhead Gable Pavilion | Exact published gable and timber-sarking reference |
| Residential gable with acrylic | Dairy Flat Estate | Exact published residential gable and acrylic reference |
| Commercial gable with acrylic | The Good Home Takanini | Exact published commercial gable and acrylic reference |
| Pitched with acrylic | Lilliput Mini Golf | Exact published pitched and acrylic reference |
| Pitched with mixed or timber-lined roofing | Tindalls Bay - Patio & Carport | Published pitched project with insulated, acrylic and timber-lined zones |
| Hip, any roof selection | Muriwai Courtyard | Exact form; exact material only when acrylic is selected |
| Box perimeter, any roof selection | Mt Maunganui Box | Exact form; exact material only when acrylic is selected |
| Professional enquiry | KiwiRail Head Office | Published architect-led commercial collaboration |
| Missing or unclear selection | Warkworth Outdoor Room | Governed homepage evidence fallback |

The 17 preview fixtures deliberately exercise this customer/form policy:

| Preview roof form | Residential reference | Commercial reference |
| --- | --- | --- |
| Pitched | Tindalls Bay - Patio & Carport (mixed roof) | Lilliput Mini Golf (acrylic) |
| Gable | Warkworth Outdoor Room (mixed roof) | The Good Home Takanini (acrylic) |
| Box perimeter | Mt Maunganui Box | Mt Maunganui Box |
| Hip | Muriwai Courtyard | Muriwai Courtyard |

Blinds selection changes the email options and investment sections but does not change the completed-project reference. Professional remains the fixed KiwiRail Head Office example. `npm run emails:preview -- enquiry-variants` writes one Editorial Refined production HTML and plain-text artifact for every combination under `tmp/email-previews`. `npm run emails:preview -- enquiry-layouts` writes one representative HTML/plain-text pair for the active layout and each of the two comparison alternatives.

The comparison email shell uses a 760 px maximum desktop width, a fluid 100% table width and small-screen media-query padding reductions. Critical structure, typography and image sizing remain inline and table-based so the message is still usable in clients that ignore media queries. It declares supported light/dark colour schemes, owns solid backgrounds and text colours, and includes targeted dark-mode and Outlook `[data-ogsc]` fallbacks. The textual wordmark, solid CTA surfaces and explicit borders avoid depending on transparent-image inversion. Actual inbox delivery remains the final check because Gmail, Outlook and Apple Mail can apply different forced-colour behaviour.

The gated `/qa/email-preview-workbench-fixture` route mirrors the real page composition only when `ENABLE_PORTAL_QA_FIXTURES=1`. It reads the real governed renderer through `/api/qa/email-preview-workbench`; that QA API accepts the same narrow fixture/layout send contract but returns a synthetic acceptance without importing or calling provider transport. Playwright can therefore verify responsive workbench geometry, isolated iframe content, confirmation and sequential-send states without authentication or email side effects. This fixture does not weaken `/staff/email-previews` authentication and is not a delivery surface.

Residential, commercial, and professional enquiry file uploads are stored, not just counted. The browser mints signed upload URLs via `apps/marketing/app/api/enquiry/attachments/sign` and uploads directly to the private `enquiry-attachments` Supabase Storage bucket (bypassing the serverless request-body limit); the enquiry payload carries only storage paths. Signing is same-origin, durably rate-limited, and creates a 15-minute server-owned session bound to the client submission UUID, a token hash, and the exact expected paths/metadata. Intake accepts at most eight PDF/JPEG/PNG/WebP files and 20 MB total, checks matching extensions, sizes, private path ownership, session expiry/consumption, and downloaded content signatures before the atomic RPC consumes the session. A path or session from another submission cannot be attached.

On send, `apps/marketing/app/api/enquiry` either inlines verified files as autoresponder attachments (total <= 8 MB) or adds 7-day signed download links to the matching residential, commercial, or professional template. Staff receive the same files or links via the autoresponder BCC. A selected attachment must upload successfully before the enquiry is submitted: missing client configuration, signing failure, or direct-upload failure produces a clear retry/remove-files error instead of degrading to metadata that cannot be delivered. Requires the private `enquiry-attachments` bucket from `20260701_000001_enquiry_attachments_bucket.sql` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` for direct browser upload. The authenticated daily cleanup route removes objects for expired unconsumed sessions; database retention removes stale rate-limit state after two days and consumed session bindings after 30 days.

The legacy JSON-only `/api/contact` compatibility send also uses the durable database limiter. It rejects multipart bodies; all public file intake belongs to the signed, submission-bound `/api/enquiry` path.

## Access Boundaries

- For legacy projects, `AutomationRunner` and its server-only `taskPersistence.ts` adapter intentionally use service-role access. For V2, only the named work-items system adapter may invoke reconciliation; staff routes use auth-bound commands. These paths remain exact-match allowlisted so a new service-role consumer still fails the security test.
- Staff project action and preview routes must use staff auth helpers.
- Public marketing enquiry/contact routes may write lead and email/audit records from server code, but must not expose staff workflow data.
- Marketing enquiry autoresponder budgets and auto-created estimate drafts share one canonical costing snapshot. Saved calculator inputs must describe that snapshot (including the two-post standard assumption); do not recalculate separately for email and persistence.
- The public Resend webhook is not a browser data surface. It verifies signatures before any database call and the repository may call only `background_job_reconcile_verified_provider_acceptance`; raw bodies, signatures, recipients, subjects, content, and arbitrary provider fields do not cross that repository boundary.
- Browser task and activity access should use current project/dashboard APIs and query helpers. Do not reintroduce direct browser automation table writes; prefer staff API routes for new write behavior.
- Work Queue and Dashboard must consume `teamQueue.ts`; do not derive lifecycle, assignee fallback, quote/estimate precedence, or commercial readiness in browser components.
- The Contacted classifier and migration routes are admin-only and auth-bound. Never add customer contact fields to the review payload or a bulk recommendation-accept command.
- Site Visits remains hidden/manual and is not a task source or project-work destination. The optional completion confirmation has no stage, Schedule, email, or automation side effect.
- Manual project-task checkboxes may show optimistic local feedback, but the owning staff API remains authoritative for `project_task_checks`, pipeline transitions, and automation events. Concurrent saves must roll back only the rejected task, expose explicit retry, and never claim an auto-advance side effect before the response confirms it.
- Service-role keys, raw email provider responses, and private customer data must not reach client props, logs, generated documents, or public routes.
- Preview-only Resend credentials and the fixed preview recipient stay server-owned. Preview-send requests accept only a repository fixture variant and never a browser-supplied address.

## Guardrails

- Side effects must be idempotent. Use stable idempotency keys for automation events, emails, tasks, and follow-ups.
- Commercial audit inserts must inspect returned database errors, not only thrown exceptions. Duplicate idempotency keys may be treated as already recorded; schema/access failures must remain visible in safe structured server logs.
- Quote/invoice delivery states must describe evidence: provider-confirmed, retryable with the same frozen request, or staff attention. Do not translate a retryable state into a promise of an automatic retry.
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
npx playwright test playwright/portal.email-preview-workbench.spec.ts --project=portal-fixture
npm run test:portal -- apps/portal/lib/emails/invoice.test.ts
npm run test:portal -- apps/portal/app/api/contacts/route.test.ts "apps/portal/app/api/contacts/[contactId]/route.test.ts"
npm run test:marketing -- apps/marketing/emails/utils/callWindow.test.ts
npm run test:portal -- apps/portal/lib/projects/workItems apps/portal/app/api/staff/v1/work-items apps/portal/app/api/admin/project-work
```

These tests inject or mock provider transport and webhook signatures. Do not use production/shared database credentials or send a real email as part of repository verification. JOB-03 local provider, integration, worker, contract, typecheck, lint, and production-build gates pass. Background Jobs [run 29723041212](https://github.com/velt-design/sanctuary/actions/runs/29723041212) passes all seven migrations on upstream PostgreSQL 18/PGMQ 1.10.0 and Supabase PostgreSQL 17/PGMQ 1.5.1, plus the contracts/integrations and worker artifact/container gates.

Manual checks should cover:

- Project action emits one audit event and does not repeat side effects on duplicate trigger.
- Expected task, follow-up, site visit, or outbox row appears on the project page.
- Email preview renders repo templates and DB fallback templates.
- Email provider failure is visible as an outbox failure where staff need to act.
- Marketing enquiry success/failure does not expose staff-only data.
