# Drafting Queue

The Drafting Queue is the portal replacement for the old operational design spreadsheet.

## Ownership

- Page route: `/staff/projects/design-packages`.
- Client adapter: `apps/portal/app/staff/projects/design-packages/useDesignListSpreadsheetAdapter.tsx`.
- Server/domain helpers: `apps/portal/lib/designPackages`.
- Staff APIs: `apps/portal/app/api/staff/v1/design-packages`.
- Schema migration: `supabase/migrations/20260317_000001_design_package_requests.sql`.
- Legacy generic project-task mirroring is retired; Design Package requests remain owned by the Design Package domain.
- Schema ownership map: `docs/supabase-schema-map.md`.

The route and internal module names still use `design-packages`, but the user-facing page name is Drafting Queue.

## Data Model

`design_package_requests` is the canonical request source. Requests are estimate-backed except legacy backfill rows.

Important request fields include:

- Project and estimate IDs.
- Request version/source.
- Priority tier.
- Designer.
- Status.
- Notes.
- Due/completed timestamps.

## Columns

Column config lives in `apps/portal/lib/designPackages/columns.ts`.

- A Date: request date, read-only.
- B Client name: request/project derived, frozen, read-only.
- C Site visit rep: visit-derived, read-only.
- D Designer: request-owned, editable.
- E Design ready: request status, editable.
- F Priority: derived/request priority, editable.
- G Sent: quote-derived, read-only.
- H Visited: visit-derived, read-only.
- I Notes: request-owned, editable.

## Write Behavior

Cell writes go through:

```text
POST /api/staff/v1/design-packages/cell
```

Request creation goes through:

```text
POST /api/staff/v1/design-packages/request
```

Request actions include start and mark done routes under:

```text
/api/staff/v1/design-packages/[requestId]/action
```

Keep writes scoped to request-owned fields. Quote and visit columns are read-only projections.

Creating, starting, reprioritising, completing, or cancelling a request updates the canonical `design_package_requests` record through the Design Package server owner. These actions no longer create or mirror a generic legacy project task; Drafting Queue behavior and request ownership are otherwise unchanged.

## Spreadsheet Behavior

The Drafting Queue shares the spreadsheet shell with Running Jobs. It should keep:

- The shared searchable staff header when rendered as a standalone route; embedded spreadsheet surfaces remain headerless.
- Spreadsheet keyboard/navigation behavior.
- Optimistic cell editing.
- Conflict-aware saves.
- Stable column widths.
- Grouping/sorting from domain helpers.

## Verification

```bash
npm run test:portal -- apps/portal/lib/designPackages
npm run test:portal -- apps/portal/app/staff/projects/design-packages
npm run test:portal
```

Manual checks:

- Load `/staff/projects/design-packages`.
- Edit Designer, Design ready, Priority, and Notes.
- Confirm quote sent and visit fields remain read-only.
- Confirm request creation from calculator or estimate tab appears in the list.
