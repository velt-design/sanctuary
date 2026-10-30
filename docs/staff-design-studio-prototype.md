# Design Studio staff trial

Studio is the active Portal editor. The Project header exposes one capability-gated
Design Studio action in place of the Workbench action. Existing Workbench URLs and
records remain supported; this release does not improve or remove that editor.
The Projects header retains progressive private-content loading and disabling.

## Current journey and owners

`/staff/projects/[projectId]/studio` lists saved designs and creates a base design.
`/staff/design-studio/[projectId]/[estimateId]/edit` owns authoring; the same route
without `/edit` owns Review, quote preparation and the client package. Staff/admin
identity and project access are checked freshly on the server. Middleware hints
only carry canonical routing and refreshed cookies, never access authority.

The ordinary Project saved-design list, bookmarks, source-design action and
revision/duplicate actions route Studio rows back to Studio. Untyped rehydrated
metadata must be refreshed before choosing an editor, and current Project
readiness remains required. Current-design summaries use authored Studio output
or the exact frozen quote view, with no legacy Calculator fallback when a Studio
binding is unavailable. Quote detail displays its frozen selections and keeps
Studio line descriptions out of the legacy structured-pergola editor.

`/api/projects/[projectId]/site-address` owns bounded address GET/POST with fresh
staff/project access, same-origin browser writes and a canonical two-column CAS.
The separate POST `/site-travel` verifies selected-address proof, current project
destination and signing authority before its Routes request. Provider adapters
retain 6.5-second address and 10-second travel deadlines, request abort and no
automatic retries. A round trip uses one computeRoutes request with two legs.
`GOOGLE_ROUTES_API_KEY` falls back to `GOOGLE_PLACES_API_KEY` only when unset;
the server also requires a 32-byte `STUDIO_TRAVEL_SIGNING_KEY`. No provider key or
raw response is exposed in client state. These runtime URL owners are required
alongside the static imports; import-only closure is not completeness proof.

`components/designStudio` owns interaction and recovery. `lib/designStudio` owns
strict authored/spatial projections, saved revision commands, current published
costing, verified site/travel inputs, immutable quote snapshots and document
projection. `packages/configurator` owns website/react/server contracts;
`packages/geometry` owns solved geometry. Studio does not store its source in
Workbench presentation state or make a browser image authoritative for price.
Shared drawing adapters retain their existing consumers and support Studio
house/attachment composition without removing legacy persisted inputs.

The quote is a separate mandatory financial PDF. The optional design booklet
contains approved technical sheets without a new cover, register or financial
pages. Selected frozen render assets append full pages to that booklet only,
with the existing Sanctuary footer, project/design identity, Concept view and
NTS. Unchecked renders are omitted; renders are never loose attachments. Separate
project files retain their original owner and are imported as immutable exact
artifacts before preparation. The financial PDF and chosen booklet cannot be
selected again as separate files.

Package recipient, subject, message, document choice, ordered render selections
and separate files persist with compare-and-swap revisions. Selection starts
document work immediately. Pending selection keeps the prior preview honestly
labelled and prevents a stale target download or preparation. Polls cannot adopt
a newer revision over unsaved local text; retry/navigation drains pending saves
or preserves an explicit conflict. Quote download remains usable while an
optional booklet runs or fails. Compact PDF Fit uses the actual scroll viewport
width and a naturally sized page-height budget; explicit zoom permits scrolling.

Deliberate Prepare freezes the canonical rendered HTML/text, recipient and exact
attachment identities/hashes. Preview redacts acceptance tokens in returned
content. Editing a prepared package first cancels only its exact attempt-zero,
unaccepted intent and restores a draft only if no newer quote exists. Dispatch
refuses cancelled intents. Unknown or provider-accepted states are immutable.

## Trial admission and delivery restriction

The application requires `ENABLE_PORTAL_DESIGN_STUDIO=1` and
`ENABLE_STUDIO_CLIENT_DOCUMENTS=1`. The private
`studio_client_document_control` remains disabled by default, with
`project_scope=explicit_projects`. That mode retains the explicit project list
for bounded tests. Operators may separately select `staff_trial` for normal
staff-authorised new and existing projects. No browser flag admits a project.
`STUDIO_DOCUMENT_STAFF_TRIAL_ENABLED=true` in the app rejects the obsolete image
quote preparation path rather than silently falling back when documents are off.

The separate document worker requires `STUDIO_DOCUMENT_WORKER_ENABLED=true`,
the exact `studio_design_booklet_v1` claim kind and an explicit supported manifest
capability. Staff trial additionally requires
`STUDIO_DOCUMENT_STAFF_TRIAL_ENABLED=true` and no static project IDs. Its
service-only RPC holds the admission row through the canonical claim, selects at
most 32 currently eligible projects per poll, and checks kind, contract, source
capability and current admission before queue visibility/read-count mutation.
An empty eligible set means zero claims. It cannot fall back to all jobs or run
enquiry or Xero handlers. Disabling the control stops new trial claims; worker
source reads also enforce current admission. Existing checkpoints support resume.

Customer email sending is disabled during this trial. The app refuses all Studio
send/resend/recovery paths using immutable quote provenance or the selected
frozen package intent, and summaries are nonretryable. The canonical database
dispatch boundary independently requires the private
`customer_send_enabled` switch, default false, for those intents. This restriction
survives application rollback. Prepare, read, preview and safe cancel remain
available. Ordinary unrelated quote, invoice and enquiry delivery is unchanged.
Future permission requires a separate owner decision and deliberate server
configuration; setting one application flag alone cannot enable sending.

Standalone aluminium and infill quote descriptions use the validated customer
selections, including chosen profile/dimensions/finish/quantity. Separately priced
blinds and exclusions remain separate. This changes customer scope text only,
with no rates, totals, GST, discounts or historical document changes.

## Installation and verification

Apply only the reviewed missing Studio dependency chain, followed by forward
`20261030020837_studio_designer_staff_trial_scope.sql`. The complete chain must
commit atomically: Studio kind registration and the scoped migration's existing
eight-kind v1 metrics projection protect older finance workers during rollout.
Do not use a blanket historical migration push or edit applied source. All
controls start dark. Production catalogue, constraints, exact definitions,
permissions and old metrics projection must be reconciled before application.

The additional `studio_designer_atomic_install` batch is the exact reviewed
production installer retained for the MCP tool's server-assigned migration
version. It installs all 17 missing canonical sources atomically, records their
exact statement vectors, verifies/no-ops when all are present, and refuses a
partial set. Its schema/ACL checks bind the actual production PostgreSQL 17
catalogue, including MAINTAIN privileges. It is not a claim that a fresh PG15
reset or controlled PGlite fixture reproduces production. Keep the original 17
canonical files and their normal tests. Before merge, the provisional batch
filename must use the actual server-observed version; its executed bytes remain
unchanged and the final head must pass required CI. No empty alias, historical
ledger rewrite or independently committed kind-registration gap is permitted.

The worker Docker build uses the workspace lock and bundles the same Node
renderer. Its asset-copy step includes three Inter fonts and their OFL licence,
plus the bundled fontkit MIT notice. Its isolated memory/heartbeat envelope needs
qualification on the actual host; local tests do not establish hosting capacity.

Focused tests cover authored persistence/conflicts, financial authority, package
selection/recovery, exact prepared payloads, token redaction, PDF fit, schema
invariants and bounded trial claims. The PGlite trial fixture executes the actual
forward migration and scoped readers but stubs the foundation lease, uses one
connection and establishes neither production concurrency nor provider delivery.
Use the normal Next build/type gate and the current Portal budget script: five
active routes retain their original thresholds and Workbench remains a retired,
non-enforced diagnostic. Calculator save previews use the lightweight Calculator
mapper, which refuses Studio inputs. Generic Project quote preparation and server
creation retain the full strict Studio source validator. Use fresh compiled
worker/assets, independent source review and a representative connected staff
journey before claiming the release verified. Keep real data, credentials,
acceptance tokens and operational evidence outside repository payloads.
