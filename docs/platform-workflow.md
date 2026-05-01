# Platform Workflow

This doc describes the current business workflow as represented in the codebase. Use it to understand which feature owns a piece of state before editing.

## Lead Capture

Public enquiries start in `apps/marketing`.

- Primary public flows: `/contact`, `/start`, `/start/explore`.
- API routes persist enquiries and send notifications through Supabase and Resend-backed helpers.
- Tracking and consent behavior is documented in `security-privacy-quality.md`.

## Contact And Project Creation

Portal staff manage contacts and projects in `apps/portal`.

- Contacts routes: `/staff/contacts`, `/staff/contacts/new`, `/staff/contacts/[contactId]`.
- Project routes: `/staff/projects`, `/staff/projects/new`, `/staff/projects/[projectId]`.
- Project pipeline stages are defined in `apps/portal/lib/projects/pipelineDefinition.ts`.
- Stage tasks mix manual checks and action links, for example booking a site visit or generating an estimate.
- Canonical doc: `projects-contacts-estimates-calculator.md`.

## Estimate Flow

Staff create estimates from the calculator and project estimate tabs.

- Main calculator route: `/staff/calculator`.
- Project estimate surface: `/staff/projects/[projectId]?tab=estimates`.
- Estimate APIs live under `apps/portal/app/api/projects/[projectId]/estimates` and `apps/portal/app/api/estimates/[estimateId]`.
- Estimate snapshots carry calculator inputs, derived costing output, and drawing state.
- Sent, accepted, or declined quote versions lock the related estimate.
- Canonical doc: `projects-contacts-estimates-calculator.md`.

## Quote And Invoice Flow

Quotes are created from estimates and can be viewed publicly through tokenized routes.

- Staff quote tab: `apps/portal/components/projects/ProjectPage/tabs/QuotesTab.tsx`.
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
- Views: Board, Gantt, Site Visits.
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
