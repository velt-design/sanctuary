# Staff Portal UI Foundation

Status: Current foundation contract.

## Scope

`/staff/ui-foundation` is the protected live catalogue for the staff portal's next shared visual system. It renders the same reusable exports that future portal screens should consume; it is not a parallel collection of demonstration-only markup.

The production-hardening phase is intentionally narrow. Projects Index and the Project Detail shell plus Overview details editor are the representative consumers; other portal screens and legacy `PortalSurface` styles remain unchanged until a separately approved rollout.

## Owners

- Semantic tokens: `apps/portal/components/ui/foundation/foundation.tokens.css`
- Reusable controls and form fields: `apps/portal/components/ui/foundation/FoundationControls.tsx`
- Server-compatible cards, badges, tables, empty/loading states, and sticky actions: `apps/portal/components/ui/foundation/FoundationSurfaces.tsx`
- Interactive pagination, search/filter, selectable-table, destructive-confirmation, and unsaved-change owners: their named modules in `apps/portal/components/ui/foundation/`
- Information, warning, error/blocking, data-state, calculator, financial, permission, and task/schedule feedback: `apps/portal/components/ui/foundation/FoundationFeedback.tsx`
- Focus-managed portal drawer: `apps/portal/components/ui/drawer/Drawer.tsx`; focus trap shared with the existing modal through `apps/portal/components/ui/focusTrap.ts`
- Keyboard-operable overflow menu: `apps/portal/components/ui/foundation/OverflowMenu.tsx`
- Project stages and commercial statuses: `apps/portal/components/ui/foundation/SanctuaryStatus.tsx`
- Dashboard, index, and detail header variants: `apps/portal/components/layout/PageHeader.tsx`
- Catalogue route: `apps/portal/app/staff/ui-foundation/**`
- Data-free visual QA mirror: `apps/portal/app/qa/ui-foundation-fixture/page.tsx` (404 unless `ENABLE_PORTAL_QA_FIXTURES=1`)

## Visual Contract

- Inter owns operational UI text. Barlow Condensed is reserved for selected headings and major metrics.
- Dashboard display type is only available through `PageHeader`'s explicit `dashboard` variant.
- Index titles are 34-36px; detail titles are 26-28px.
- Working surfaces are warm off-white; structure is black; orange is reserved for primary action, active/current stage, and selected data.
- Panels are square, controls use 2px radii, and overlays use 4px radii.
- Borders and tonal contrast replace general card shadows.
- Spacing uses a 4px foundation. Standard and compact density are scoped with `data-ui-density`.
- Lucide outline icons, native form semantics, keyboard operation, and visible focus states are required.
- Project stages come from `lib/projects/pipelineDefinition.ts`; components must not duplicate workflow order.
- Quote and estimate badges accept canonical `QuoteStatus` and `EstimateStatus` types directly. Their exhaustive presentation maps are the only commercial status display mapping in the foundation.
- Action orange uses a dark semantic foreground. Reduced-motion mode stops spinners and shimmer and removes non-essential pressed transforms.
- The actual `PortalShell` owns expanded and collapsed desktop navigation plus a 56px mobile top bar and focus-managed drawer. Each sidebar destination has one keyboard focus stop.

## Production Patterns

The catalogue renders the actual exported search/filter bar, selection table, pagination, modal, drawer, alerts, data states, permission/read-only controls, calculator notices, NZD financial summary, task/schedule feedback, and sticky action bar. Forced interaction states stay in catalogue markup via `data-visual-state`; they are not component props. Demo-only helpers are not exported.

Projects Index consumes the index `PageHeader`, `ButtonLink`, `SearchFilterBar`, `ProjectStageBadge`, `LoadingSkeleton`, and `DataStatePanel` while retaining its existing query, preload, optimistic mutation, archive-scope, and retry owners. Project Detail consumes the detail `PageHeader`, stage badge/tracker, shared controls, alerts, and unsaved-change guard while retaining lazy tabs and the existing local-first details draft owner.

## Change Rules

- Prefer semantic `--ui-*` roles over raw colour or spacing values in new foundation consumers.
- Keep old portal tokens compatibility-owned until a production-screen migration explicitly replaces them.
- Add a catalogue example and focused test when adding a public primitive variant.
- Update `playwright/support/portalRouteCatalog.ts` if the route contract changes.
- Do not use the catalogue as approval to broadly restyle existing portal screens.

## Verification

- `npx vitest run apps/portal/components/ui/foundation apps/portal/components/layout/PageHeader.test.tsx apps/portal/app/staff/ui-foundation`
- `npx playwright test playwright/portal.ui-foundation.spec.ts --project=portal-chromium`
- Browser matrix: 1440x1000, 1280x800, 1024x900, 768x1024, 390x844, and 720x500 with 200% zoom simulation. Assert document overflow, major-section overlap, cropped controls, heading semantics, focus return, reduced motion, and action/stage contrast.
- `npx tsc -p apps/portal/tsconfig.json --noEmit --incremental false`
- `npm --prefix apps/portal run lint`
- `npm run build:portal`
- Authenticated desktop, tablet, and mobile review of `/staff/ui-foundation`
- Credential-free visual review may use `/qa/ui-foundation-fixture` only with the explicit portal QA flag; this must never replace staff-route auth smoke.
