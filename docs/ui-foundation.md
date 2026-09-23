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

## Clear pages, useful detail

Owner-endorsed direction (23 September 2026): apply the clarity demonstrated by
Marketing & Sales to future authorised Portal improvements. The aim is less
reading to understand the state and next action, not fewer capabilities.

- Start from the user's decision. Put the important status, figure and next action
  first; use concise labels and a small number of meaningful summaries.
- Use charts for patterns and comparisons, tables for exact records, and familiar
  controls for decisions. A chart is optional, not a requirement for every page.
  Label the population, period, units and missing evidence. Make segments lead to
  matching records; provide an equally capable keyboard/text alternative.
- Keep frequent controls visible and group less-used filters in a labelled drawer.
  Applied choices stay visible and removable. Editing is a draft until Apply;
  Cancel changes nothing. Preserve selections when returning from detail.
- Put definitions and secondary explanation beside their subject, available on
  demand. Never hide a blocking error, required instruction, destructive consequence,
  missing-data qualification or approval needed to act safely. Brevity must not
  remove the evidence needed to interpret a number.
- Reserve space for changing content. Keep controls and reading position steady
  during loading, filtering and drawer transitions. Missing reads are unavailable,
  not zero. Recovery must retain the user's choices and provide a clear action.
- Reuse the existing component owners and tokens. Prefer composing them before
  creating a new variant; name a demonstrated gap if a variant is necessary.
  Specialist schedules, commercial editing and dense operational tables retain
  their useful detail and business contracts.

For each bounded UI PR, name the user task, reference and component owners, then
verify first comprehension, editing/cancellation, loading/failure, keyboard and
mobile-size use, and return with saved choices. Check the complete task, not only
individual controls. Preserve independent delivery review and separate owner
acceptance from agent verification. These principles do not grant a cross-route
migration or production release.

## Clarity programme working record

Latest owner refinement (23 September, Closed/location screenshot): show only
Closed for closed rows and keep a visible location in Project identity. Use a
saved Auckland suburb or outside town/city where comma/newline-separated address
text supports it; retain ambiguous address text instead of inventing geography.
No structured locality fields exist in the current Project contract. Full address
and editing remain in Contact & location. Closed rows show no running stage age
because the prior stage timestamp is not a closure timestamp. Verified with 33
focused tests, full lint, architecture/docs guard and hosted optimized build.
Independent review verified Closed/location presentation at 1440px and 390px;
the final single-locality postcode correction was source-reviewed and unit-tested.
Current preview: https://sanctuary-portal-96dczkx1i-jordans-projects-43df95bd.vercel.app/staff/projects
(`dpl_ExKsudxcpi7tuHVCtWakteGBFbdK`). Prior previews below are superseded.
No business writes. This small refinement meets the existing preview quality
standard for correctness, clarity and system fit; free-text locality precision,
physical-phone acceptance and release readiness retain the stated limits.
Same PR183 and no production release. Earlier PR checks exposed a remaining
ambiguous Projects heading in the shared browser preflight; its callers now
specify level 1. A separate background-job CI container failed to start; no claim
of passing release checks is made. Fresh checks run on the published batch.

Current stage: **Projects six-column/date refinement implemented and independently reviewed in staging; [review PR183](https://github.com/velt-design/sanctuary/pull/183) remains unmerged, not live.** Foundation PR180 merged as `e8d1158`. Main's open-pipeline correction `bc7ac36` is integrated and its OPEN population is preserved by the new reader. See the refinement evidence below for the current preview and limits. The refinement is published in PR183 (implementation revision 1337804); fresh PR-wide checks are reported on that PR. Staging review is not production release authority.
Agent-managed preview access is required; never assign sign-in to Jordan.
Owning task: continue Marketing & Sales clarity across the Portal through bounded
PRs. Current branch `codex/projects-clarity-20260923`, integrated main `bc7ac36`. Foundation history: `codex/portal-foundation-clarity-20260923`, initial base `54ceef1`.
Initial approval: 23 September "go ahead" to Foundation guidance and examples.
Superseded by the later same-task "go ahead with those 3 points": merge Foundation
after checks, then a separate Projects -> detail pilot and independent journey
review before wider rollout. Pilot merge/release and business writes remain excluded.
The completed Marketing & Sales release remains separately recorded in
`marketing-performance.md` and PR178. Its local postflight note is preserved in its
original worktree. Open PRs were checked; none owns the catalogue paths.

Reference: released Marketing & Sales, especially `HubToolbar`, `ReportDetail`,
`BusinessOverview`, and the shared Button/Select/Card/MetricGrid/Drawer owners.
The same review scenario is source filter -> source count -> matching records ->
inspect -> return; filter cancellation and saved-view restoration must preserve
context. Catalogue records are fictional and isolated from business APIs. This is
an instructional composition, not a proposed replacement business workflow.
No unresolved business-definition decision is needed for this bounded example.

Acceptance: guidance implemented in this owner and linked from the agent playbook;
compact example, exact source/date record counts, draft/apply/cancel, detail return,
saved restoration across remount, loading/empty/unavailable recovery and preserved
catalogue verified. Eight focused tests, full lint, Portal typecheck and
architecture/docs guards pass. Existing catalogue browser regression helper selects
the Components & tokens tab; the new default instructional task was exercised in
actual local and hosted browsers. Preview inspection confirmed no real data files,
credentials, new media or private evidence in the outgoing deployment.

One independent read-only reviewer found no material issues. Observed: seven-day
Google selection reconciles to two enquiries/one linked fictional project/two known
sources; saved restore and Cancel preserve choices; unavailable Retry retains the
selection and state-control position; keyboard source selection, drawer focus/scroll
return and 390px no-overflow checks pass. Builder repeated the hosted count ->
record -> return journey, checked stable metric height across available/unavailable
at 390px, and preserved filters when switching catalogue tabs. Prior Marketing &
Sales evidence remains valid for the unchanged shared owners; this catalogue uses
simple labelled button bars for three categories rather than introducing another
chart abstraction. Relevant dimensions meet the 8/10 review standard through this
concrete evidence: correctness/journey/clarity, visual/accessibility/system fit,
maintainability/recovery/privacy/cost and preview handover. No correction round was
needed. Private verification artifacts remain ignored in `.local-evidence/`.

Review device: hosted desktop access verified; phone-width browser checks passed.
Physical-phone access and human unassisted acceptance remain unverified. This
fictional instructional task does not prove live business-data coverage. No new
business assumptions, API, dependency or permission changes in Foundation. Its
PR180 final head `6750b8c` passed every required check (Portal Quality run `35801553638`) and merged as `e8d1158`. The now-authorised Projects
pilot is recorded below; wider route rollout and pilot release remain excluded.

## Owners

- Semantic tokens: `apps/portal/components/ui/foundation/foundation.tokens.css`
- Reusable controls and form fields: `apps/portal/components/ui/foundation/FoundationControls.tsx`
- Server-compatible page layout, cards, badges, tables, empty/loading states, and sticky actions: `apps/portal/components/ui/foundation/FoundationSurfaces.tsx`
- Interactive pagination, search/filter, selectable-table, destructive-confirmation, and unsaved-change owners: their named modules in `apps/portal/components/ui/foundation/`
- Lightweight information, warning, error/blocking alerts and alert actions: `apps/portal/components/ui/foundation/FoundationAlert.tsx`; richer data-state, calculator, financial, permission, and task/schedule feedback: `apps/portal/components/ui/foundation/FoundationFeedback.tsx`
- Focus-managed portal drawer: `apps/portal/components/ui/drawer/Drawer.tsx`; focus trap shared with the existing modal through `apps/portal/components/ui/focusTrap.ts`
- Keyboard-operable overflow menu: `apps/portal/components/ui/foundation/OverflowMenu.tsx`
- Portalled action-menu and interactive-popover positioning, dismissal, and focus return: `apps/portal/components/ui/PortalFloatingPanel.tsx`. Action lists use menu/menuitem semantics; the interactive User settings surface uses labelled dialog semantics.
- Detail-page tabs, key-value and metric groups, action panels, timelines, and task rows: `apps/portal/components/ui/foundation/FoundationOperational.tsx`
- Project stages and commercial statuses: `apps/portal/components/ui/foundation/SanctuaryStatus.tsx`
- Dashboard, index, and detail header variants: `apps/portal/components/layout/PageHeader.tsx`
- Shared staff header/search composition: `apps/portal/components/layout/StaffPageHeader.tsx` and `GlobalPortalSearch.client.tsx`
- Grouped portal-search contract and authenticated read owner: `apps/portal/lib/search/**` and `GET /api/staff/v1/search`
- Read-only Sanctuary AI activity composition: `apps/portal/components/ai/AiActivityView.tsx`, with auth-bound safe reads under `apps/portal/lib/ai/**` and a gated synthetic mirror at `/qa/ai-activity-fixture`
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

Marketing Performance is a developer-only staging/local composition of StaffPageHeader, PageLayout,
Card, MetricGrid, foundation form controls, table primitives and failed-read AlertBanner. Its
comparison and evidence tables use stable scroll regions; filters persist in the
URL. One-click date shortcuts apply inclusive Auckland ranges. Source ranking and
qualification/win rates use explicit denominators. Informational context lives in
quiet preview labels and metric-local notes, following owner feedback on banner
clutter; actionable read failures retain retry. Change over time compares equal
adjacent enquiry periods, with a weekly per-day bar chart and an accessible exact
count table; comparison failure does not masquerade as zero. It introduces no
shared-token change. The non-production synthetic mirror is
`/qa/marketing-performance-fixture`; see `marketing-performance.md` for review limits.

Finance clarity work composes existing Foundation view buttons, labelled search controls and data states within the existing Finance route. View selection remains server-owned before pagination. This adoption does not move payment/transfer commands or change the shared visual system; release evidence and remaining usability gaps are in `xero-connection.md`.

The catalogue renders the actual exported search/filter bar, selection table, pagination, modal, drawer, alerts, data states, permission/read-only controls, calculator notices, NZD financial summary, task/schedule feedback, and sticky action bar. Forced interaction states stay in catalogue markup via `data-visual-state`; they are not component props. Demo-only helpers are not exported.

Projects Index consumes the index `PageHeader`, `ButtonLink`, `SearchFilterBar`, `ProjectStageBadge`, `LoadingSkeleton`, and `DataStatePanel` while retaining its query, preload, optimistic mutation, journey/stage/state filtering, and retry owners. Project Detail consumes the detail `PageHeader`, inline stage badge, `TabNavigation`, `KeyValueGrid`, `MetricGrid`, `ActionPanel`, `ActivityTimeline`, `TaskList`, shared controls, alerts, and confirmation owners while retaining lazy tabs and existing cache/local-first owners.

`StaffPageHeader` is the shared composition for the global utility rail. It is adopted by Dashboard, Projects Index/Detail/Create, Contacts Index/Detail/Create, Schedule, Drafting Queue, Running Jobs, Imports, Pricebook, and Access, including the Projects and Contacts truthful pending states. It preserves each `PageHeader` variant and its page-owned actions while adding one grouped Projects/Contacts search owner. When the header has more than 960px of available width, identity, search, and actions share one row and equal flexible side tracks keep search on the header's geometric centreline. At 960px or below, including narrow sidebar layouts and 200% zoom, the default header wraps in the stable order identity, search, then actions; search remains centred and becomes full-width on mobile. Project Detail deliberately keeps its project name/stage, search, owner, and route actions on one internally scrollable command rail at narrow widths so the sticky project header remains exactly two rows with its tabs; it must not create document overflow or hide a permitted command. The search begins at two characters, debounces and cancels superseded requests, returns at most five results per group, supports `Ctrl/Cmd+K`, `/`, arrow keys, Enter, and Escape, and exposes explicit loading, empty, error, current-result, and opening states. Its interaction state lives above route header replacements, so a pending-to-loaded remount preserves text, open intent, and focus. Selecting a destination uses the shared non-blocking route-progress owner; the query and results clear only when the route commits, while selecting the current result closes and clears without a false navigation. Projects remain ranked first. Projects search real name, saved reference, site address, and linked contact name fields; Contacts search real name, email, phone, and address fields. No company or dedicated project-number field is claimed because neither exists in the current canonical schema. Local list filters remain separate and keep their existing owners.

The routes named above are the current `StaffPageHeader` consumers. Calculator
and Design Workbench deliberately remain outside global-search adoption because
their unsaved-work navigation requirements have separate owners. Changing that
boundary requires its own approved task and route-specific evidence. The public
marketing site remains outside this contract.

Contacts Index, Contact Create, Contact Detail, and CSV import compose `PageLayout`, header variants, foundation controls, cards, tables, loading/data states, alerts, and the shared modal. Their existing Contacts-index state machine, instant navigation, authenticated APIs, cache coherence, lazy import boundary, and local-first Contact Detail queue remain the behavioral owners. Mobile contact tables reduce to identity and action columns; secondary data remains available on wider screens and the detail field table reflows without document overflow.

Project Commercial keeps `CommercialTab` as a composition-only Estimates/Quotes/Invoices owner. Estimates is the first, list-first subtab and uses Foundation loading, empty/error, badge, table, button, search, and focus-managed dialog patterns before an explicit selection opens the specialist Calculator. Create estimate remains primary and Create add-on estimate is the secondary action; add-on estimate and quote rows use the existing informational badge rather than a new visual system. Optional staff-only estimate and quote names are the primary row identity; the existing estimate version or quote reference/version stays visible as the stable secondary identity, unnamed records retain the old fallback, and search matches either value. Explicit calculator intent uses a focused project workspace: the standard project header and Commercial subtabs yield to one compact Foundation return/context bar, and the embedded Calculator receives the remaining viewport; returning to the list restores the normal shell. `QuotesTab` consumes canonical quote badges, including the neutral historical `SUPERSEDED` state, the shared sticky action and unsaved-change owners, shared focus-managed dialogs, retryable data states, semantic foundation surfaces, and responsive table containment. Admin quote retirement is an immediate overflow action rather than a dialog; destructive permanent deletion retains typed confirmation. Quote creation still selects an exact saved estimate version and all local-first estimate/quote mutations, lifecycle locks, PDF/email actions, invoice/job-pack handoffs, and cache invalidation remain with their existing domain owners. Internal naming remains portal metadata and never changes customer artifacts. The retired standalone estimate URL redirects to Job Packs; standalone quote and quote-print URLs redirect to the canonical Commercial editor/preview. Their unused legacy editor, print view, chevron, and project stylesheet are retired.

The Commercial Invoices surface uses Foundation cards, metric groups, tables, badges, overflow actions, and focus-managed action dialogs. The job schedule aggregates the base contract and accepted add-ons into reconciled job-level Paid/Open/Remaining totals, while every stage retains its quote identity and the admin-only Payments & credits card allocates entries to an exact base or add-on stage. Historical quote-version invoices remain labelled in the complete history and their paid value can appear as unallocated job credit. Create invoice opens an owned Foundation modal, selects a quote family when more than one is accepted, offers scheduled, remaining, custom or split creation within that family, and retains a before/after preview after success. Orange is reserved for the current primary action, while preview, payment evidence, voiding and reconciliation corrections live in overflow menus or owned dialogs.

Calculator retains its specialist command bar, configuration, module navigation, preview, draft, and save-dialog owners while inheriting foundation density, canvas, text, border, focus, disclosure, and destructive roles. The global Basic/Advanced switch is absent; specialist configuration and admin diagnostics use native disclosures. A new add-on estimate uses the same module navigator but begins with its truthful zero-pergola state and an Add pergola action; module-only configuration and templates stay absent until a pergola is added, while project context, pricing basis, blinds, and site allowances remain available. Preview warnings use the shared accessible alert pattern, and command-bar actions expose 44px mobile/coarse-pointer targets. Costing, cancellation/newest-result protection, browser drafts, validation focus, Preserve/Reprice, and estimate/quote handoff retain their specialist owners.

Schedule Board, Gantt, and the legacy fallback share the full-width compact foundation canvas while retaining their existing view/lazy boundaries. The current Site Visits route/data owner remains hidden from normal navigation and outside Project Work items; the approved active-V2 `site_visit` stage exposes one direct **Book or confirm site visit** link to that retained workflow, while completion remains a separate manual fact with no automatic stage or Schedule side effect. V2 scheduling issues, load/refresh failures, task pending/retry state, and action failures use shared accessible feedback; Schedule action dialogs use the focus-trapping modal owner. On larger screens, Board lanes wrap responsively with up to four crews per row and keep vertical overflow inside the grid or lane body; narrow Board lanes remain horizontally focused inside their owning scroll region.

Board and Gantt share one browser-saved crew visibility preference that can hide individual or empty active crews without changing access, installer activity, project links, or Schedule data. Gantt groups planning controls separately from secondary view options, defaults to an eight-week visual scale while retaining the existing twelve-week/84-day data range, and limits Needs attention to attached Schedule issues, required client updates, or drift beyond the stored flex allowance. Crew rows show item and attention counts, project rows keep dates and duration visible, and the current-week/today treatment anchors the timeline. `ScheduleGanttModel.ts`, `ScheduleGanttToolbar.tsx`, and `ScheduleGanttTimeline.tsx` own those respective presentation responsibilities while `ScheduleGanttView.tsx` retains interaction coordination. Controls retain 44px coarse-pointer targets; Schedule API/RPC commands, optimistic state, drag/drop, project-task field-owned rollback, and legacy fallback isolation are unchanged.

New Project, Drafting Queue, Running Jobs, Imports, Pricebook, and Access use the Foundation canvas, form controls, status edges, and hard-edge working surfaces. Drafting Queue and Running Jobs retain their shared spreadsheet viewport, zoom, local editing, and internal horizontal containment. Pricebook retains all three admin data owners behind an accessible tab/panel relationship. Large related-record reads use bounded ID-filter chunks so production-scale project inventories do not exceed PostgREST request-line limits.

Dashboard uses the dashboard-only display header, three real quick actions, a compact five-phase Project portfolio with server-owned Active/Waiting/Closed/Archived counts, dense operational panels, flat activity rows, and the shared accessible `TaskRow` control without restoring rounded cards or pills. Most page-owned operational panels use warm secondary headers, charcoal labels, and subtle neutral borders; Project portfolio and My Tasks retain inverse-black headers as deliberate overview and personal-work anchors. Orange is limited to selected filters, links and interaction feedback, and real attention/status edges. The workspace contains Work Queue, Recent Activity, Recent Estimates, and private My Tasks; the retired Project actions/Attention Today surface is absent. The page retains cached/fresh/failure states, workflow links, personal-task optimistic mutations, internal portfolio containment, and a one-column mobile flow.

`/staff/projects/work-queue` is the operational team list for all current project work. It uses one ruled row per project, stable Overdue/Today/Next seven business days/Blocked/Needs triage groups, stage and effective responsibility context, semantic queue commands, explicit server-confirmed feedback, and normal loading/background-refresh/error/retry/access-ending states. The server can return the whole portfolio and the browser presents it in bounded 100-row pages. Cached or refresh-failed rows remain visible but read-only; staff-directory failure disables reassignment only. A missing rollout contract renders the named **Work Queue not ready** state without stale rows, mutation controls, or an automatic retry loop. Responsive behavior prioritizes project, obligation, due state, and action before progressively revealing secondary controls. Project Overview uses one V2 Project Work surface and pauses all work controls whenever its reads are not fresh or disagree; only the existing admin work-management disclosure may expose confirmation correction. Call and legacy/generic Site Visit work is hidden; approved `Contacted` and `Site Visit` specialist candidates use the same server ranking and explicit destination in Overview and Queue.

Project Overview V2 is route-owned composition within this current visual system. `ProjectOverviewLayout` arranges `ProjectOrientationBand`, the single `ProjectWorkSection`/`ProjectWorkList`, the current-design/commercial owner, and `ProjectRecentNotesEvents` inside the shared 1440px content ceiling. Its approximately 62/38 command grid responds to the Overview's available content width rather than viewport width alone: at 800 CSS pixels or narrower it stacks with Orientation first for desktop/tablet, while at 768 CSS pixels and below it preserves the mobile-priority Project Work, commercial, Orientation, and recent-history DOM order. The Project Work action title is the strongest route-owned heading, with one action rail and explicit outcome-recording labels; commercial warnings precede commercial metrics, while source facts and history remain visually subordinate. `ProjectOrientationBand` presents journey, server-owned operational state, customer/site context, freshness, and active local-first details editing without repeating the detailed stage already shown in the project header. `ProjectStatusDetailsCard` is only its compatibility wrapper for the detail-mutation fixture and focused tests. `ProjectHeaderOwnerControl` owns the single header owner-management entry point.

Within Project Work, `ProjectWorkSection` presents the ranked server CTA and `ProjectWorkControls` owns manual work, Waiting, visible Close/Reopen lifecycle actions, confirmation correction, and the separate Site Visit completion fact; it suppresses its fallback booking link when the ranked Site Visit specialist action is already prominent. `ProjectCloseDialog` is the dedicated Lost/Cancelled/Complete presentation owner and uses explicit radio choices, consequence copy, exact destructive labels, native field semantics, and the existing focus-trapping modal. `useProjectWorkCommandController` owns stable command/feedback orchestration. The legacy command/action/history/task-sidebar owners and the generic state dropdown are retired. `projectWorkVisibilityPolicy` fails closed for Call and generic Site Visit work while allowing only a trusted server specialist key and canonical Schedule destination. All cache writes remain in `projectWorkCache`: `patchProjectCommandCentreCache` is the sole complete command-centre response patch owner, while projection fan-out, immediate Closed/Archived Work Queue removal, and shared invalidation retain their named owners there.

Work Queue may show one compact admin-only **Stale enquiry review** panel above the ranked queue. It is an operational review surface, not another work queue: it selects nothing by default, lists exact activity age/source, disables future-Waiting rows, and requires an exact second confirmation before the server-owned batch command. Its list and dialog stack at mobile widths, retain 44px controls, and never close from the read-only report itself.

### Dashboard data contract

- Project portfolio groups the nine canonical stages into Enquiry, Proposal, Confirmed, Delivery, and Settled. These are inventory phases, not health, readiness, or progress scores.
- Active, Waiting, Closed, and Archived counts come from `staff_project_state_counts_v1`; missing counts display unavailable rather than being inferred from stage.
- Recent Estimates lists the most recently updated non-archived draft estimates. Its displayed customer price is derived from `total_true_cost_ex_gst` through `calculateStaffCustomerPriceFromCostEx`, the same pricing sequence used by staff quote creation; `summary_json.total` is not treated as customer price.
- Work Queue preview is a bounded read of the same authoritative one-row-per-project queue used by the full Work Queue. It shows project, action, stage, and due group and links to the owning queue/project surface; lifecycle and commercial truth stay server-composed.
- My Tasks contains only the authenticated user's dashboard reminders. Recent Activity contains only non-deleted project notes attached to active projects.
- A separate New Leads list is intentionally absent because the canonical nine-stage pipeline already exposes the New inventory and the projects index owns the underlying records. Project Exceptions and install/starting-soon data are also absent from the staff home page. Margin, health, fake progress, notification counts, and inferred quote-readiness metrics remain out of scope until a canonical operational owner exists.

The canonical `/login` and `/access-status` routes use the same hard-edge Foundation tokens through `PublicAuthShell`; `/staff/login` remains a query-preserving redirect. Generic page-message and pending-state surfaces share that token owner, so authentication, failure, and loading states do not reintroduce the retired rounded-card layer.

### Instant route shell contract

`portalInstantRoutes.ts`, `PortalRouteTransition`, and the shared pending frames
own the small contract for warm portal page
changes. Dashboard, Projects, Contacts, Schedule, Work Queue, Drafting Queue,
Running Jobs, Calculator, and Project Detail render a truthful destination
header and structural frame synchronously while the persistent sidebar stays
mounted. Projects and Contacts retain their richer client-mounted index frames;
the other shared frames release when the new route commits. Client-mounted
completion is accepted only for the current instant-route identity; an older
route cannot dismiss a newer frame. Back/Forward clears pending progress and
instant state immediately. Same-page query changes such as Schedule
Board/Gantt do not replace usable route content and close the mobile drawer.

Navigation prefetch remains intent-only. It loads the exact route chunk and,
where one exists, only that route's lightweight current-user summary query.
Authoritative APIs, access-ending behavior, local-first queues, specialist lazy
modules, and background refresh remain with their existing owners. This is not
authority to persist broad portal data or duplicate database records in the
browser.

A future routine portal page should add its metadata and path recognition to
the instant-route registry, use the shared frame from its `loading.tsx`, and
preload only its exact safe route code from navigation intent. Add an
intent-preload query only when its owner does not expand every shared route's
bundle graph; otherwise let the route-owned query start after commit behind the
immediate frame. If the page needs a specialist frame or cannot truthfully
release on route commit, record that exception in the registry and cover it
with a focused transition test.

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
| Staff shell and navigation | `PortalShell`, navigation modules, instant-route registry/frame, semantic portal tokens, mobile drawer | Keep current expanded/collapsed/mobile behavior, focus ownership, truthful route-shell release rules, intent-only prefetch, and active compatibility tokens. |
| Dashboard | dashboard header, quick actions, pipeline, operational panels, activity and task owners | Preserve current hierarchy and data semantics; do not infer new metrics or restyle other routes from Dashboard. |
| Project Work Queue | Work Queue route/components plus `teamQueue.ts` and paginated list owner | Keep one row per project, direct marker/state ownership, server-owned precedence, durable command feedback, complete portfolio reachability, and the named rollout-not-ready state. Personal reminders remain separate. |
| Projects and Contacts | `StaffPageHeader`, `PageHeader`, shared controls/surfaces/statuses plus route-owned composition | Keep search, filters, pending states, cache/local-first behavior and page actions with their domain owners. |
| Project Detail and commercial tabs | detail header/tabs, operational patterns, quote/invoice/job-pack owners and specialist tab composition | Shared components do not move commercial, local-first, side-effect or lazy-boundary authority. |
| Calculator | specialist command, configuration, preview and save owners with current portal token/control integration | Do not flatten the specialist workspace into a generic page pattern or change costing/save behavior as UI cleanup. |
| Schedule and Tasks | `ScheduleBoardCards`, shared crew visibility, `ScheduleGanttModel`, `ScheduleGanttToolbar`, `ScheduleGanttTimeline`, dormant Site Visits owner, shared feedback and dialogs | Preserve responsive Board wrap/mobile carousel boundaries, the 12-week Gantt data range, specialist internal scroll owners, optimistic commands and legacy fallback isolation. Crew visibility and Needs attention are presentation filters only; they must not become access, installer-state, or Schedule-truth ownership. Do not make Site Visits a project-work source or destination. |
| Drafting Queue and Running Jobs | shared spreadsheet shell and route-owned spreadsheet presentation | Preserve zoom, local editing, internal scroll containment and field ownership. |
| Sanctuary AI activity | `AiActivityView` plus the gated synthetic fixture | Read-only evidence presentation only. Keep private inputs, identities, execution, provider/model calls, mutations, and production navigation outside this slice. |
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
- `npx vitest run test/playwright-support/portalRouteCatalog.test.ts` proves that the catalogue exactly matches all 47 `apps/portal/app/**/page.tsx` routes, including authenticated, public-auth, diagnostics, and redirect-only entries
- Browser matrix: 1440x1000, 1280x800, 1024x900, 768x1024, 390x844, and 720x500 with 200% zoom simulation. Assert document overflow, major-section overlap, cropped controls, heading semantics, focus return, reduced motion, and action/stage contrast.
- Portal browser specs use `playwright/support/portalBrowserEvidence.ts`. Named screenshot capture keeps the real caret state so evidence collection cannot introduce a hydration mismatch.
- `npx tsc -p apps/portal/tsconfig.json --noEmit --incremental false`
- `npm --prefix apps/portal run lint`
- `npm run build:portal`
- Authenticated desktop, tablet, and mobile review of `/staff/ui-foundation`
- Credential-free visual review may use `/qa/ui-foundation-fixture` only with the explicit portal QA flag; this must never replace staff-route auth smoke.

Finance navigation uses the existing sidebar/rail/drawer items and styling. Its visibility comes from the server-verified finance user identity, checked against the current authenticated client identity; a generic admin role is insufficient. Finance routes and commands retain independent current-grant checks. Invoice references in Finance lead to the project Commercial/invoices view. This addition does not expose developer connection controls or change the shell layout.

## Reading position in overlays (22 September 2026)

The shared Portal scroll lock now holds the document at its captured position with scrollbar compensation, rather than clamping root height and losing scroll. The existing Modal, Drawer and Schedule fullscreen consumers retain the same lock/unlock contract. Nested locks release only after the last close; original inline styles and scroll position are restored. This correction was found during the Marketing hub information-drawer review. Unit evidence includes nested locks/style restoration; browser evidence includes opening help below the fold, Escape/focus return and preserved reading position. No portal token or cross-route visual migration.

### Projects clarity pilot — earlier evidence (23 September 2026)

**Earlier version, superseded by the column/date refinement below:** implemented and independently reviewed in authenticated staging.
Foundation PR180 has merged after all checks; PR183 remains a separate,
unmerged review batch against main. Builder owns branch
`codex/projects-clarity-20260923`. No pilot production release or business-data
writes are authorised. Review PR183 is published and rebased onto merged main. Next boundary: owner
acceptance and explicit pilot release authority, with PR checks passing before
any merge. No further implementation approval is needed for material corrections. Focused 28-test suite also passed after rebasing onto
the refreshed Foundation head 6750b8c.

**Agreement:** find a project, identify its next attention, open detail and return
to the same list context. Reference: Marketing & Sales compact toolbar and
Foundation Apply/Cancel drawers. Existing StaffPageHeader, Drawer, Table, index
query/state controller, instant navigation and authoritative nextAction remain
owners. Live baseline had six selects before the table, attention beyond the
initial viewport and repeated reasons. Counts remain server-owned; no aggregates
from partial pages and no new business definitions. Detail remains the existing
workflow. Broader rollout waits for pilot acceptance.

**Verified implementation:** compact search/sort, draft filter drawer with
Apply/Cancel, removable applied choices, Next attention second in the table,
contextual supporting reasons, preserved existing edits/actions/access/error
owners. Pending and loaded states use the same toolbar/layout, preserving URL
choices and dimensions. Name and attention stay readable with horizontal overflow
contained in the table. No dependency, role or data-contract changes.

**Hosted candidate:**
https://sanctuary-portal-1hcf822gp-jordans-projects-43df95bd.vercel.app/staff/projects
Deployment `dpl_BqRc9Z26hSxyoLosZAsfS4H5ekRb` passed build/typecheck. This is the
normal staff route and API with 25 existing synthetic staging rehearsal projects,
not production reporting. Agent-managed authentication was verified separately in
the builder and independent review browsers. Earlier gytgaigdf and g42racwxh
previews are superseded.

**Technical evidence:** 28 focused tests across index, toolbar, attention cells,
loading shell and return-position owner passed; Portal typecheck, full lint,
architecture/docs guards and hosted build passed. Return tests cover page-three
serialization/remount and user isolation. Private evidence stays in ignored local
storage, explicitly excluded from deployment. Outgoing source/tests/guidance
contain no new customer payload, credentials or media.

**Independent delivery review:** no material blockers after corrections. Reviewer
caught a drawer event-isolation defect and mobile attention squeeze; both fixed
and independently rechecked. Quoting returned three records; project detail
showed the same next action; actual browser Back preserved filters, results and
scroll. Earlier below-fold return restored window Y 407.5 exactly. Tab/Escape
restore focus. At 390px, Name is 200px and Next attention 244px, with table-only
overflow and no document overflow. Pending-to-loaded controls retain selections,
chips and toolbar height. Builder also measured unchanged search top (127.5px)
after adding a filter chip.

Evidence supports 8/10 for outcome/usability/clarity, visual accessibility,
system fit/maintainability, recovery/security and handover within this read-only
pilot scope: authoritative controllers are retained, tested return and keyboard
paths work, and the authenticated preview is reviewable. Performance introduces
no new reads/integrations and the production build passes; no performance uplift
claimed. Human acceptance remains separate. Limits: only 25 staging records, so
browser page-two return is unverified; physical phone, induced read-failure and
live mutation journeys were not demonstrated. No business writes manufactured
coverage. The reviewer did not claim broader production readiness.

**Owner intervention and durable resolution:** on 23 September Jordan explicitly
rejected any further request to sign into Portal for agent work. This supersedes
the earlier owner-login request. Agents own access setup/recovery and must never
ask Jordan to log in. The cause was missed reuse of the existing private staging
helper, not missing owner capability. Reusing that method restored sessions with
no email, account creation, role/password change or weakened access control.
Workspace AGENTS records private helper locations; `docs/agent-playbook.md`
records the standing instruction without secrets. Separate preview origins are
agent setup work. If recovery exceeds authority, report the technical blocker
without assigning a login task to Jordan.

Continuity correction: the builder ended the access-recovery turn before
finishing the already-authorised Foundation merge and pilot PR publication.
Jordan had to prompt continuation. No new approval was needed; the existing
stage-continuation rule was missed. Work resumed with PR183 publication and
Foundation merge checks; authentication recovery alone did not finish the task.
The approved Foundation merge and separate pilot PR publication are now complete.


### Approved column/date refinement (23 September 2026)

Owner accepted six default columns: Project (client below), Stage (exception state
badge), Time in stage (age and exact date), Next action (due), Owner, and actions.
Keep contact details, editing, delivery, correction, archive/delete accessible in
contextual controls. Keep Journey as a filter. Add whole-result Longest in stage
and Next action due sorting; never sort only the visible page.

Evidence before implementation: staging has 39 projects and only three stage
change automation events. No stage timestamp column exists. AutomationRunner
stage events are idempotent by project/type/stage/primary ID, so they cannot prove
latest entry after repeat transitions; silent corrections also bypass that feed.
Decision: nullable database-owned stage_changed_at captured on future insert/stage
change, no historical backfill or updated_at substitution. Historical age Unknown.
An additive v4 read function preserves v3 consumers. Next-action ranking reuses
the authoritative full work queue with its existing completeness guards, passes
only dated project IDs into the bounded index sort, and reuses the same selected
action in displayed rows. Fail closed if source coverage exceeds existing limits.

Scope: same PR183, no production migration/release, no business-data backfill.
Staging schema rehearsal and disposable synthetic SQL checks support the preview.
Verified: six-column journey, contact edit/cancel, modal cancellation and focus
return, unknown/valid/future dates, Auckland day boundaries, global sorting before
paging, access denial, stable filter/return and independent delivery review.
Known dates and multi-page sort order are demonstrated in disposable tests, not
fabricated staging history. Live saves, physical-phone acceptance and
production-scale next-action-sort latency remain unverified. Owner need not sign in.

Overlap resolved: PR184 merged as bc7ac36 and owns migration 20260923030001.
This pilot uses 20260923040001. Main was merged into the pilot; v4 preserves the
exact OPEN predicate (unarchived ACTIVE/WAITING). A disposable database regression
checks both new sorts against 23 matching records from 25; independent review
confirmed filtering precedes sorting/paging. No other branch was edited.

Technical evidence: 128 tests across 26 focused files pass, including five real
SQL tests in disposable PGlite. Portal typecheck, full lint and hosted optimized
build passed before integration; final integrated build/checks are recorded with
the published revision. Stage capture handles insert, transition/re-entry,
unrelated edits and spoofed supplied dates. Existing historical rows remain null.
Staging additive schema rehearsal compared 39 records with zero business-row
changes and zero invented dates. The final v4 OPEN predicate was installed in
staging only. Production requires the ordered migration before application rollout.

Independent review caught drawer keyboard propagation, desktop overflow from
long project names, and focus returning to a removed menu item. All were fixed
and independently rechecked in the hosted UI. The final focus check covered phone
edit cancellation, drawer Escape, stage Cancel and archive Cancel: each returned
to a usable control/the persistent Actions trigger. No records were saved.
Desktop six-column fit, 390px table-only scrolling, readable menu, and Quoting +
Next action due -> detail -> Back with three matching results were demonstrated.

Assessment within this preview scope: outcome/correctness and system fit meet
8/10 through authoritative definitions, prospective timing and global SQL order;
usability/clarity/accessibility meet 8/10 through the independent task, layout and
keyboard evidence. Maintainability improves by extracting ProjectIndexActions
from ProjectsIndexClient while preserving existing mutation controllers. Security
and recovery retain staff/admin boundaries, denial checks and unknown evidence.
Production performance and physical-device/human acceptance remain unverified;
no uplift or complete live-write workflow is claimed. Handover requires the final
connected preview and fresh PR checks below; no production release is authorised.

Final hosted preview: https://sanctuary-portal-kfn546yab-jordans-projects-43df95bd.vercel.app/staff/projects
(`dpl_CJ2xEPZxzYw9f3Dwix1kfNoiRAvR`, integrated main plus the OPEN compatibility
patch). Optimized build/typecheck passed; builder opened the authenticated normal
route and verified all six headings and 25 existing synthetic staging records.
Prior g1sl0wqf0 preview holds the independent final focus evidence; UI source is
unchanged in the integrated candidate. This is staging, not production reporting.
The new SQL regression is included in the existing Project Work CI gate.

Publication review: inspected outgoing branch commits, final source/test/doc diff
and PR body for the existing GitHub audience. Only source, synthetic tests and
reusable guidance are included. No private logs, customer media, credentials or
auth helpers are tracked; private evidence is also explicitly deployment-excluded.
No screenshots or recordings are published. The review batch is published; the next authorised action is collecting its checks. Owner acceptance/release authority remains separate.

Final integration correction: the old v3 owner allowlist omitted Ellen and Dave,
although the current owner contract offers both. V4 now honours all six keys;
disposable SQL tests prove exact populations. Builder verified the normal staging
UI: OPEN has 24 records, OPEN + Ellen has 23, OPEN + Dave has none. Independent
source review compared the complete v4 against v3 plus OPEN and found no further
supported-contract omission. No rows were changed. The existing Project Work
gate passed 420 tests; its imported dashboard migration test now normalises the
new SQL payload to committed LF on Windows while retaining the deliberately CRLF
old-function scenario. Both SQL suites pass all 11 tests after the owner correction.
