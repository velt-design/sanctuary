# Platform Workflow

This doc describes the current business workflow as represented in the codebase. Use it to understand which feature owns a piece of state before editing.

## Lead Capture

Public enquiries start in `apps/marketing`.

- Primary public flows: `/contact` and the shared embedded enquiry form on
  residential, commercial and professional service pages.
- Project type, name, phone and email are required on every current enquiry
  form. The shared client/server contract owns the validation rule.
- API routes persist enquiries and send notifications through Supabase and Resend-backed helpers.
- Each enhanced form keeps one browser-generated submission UUID across
  retries. The no-JavaScript POST adapter assigns an equivalent server UUID
  before entering the same intake boundary. The server verifies any
  short-lived upload binding, then `marketing_enquiry_intake` atomically
  creates or reuses the contact/project/enquiry result. Attribution, the
  pricing snapshot and estimate draft, audit event, attachments, and
  autoresponder retain their existing owners after first-time intake; an
  idempotent replay does not duplicate those side effects.
- Optional uploads use private signed URLs bound to that submission. Expired, abandoned, forged, oversized, or unsupported uploads cannot enter another enquiry and are covered by scheduled cleanup/retention.
- Tracking and consent behavior is documented in `security-privacy-quality.md`.
- Automation, email outbox, autoresponder, and audit behavior is documented in `automation-email-audit.md`.

## Contact And Project Creation

Portal staff manage contacts and projects in `apps/portal`.

- Contacts routes: `/staff/contacts`, `/staff/contacts/new`, `/staff/contacts/[contactId]`.
- Project routes: `/staff/projects`, `/staff/projects/new`, `/staff/projects/[projectId]`.
- Project pipeline stages are defined in `apps/portal/lib/projects/pipelineDefinition.ts`.
- V2 projects use one operational state plus accountable work items. Pipeline stage remains journey position, not a task list; the shared server ranking overlays only bounded specialist actions where another domain owns the next step.
- Active New and Contacted projects are server-assigned to Ellen. Stage changes remain manual: after entering Proposal, staff explicitly select the Proposal owner; before leaving Proposal, that owner hands over and assigns Dave for Confirmed and Delivery work.
- The project page's staff-facing default is Overview, while the compatibility route key remains `activity`. Overview hosts status/details, current design and commercial truth, the Project Owner, one primary next action, project notes/activity, and the model-appropriate work/task surface.
- Staff-facing project tabs are Overview, Calculator, Commercial, and conditional Job Packs. Their compatibility route keys remain `activity`, `estimates`, `quotes`, `invoices`, and `job-packs`.
- Canonical doc: `projects-contacts-estimates-calculator.md`.

## Estimate Flow

Staff create estimates from the Calculator, either standalone or embedded in a project.

- Main calculator route: `/staff/calculator`.
- Project Calculator surface: `/staff/projects/[projectId]?tab=estimates`; the route key remains for compatibility even though the visible label is Calculator.
- Estimate APIs live under `apps/portal/app/api/projects/[projectId]/estimates` and `apps/portal/app/api/estimates/[estimateId]`.
- Estimate snapshots carry calculator inputs, derived costing output, and drawing state.
- Sent, accepted, or declined quote versions lock the related estimate.
- Canonical doc: `projects-contacts-estimates-calculator.md`.

## Quote And Invoice Flow

Quotes are created from estimates and can be viewed publicly through tokenized routes.

- Project Commercial surface: `/staff/projects/[projectId]?tab=quotes` or `?tab=invoices`.
- `CommercialTab.tsx` owns Quotes/Invoices composition while `QuotesTab.tsx` and `InvoicesTab.tsx` retain their specialist workflow behavior.
- Staff quote APIs live under `apps/portal/app/api/quotes` and `apps/portal/app/api/staff/v1/quotes`.
- Public quote routes live under `apps/marketing/app/quote/[quoteId]`.
- Deposit invoice routes live under portal staff APIs and public marketing invoice routes.
- Quote and invoice emails use Resend-backed transactional helpers.
- Canonical doc: `quotes-invoices-job-packs.md`.

## Design List

The Design List replaces the old operational design spreadsheet.

- Page route: `/staff/projects/design-packages`.
- API routes: `apps/portal/app/api/staff/v1/design-packages`.
- Canonical doc: `design-list.md`.
- Requests are estimate-backed and track designer, status, priority, notes, quote sent date, and visit state.

## Schedule

Schedule V2 owns install planning and site visit scheduling.

- Page route: `/staff/schedule`.
- Normal staff views: Board and Gantt.
- Site Visits remains a bounded Schedule-owned route/data capability hidden from normal navigation. `Contacted` Project Work can route staff to arrange a visit; `Site Visit` can route them to book/confirm and record completion. These are specialist actions, not work-item rows, and they do not mutate Schedule or stage automatically.
- API routes: `apps/portal/app/api/staff/v1/schedule`.
- Canonical doc: `schedule.md`.
- Readiness route: `GET /api/staff/v1/schedule/readiness`.

## Running Jobs

Running Jobs replaces the operational active-install spreadsheet.

- Page route: `/staff/projects/running-jobs`.
- Redirect route: `/staff/running-jobs`.
- API routes: `apps/portal/app/api/staff/v1/running-jobs`.
- Canonical doc: `running-jobs.md`.
- Manual fields, schedule-owned fields, and estimate-derived fields are intentionally separated.
- For V2 projects, materials- and roofing-ordered facts live in versioned Running Jobs metadata. Install completion remains Schedule V2 actual-finish truth; neither fact is copied into a generic work item.

## Job Packs And Outputs

Job packs sit after quoting/design and before or during install preparation.

- Staff project tab: `apps/portal/components/projects/ProjectPage/tabs/JobPacksTab.tsx`.
- Staff APIs: `apps/portal/app/api/staff/v1/job-packs`.
- Output helpers: `apps/portal/lib/outputs` and `apps/portal/lib/jobPacks`.
- Canonical doc: `quotes-invoices-job-packs.md`.

## Admin And Pricebook

Admin-only surfaces include access management, imports, crews, costs, and pricebook configuration.

- Admin routes: `apps/portal/app/admin`.
- Pricebook route: `/pricebook`.
- Admin API helpers enforce `admin` role via `requireAdminSession` or `requireAdminContext`.

## Automation, Email, And Audit

Automation supports project actions, follow-ups, project tasks, email outbox records, and audit events.

- V2 project-work owner: `apps/portal/lib/projects/workItems` and the `project_work_*` command/read contracts.
- Legacy-project automation runner: `apps/portal/lib/automation/AutomationRunner.ts`.
- V2 uses accountable work items and manual email confirmations. It creates no call tasks and never sends, changes phase, or closes automatically. Project Overview exposes a dedicated Close Project dialog with explicit Lost, Cancelled, and Complete paths; closing preserves pipeline stage, safely cancels remaining Project Work, removes the project from the active Work Queue, and remains reversible through Reopen Project. A structured Lost outcome is the reason, with only an optional note; Cancelled and Complete still require a reason, and Complete remains subject to server-owned Schedule/payment checks.
- `project_enquiry_inactivity_report_v1` is a read-only admin/service inventory over all recorded project activity. Work Queue admins can review its exact rows, select none-by-default candidates, and explicitly confirm a `Lost - No response` batch. `project_enquiry_bulk_close_v1` revalidates the approved report fingerprint and current activity/future-Waiting protection for every selected project before atomically invoking the normal state command. It never advances stage or runs without a final staff confirmation.
- Existing projects remain on legacy `tasks`, `followup_plans`, and `followup_tasks` until reviewed migration; no Contacted backlog records are changed.
- Canonical doc: `automation-email-audit.md`.
- Quote/invoice email side effects remain owned by `quotes-invoices-job-packs.md`.

## Durable Background Work

The durable background system is technical infrastructure and remains separate from the business-facing Running Jobs workflow.

- `packages/jobs` owns job kinds, safe runtime contracts, retry/effect policy, and staff-facing state labels.
- Supabase owns the logged queue, durable ledger, protected frozen payloads, leases, events, effect checkpoints, worker records, and RPC boundary.
- `apps/worker` owns generic polling, claim/heartbeat/visibility, bounded concurrency, retry classification, shutdown, reconciliation, safe logs, and health.
- JOB-02 ships the worker dark by default with no commercial handlers or app producers enabled. Quote, invoice, job-pack, automation, and outbox behavior remains on its existing owner until the named later checkpoint migrates it atomically.
