# Staff Portal UI System

Status: Current portal UI contract.

## Authority And Scope

The checked-in portal implementation and its rendered behavior are the current
staff UI canon. This document describes the shared owners, active specialist
boundaries, visual rules and regression evidence that exist now. It is not a
redesign brief, replacement programme or instruction to migrate another route.

`/staff/ui-foundation` is the protected live catalogue for shared portal
exports. It demonstrates current reusable components and forced test states. It
does not outrank production routes, require every specialist surface to use the
same composition, or authorize changing a route merely to resemble the
catalogue.

Portal and marketing have separate UI systems. The marketing-only contract in
`docs/marketing-ui-foundation.md` must not be imported into or used to set
direction for the portal. A broad portal restyle, cross-route token migration or
replacement of current specialist presentation requires explicit user
approval.

The Project Overview route composition redesign is explicitly approved under
`docs/project-command-centre-architecture.md`. That approval preserves this
visual system and applies only to Overview composition; it does not authorize a
shared-token replacement, cross-route restyle, or marketing-to-portal adoption.

Names such as `legacy`, `compatibility`, `foundation`, or `specialist` describe
implementation history or ownership; they do not by themselves make a live
path removable. Behavioural owners, API contracts, cache/local-first
semantics, permissions, accessibility and performance boundaries remain
authoritative.

## Owners

- Semantic tokens: `apps/portal/components/ui/foundation/foundation.tokens.css`
- Reusable controls and form fields: `apps/portal/components/ui/foundation/FoundationControls.tsx`
- Server-compatible page layout, cards, badges, tables, empty/loading states, and sticky actions: `apps/portal/components/ui/foundation/FoundationSurfaces.tsx`
- Interactive pagination, search/filter, selectable-table, destructive-confirmation, and unsaved-change owners: their named modules in `apps/portal/components/ui/foundation/`
- Lightweight information, warning, error/blocking alerts and alert actions: `apps/portal/components/ui/foundation/FoundationAlert.tsx`; richer data-state, calculator, financial, permission, and task/schedule feedback: `apps/portal/components/ui/foundation/FoundationFeedback.tsx`
- Focus-managed portal drawer: `apps/portal/components/ui/drawer/Drawer.tsx`; focus trap shared with the existing modal through `apps/portal/components/ui/focusTrap.ts`
- Keyboard-operable overflow menu: `apps/portal/components/ui/foundation/OverflowMenu.tsx`
- Detail-page tabs, key-value and metric groups, action panels, timelines, and task rows: `apps/portal/components/ui/foundation/FoundationOperational.tsx`
- Project stages and commercial statuses: `apps/portal/components/ui/foundation/SanctuaryStatus.tsx`
- Dashboard, index, and detail header variants: `apps/portal/components/layout/PageHeader.tsx`
- Shared staff header/search composition: `apps/portal/components/layout/StaffPageHeader.tsx` and `GlobalPortalSearch.client.tsx`
- Grouped portal-search contract and authenticated read owner: `apps/portal/lib/search/**` and `GET /api/staff/v1/search`
- Project Work Queue composition: `apps/portal/components/projects/workQueue/**`, route-owned layout under `apps/portal/app/staff/projects/work-queue/**`, and the server contract in `apps/portal/lib/projects/workItems/teamQueue.ts`
- Catalogue route: `apps/portal/app/staff/ui-foundation/**`
- Data-free visual QA mirror: `apps/portal/app/qa/ui-foundation-fixture/page.tsx` (404 unless `ENABLE_PORTAL_QA_FIXTURES=1`)

## Visual Contract

- Inter owns operational UI text. Barlow Condensed is reserved for selected headings and major metrics.
- Dashboard display type is only available through `PageHeader`'s explicit `dashboard` variant.
- Index titles are 34-36px; detail titles are 26-28px.
- Working surfaces are warm off-white; structure is black; orange is reserved for primary action, active/current stage, and selected data.
- Operational dashboards use the same warm-neutral panel hierarchy as other portal routes. Inverse black is reserved for global navigation, command/action surfaces, and deliberate high-emphasis moments; repeated panel headers use secondary surfaces, dark text, and subtle borders. Orange must communicate an action, current/selected state, interaction feedback, or genuine attention rather than decorate every populated metric.
- Panels are square, controls use 2px radii, and overlays use 4px radii.
- Borders and tonal contrast replace general card shadows.
- Spacing uses a 4px foundation. Standard and compact density are scoped with `data-ui-density`.
- `PageLayout` owns the warm route canvas, 1440px content ceiling, density scope, and responsive page padding. Route CSS should add composition only.
- Lucide outline icons, native form semantics, keyboard operation, and visible focus states are required.
- Project stages come from `lib/projects/pipelineDefinition.ts`; components must not duplicate workflow order.
- Quote and estimate badges accept canonical `QuoteStatus` and `EstimateStatus` types directly. Their exhaustive presentation maps are the only commercial status display mapping in the foundation.
- Action orange uses a dark semantic foreground. Reduced-motion mode stops spinners and shimmer and removes non-essential pressed transforms.
- The actual `PortalShell` owns expanded and collapsed desktop navigation plus a 56px mobile top bar and focus-managed drawer. Each sidebar destination has one keyboard focus stop.
- `components/navigation/sidebarLayout.ts` owns the approved 208px expanded and 48px collapsed shell widths; the matching `--ui-sidebar-*` tokens are guarded against drift. Mobile chrome and drawers account for top and bottom safe-area insets, hide desktop rails below the mobile breakpoint, expose 44px navigation targets, and disable non-essential navigation motion when reduced motion is requested.
- Shared header actions and breadcrumb links retain 44px touch targets at mobile/coarse-pointer breakpoints. The shared modal uses the overlay radius, safe-area padding, focus trap, Escape/backdrop policy, and focus return contract.

## Production Patterns

The catalogue renders the actual exported search/filter bar, selection table, pagination, modal, drawer, alerts, data states, permission/read-only controls, calculator notices, NZD financial summary, task/schedule feedback, and sticky action bar. Forced interaction states stay in catalogue markup via `data-visual-state`; they are not component props. Demo-only helpers are not exported.

Projects Index consumes the index `PageHeader`, `ButtonLink`, `SearchFilterBar`, `ProjectStageBadge`, `LoadingSkeleton`, and `DataStatePanel` while retaining its existing query, preload, optimistic mutation, archive-scope, and retry owners. Project Detail consumes the detail `PageHeader`, inline stage badge, `TabNavigation`, `KeyValueGrid`, `MetricGrid`, `ActionPanel`, `ActivityTimeline`, `TaskList`, shared controls, alerts, and confirmation owners while retaining lazy tabs and existing cache/local-first owners.

`StaffPageHeader` is the shared composition for the global utility rail. It is adopted by Dashboard, Projects Index/Detail/Create, Contacts Index/Detail/Create, Schedule, Drafting Queue, Running Jobs, Imports, Pricebook, and Access, including the Projects and Contacts truthful pending states. It preserves each `PageHeader` variant and its page-owned actions while adding one grouped Projects/Contacts search owner. When the header has more than 960px of available width, identity, search, and actions share one row and equal flexible side tracks keep search on the header's geometric centreline. At 960px or below, including narrow sidebar layouts and 200% zoom, the default header wraps in the stable order identity, search, then actions; search remains centred and becomes full-width on mobile. Project Detail deliberately keeps its project name/stage, search, owner, and route actions on one internally scrollable command rail at narrow widths so the sticky project header remains exactly two rows with its tabs; it must not create document overflow or hide a permitted command. The search begins at two characters, debounces and cancels superseded requests, returns at most five results per group, supports `Ctrl/Cmd+K`, `/`, arrow keys, Enter, and Escape, and exposes explicit loading, empty, error, current-result, and opening states. Selecting a destination uses the shared non-blocking route-progress owner; the query and results clear only when the route commits, while selecting the current result closes and clears without a false navigation. Projects remain ranked first. Projects search real name, saved reference, site address, and linked contact name fields; Contacts search real name, email, phone, and address fields. No company or dedicated project-number field is claimed because neither exists in the current canonical schema. Local list filters remain separate and keep their existing owners.

The routes named above are the current `StaffPageHeader` consumers. Calculator
and Design Workbench deliberately remain outside global-search adoption because
their unsaved-work navigation requirements have separate owners. Changing that
boundary requires its own approved task and route-specific evidence. The public
marketing site remains outside this contract.

Contacts Index, Contact Create, Contact Detail, and CSV import compose `PageLayout`, header variants, foundation controls, cards, tables, loading/data states, alerts, and the shared modal. Their existing Contacts-index state machine, instant navigation, authenticated APIs, cache coherence, lazy import boundary, and local-first Contact Detail queue remain the behavioral owners. Mobile contact tables reduce to identity and action columns; secondary data remains available on wider screens and the detail field table reflows without document overflow.

Project Commercial keeps `CommercialTab` as a composition-only Quotes/Invoices owner. `QuotesTab` now consumes canonical quote badges, the shared sticky action and unsaved-change owners, shared focus-managed dialogs, retryable data states, semantic foundation surfaces, and responsive table containment. Quote creation still selects an exact saved estimate version and all local-first quote mutations, lifecycle locks, PDF/email actions, invoice/job-pack handoffs, and cache invalidation remain with their existing domain owners. The retired standalone estimate URL redirects to Job Packs; standalone quote and quote-print URLs redirect to the canonical Commercial editor/preview. Their unused legacy editor, print view, chevron, and project stylesheet are retired.

Calculator retains its specialist command bar, configuration, module navigation, preview, draft, and save-dialog owners while inheriting foundation density, canvas, text, border, focus, and destructive roles. Preview warnings use the shared accessible alert pattern, and command-bar actions expose 44px mobile/coarse-pointer targets. Costing, cancellation/newest-result protection, browser drafts, validation focus, Preserve/Reprice, and estimate/quote handoff behavior are unchanged.

Schedule Board, Gantt, and the legacy fallback share the full-width compact foundation canvas while retaining their existing view/lazy boundaries. The current Site Visits route/data owner remains dormant and directly reachable for maintenance, but Site Visits is hidden from normal navigation, is not linked from project work, and uses a manual completion fact only until reactivation is separately approved. V2 scheduling issues, load/refresh failures, task pending/retry state, and action failures use shared accessible feedback; Schedule action dialogs use the focus-trapping modal owner. Narrow Board lanes remain horizontally focused inside their owning scroll regions, while controls expose 44px targets. Schedule API/RPC commands, optimistic state, drag/drop, project-task field-owned rollback, and legacy fallback isolation are unchanged.

New Project, Drafting Queue, Running Jobs, Imports, Pricebook, and Access use the Foundation canvas, form controls, status edges, and hard-edge working surfaces. Drafting Queue and Running Jobs retain their shared spreadsheet viewport, zoom, local editing, and internal horizontal containment. Pricebook retains all three admin data owners behind an accessible tab/panel relationship. Large related-record reads use bounded ID-filter chunks so production-scale project inventories do not exceed PostgREST request-line limits.

Dashboard is the final migrated checkpoint. It uses the dashboard-only display header, three real quick actions, a compact nine-stage pipeline, dense operational panels, flat activity rows, and the shared accessible `TaskRow` control without restoring rounded cards or pills. Most page-owned operational panels use warm secondary headers, charcoal labels, and subtle neutral borders; Pipeline and My Tasks retain inverse-black headers as deliberate overview and personal-work anchors. Orange is limited to selected filters, links and interaction feedback, and real attention/status edges. On standard desktop viewports, the bounded V2 Work Queue preview sits above Recent Estimates in the left column, Recent Activity uses the full middle column, and My Tasks occupies the full-height right column. Longer lists scroll inside their owning panels. At tablet widths the queue remains the first project-work surface; the route becomes a one-column flow on mobile. The page retains cached/fresh/failure states, workflow links, personal-task optimistic mutations, internal horizontal pipeline containment, and responsive overflow safeguards.

`/staff/projects/work-queue` is the operational team list for V2 project work. It uses one ruled row per project, stable Overdue/Today/Next seven business days/Blocked/Needs triage groups, stage and effective responsibility context, semantic queue commands, explicit server-confirmed feedback, and normal loading/background-refresh/error/retry/access-ending states. Cached or refresh-failed rows remain visible but read-only; staff-directory failure disables reassignment only. A missing V2 contract renders the named **Work Queue not ready** state without stale rows, mutation controls, or an automatic retry loop. Responsive behavior prioritizes project, obligation, due state, and action before progressively revealing secondary controls; it must not become another general dashboard or duplicate specialist workspaces. Project Overview uses one Project Work region for both models. V2 work remains actionable through its existing server commands and pauses controls whenever its reads are not fresh or disagree. Pre-V2 projects render one clearly labelled read-only retirement card, with an admin review link when permitted; they do not load or display old task rows, rank a next action, show task history, or expose create/complete controls. Call and Site Visit identities remain fail-closed in V2 Project Work, and Site Visits remains hidden/manual.

Project Overview V2 is route-owned composition within this current visual system. `ProjectOverviewLayout` arranges `ProjectOrientationBand`, the single `ProjectWorkSection`/`ProjectWorkList`, the existing current-design/commercial owner, and `ProjectRecentNotesEvents`. `ProjectOrientationBand` owns active local-first details/stage presentation; `ProjectStatusDetailsCard` is only its compatibility wrapper for the detail-mutation fixture and focused tests. `ProjectHeaderOwnerControl` owns the single header owner-management entry point.

Within Project Work, `ProjectWorkControls` owns V2 manual/state/correction controls and the existing manual hidden Site Visit completion fact, while `useProjectWorkCommandController` owns V2 stable command/feedback orchestration. `LegacyProjectWorkRetiredCard` is the only pre-V2 work presenter and has no command controller. `projectWorkVisibilityPolicy` is the V2 fail-closed Call/Site Visit filter. V2 projection fan-out and invalidation remain in `projectWorkCache`; there is no legacy complete-response patch path. None of these owners adds shared tokens, restyles another route, infers project truth, or moves specialist workflow ownership.

### Dashboard data contract

- Pipeline is a raw count of active, non-archived `projects.pipeline_stage` rows across all nine canonical stages. It is an inventory overview, not a health score or a recent-period metric.
- The retired Attention Today card, its overdue/due-today legacy project-action rows, and its duplicate Projects-in-quoting row are absent. `projects.follow_up_date` and `next_action*` compatibility fields are not evidence of a current obligation or a lost opportunity and do not enter the Dashboard browser contract. The Pipeline remains the single home-page inventory view for quoting-stage membership. Site Visits remains hidden and does not contribute a Dashboard link.
- Recent Estimates lists the most recently updated non-archived draft estimates. Its displayed customer price is derived from `total_true_cost_ex_gst` through `calculateStaffCustomerPriceFromCostEx`, the same pricing sequence used by staff quote creation; `summary_json.total` is not treated as customer price.
- Work Queue preview is the only project-work surface on Dashboard. It is a bounded read of the same authoritative one-row-per-project V2 queue used by the full Work Queue. It shows project, action, stage, and due group and links to the owning queue/project surface; lifecycle and commercial truth stay server-composed.
- My Tasks contains only the authenticated user's dashboard reminders. Recent Activity contains only non-deleted project notes attached to active projects.
- A separate New Leads list is intentionally absent because the canonical nine-stage pipeline already exposes the New inventory and the projects index owns the underlying records. Project Exceptions and install/starting-soon data are also absent from the staff home page. Margin, health, fake progress, notification counts, and inferred quote-readiness metrics remain out of scope until a canonical operational owner exists.

The canonical `/login` and `/access-status` routes use the same hard-edge Foundation tokens through `PublicAuthShell`; `/staff/login` remains a query-preserving redirect. Generic page-message and pending-state surfaces share that token owner, so authentication, failure, and loading states do not reintroduce the retired rounded-card layer.

The current portal intentionally combines shared semantic `--ui-*` roles with
active route-owned, compatibility and specialist presentation. Examples
include the compatibility tokens retained for the design workbench and theme
editor, the default and Foundation-aware `PageHeader` paths, runtime geometry,
user-selected crew colours, calculator composition and spreadsheet surfaces.
These are part of the current system where they are still consumed. Do not
delete, rename, flatten or visually replace them without proving their exact
consumers and obtaining approval for any resulting UI change.

## Change Rules

- Inspect the current rendered route, its code, its tests and its owning feature
  doc before proposing a visual change. When this doc disagrees, those current
  sources win and this doc must be corrected.
- Prefer semantic `--ui-*` roles when extending an existing Foundation
  consumer. Do not use that preference to rewrite an unrelated current
  surface.
- Preserve active route-owned and specialist presentation. A compatibility or
  legacy name is not deletion evidence.
- Add a catalogue example and focused test when changing a shared primitive
  variant.
- Update `playwright/support/portalRouteCatalog.ts` if the route contract
  changes.
- Decide whether a missing pattern is truly shared or route-specific from
  current consumers. A new shared primitive requires a real reuse case; it
  does not require an incidental migration of existing routes.
- Never import the marketing Foundation into the portal or use its visual rules
  as portal acceptance criteria.

## Current Ownership And Adoption Map

This map records current owners and important boundaries. It is not a backlog
and has no implied completion sequence.

| Surface | Current presentation owner | Boundary to preserve |
| --- | --- | --- |
| Staff shell and navigation | `PortalShell`, navigation modules, semantic portal tokens, mobile drawer | Keep current expanded/collapsed/mobile behavior, focus ownership and active compatibility tokens. |
| Dashboard | dashboard header, quick actions, pipeline, operational panels, activity and task owners | Preserve current hierarchy and data semantics; do not infer new metrics or restyle other routes from Dashboard. |
| Project Work Queue and legacy review | Work Queue route/components plus `teamQueue.ts`; pre-V2 Overview uses `LegacyProjectWorkRetiredCard`, and admin review remains bounded | Keep one V2 queue row per project, server-owned precedence, durable command feedback, customer-contact-data exclusion, and explicit one-project review. Never restore legacy task controls or bulk-classify/close projects. Personal reminders remain separate. |
| Projects and Contacts | `StaffPageHeader`, `PageHeader`, shared controls/surfaces/statuses plus route-owned composition | Keep search, filters, pending states, cache/local-first behavior and page actions with their domain owners. |
| Project Detail and commercial tabs | detail header/tabs, operational patterns, quote/invoice/job-pack owners and specialist tab composition | Shared components do not move commercial, local-first, side-effect or lazy-boundary authority. |
| Calculator | specialist command, configuration, preview and save owners with current portal token/control integration | Do not flatten the specialist workspace into a generic page pattern or change costing/save behavior as UI cleanup. |
| Schedule and Tasks | schedule-owned Board/Gantt composition, dormant Site Visits owner, shared feedback, controls and dialogs | Preserve view boundaries, horizontal work regions, optimistic commands and legacy fallback isolation. Do not make Site Visits a project-work source or destination. |
| Drafting Queue and Running Jobs | shared spreadsheet shell and route-owned spreadsheet presentation | Preserve zoom, local editing, internal scroll containment and field ownership. |
| Design Workbench and theme editor | specialist presentation plus the active compatibility tokens declared in portal globals | Outside any general Foundation cleanup; follow their own architecture and visual-review guardrails. |
| Public auth and page states | `PublicAuthShell`, semantic status edges, shared controls and reduced-motion states | Preserve credential-free routes, redirects, focus and responsive behavior. |
| Foundation catalogue and QA mirror | `/staff/ui-foundation` and gated `/qa/ui-foundation-fixture` | Regression and discovery evidence only; never a blanket production migration target. |
| Compatibility URLs | server redirects to current Dashboard, Login, Calculator, Running Jobs, Commercial or Job Packs owners | Redirect behavior is canonical; do not recreate retired presentation. |

## Verification

- `npx vitest run apps/portal/components/ui/foundation apps/portal/components/layout/PageHeader.test.tsx apps/portal/app/staff/ui-foundation`
- `npx playwright test playwright/portal.ui-foundation.spec.ts --project=portal-chromium`
- `npx playwright test playwright/portal.contacts-ui.spec.ts --project=portal-chromium --no-deps` after authenticated storage state exists
- `npx playwright test playwright/portal.quotes-estimates-ui.spec.ts --project=portal-chromium --no-deps` after authenticated storage state exists; the populated detail state uses a read-only mocked quote response and performs no live mutation
- `npx playwright test playwright/portal.calculator-foundation-ui.spec.ts --project=portal-chromium --no-deps` for the non-mutating responsive Calculator foundation review
- `npx playwright test playwright/portal.schedule-tasks-ui.spec.ts --project=portal-chromium --no-deps` for the non-mutating Board, Gantt, Site Visits, dialog, and project Tasks review
- `npx playwright test playwright/portal.remaining-routes-ui.spec.ts --project=portal-chromium --no-deps` for New Project, settled Drafting Queue/Running Jobs data, Imports, all Pricebook panels, Access, and canonical quote redirects
- `npx playwright test playwright/portal.dashboard-ui.spec.ts --project=portal-chromium --no-deps` for settled Dashboard data, responsive/zoom geometry, reduced motion, and read-only workflow links
- `npx playwright test playwright/portal.header-search-ui.spec.ts --project=portal-chromium --no-deps` for the live authenticated search contract, Project-to-Project mouse/keyboard/mobile navigation, current/opening states, adopted-route coverage, responsive containment, and Dashboard fit
- `npx playwright test playwright/portal.public-auth-ui.spec.ts --project=portal-chromium --no-deps` for credential-free Login, Access Status, `/staff/login` redirect, responsive/zoom geometry, and reduced motion
- `npx vitest run playwright/support/portalRouteCatalog.test.ts` proves that the catalogue exactly matches all 36 `apps/portal/app/**/page.tsx` routes, including authenticated, public-auth, diagnostics, and redirect-only entries
- Browser matrix: 1440x1000, 1280x800, 1024x900, 768x1024, 390x844, and 720x500 with 200% zoom simulation. Assert document overflow, major-section overlap, cropped controls, heading semantics, focus return, reduced motion, and action/stage contrast.
- Portal browser specs use `playwright/support/portalBrowserEvidence.ts`. Named screenshot capture keeps the real caret state so evidence collection cannot introduce a hydration mismatch.
- `npx tsc -p apps/portal/tsconfig.json --noEmit --incremental false`
- `npm --prefix apps/portal run lint`
- `npm run build:portal`
- Authenticated desktop, tablet, and mobile review of `/staff/ui-foundation`
- Credential-free visual review may use `/qa/ui-foundation-fixture` only with the explicit portal QA flag; this must never replace staff-route auth smoke.
