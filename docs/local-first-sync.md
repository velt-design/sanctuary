# Local-First Sync

The portal uses local-first primitives for heavy staff editing flows where routine edits should feel instant while durable business state remains server-authoritative.

## Core Files

- `apps/portal/lib/localFirst/store.ts`: IndexedDB-backed persisted state, working copies, aliases, queue state.
- `apps/portal/lib/localFirst/queue.ts`: mutation handler registry and queue processing.
- `apps/portal/lib/localFirst/runtime.ts`: runtime bootstrap.
- `apps/portal/lib/localFirst/portalEntities.ts`: portal entity keys, mutation keys, optimistic cache patch helpers, payload shapes.
- `apps/portal/components/sync/LocalFirstRuntime.tsx`: starts runtime in the app.
- `apps/portal/components/sync/LocalFirstPortalMutations.tsx`: registers portal mutation handlers.

## Mutation Keys

Current portal local-first mutations:

- `portal.estimate.create`
- `portal.estimate.update`
- `portal.designRequest.create`
- `portal.quote.createFromEstimate`
- `portal.quote.updateDraft`
- `portal.estimate.notes.update`

Add new mutation keys in `portalEntities.ts` and register a handler in `LocalFirstPortalMutations.tsx`.

The `workbench_solved` pricing rollout prep does not add a mutation key and does not change estimate create/update request bodies. If future source metadata is added for live pricing, it must preserve provisional estimate aliases, queued dependent quote/design-request actions, retry visibility, `ESTIMATE_LOCKED` conflicts, and server-authoritative estimate persistence.

Future `workbench_solved` enablement must stay a server-authoritative gate, not a browser-selected local-first mode. The local-first layer may surface the server readiness failure for the affected estimate, but it must not silently retry with `calculator_live`, rewrite the requested source, or mark a blocked save as synced. Dependent quote/design-request mutations should remain queued or conflicted according to the existing alias/conflict rules until the durable estimate save succeeds.

## Working Copies

Working copies are local drafts scoped by stable entity keys. They allow UI to preserve unsaved or not-yet-synced work across route changes and reloads.

Use `useLocalWorkingCopy` for entity draft state. Use `useEntitySyncState` or aliased sync helpers when UI must show pending, failed, or conflict state.

## Queue Semantics

- Mutations are enqueued locally first.
- Registered handlers process queued mutations and update server state.
- Successful mutations clear or alias local state as needed.
- Failed mutations should remain visible to the affected entity, not block the whole portal.

## ID Aliases

Creates can start with local IDs. When the server returns a durable ID, register an alias so subsequent working copies and sync state resolve correctly.

Use alias helpers from `apps/portal/lib/localFirst/store.ts`.

## Server Authority

Local-first does not make the browser the only truth.

Server-authoritative actions include:

- Sending quote or invoice emails.
- Accepting, declining, or marking quote/invoice states.
- Schedule V2 mutations and RPC command writes.
- Admin access and cost configuration writes.
- Public token flows.

For table/RPC ownership, write paths, access boundaries, and migration sources used by these server actions, see `docs/supabase-schema-map.md`.

## Current Surfaces

- Calculator estimate create/update.
- Project Estimates tab drawing and notes edits.
- Quotes tab draft creation/update.
- Design request creation.
- Contact/project cache patching around create/detail workflows.

Spreadsheet surfaces use their own optimistic editing helpers and should stay aligned with local-first UX expectations.

## Verification

```bash
npm run test:portal -- apps/portal/lib/localFirst
npm run test:portal -- apps/portal/components/sync/LocalFirstPortalMutations.test.tsx
npm run test:portal
```

Current local signal from 2026-05-03: `npx vitest run apps/portal/lib/localFirst apps/portal/components/sync/LocalFirstPortalMutations.test.tsx apps/portal/lib/estimates apps/portal/app/api/estimates` passed with 12 files and 67 tests. The gate covers store persistence, queue processing, provisional-ID retry, alias resolution, conflict/discard behavior, estimate lock handling, and portal mutation handlers for estimate create/update, design request create, quote create/update, and estimate notes update.

Manually verify pending, failed, retry, and lock states for changed entity flows.

Before enabling workbench-backed saved pricing, manual QA must include local-first estimate create/update under both `calculator_live` and blocked `workbench_solved`, retry after a transient failure, durable ID alias resolution, dependent quote/design-request queue release, and `ESTIMATE_LOCKED` conflict handling for sent, accepted, and declined quote-backed estimates.
