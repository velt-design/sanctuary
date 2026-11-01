# Design Studio staff trial

Studio is the active Portal editor. The Project header exposes one capability-gated
Design Studio action in place of the Workbench action. Existing Workbench URLs and
records remain supported; this release does not improve or remove that editor.
The Projects header retains progressive private-content loading and disabling.

## Current journey and owners

`/staff/projects/[projectId]/studio` is now a direct-entry resolver, not a landing
form. Its server GET reads only. The browser opens the last explicitly selected
visible, non-archived design for that actor and project, or the canonical current
base draft. Quoted designs open in Review; their frozen design and quote stay
protected. Add-ons are a deliberate selection, not a newer-row override of base.
An empty successful project inventory starts one default-named base design with a
freestanding 6 x 3 m pitched pergola through
the existing retained creation journal. The same Web Lock rechecks fresh inventory
before staging, so two tabs cannot both create from stale empty data. Failed list
or quote-history reads show Retry and never create a blank.

The current title is editable inside Studio. Naming reuses the existing commercial
name dialog and metadata-only estimate PATCH. Save-before-rename and a fenced
working-copy/journal check protect unsaved, pending and recovery work, including
when naming from Review or Quote. After confirmation the same document reopens:
the existing fully acknowledged clean-cache restore adopts the metadata timestamp.
Dirty content is never silently rebased or discarded.
After a dispatched name command, an unknown response or failed navigation keeps
the old editor fenced. Reopen saved design checks the exact current source and
re-enters fresh admission without resending the name PATCH. Back to Project is
also available. Dialog dismissal and selector refresh cannot clear this recovery;
only actual actor/project/document retirement releases its owned fence.
The live Studio frame adopts that same ready, actor/project/estimate-bound
preparation before PATCH. Masking, native failure and Continue use one fence;
fresh server admission still owns the existing post-commit release after the old
controller cleans up. The frame refuses failed, non-owned or mismatched preparations.
The inventory GET and its browser requests explicitly use private/no-store.
Design/Review/Quote share a
compact Designs selector and bounded history popover. Switching and New actions
use the existing local navigation drain. New option and New add-on are available
inside that selector. Each explicit New action owns a durable URL request nonce;
reload, Back and unconfirmed outcomes reconcile the same request, and successful
creation replaces the transient entry URL. Edit a new revision uses the selected
source's current revision and opens the new editable design without changing the
quoted source. The Quote header exposes that action beside Download PDF.

`/staff/design-studio/[projectId]/[estimateId]/edit` owns authoring; the same route
without `/edit` owns Review, quote preparation and the client package. Staff/admin
identity and project access are checked freshly on the server. Middleware hints
only carry canonical routing and refreshed cookies, never access authority.

Incremental implementation map: `projectDesigns.ts` owns selection/routing hints;
`loadStudioProject` and GET `/api/projects/[projectId]/studio` own fresh caller-RLS
inventory and existing quote-flow authority. `StudioProjectEntry` resolves entry;
`StudioCreateAction` retains creation, locking, exact replay and automatic opening.
`StudioDesignSelector` owns the shared header/popover; `renameDesign.ts` coordinates
the existing metadata name command with local preservation and fresh reopening.
Direct-entry navigation retains the existing worker, pricing, document and email
contracts. The authoring changes below add an explicit geometry selection and
the narrowly expanded creation predicate described below, using the existing
commercial and document owners.
Representative project size is 1–20 saved versions/options. Entry/selector refresh
uses one metadata request, backed by project, estimate and quote-flow reads; no
per-frame or per-keystroke list request is added. Existing all-row version labels
remain canonical. Fixture response timings are not production latency evidence.

### Studio authoring feedback, 2 November 2026

New base/options use `newDesignSeed` only in canonical blank creation. Add-on
scopes remain empty for accessory-only work; clones/revisions preserve their
exact source, including saved empty designs. `newHousePlacement` derives a clear
world-space gap from the occupied physical envelope; `houseEditing` converts that
world position to the existing rectangle composition origin. Adding an object
fits the existing camera once; later edits and moves preserve the user's view.
Soffit bracket meshes inherit frame finish in the live scene and quote capture.

The forward `studio_base_creation_seed` migration is required before enabling
this new creation code. It updates only the existing creation function's blank
predicate: exact historical empty pairs remain valid, and base scope additionally
accepts the exact canonical starter pair. Receipt replay, clone/import source
proof, role/project checks, locking, function owner and ACL stay intact. Applied
migrations and the historical atomic installer remain unchanged. Local execution
tests establish old-function refusal then forward acceptance; this is not a
claim of staging/production installation or concurrent database verification.

Mixed roofs opt into `finish.studioPanels` version 1 with an exact TOTAL count and
product-local side. Front is the existing Sides/Blinds outer +Y edge, Back/Rear
is -Y, Left is -X and Right is +X; world rotation/camera do not change the choice.
Full fall-length sheets are retained. Jordan chose "Keep full-length panels, with
front/back available on gables (Recommended)" on 2 November. A single-slope roof
offers Left/Right and explains why Front/Back needs a gable. A chosen gable face
has its own exact limit, with no silent spill to the opposite face. Legacy bands
display their actual arrangement/count without migrating on open. Explicit
choices are never clamped on resize. `representativeStudioRoofPanels` owns the
620mm bay allocation; the existing costing adapter reads the actual built panel
counts per plane, including explicit zero on the unselected slope. Rates and
historical public defaults are unchanged. Frozen document sources carry the
already-built assembly/covering, not a new worker solve or selection protocol.

Gate0: legacy audit rows N/A. This extends the active Studio geometry path under
the owner's explicit 2 November request; no retired Workbench UI is improved.
House composition remains rectangle-owned. There is no cost input migration or
`inputs.modules` dependency, and no consolidation drops fields. Consumers checked:
website contract parse/serialize and finish constraints, Studio raw/edit/save/
revision projection, roof solve and Plan/3D, commercial per-plane counts, quote
descriptions/capture and immutable document-source consumers. Missing optional
Studio selection retains historical/public equal-third/half geometry.

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
