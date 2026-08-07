# Local-First Sync

The portal uses local-first primitives for heavy staff editing flows where routine edits should feel instant while durable business state remains server-authoritative.

## Core Files

- `apps/portal/lib/localFirst/store.ts`: IndexedDB-backed persisted state, working copies, aliases, queue state.
- `apps/portal/lib/localFirst/storeEntityTransitions.ts`: conditional working-copy completion and explicit entity retry transitions.
- `apps/portal/lib/localFirst/storeSummary.ts`: runtime save/sign-out summaries derived from persisted state.
- `apps/portal/lib/localFirst/queue.ts`: mutation handler registry and queue processing.
- `apps/portal/lib/localFirst/runtime.ts`: runtime bootstrap.
- `apps/portal/lib/localFirst/portalEntities.ts`: portal entity keys, mutation keys, optimistic cache patch helpers, payload shapes.
- `apps/portal/lib/localFirst/contactDetails.ts`: Contact Detail draft ownership, stable entity keys, and coherent contact-cache patches.
- `apps/portal/lib/localFirst/projectDetails.ts`: Project Detail draft ownership, stable entity keys, and query-cache patches.
- `apps/portal/components/sync/LocalFirstRuntime.tsx`: starts runtime in the app.
- `apps/portal/components/sync/LocalFirstPortalMutations.tsx`: registers portal mutation handlers.

## Authenticated Owner Boundary

Persisted drafts and queued mutations belong to one authenticated user in the local-first store at `sanctuary-portal-local-first:v2:<userId>`. React Query is memory-only: server query responses, including quote, estimate, customer, and operational responses, are never hydrated from or written to durable browser storage. The retired `sanctuary-portal-react-query:v4:<userId>` key remains only in owner cleanup so older releases cannot leave data behind. Data-bearing providers mount only after a live role verification; a cached role may render the data-free shell but cannot mount owner data.

On logout, owner change, or verified access loss, the old queue runtime stops, removes online listeners, retry timers, and store subscribers, clears its in-memory QueryClient, and clears that owner's drafts, queue, theme, retired query cache, and sensitive legacy browser keys. The transition also starts a new document so Next's Router/RSC prefetch memory cannot cross the identity boundary. The next owner is not mounted unless its current session and role verify live. Calculator working copies inherit the local-first owner boundary and its physical session fallback key is `sanctuary-portal:calculator:draft:v2:<userId>:<draftScope>`.

Same-origin portal API `401` and `403` responses trigger a live session/role recheck even in specialist flows that use raw `fetch`. A `401` locks the owner data boundary during that check; a route-specific `403` does not delete drafts unless the live role read confirms whole-portal access was removed.

Sign-out is immediate when there is no retained work. If queued, syncing, offline, conflicted, failed, or draft work exists, the user must either remain signed in or explicitly confirm permanent local discard. Confirmed sign-out clears the departing owner's local data even if one browser backend reports a cleanup failure; access is never restored from a partly deleted cache.

## Mutation Keys

Current portal local-first mutations:

- `portal.project.details.update`
- `portal.contact.details.update`
- `portal.estimate.create`
- `portal.estimate.update`
- `portal.designRequest.create`
- `portal.quote.createFromEstimate`
- `portal.quote.updateDraft`
- `portal.estimate.notes.update`
- `portal.project.note.create`
- `portal.project.note.update`
- `portal.project.note.delete`

Add new mutation keys in `portalEntities.ts` and register a handler in `LocalFirstPortalMutations.tsx`.

The workbench breakaway does not add a mutation key and does not change estimate create/update request bodies. Workbench repricing is unavailable in this pass, so local-first estimate mutations continue to preserve existing calculator-backed pricing, provisional estimate aliases, queued dependent quote/design-request actions, retry visibility, `ESTIMATE_LOCKED` conflicts, and server-authoritative estimate persistence.

Future workbench-solved pricing enablement must stay a server-authoritative gate, not a browser-selected local-first mode. If a future save is blocked by source readiness, the local-first layer must surface that as a visible conflict for the affected estimate; it must not silently retry with calculator pricing, rewrite the requested source, alias a blocked create, queue dependent design work from a blocked create, or mark a blocked save as synced. Dependent quote/design-request mutations should remain queued or conflicted according to the existing alias/conflict rules until the durable estimate save succeeds.

## Working Copies

Working copies are local drafts scoped by stable entity keys. They allow UI to preserve unsaved or not-yet-synced work across route changes and reloads.

Use `useLocalWorkingCopy` for entity draft state. Use aliased sync helpers when UI must show pending, failed, or conflict state across provisional and durable IDs.

## Queue Semantics

- Mutations are enqueued locally first.
- Registered handlers process queued mutations and update server state.
- Successful mutations clear or alias local state as needed.
- Failed mutations should remain visible to the affected entity, not block the whole portal.
- Estimate and quote creates carry stable client intent IDs so a lost response replays the committed server record.
- Quote draft writes carry the last server-confirmed monotonic commercial revision. Only one draft save may be in flight for a quote; stale `409` or locked `423` responses become visible conflicts and refresh the authoritative quote rather than chaining optimistic overwrites.

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

Quote delivery is deliberately outside the mutation queue. Review/send first requires a durable quote ID, no dirty form state, no pending draft mutation, and the expected server revision. The browser retains only a stable delivery-intent hint; the server freezes the complete request, permits only one unfinished intent per action/quote version, exposes a redacted authenticated recovery review, and owns duplicate protection, provider checkpoints, finalisation, and delivery status.

For table/RPC ownership, write paths, access boundaries, and migration sources used by these server actions, see `docs/supabase-schema-map.md`.

## Current Surfaces

- Calculator estimate create/update.
- Project Estimates tab drawing and notes edits.
- Quotes tab draft creation/update.
- Design request creation.
- Contact/project cache patching around create/detail workflows.
- Project Details full-draft autosave, ordered retry, terminal rollback, and reviewable rejected working copies.
- Activity tab project notes (create/update/soft-delete).

Spreadsheet surfaces use their own optimistic editing helpers and should stay aligned with local-first UX expectations.

## Verification

```bash
npm run test:portal -- apps/portal/lib/localFirst
npm run test:portal -- apps/portal/components/sync/LocalFirstPortalMutations.test.tsx
npx vitest run apps/portal/lib/localFirst/runtime.test.ts apps/portal/components/auth/PortalAuthProvider.test.tsx
npm run test:portal
```

Current local signal from 2026-05-03: `npx vitest run apps/portal/lib/localFirst apps/portal/components/sync/LocalFirstPortalMutations.test.tsx apps/portal/lib/estimates apps/portal/app/api/estimates` passed with 12 files and 67 tests. The gate covers store persistence, queue processing, provisional-ID retry, alias resolution, conflict/discard behavior, estimate lock handling, and portal mutation handlers for estimate create/update, design request create, quote create/update, and estimate notes update.

Manually verify pending, failed, retry, and lock states for changed entity flows.

Before enabling future workbench-backed saved pricing, manual QA must include local-first estimate create/update under calculator pricing and blocked workbench-solved pricing, retry after a transient failure, durable ID alias resolution, dependent quote/design-request queue release, and `ESTIMATE_LOCKED` conflict handling for sent, accepted, and declined quote-backed estimates.
