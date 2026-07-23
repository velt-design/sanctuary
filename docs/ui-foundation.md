# Staff Portal UI Foundation

Status: Current foundation contract.

## Scope

`/staff/ui-foundation` is the protected live catalogue for the staff portal's next shared visual system. It renders the same reusable exports that future portal screens should consume; it is not a parallel collection of demonstration-only markup.

The production rollout is a replacement migration, not a compatibility skin. A route is complete only when its active presentation is built from Foundation tokens and reusable patterns with no legacy card, control, colour, radius, or arbitrary feature-level styling left in the rendered layer. Behavioural owners, API contracts, cache/local-first semantics, permissions, accessibility, and performance boundaries remain unchanged.

The active checkpoint order is Shell, Projects Index, Project Detail, Contacts, Estimates/Quotes, Calculator, Schedule/Tasks, remaining staff routes, then Dashboard. Earlier checkpoints were reopened after the July 2026 visual audit found blended legacy presentation. The inventory below, not a prior checkpoint label, is the current completion record.

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

Future adoption still requires checking the route's identity, actions, metadata, local filters/tabs, pending states, mobile order, and overlay containment against the shared header archetypes. Calculator and Design Workbench remain deliberate exclusions until their unsaved-work navigation requirements have a defined search handoff. The public marketing site remains outside this contract.

Contacts Index, Contact Create, Contact Detail, and CSV import compose `PageLayout`, header variants, foundation controls, cards, tables, loading/data states, alerts, and the shared modal. Their existing Contacts-index state machine, instant navigation, authenticated APIs, cache coherence, lazy import boundary, and local-first Contact Detail queue remain the behavioral owners. Mobile contact tables reduce to identity and action columns; secondary data remains available on wider screens and the detail field table reflows without document overflow.

Project Commercial keeps `CommercialTab` as a composition-only Quotes/Invoices owner. `QuotesTab` now consumes canonical quote badges, the shared sticky action and unsaved-change owners, shared focus-managed dialogs, retryable data states, semantic foundation surfaces, and responsive table containment. Quote creation still selects an exact saved estimate version and all local-first quote mutations, lifecycle locks, PDF/email actions, invoice/job-pack handoffs, and cache invalidation remain with their existing domain owners. The retired standalone estimate URL redirects to Job Packs; standalone quote and quote-print URLs redirect to the canonical Commercial editor/preview. Their unused legacy editor, print view, chevron, and project stylesheet are retired.

Calculator retains its specialist command bar, configuration, module navigation, preview, draft, and save-dialog owners while inheriting foundation density, canvas, text, border, focus, and destructive roles. Preview warnings use the shared accessible alert pattern, and command-bar actions expose 44px mobile/coarse-pointer targets. Costing, cancellation/newest-result protection, browser drafts, validation focus, Preserve/Reprice, and estimate/quote handoff behavior are unchanged.

Schedule Board, Gantt, Site Visits, and the legacy fallback share the full-width compact foundation canvas while retaining their existing view/lazy boundaries. V2 scheduling issues, load/refresh failures, task pending/retry state, and Site Visit action failures use shared accessible feedback; Schedule action dialogs use the focus-trapping modal owner. Active V2 downtime deletion, locked-job unscheduling, and Site Visit unscheduling require an in-context confirmation instead of a browser prompt. Narrow Board lanes and Site Visit days remain horizontally focused inside their owning scroll regions, while controls expose 44px targets. Schedule API/RPC commands, optimistic state, drag/drop, project-task field-owned rollback, and legacy fallback isolation are unchanged.

New Project, Drafting Queue, Running Jobs, Imports, Pricebook, and Access use the Foundation canvas, form controls, status edges, and hard-edge working surfaces. Drafting Queue and Running Jobs retain their shared spreadsheet viewport, zoom, local editing, and internal horizontal containment. Pricebook retains all three admin data owners behind an accessible tab/panel relationship. Large related-record reads use bounded ID-filter chunks so production-scale project inventories do not exceed PostgREST request-line limits.

Dashboard is the final migrated checkpoint. It uses the dashboard-only display header, three real quick actions, a compact nine-stage pipeline, dense operational panels, flat activity rows, and the shared accessible `TaskRow` control without restoring rounded cards or pills. Most page-owned operational panels use warm secondary headers, charcoal labels, and subtle neutral borders; Pipeline and My Tasks retain inverse-black headers as deliberate overview and personal-work anchors. Orange is limited to selected filters, links and interaction feedback, and real attention/status edges. On standard desktop viewports, Attention Today and Recent Activity sit above equal-width Project Action Queue and Recent Estimates panels, while My Tasks occupies the full-height right column. The two operational rows consume the remaining viewport height and longer lists scroll inside their owning panels. The page retains cached/fresh/failure states, workflow links, personal-task optimistic mutations, internal horizontal pipeline containment, and a one-column mobile flow.

### Dashboard data contract

- Pipeline is a raw count of active, non-archived `projects.pipeline_stage` rows across all nine canonical stages. It is an inventory overview, not a health score or a recent-period metric.
- Attention Today contains only four defined signals: overdue and due-today Project Command Centre actions from the service-owned project next-action projection; unscheduled `site_visit_events`; and the raw count of projects in `QUOTING`. The last signal is deliberately labelled **Projects in quoting**, not `Quotes to send`, because stage membership does not prove a quote is ready.
- Recent Estimates lists the most recently updated non-archived draft estimates. Its displayed customer price is derived from `total_true_cost_ex_gst` through `calculateStaffCustomerPriceFromCostEx`, the same pricing sequence used by staff quote creation; `summary_json.total` is not treated as customer price.
- Project Action Queue is the selected Project Command Centre action projection ordered by due date and bounded by Today, Next 7 days, or All due. Category, project, client, stage, and due date are read-only links back to the project owner.
- My Tasks contains only the authenticated user's dashboard reminders. Recent Activity contains only non-deleted project notes attached to active projects.
- A separate New Leads list is intentionally absent because the canonical nine-stage pipeline already exposes the New inventory and the projects index owns the underlying records. Project Exceptions and install/starting-soon data are also absent from the staff home page. Margin, health, fake progress, notification counts, and inferred quote-readiness metrics remain out of scope until a canonical operational owner exists.

The canonical `/login` and `/access-status` routes use the same hard-edge Foundation tokens through `PublicAuthShell`; `/staff/login` remains a query-preserving redirect. Generic page-message and pending-state surfaces share that token owner, so authentication, failure, and loading states do not reintroduce the retired rounded-card layer.

The replacement is also complete at source level for active portal presentation: route and shared-surface CSS use semantic `--ui-*` roles directly, static presentation has moved out of JSX into named owners, and obsolete standalone quote/estimate, project stylesheet, warning, and chevron implementations have been deleted. Runtime geometry, user-selected crew colours, and the separately owned design-workbench drawing surface remain data/specialist concerns rather than compatibility exceptions.

## Change Rules

- Prefer semantic `--ui-*` roles over raw colour or spacing values in new foundation consumers.
- Legacy tokens may remain only in explicitly inventoried, not-yet-migrated routes. They cannot remain in a route marked complete.
- Add a catalogue example and focused test when adding a public primitive variant.
- Update `playwright/support/portalRouteCatalog.ts` if the route contract changes.
- A missing production pattern must be implemented as a reusable Foundation component, demonstrated in the catalogue, tested, and then consumed by the route.

## Route Migration Inventory

Status meanings: `migrated` means the named active layer has no legacy presentation; `in review` means the Foundation replacement exists but browser/route audit is not closed; `pending` means a legacy presentation remains and the route checkpoint is not complete.

| Route / surface | Legacy presentation owner being replaced | Foundation owner | Status |
| --- | --- | --- | --- |
| Staff shell | legacy sidebar/mobile chrome and compatibility tokens | `PortalShell`, inverse Foundation navigation, orange active edge, focus-managed drawer | Migrated |
| `/staff/projects` | index-specific legacy table/filter/action styling | `PageHeader`, `SearchFilterBar`, `Table`, badges, data states, shared confirmation | Migrated |
| Project Detail header | legacy masthead, project-ID line, pipeline visual, action menu, chevron workflow, tab strip | two-row detail `PageHeader`, inline `ProjectStageBadge`, `OverflowMenu`, `TabNavigation` | Migrated |
| Project Detail status/details | rounded status/detail cards and inline field styling | square `Card`, `KeyValueGrid`, Foundation inputs and alerts | Migrated |
| Project Detail design/commercial summary | legacy summary cards and ad hoc metrics | `Card`, `MetricGrid`, canonical status badges | Migrated |
| Project Detail command | legacy command-centre card and action controls | `Card`, `ActionPanel`, `KeyValueGrid`, Foundation controls/timeline | Migrated |
| Project Detail activity | legacy note cards and browser delete prompt | `Textarea`, `ActivityTimeline`, `DestructiveConfirmation` | Migrated |
| Project Detail tasks/stage modal | legacy task rows, raw utility controls, legacy modal classes | `TaskList`, `TaskRow`, feedback, Foundation controls, semantic `PipelineModal` | Migrated |
| Project Detail overview composition | blended legacy grid/card layer | warm `PageLayout`, square cards, `OperationalGrid` | Migrated |
| Project Detail Commercial, Calculator, Invoices, Job Packs tabs | legacy tab-specific cards, tables, controls, and modal actions | shared tabs, controls, tables, badges, data states, and Foundation-token specialist calculator/spreadsheet owners | Migrated |
| Contacts routes | legacy route-specific cards/tables/forms and dev diagnostic panel | Foundation layout, forms, tables, feedback, import dialog, semantic diagnostic surface | Migrated |
| Estimates / Quotes | legacy presentation in active editors and dialogs | canonical badges, tables, sticky actions, dialogs, square semantic notes and row actions | Migrated |
| Calculator | specialist command/configuration presentation | Foundation density, controls, feedback, panels, and approved geometry-status chips | Migrated |
| Schedule / Tasks | rounded Board/Gantt/Site Visit cards, pill controls, and inline popover styling | hard-edge Foundation canvas, controls, feedback, semantic status edges, dialogs, and portal popovers | Migrated |
| Remaining staff routes and settings | legacy route presentation | Foundation project form, shared spreadsheet, admin data surfaces, accessible Pricebook tabs, canonical quote redirects | Migrated |
| Dashboard | legacy dashboard composition and exceptions feed | dashboard hero/quick actions, nine stage cells, attention/leads/estimates/action queue, flat activity, shared task rows | Migrated |
| Public staff auth, access, and page states | rounded gradient cards, pill actions, and rounded loading blocks | hard-edge `PublicAuthShell`, semantic status edges, Foundation controls and reduced-motion skeletons | Migrated |
| Compatibility URLs | standalone or superseded route presentation | server redirects to the canonical Dashboard, Login, Calculator, Running Jobs, Commercial, or Job Packs owner | Migrated (redirect-only) |

Temporary exceptions must be recorded as `pending` with a named owner and removal checkpoint. They are excluded from final completion and the portal-wide READY verdict.

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
