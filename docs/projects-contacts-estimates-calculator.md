# Projects, Contacts, Estimates, And Calculator

This doc is the current-state reference for the core staff portal workflow before quotes, design requests, schedule, running jobs, and job packs. Use it when touching contacts, projects, project snapshots/tasks, calculator estimates, estimate versions, estimate locks, or local-first estimate mutations.

## Read First

- Use `## Ownership` to route pages, APIs, helpers, tables, and local-first keys.
- Use `## Contact And Project Flow` and `## Project Snapshot, Pipeline, And Tasks` for project workflow behavior.
- Use `## Calculator And Estimate Versions` for estimate creation, versioning, summaries, and warnings.
- Use `## Estimate Editability And Locks` and `## Local-First Mutations` for locks, queues, aliases, and conflicts.
- Finish with `## Handoffs` and `## Verification` for downstream docs and focused tests.

## Ownership

- Contact pages: `/staff/contacts`, `/staff/contacts/new`, `/staff/contacts/[contactId]`.
- Project pages: `/staff/projects`, `/staff/projects/new`, `/staff/projects/[projectId]`.
- Calculator page: `/staff/calculator`.
- Project estimate surfaces: `/staff/projects/[projectId]?tab=estimates`, `/staff/projects/[projectId]/estimate/[estimateId]`, and `/staff/projects/[projectId]/design-workbench`.
- Contact APIs: `apps/portal/app/api/contacts` and the Contacts-list read model at `apps/portal/app/api/staff/v1/contacts/index`.
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
- The Contacts index renders its heading, actions, search, and truthful list region before any database read. `GET /api/staff/v1/contacts/index` then loads the complete paginated contact list through the authenticated staff API and the user-owned QueryClient. The client has explicit `pending`, `cached`, `fresh`, `refresh-failed`, and `unavailable` states: known rows remain visible during refresh or network/server failure, while `401`/`403` hides them, and an empty state requires a fresh successful response.
- Contacts-index links update `/staff/contacts` immediately without the global route overlay and preload route/data only from hover, focus, touch, or pointer-down. The generic portal-index navigation owner preserves Projects filters, modified clicks, new tabs, and browser Back. Fresh contact results seed the canonical contact list and every cached Projects-index contact segment; contact create/edit/import cache updates use the same central helper. CSV import is a route-owned lazy workflow boundary whose code preloads on intent.
- Contact Detail editing uses the user-owned local-first queue key `portal.contact.details.update`. Done closes immediately and keeps the desired values visible while the full normalized working copy persists through the authenticated contact API. Ordered drafts survive navigation, reload, and offline periods. Transient failures retain the desired values and retry; terminal validation/access/conflict responses restore the last confirmed contact across detail, Contacts index, canonical contact list, and Projects-index contact caches while retaining the rejected draft for Review/Retry. A successful handler accepts the server-mapped contact and clears only the matching working copy when no newer contact save remains.
- Project create/detail routes write and read `projects`.
- The persistent portal content boundary renders the real header, actions, filters, and truthful "Updating projects" list frame synchronously on an ordinary Projects-index click, while keeping the sidebar available; the matching route loading boundary uses the same frame for direct route transitions. The page entrypoint does not await request search params or data; its client controller reads the current filters and date, then dismisses the pending frame after mounting. One authenticated React Query request to `GET /api/staff/v1/projects/index` loads the selected active/archived/all project scope and complete contact list concurrently through the existing paginated server loader.
- Projects-index reads have five states: `pending`, `cached`, `fresh`, `refresh-failed`, and `unavailable`. Known rows remain visible during background refresh and network/server failure, while `401`/`403` hides them. An empty state is truthful only after a fresh successful response, and archive scopes never borrow active-only rows.
- Reversible Projects-index writes are optimistic through the current user's QueryClient. Name, phone, address, silent stage-correction, archive, and restore feedback appears before the API settles; only the affected field/state is rolled back on rejection, a small `Saving...` marker remains visible while syncing, and success language is emitted only after server confirmation. Archive moves update active/archived/all membership and known counts together. Hard delete remains server-confirmed and is never optimistic. The data-free project-mutation browser fixture mounts this production owner, deliberately delays persistence, and records feedback/useful/background timing separately; its disabled fixture query and intercepted sample request never read or write customer tables.
- Links to the Projects index update the canonical `/staff/projects` URL immediately, bypass the blocking route overlay, and preload route/data only on hover, focus, touch, or pointer-down. Fresh index results seed the established project/contact list keys so project opening remains instant; mutations patch or invalidate both combined and canonical caches.
- Project detail pages use the existing authenticated React Query request to `/api/projects/[projectId]/snapshot`; the server route renders the project shell without repeating that snapshot read.
- Project Details editing uses the user-owned local-first queue key `portal.project.details.update`. Done closes the editor and exposes the desired values immediately; full normalized drafts remain in the per-user working-copy store until the ordered authenticated API saves finish. Transient/offline failures retain the desired values and retry. Terminal validation, permission, not-found, lock, or conflict responses restore the last confirmed cache values while retaining the rejected working copy for Review/Retry; `401`/`403`/`404` also refresh the protected project read boundary. A confirmed save clears its working copy only when the stored draft still matches that queue item and no newer project-detail save is pending.
- When the current user's active/all project list already contains the project, the page builds an immediate summary from that list and the matching contact-list cache. The full snapshot replaces it quietly through the same query key. A different user's persisted cache is never consulted.
- Contact writes and the snapshot API run through auth-bound staff Supabase clients from the route context; tests should inject fake server clients instead of mocking the legacy compatibility client.
- Project cache patching around creates/details and reversible index mutations lives with central query/local-first helpers so canonical lists, combined indexes, project summaries, and detail views stay coherent without crossing the authenticated QueryClient boundary.
- Staff/admin browser UI should use API, query, or local-first layers, not direct table writes.
- Top-level list-fetch boundaries (contacts/projects/design-packages/running-jobs and any sibling) MUST go through `fetchAllPages()` from [`apps/portal/lib/list/listLimits.ts`](../apps/portal/lib/list/listLimits.ts). It pages through Supabase 1000 rows at a time up to `MAX_LIST_FETCH_ROWS = 5000`, defeating both PostgREST's silent 1000-row default (PR-PG1) AND any Supabase project-level `db-max-rows` cap (PR-PG1c). Inline `.range(0, MAX_LIST_FETCH_ROWS - 1)` is treated as a bug. Use `count: 'exact'` and surface `truncated` from the result to feed a `ListCountBanner`. See the [list-pagination plan](list-pagination-plan.md) and [PR-PG1c plan](pr-pg1c-plan.md). Conditional filters (`.in(...)`, `.is(...)`) MUST be applied INSIDE the page-builder callback, never outside the helper — applying them outside loses the filter on later pages.

Keep contact fields, project fields, and estimate snapshot fields distinct. Estimate snapshots can carry copied customer/project context for historical quote/design accuracy, but that snapshot copy is not the canonical editable project record.

## Project Snapshot, Pipeline, And Tasks

`ProjectPageSnapshot` is the complete project-detail read model for the staff project page. It combines project/contact data, pipeline and task state, email summaries, and notes. The access-defining project/contact row is read independently, while all subordinate relations are embedded in one second auth-bound PostgREST read. A subordinate-read failure rejects the complete snapshot so the client retains known data with Retry instead of presenting partial arrays as fresh.

Project opening has five explicit read states: `pending` for a direct link with no known summary, `summary` while authenticated summary fields are visible, `fresh` after the full snapshot arrives, `refresh-failed` when known data remains visible with Retry, and `unavailable` after a `401`, `403`, or `404` response. Access-ending responses must hide known project data. Debug exports are fresh-snapshot-only. The Projects list includes the lightweight project shell in its normal bundle and gives the rendered instant view to a tiny Projects-layout navigation boundary, which updates browser history and keeps the current-user cached summary visible while the existing authenticated snapshot query completes. On a direct link without list cache, `GET /api/staff/v1/projects/[projectId]/summary` supplies only the RLS-visible project/contact shell; the complete snapshot still refreshes through its existing query and key in parallel. The shell must not be hidden behind an intent-time dynamic import: a brief hover or direct click still needs immediate useful content. Browser Back clears that instant view and lets Next restore its own retained list route; server-rendered React nodes are never treated as a reusable cache. The persistent boundary makes browser Back reliable without importing project-opening code into Design Workbench.

Project rows preload the route and existing full-snapshot query on hover, keyboard focus, touch, or pointer-down. There is no automatic first-three-project fan-out. Activity is the default workflow but is also a real lazy boundary; its local loading state appears only inside the already-usable project frame. Emails, Estimates, Quotes, Invoices, and Job Packs are separate lazy code boundaries; hovering or focusing one preloads its exact code and owned query data. The responsive Details panel is also a shared lazy boundary: desktop loads it when the rail is actually rendered, while the narrow-layout Details tab preloads it from intent. Activity and Emails depend on the full snapshot, so they show `Updating...` during the summary state and never turn placeholder empty arrays into a false empty state.

- Pipeline stages and task definitions live in `apps/portal/lib/projects/pipelineDefinition.ts`.
- Manual task completion is stored in `project_task_checks`.
- Manual task toggles update the visible task and project snapshot cache immediately, but only the affected checkbox is disabled while its authenticated API request is pending. Separate tasks may save concurrently. If one request fails, only that task is restored; other successful task state is preserved, the protected snapshot is refreshed, and the failed desired value remains available through a per-task Retry action. Tasks that can advance pipeline state still report completion/automation only from the server response.
- Action tasks link into owned workflows such as site visits, estimates, schedule, invoices, and job packs.
- Snapshot readiness comes from portal data such as booked site visits, generated estimates, accepted quotes, open deposit invoices, scheduled install items, and generated job packs.
- Stage action routes under `apps/portal/app/api/staff/v1/projects/[projectId]/action` own staff workflow side effects.
- The project page Tasks panel is rendered inside the Activity tab (`ActivityTab.tsx`), not in the side rails. The side rails own the project details panel only.

Do not hard-code duplicate pipeline or task rules in components. Update the pipeline definition and snapshot mapping together when task behavior changes.

## Calculator And Estimate Versions

The calculator produces estimate snapshots. Estimate rows are versioned per project and hold calculator inputs, outputs, warnings, costing metadata, derived summary fields, and drawing/snapshot state.

- Estimate payload normalization lives in `apps/portal/lib/estimates/persistence.ts`.
- Estimate summary mapping lives in `apps/portal/lib/estimates/summarize.ts` and server mapping helpers.
- Version labels are derived from project estimate rows; new estimates advance the next available version.
- Estimate snapshots carry calculator inputs plus output sections such as `derived`, `projectSnapshot`, `snapshot`, and `configVersions`.
- Calculator blind add-ons keep `widthMm` and `coverLengthMm` in saved estimate snapshots for compatibility, but the staff calculator presents and accepts those two dimensions in metres and converts them back to mm in the client adapter before pricing/persistence.
- Drawing state can be stored inside estimate snapshot/drawing draft shapes, but design workbench architecture and compatibility rules are owned by `docs/design-workbench-architecture.md`.

The calculator workspace keeps workflow context and save readiness in a persistent command bar. Staff can search active projects by name, quote reference, or address; selecting one opens that project's calculator workflow and active draft while the scratch draft remains in local/session storage under its original key.

Calculator input drafts are protected separately from estimate Save. The command bar reports `Saving locally`, `Saved locally`, `Restored unsaved work`, or `Local save failed` for the browser working copy/session snapshot and always explains that Save is still required to update the estimate. Working-copy restoration takes priority over the session fallback, active-module selection restores with the inputs, and a draft-key change must not persist the previous project's values while an estimate or duplicated source is still loading. These states do not enqueue an estimate mutation and are separate from the post-Save `syncing`, `synced`, `offline`, `error`, and `conflict` states.

Multi-module calculator drafts use one canonical module navigator. Modules remain in stored array order but are grouped under every pergola, including an empty pergola left by Move, and their computed identity is `Pergola N · Module N` using the module's local ordinal inside that pergola. Rows show style, dimensions, active state, and validation-error count. Add module and Add pergola create fresh defaults; Duplicate deep-copies the active module and regenerates flashing/infill IDs; Move changes only `pergolaId`; Remove requires confirmation, protects the final module, and explains that the change affects only the browser draft until Save. The navigator is a sticky rail at calculator widths of 1120px and above and an accessible modal launcher below that width. These actions do not reorder modules or change costing, estimate versioning, or automatic persistence semantics.

Calculator result freshness is explicit. Only a result produced from the current serialized costing request is `Live` and saveable. The debounced request lifecycle belongs to `useCalculatorCostingRequest`: an input change aborts the obsolete request, a late aborted response cannot replace the newest result, and a network/server failure retains the last valid result. While inputs are invalid, awaiting recalculation, or affected by a costing error, the last successful totals and drawings remain visible for continuity but are labelled `Last valid result`; Quote Status and save preflight continue to block until the result is current. This controller changes request ownership only: the authenticated costing API and `@sp/costing` remain authoritative for the result. At narrow calculator widths the form and preview stack under one page-owned scrollbar; the split, independently scrollable workspace remains at widths of 1120px and above.

Calculator configuration section order, Basic/Advanced visibility, and field-width presentation live outside `CalculatorGridClient` in the configuration-section model and form presenter. Field dependencies, validation IDs, and focus targets are unchanged. Consecutive ordinary sections share quiet sheets with subtle dividers, while Blinds and Infills remain separate configuration cards. Labels and input-like toggles use a consistent control rhythm; routine field helper subtext is not rendered, while validation errors remain attached to their fields and visible. The responsive field grid deliberately renders three columns at the 1600px and 1024px browser checks, and two columns at 1366px and 768px, with one column on narrower mobile widths. Specialist Flashings, Blinds, and Infills controls use the full section width. The presentation-only Orientation diagram is omitted. The narrow command bar keeps Save prominent while retaining project/module identity, browser-draft explanation, freshness, and Basic/Advanced controls.

Calculator money labels distinguish internal costing from customer-facing values. The pricing preview displays the pergola customer price as the primary figure: rounded internal true cost ex GST multiplied by `1.25`, then GST applied to that rounded ex-GST value using the same shared helper as estimate-to-quote line mapping. Full and compact pergola customer-price displays add thousands separators and round the inc-GST and ex-GST figures to the nearest whole dollar; the underlying cent-accurate calculation and quote mapping remain unchanged. This is a live display calculation only; it is not persisted and does not change estimate Save, Preserve/Reprice, or quote totals. Cost-engine totals and blind customer prices retain cent precision. Blind prices remain separate, are added during quote creation, and stay excluded from pergola true cost.

Below the 1120px split-workspace breakpoint, a compact customer-price card appears between the module launcher and configuration form so the current or last-valid inc-GST and ex-GST figures are available before configuration. The full preview retains the detailed pricing and internal-cost breakdown, with internal metrics aligned into compact label/value rows. Labels may wrap at constrained preview widths, but metric values remain on one line. At split widths the preview order is Pricing preview, Module views, True cost change, then Quote status, so the active drawing appears before secondary cost-change detail. True cost change keeps its inc/ex totals, operational deltas, and Advanced material/labour detail while presenting up to three cost categories in absolute-change order. Empty customer-priced add-ons collapse to one quiet message, and zero-count infill summaries are omitted. Untouched preview sizing is 480px when the measured workspace is at least 1280px and 440px from 1120px to 1279px; only an explicit drag or keyboard resize writes the v2 preference. Stacked layouts add scroll clearance for the sticky command bar, pricing card, configuration sections, and validation focus targets. Context uses compact density without changing its values, field order, or Basic/Advanced visibility.

Every valid calculator save opens a costing decision. For an existing estimate, staff see stored estimate costs beside the Live calculator result and choose either `Save design — keep stored costing` or `Reprice and save`. The comparison uses pricing-affecting input semantics, not merely whether the numerical total changed. Missing legacy breakdown values remain unknown (`—`). Preserve keeps the existing cost outputs and marks pricing stale when applicable; Reprice stores the Live result and marks pricing current.

Successful calculator saves remain on the calculator long enough to show the actual local-first state (`syncing`, `synced`, `offline`, `error`, or `conflict`). Staff may stay, return to the exact saved estimate, or explicitly create a quote from that estimate. Quote handoff uses `?tab=quotes&createFromEstimateId=...`; navigation never creates a quote until the user selects that action. The action waits while state is still hydrating, permits queued/syncing/synced/offline local snapshots, and disables on sync error or conflict.

Costing logic must remain in `packages/costing`; estimate code should persist and summarize costing output, not fork the costing engine.

Calculator infills keep draft-string and field validation in the portal, but every complete infill delegates geometry, source/orientation resolution, joiner/support cuts, and stock purchasing to `calculateInfillsTakeoffV1()` from `@sp/costing`. The cut-list result has two groups: `Pieces to cut` for individual finished panels and linear cuts, and `Materials to purchase` for physically allocated stock. CSV download and clipboard copy use those same canonical records, including source IDs and allocated stock. A critical takeoff error makes the infill incomplete, hides exportable rows, and participates in Quote Status/save blocking.

The infill configurator is a guided `Opening` -> `Existing supports` -> `Results` workflow. Opening uses three accessible visual templates: Rectangle, Sloping top, and Triangle. The active template has an explicit Selected marker. Triangle asks only for width and peak height; its illustrated default tapers to a point on the left, while existing saved mirrored triangles retain their geometry. Triangle remains compatible with saved inputs by using the existing mono-slope shape with one zero-height endpoint; no persisted `triangle` type is added. Opening shows a neutral finished-outline preview without support or cutting-plan marks. Required measurements gate progression, but untouched blank fields remain visually neutral until blur and the disabled Continue action explains what is missing. The Existing supports stage owns the explicit panel-material and joiner-direction selections: Sheet panels or 620 strips, and Vertical or Horizontal. Each physical perimeter edge has only Yes or No; new custom infills and presets begin at No so the takeoff conservatively includes the required 50x50 member. Legacy `auto` material/direction values are pinned to their current canonical resolved choice when the user enters a later stage, and legacy Unsure edge metadata is presented as No, preserving the same support purchasing result. Saved infills without confirmation metadata still infer Yes/No from their stored booleans. A triangular point is identified as having no fixing edge and preserves its hidden confirmation metadata if the opening later changes shape. Only resolved sheet/strip, vertical/horizontal and support booleans enter the unchanged `CostInputsV1` payload.

At `900px` and below the desktop infill rail is replaced by one selector, the full progress row becomes a compact `Step N of 3` line, and opening shape/location/dimensions precede optional label and quantity fields. The three shape cards remain side by side through tablet width and stack below `600px`. The support diagram labels every physical edge, marks a triangle's collapsed side as a point, and explains existing members, new supports, and internal joiners. Material/direction selections and Yes/No edge answers remain visible on this stage, followed by one neutral purchase-plan summary containing the exact new-support count. Results are production-first in semantic order: manufacturing status and blockers, selected system, added supports, canonical pieces, purchases, cutting diagram, then collapsed cost and technical detail. Piece rows separate finished size or cut length from allocated stock; purchase rows separate stock size from planned use and waste. Individual canonical rows and CSV contents are unchanged. Download cutting list is the primary export, while Copy cutting list sits in the local More menu. At `1200px` and below the tables remain ahead of a compact diagram; above that breakpoint the diagram occupies the left column while the selected system and first cutting rows occupy the right. Below `600px`, table rows stack into labelled blocks without horizontal scrolling while retaining accessible table headers.

Infill purchasing uses `3.05m x 2.03m` sheets, fixed-width Crystalite stock, 3mm consecutive-cut kerf, rotation-safe sheet placement, and job/site pooling. Module output may retain standalone purchasing for comparison, while job/site material totals use the pooled takeoff. Bottom offset never changes finished dimensions, and `match roof rafters` requires the infill to cover the full matching edge with real derived rafter spacing.

## Estimate Pricing Rollout Boundary

Saved estimate pricing stays on the calculator path. The 2026-06-11 workbench breakaway disables workbench repricing rather than adapting object-first geometry back into calculator inputs.

The rollout-prep contract in `apps/portal/lib/estimates/pricingRollout.ts` remains the place for saved source-of-record decisions at estimate create/update/duplicate persistence, but the workbench currently reports pricing as unavailable and preserves existing estimate pricing.

Workbench-solved pricing may become live only after a new downstream artifact/takeoff-to-commercial adapter exists and all readiness gates pass: ready workbench trust with no blocking diagnostics, owned geometry-derived quantity takeoff, explicit estimate source-of-record metadata, preserved estimate locks, preserved local-first queue/alias/conflict behavior, preserved quote/invoice/job-pack pricing boundaries, and an explicit rollback switch back to calculator pricing.

Failed readiness must block rollout. Do not add hidden fallback behavior that silently prices from calculator while reporting a workbench-solved source.

The future live switch must be server-owned and default-safe:

- Use a server-only requested-source flag when a future adapter exists; unset or invalid values must behave as calculator pricing.
- When a future workbench source is requested, estimate create/update/duplicate must derive readiness on the server from the saved workbench artifact/takeoff and commercial adapter before changing saved pricing. Any failed gate returns a visible blocked-source conflict with gate codes, logs a compact audit event, and leaves estimate rows unchanged.
- The browser must not send or override pricing source, readiness, source metadata, or commercial payloads. Calculator-live, unset, invalid, or blocked source attempts keep `commercial_design_input` null.
- Calculator rollback is the same explicit flag switch back to calculator pricing. Rollback affects new estimate saves and future draft quote refreshes only through the quote domain helpers; it must not mutate existing estimates, sent quote versions, public outputs, invoices, PDFs, job-pack generations, or audit rows.

Operational rollback must be explicit:

- Set the server config back to calculator pricing; do not rely on hidden fallback or browser-selected source changes.
- Redeploy or restart the portal process that reads the server config before running verification.
- Run a calculator-live estimate create/update smoke and confirm the new or updated row records `pricing_source: calculator_live`, `pricing_source_metadata.selectedSource: calculator_live`, and `pricing_source_metadata.rollbackProvenance: explicit_calculator_live`.
- Confirm existing `workbench_solved` estimates keep their historical source metadata and are not rewritten by rollback.
- Confirm the next draft quote refresh uses only the saved estimate/quote-version boundary through quote domain helpers.

Persistence changes must use ordered forward migrations. Do not edit baseline SQL or old applied migrations. The estimate source-of-record fields are:

- `estimates.pricing_source`: `calculator_live` or `workbench_solved`.
- `estimates.pricing_source_metadata`: compact JSONB with gate version, selected time and actor, requested source, commercial input schema version, quantity takeoff source, trust summary, commercial input hash, parity report hash/version, and rollback provenance.
- `estimates.commercial_design_input`: nullable JSONB populated only when the saved estimate actually prices from the commercial boundary.

Audit events must be server-owned and append-only. Log rollout source requested/enabled/disabled decisions, estimate saves with source metadata, and blocked `workbench_solved` attempts with gate codes. Audit payloads should include IDs, actor/request metadata, source, gate version, blocking codes, and hashes; they must not include raw public tokens, service-role details, or oversized commercial payloads.

Before enabling `workbench_solved`, evidence must include automated gate coverage plus manual QA. Automated coverage should prove readiness gates, metadata persistence, no hidden fallback, `ESTIMATE_LOCKED` behavior, local-first alias/retry/conflict behavior, and downstream quote/invoice/job-pack boundary preservation. Manual QA should cover calculator-live create/update, blocked workbench diagnostics with no row mutation, ready workbench-backed save, quote/PDF/public quote/invoice/job-pack preservation from saved totals, locked estimate behavior under both flags, local-first pending/failed/retry states, and rollback to new calculator-live saves while existing workbench-backed records remain historical.

## Estimate Editability And Locks

Estimate editability is derived from related quote versions and send logs.

- Draft estimates are editable unless a locking quote state exists.
- Quote statuses `SENT`, `ACCEPTED`, and `DECLINED` lock the source estimate.
- Sent quote send logs also participate in lock detection.
- Locked estimate updates return `ESTIMATE_LOCKED` with editability details.
- Internal notes can be patched separately, but estimate snapshot updates must respect editability.
- Flow state marks the active draft estimate, sent quote presence, job-pack eligibility, generated job-pack timestamp, and job-pack quote version.

Do not bypass these rules with ad hoc estimate table writes. Use the estimate routes and domain helpers so lock state, version labels, summaries, and downstream cache invalidation stay aligned.

## Activity Tab And Project Notes

The Activity tab is the project page's default landing tab. It renders a current-design snapshot bar across the top, with two columns underneath:

- Top: the current-design snapshot bar (`ProjectActivityDesignSnapshotBar`) — a slender summary of the project's current design (size, shape, customer price, status pill).
- Left: the wider Activity column (`ProjectNotesPanel`), currently an activity-style feed of project notes written by staff/admin. Entries use the same project-note pill, timestamp, note body, and author metadata pattern as dashboard Recent Activity.
- Right: the compact Tasks panel (`ProjectTasksSidebarClient`), reused inline from the Activity tab. Same data and actions as before, but visually treated as the action rail beside the wider activity feed.
- Project details render in the desktop project rail when there is enough width. When the shell falls back to the stacked laptop/mobile layout, details move to a dedicated `Details` tab so they do not push the Activity command centre down the page.

### Current-design snapshot precedence

The snapshot bar names the project's "current design". Precedence is encoded in `apps/portal/lib/projects/currentDesign/resolve.ts`:

1. Most recent `ACCEPTED` quote.
2. Else most recent `SENT` quote.
3. Else most recent `DRAFT` quote.
4. Else the latest estimate (with status `Quotes declined` if any quote was declined, otherwise `No accepted quote`).
5. Else empty state.

`DECLINED` quotes are excluded from precedence. They never become the "current design"; the bar falls through to the next eligible source. A separate boolean flag (`hasDeclinedQuotes`) tells the summarizer whether to show the declined-tinted status pill on the fall-through estimate.

### Source of truth rules for the bar

- **Size** always reads from the source estimate's calculator snapshot (`outputs.snapshot` -> `inputs.modules`), regardless of which quote sourced the price. Quote versions intentionally do not denormalize geometry.
- **Shape** is `formatModuleStyle` + lowercased `formatModuleRoof` from `apps/portal/lib/quotes/moduleFormatters.ts`. Both formatters are shared with the quote-line-item description path.
- **Customer price** prefers `quoteVersion.totals.totalIncGstCents` when a quote is chosen, falls back to `estimate.summary.total`, then `Price not available`. Never recompute pricing in the bar; the helpers must not import costing.
- **Multi-module projects** show the largest module by floor area as the primary, with a `+ N more` suffix when other modules exist.
- **Empty/partial state**: `Size not set`, `Design details incomplete`, `Price not available` are the standard fallback strings.

The bar reads from `estimateMetasByProjectQueryOptions`, `quoteVersionsByProjectQueryOptions`, and `estimateDetailQueryOptions` — the same TanStack queries the Quotes/Estimates tabs use. **No new browser Supabase reads.**

Notes data:

- Stored in `public.project_notes` (`apps/portal/lib/projectNotes/server.ts` is the domain helper). Snapshot of latest 50 non-deleted notes is preloaded in `ProjectPageSnapshot.notes`.
- The dashboard `Recent Activity` card reads the latest non-deleted project notes across projects as a read-only feed. Creating, editing, and deleting project notes remains owned by the project page note routes and local-first mutation keys.
- Author info is denormalized at write time (`author_id`, `author_email`, `author_display_name`) so reads do not need to join `auth.users`; display-name fallback rules live in `apps/portal/lib/projectNotes/types.ts` so project pages and dashboard activity resolve authors consistently.
- Soft delete via `deleted_at`; UI list filters out deleted notes.

Permissions:

- Any portal user can read all notes for a project (RLS policy `project_notes_select`).
- Authors can edit and soft-delete their own notes; admins (`is_portal_admin()`) can edit and soft-delete any note. RLS enforces this; route handlers do not re-check.

Routes:

- `GET /api/staff/v1/projects/[projectId]/notes` — list (paginated, default 50, max 200).
- `POST /api/staff/v1/projects/[projectId]/notes` — create.
- `PATCH /api/staff/v1/projects/[projectId]/notes/[noteId]` — update body.
- `DELETE /api/staff/v1/projects/[projectId]/notes/[noteId]` — soft delete.

Local-first mutation keys for project notes (`portal.project.note.{create,update,delete}`) are listed under `## Local-First Mutations`. The optimistic note uses a `local-note:*` id; the create handler aliases it to the durable id once the server returns.

## Local-First Mutations

Project estimate and quote draft workflows use local-first mutations for responsive editing while server state remains authoritative.

Current mutation keys used by this workflow:

- `portal.estimate.create`
- `portal.estimate.update`
- `portal.quote.createFromEstimate`
- `portal.quote.updateDraft`
- `portal.designRequest.create`
- `portal.estimate.notes.update`
- `portal.project.note.create`
- `portal.project.note.update`
- `portal.project.note.delete`

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
- Automation events, project tasks, follow-ups, email outbox, and audit behavior: `docs/automation-email-audit.md`.
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
- Edit a valid calculator estimate and confirm Save always shows stored versus Live costing, Preserve remains primary, and opening the dialog creates no quote.
- Save locally and confirm the outcome state follows the estimate entity queue; error/conflict blocks quote handoff while queued, syncing, synced, and offline states retain the local-first path.
- Create a design request from an estimate and confirm Design List receives the request.
