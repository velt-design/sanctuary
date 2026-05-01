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

Manually verify pending, failed, retry, and lock states for changed entity flows.
