# Projects, Contacts, Estimates, And Calculator

This doc is the current-state reference for the core staff portal workflow before quotes, design requests, schedule, running jobs, and job packs. Use it when touching contacts, projects, project snapshots/tasks, calculator estimates, estimate versions, estimate locks, or local-first estimate mutations.

## Ownership

- Contact pages: `/staff/contacts`, `/staff/contacts/new`, `/staff/contacts/[contactId]`.
- Project pages: `/staff/projects`, `/staff/projects/new`, `/staff/projects/[projectId]`.
- Calculator page: `/staff/calculator`.
- Project estimate surfaces: `/staff/projects/[projectId]?tab=estimates`, `/staff/projects/[projectId]/estimate/[estimateId]`, and `/staff/projects/[projectId]/design-workbench`.
- Contact APIs: `apps/portal/app/api/contacts`.
- Project APIs: `apps/portal/app/api/projects` and action routes under `apps/portal/app/api/staff/v1/projects`.
- Estimate APIs: `apps/portal/app/api/projects/[projectId]/estimates` and `apps/portal/app/api/estimates/[estimateId]`.
- Route/auth contracts: `docs/staff-api-auth-contracts.md`.
- Project domain helpers: `apps/portal/lib/projects`.
- Estimate domain helpers: `apps/portal/lib/estimates`.
- Local-first mutation keys and cache helpers: `apps/portal/lib/localFirst/portalEntities.ts` and `apps/portal/components/sync/LocalFirstPortalMutations.tsx`.

Important tables include `contacts`, `projects`, `project_task_checks`, `estimates`, `quote_versions`, `quote_send_logs`, `site_visit_events`, `schedule_items`, `deposit_invoices`, and `job_pack_generations`.

For table/RPC ownership, write paths, access boundaries, and migration sources, see `docs/supabase-schema-map.md`.

## Contact And Project Flow

Contacts and projects are staff-owned portal records. Marketing lead capture can create upstream enquiry data, but staff workflow state belongs in the portal.

- Contact create/update routes write `contacts` and return mapped contact shapes.
- Project create/detail routes write and read `projects`.
- Project detail pages use `ProjectPageSnapshot` data from `apps/portal/lib/projects/getProjectPageSnapshot.ts`.
- Project cache patching around creates/details lives with local-first helpers so lists and detail views stay coherent.
- Staff/admin browser UI should use API, query, or local-first layers, not direct table writes.

Keep contact fields, project fields, and estimate snapshot fields distinct. Estimate snapshots can carry copied customer/project context for historical quote/design accuracy, but that snapshot copy is not the canonical editable project record.

## Project Snapshot, Pipeline, And Tasks

`ProjectPageSnapshot` is the project detail read model for the staff project page. It combines project/contact data, pipeline state, task state, activity, and email summaries.

- Pipeline stages and task definitions live in `apps/portal/lib/projects/pipelineDefinition.ts`.
- Manual task completion is stored in `project_task_checks`.
- Action tasks link into owned workflows such as site visits, estimates, schedule, invoices, and job packs.
- Snapshot readiness comes from portal data such as booked site visits, generated estimates, accepted quotes, open deposit invoices, scheduled install items, and generated job packs.
- Stage action routes under `apps/portal/app/api/staff/v1/projects/[projectId]/action` own staff workflow side effects.

Do not hard-code duplicate pipeline or task rules in components. Update the pipeline definition and snapshot mapping together when task behavior changes.

## Calculator And Estimate Versions

The calculator produces estimate snapshots. Estimate rows are versioned per project and hold calculator inputs, outputs, warnings, costing metadata, derived summary fields, and drawing/snapshot state.

- Estimate payload normalization lives in `apps/portal/lib/estimates/persistence.ts`.
- Estimate summary mapping lives in `apps/portal/lib/estimates/summarize.ts` and server mapping helpers.
- Version labels are derived from project estimate rows; new estimates advance the next available version.
- Estimate snapshots carry calculator inputs plus output sections such as `derived`, `projectSnapshot`, `snapshot`, and `configVersions`.
- Drawing state can be stored inside estimate snapshot/drawing draft shapes, but design workbench architecture and compatibility rules are owned by `docs/design-workbench-architecture.md`.

Costing logic must remain in `packages/costing`; estimate code should persist and summarize costing output, not fork the costing engine.

## Estimate Editability And Locks

Estimate editability is derived from related quote versions and send logs.

- Draft estimates are editable unless a locking quote state exists.
- Quote statuses `SENT`, `ACCEPTED`, and `DECLINED` lock the source estimate.
- Sent quote send logs also participate in lock detection.
- Locked estimate updates return `ESTIMATE_LOCKED` with editability details.
- Internal notes can be patched separately, but estimate snapshot updates must respect editability.
- Flow state marks the active draft estimate, sent quote presence, job-pack eligibility, generated job-pack timestamp, and job-pack quote version.

Do not bypass these rules with ad hoc estimate table writes. Use the estimate routes and domain helpers so lock state, version labels, summaries, and downstream cache invalidation stay aligned.

## Local-First Mutations

Project estimate and quote draft workflows use local-first mutations for responsive editing while server state remains authoritative.

Current mutation keys used by this workflow:

- `portal.estimate.create`
- `portal.estimate.update`
- `portal.quote.createFromEstimate`
- `portal.quote.updateDraft`
- `portal.designRequest.create`
- `portal.estimate.notes.update`

Local IDs such as `local-estimate:*` and `local-quote:*` must be resolved through aliases before dependent mutations run. Creates and follow-on actions may queue until the durable server ID exists.

Server-authoritative actions stay server-owned:

- creating or updating durable estimate rows
- creating quotes from estimates
- creating design requests from estimates
- sending quote or invoice emails
- accepting or declining quotes
- generating job packs

## Handoffs

- Quote, invoice, public-token, PDF/email, and job-pack side effects: `docs/quotes-invoices-job-packs.md`.
- Design request list behavior: `docs/design-list.md`.
- Drawing workbench object-first and geometry behavior: `docs/design-workbench-architecture.md`.
- Local-first queue mechanics, aliases, and conflict recovery: `docs/local-first-sync.md`.
- Staff route auth, diagnostics, and Supabase client boundaries: `docs/staff-api-auth-contracts.md`.
- Supabase table/RPC ownership and migration routing: `docs/supabase-schema-map.md`.
- Costing and geometry source-of-truth rules: `docs/costing-and-geometry.md`.
- Schedule and site visit behavior: `docs/schedule.md`.

## Verification

Focused commands:

```bash
npm run test:portal -- apps/portal/lib/projects
npm run test:portal -- apps/portal/lib/estimates
npm run test:portal -- apps/portal/lib/localFirst
npm run test:portal -- apps/portal/app/api/projects
npm run test:portal -- apps/portal/app/api/estimates
npm run test:portal -- apps/portal/app/api/contacts
```

Manual or browser checks should cover:

- Create a contact and project, then confirm list/detail cache updates.
- Load a project detail page and confirm `ProjectPageSnapshot` pipeline, task, activity, and email sections match current data.
- Create an estimate from calculator/project estimate flow and confirm version label, summary, snapshot, and active draft state.
- Update an unlocked estimate and confirm local-first pending/success state clears.
- Try to update a sent/accepted/declined quote-backed estimate and confirm `ESTIMATE_LOCKED` conflict behavior.
- Create a quote from an estimate and confirm the handoff uses quote domain routes.
- Create a design request from an estimate and confirm Design List receives the request.
