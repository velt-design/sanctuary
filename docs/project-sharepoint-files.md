# Project SharePoint files

Status: Dedicated Files, protected recent-preview verification, open-only authentication deduplication and the workspace test dependency correction are live as of 23 October 2026. The combined Singapore release regressed both representative first opens despite lower authentication time. A narrow local recovery returns only the open route to Sydney, retaining every current session/RPC/Graph check and the dependency fix. The owner's almost-instant outcome remains unmet; recovery performance is unverified. Large original delivery retains its separate acceptance requirement. No bindings, grants, provisioning or staff changeover changes.

## Outcome and ownership

The owner's request is to link SharePoint files to their Portal projects and automatically prepare project folders for new enquiries, while leaving staff changeover for later. The main project **Files** tab includes verified SharePoint roots and preserves website enquiry attachments. Multiple roots can belong to one project. Runtime/import requires an explicit project UUID and verified SharePoint item identity; there is no runtime name-based auto-matching. Private preparation records the evidence used for each proposed identity, which may include a unique exact full-name match in its dated context rather than an independently confirmed street address.

SharePoint remains the file authority. Portal stores explicit drive/item/project bindings and provisioning state, not copies or public links. Staff can navigate folders, page through results, open PDF and raster image previews, and download originals including Rhino. Files beyond the 50 MB inline preview limit remain downloadable. SVG and HTML are download-only. This does not merge the historical unassigned files, copy website attachments into SharePoint, or move current folders when a project changes stage.

Implementation map:

| Surface | Owner |
| --- | --- |
| Main Files route and available-screen layout | `projectTabs`, `ProjectMainTabs`, `tabs/FilesTab` |
| Staff project Files UI | Existing `ProjectSharePointFilesPanel`, in workspace mode |
| Folder reads, finding and continuity | `useProjectFilesExplorer`, `useProjectFilesListPosition`, `projectFilesNavigation`, domain `client.ts` |
| Protected recent-preview verification contract | `previewVerification.ts`, existing open route and `useProjectFilePreview` |
| Selected PDF/raster content | `ProjectFilePreview`, `useProjectFilePreview`, bounded `projectFilePreviewCache`, `ProjectPdfStream`, existing `QuotePdfInlinePreview` renderer |
| Current-project preparation and freshness | `useProjectFilesPreparation`, shared domain `query.ts`, existing authenticated-owner QueryClient |
| Open identity and current staff proof | `openIdentity.ts` retains fresh `getUser`; the same user-bound client calls existing `project_files_read` for current staff/project/root authority |
| Authenticated reads and file access | `apps/portal/app/api/staff/v1/projects/[projectId]/files` and `lib/projects/sharePointFiles/server.ts` |
| Microsoft source and ancestry checks | `graph.ts`, `graphProtocol.ts`, `graphContainment.ts`; assertion-scoped `accessToken.ts` owns bearer reuse |
| New enquiry folder job | `lib/projects/sharePointFiles/provision.ts`, `api/integrations/sharepoint-project-folders` |
| Private state, grants and atomic enqueue | `supabase/migrations/20261022090001_project_sharepoint_files.sql` |
| Verified existing-folder import | `scripts/sharepoint-project-files.ts`, domain `import.ts` |

## Explorer interaction and finding

Jordan selected folders, list and preview together after the local exploration.
On 22 October he approved Files as its own main project tab. The dedicated
`?tab=files` view fills the available width and remaining viewport height below
the project masthead. Overview retains Work and Original enquiry plus a Files
shortcut; it never expands its columns to host the browser. List and selected
preview scroll within the workspace, including after snapshot notices change
height. Narrow layouts retain the existing expanded preview dialog.
The project Files tab now has a persistent folder rail, compact file list and
adjacent selected-file actions/preview. Narrow containers retain the list and use
the existing Foundation dialog. The source chooser retains multiple verified
roots and website enquiry files; website attachment reads wait until selected.
Folder links and breadcrumbs navigate one folder; bounded preparation described below may already have read its first page. Source MIME metadata permits
photo next/previous among the loaded folder's previewable images. There is no
thumbnail index or whole-project crawl.

Finding covers the current folder across actual provider cursor pages. It first
filters resident metadata, then reads at most three further pages per pass.
Partial results say more files are available, including when no match has yet
been found. Continue finding explicitly reads another bounded pass. A complete
result means that folder's final cursor was reached, not that SharePoint cannot
change later. Each provider page contains at most 100 metadata items; these are
real source pages, not synthetic display pagination. No Microsoft search API or
broader permission is introduced. Refresh revalidates the current loaded pages
and root navigation. Very large folders can require repeated continuation and
the provider's listing is not an atomic snapshot across pages.

The authenticated-owner QueryClient retains metadata with a five-minute
freshness window, approved by the owner on 22 October. Manual Refresh bypasses
this lease. Initial default-root data seeds the equivalent
explicit-root key, avoiding a needless return request. Fresh returns reuse data;
stale returns revalidate. Abort signals, scope/scan guards and selection-tagged
preview results keep late folder/file responses from replacing current content.
Denied or failed reads hide cached file actions and offer truthful recovery.

User/host/project-scoped session navigation stores only bounded root/trail IDs
and names, selected ID, current finding text, loaded-page counts and scroll
positions. The main Files/Overview choice is URL-owned; Overview stores only its
Work/Original enquiry choice. Earlier saved nested Files choices resolve to Work. No document bytes, signed
URLs, tokens or provider cursors enter durable storage. Reload reads fresh source
metadata and restores up to ten saved pages automatically; deeper positions need
continuation. Same-URL history entries preserve existing Next state and support
folder Back/Forward without adding project query keys or changing canonical
document routing/auth eligibility. The existing auth-owner QueryClient boundary
remains authoritative; a different owner receives separate keys and navigation.

Scroll restoration waits for the saved metadata pages and sufficient rendered
extent. A first-page browser clamp cannot overwrite the intended deep offset;
partial failures retain it for retry. Beyond the ten-page automatic budget it
waits for explicit continuation, while deliberate wheel/touch/pointer/keyboard
interaction gives scrolling back to the user. Finding has its own scoped offset,
so a temporary filtered list does not destroy the unfiltered folder position.
Completed shorter source listings may legitimately clamp to their new end.
Preview controls persist through expanded gallery selection; close returns
focus without scrolling to the current Expand control or narrow selected row.
This stays local to Files and reuses the shared Modal focus trap unchanged.

The selected preview uses one protected body fetch. PDF parser code is prepared
alongside the active project's metadata; its worker starts when a PDF preview opens.
PDF.js receives progressive copies from that same stream rather than issuing
repeated protected range reads.
Documents without a reliable content length use the existing complete-byte
renderer. Progressive first-page display depends on the PDF's structure; the
local non-linearized fixture does not establish first paint before body completion.
Inspector and dialog share the same request. Selection changes abort the prior
read and revoke its object URL. Actual response MIME and the 50 MB byte cap are
checked before rendering. Download remains an authenticated native link to the
original redirect route, including large Rhino. No original is fetched in the
background or given a simulated completion message.

Files is a dedicated main project view beneath the shared masthead. It fills
the available project width and remaining viewport height, while commercial,
contact and correspondence cards remain in Overview. The old selected-panel
CSS that expanded the Overview row is removed. Narrower widths retain the
existing list/modal layout. Responsive evidence must include the actual
`ProjectPageFrame`, main-tab routing and outer `PageLayout`/Portal shell sizing,
including entry from a scrolled Overview, history return and reload. The local
fixture mounts those component owners and production sizing CSS with synthetic
file/source boundaries and surrounding context; it does not establish live
Microsoft delivery or performance. Earlier Overview-row receipts describe the
superseded embedded arrangement, not acceptance of this main-tab layout.

## Prepared browsing and recent previews

The target is prepared lists in 100–300 ms, useful ordinary new PDF/photo content
in 0.5–1 second and effectively immediate recent-file return. These are task
acceptance targets, not measured production claims. SharePoint remains authoritative.
The approved five-minute allowance applies to prepared lists and previously
opened previews, not new downloads or a new file's first content read.

Preparation starts with an authenticated staff/admin route project ID alongside
the snapshot. It reads at most that project's root, saved folder and first two
root folders' first pages, sharing exact owner/host/project/root/folder query
keys with Files. Root/saved reads can overlap; the two child reads start after
the root response. Folder pointer/focus intent is debounced 120 ms and cancels a
previous unobserved speculative read. Project/owner/access changes cancel owned
preparation; list/open request cancellation propagates to request-owned Graph
and content fetches. A shared bounded token exchange may finish independently.
There is no all-project polling, whole-tree traversal or background body download.

An instance-local bearer map reuses only an exact assertion already accepted by
Entra, scoped to source binding/tenant/client and bounded to eight entries.
Expiry is the earlier assertion expiry or supported token `expires_in`, less a
one-minute margin. Missing usable lifetimes preserve direct exchange behavior.
Concurrent identical exchanges coalesce; failures and Graph 401/403 invalidate
the relevant generation. Every server request still performs current staff,
project and source-binding checks. No decoded assertion grants first-time access.

Recent complete preview bytes live only in the current QueryClient's memory:
at most eight files and 32 MiB total, with a five-minute lease. They are scoped
to owner/host/project/root/item and a strong source version. No bytes, tokens or
signed URLs enter durable browser storage or another service. A body enters this
memory only if its actual origin strong ETag exactly matches the fresh Graph
eTag/cTag. Weak/missing/mismatched origin tags still permit fresh rendering but
prevent reuse. This also covers a source change between metadata and transfer.
Live `9411232a` verified matching strong origin/Graph versions for a representative photo and PDF. That establishes compatibility for those observations, not every file or future source response.

A recent preview displays immediately while its protected route checks current
authorization, root containment, type, size and source version. Only then may the
route return a small protected 200 JSON receipt without resolving another transport URL or transferring file bytes. The request uses `x-project-file-preview-version`, never HTTP `If-None-Match`. The strict receipt binds the current project/root/item, strong version, MIME, byte size and current name to the resident; malformed, mismatched or unexpected 304 responses fail closed.
Changed versions replace content; observed deletion, missing root, failed read
or lost access hides/purges affected previews and offers retry. Any failed body
recheck clears that project's recent memory, including source access errors
mapped to 503. Logout/owner change clears the owner store. Refresh rechecks both
metadata and the selected body; stale responses cannot replace another selection.
Original downloads always perform current checks and retain native delivery.

Live `9411232a` exposed a platform boundary: Vercel stripped the custom verification
header from 304 responses, causing a valid recent PDF to disappear after its
recheck. Bare 304/ETag is insufficient proof because an intermediary can generate
it from an unverified 200 body. The correction therefore uses the authenticated 200
JSON receipt above, which carries no signed URL or file body. The separate local
platform model reproduces header-stripped 304 and conditional rewriting. Actual
`0de9bf77` acceptance verified recent photo/PDF 200 receipts and manual Refresh.
First photo/PDF headers were about 3.1/2.9 seconds, with application time about
2.5/2.3 seconds; current metadata proof, optional content redirect and source
headers account for the measured work. The exact decoded bodies rendered, but
aborted transport reporting does not establish native completion or exact paint.
The first-new-file speed goal remains unmet. Prepared navigation avoided extra
source reads. The receipt fix adds no new body prefetch, authority cache or durable copy.

### Workspace dependency verification

The actor-bound open-access test imports PGlite to execute the actual SQL locally.
Portal now declares that test tool as a development dependency at the exact
existing repository version, `0.5.4`, with its workspace lock entry. Root/Marketing
declarations do not make it a Portal dependency. A full-root development install
can mask that error; verification must include a fresh Portal-selected workspace
install outside ancestors containing a full dependency tree. Portal's existing
Next TypeScript test inclusion remains intact. No production runtime import,
auth/session behavior, SQL, grants, region or file content changes are required.

### Open-route locality and narrow recovery

The earlier open-only Sydney release improved the representative photo/PDF to
about 2.47/2.44 seconds for all observed decoded bytes, from about 5.85/5.19
seconds in Mumbai. Headers still took about 2.31/2.34 seconds. These are observed
transport timings, not exact useful-paint claims or acceptance of the owner's
almost-instant outcome. Lists and other Portal functions retained their placement.

The combined `5ca16a7c` release kept the auth improvement and dependency fix while
moving only open to Singapore. Actual production artifacts verified that only
both open variants moved, with all other placements and resources unchanged.
In one bounded matched window, photo headers/all decoded bytes took about
4.40/7.43 seconds; PDF took about 2.90/5.42 seconds. Both first opens regressed
against Sydney. Authentication dropped to about 0.16/0.14 seconds and binding
reads to 0.10/0.14 seconds, but current Graph proof and source headers were slower.
A single window does not establish a general regional cause or isolate the auth
change's contribution. Recent previews still appeared immediately, completed
protected 200 JSON verification and remained visible through Refresh without
another body transfer.

The narrow local recovery changes only the existing open-route function override
from Singapore (`sin1`) back to Sydney (`syd1`). It retains the live open-only
identity owner: one existing cookie-bound client performs fresh `auth.getUser()`
and the SAME client calls unchanged `projectGraph`. Existing `project_files_read`
rechecks current staff/admin membership, confirmation, deletion and ban state
before returning project roots. Only the redundant generic `portal_users` role
query was removed; no cached role, claims or authority replaces current proof.
Fresh `getUser()` still detects server-ended sessions; the RPC alone or
`getClaims()` is insufficient. Existing SSR refresh/cookie behavior is unchanged.

Current Graph containment/type/size/version checks, native original delivery,
the five-minute prepared metadata/recent-preview policy, the exact development
dependency declaration and all tests remain intact. Session/RPC denial, error,
invalid roots or stale binding still stop before provider access, previews,
verification receipts or original redirects. Lists, middleware, defaults,
resources and every other function retain their current configuration.

Before recovery acceptance, the actual production comparison must permit only
both open variants moving Singapore to Sydney and preserve all other functions
and resources. The bounded ordinary photo/PDF and recent-return task still needs
fresh verification. This restores the better observed byte path without a stale
full rollback, wider region move, body preparation or authority relaxation.
Recovery performance and the almost-instant outcome remain unverified.
[Vercel per-function regions](https://vercel.com/docs/functions/configuring-functions/region)
own placement; the deprecated Next `preferredRegion` export is not used.

The separate private localhost harness executes the actual list/open handlers,
Graph/token/containment owners and client workspace with synthetic auth/RPC and
provider responses. It models source/network delays and valid synthetic 2.9 MB
photo and 687 KB two-page PDF bytes, records prepared/unprepared/useful-paint
cases separately, and exercises change/deny/retry. It is not checked-in production
behavior or evidence of live source timing. No new storage service, region, provider permissions or periodic worker is
introduced. Preparation uses the existing request/runtime budget and adds at most four bounded metadata requests per project visit before query reuse,
plus explicit intent/navigation. Cold/unprepared entry and folders outside the
bounded preparation still wait for current source/network work. Production
acceptance must measure those ordinary tasks and the real version-header contract.

## Access and delivery contract

Every staff request authenticates first and calls the user-bound `project_files_read` RPC. Open requests retain fresh `getUser()` on the same request client; current staff access comes from the RPC actor rather than a duplicate Portal role read. The RPC rechecks confirmed, active staff/admin membership. It exposes roots only for the requested existing project and configured drive. The service role is used only by the operator importer and the scoped provisioning command, never to bypass staff read checks.

Both privilege governance checks retain this boundary: `supabaseClient.boundaries.test.ts` inventories Portal runtime users, while `scripts/service-role-access-report.mjs` registers the exact cron adapter for the strict shared-impact gate and identifies the operator-only importer. Nearby SharePoint modules receive no privilege exception. The focused `serviceRole.test.ts` checks that the two reviewed entrypoints pass and neighbouring runtime files remain rejected.

Microsoft uses a **separate** app registration with application `Sites.Selected` and an explicit Jobs-site write assignment for folder creation. Consent alone is insufficient. The existing mailbox-only Outlook app is not reused. Configure a narrowly bound Vercel OIDC federated identity for the approved Portal environment; do not grant broad site, directory or administrative permissions to the runtime app. The credential resolver accepts only the supplied assertion and does not prompt or discover desktop credentials.

Every Graph session verifies the configured Jobs site's `Shared Documents` library. Scoped runtime requests first read the current DB-bound project folder and requested item, deduplicated when identical and otherwise in one Graph batch. A current folder URL with exact decoded site/library segments, matching current folder name and drive identity proves the library; unusable optional URL data falls back to the existing fresh drive-root read. Fresh provider parent paths use decoded segment containment, with direct-parent ID proof or the existing bounded fresh ancestry walk when paths cannot prove membership. Every batch subresponse must succeed; no cross-request library or item-authority cache is introduced. The importer additionally requires the manifest's exact site URL and Documents library. Remote shortcuts, foreign drives, non-descendant file IDs and cross-folder pagination URLs fail closed. Provisioning verifies the configured intake item resolves to `02 Enquiries and quotes` before writing.

Original downloads authenticate and verify ancestry, then redirect to Microsoft's short-lived preauthenticated URL. It must be HTTPS on the exact configured tenant host at a `/_layouts/15/download.aspx` path. No Graph bearer is forwarded to that endpoint. This lets large Rhino downloads bypass function response size/duration limits. URLs are not stored or logged; responses use private/no-store and no-referrer. The link itself remains a temporary bearer capability until Microsoft expires it. Microsoft controls attachment filename and expiry. The provider's actual download behavior still needs a live acceptance probe.

Inline PDF/PNG/JPEG/WebP/GIF responses stream with single-range support, nosniff, a restrictive sandbox CSP and a 50 MB byte cap. A provider may return 200 for a range request. Preview timeouts can be recovered by Download. Neither flow buffers an original file into function memory.

## Activation prerequisites and sequence

Production release and provider/schema writes require the owner's existing release approval boundary. This branch suppresses automatic Vercel deployments for both apps. The candidate contains an every-minute cron entry; it is not deployed and both runtime/database enablement flags remain required before any folder creation.

1. Review this source and the private verified mapping. Establish the dedicated app, approved OIDC federation and explicit Jobs site grant. Verify the actual tenant, client, Jobs drive and intake item IDs with Microsoft. Do not infer drive IDs from the SharePoint list GUID.
2. Apply the reviewed migration in the approved database. It creates private tables with RLS and no direct client grants. Both control flags start false. Existing projects are not queued.
3. Set server-only configuration in the approved environment: `SANCTUARY_SHAREPOINT_TENANT_ID`, `SANCTUARY_SHAREPOINT_CLIENT_ID`, `SANCTUARY_SHAREPOINT_HOSTNAME`, `SANCTUARY_SHAREPOINT_JOBS_SITE_URL` (exact HTTPS `/sites/<Jobs site>`), `SANCTUARY_SHAREPOINT_JOBS_DRIVE_ID`, `SANCTUARY_SHAREPOINT_ENQUIRIES_ITEM_ID`. Set `SANCTUARY_SHAREPOINT_ENABLED=true` only when activating read access; keep `SANCTUARY_SHAREPOINT_PROVISION_ENABLED=false` initially. The source binding hashes all six source identity values including the site URL.
4. Preflight the private manifest using an already approved operator process with `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `VERCEL_OIDC_TOKEN` and the same source configuration. Set the operator process's enabled flag true to parse its configuration. No prompts are supported. Run:

   ```text
   node --conditions=react-server --import tsx scripts/sharepoint-project-files.ts <input.private.json> <fresh-output.private.json> --preflight
   ```

   The manifest is `{formatVersion:1,siteUrl,libraryName:"Documents",status,rows:[{projectId,relativePath,label,evidence}]}`. Accepted roots are current projects, yearly enquiries, `Design and feasibility` enquiries, and yearly completed projects. Every row must resolve to an existing Portal project and live Graph folder. The complete batch resolves before any import write. Output is private, created exclusively and must remain outside Git. This preflight has no provider or database writes.
5. Configure the database through the service-role-only `project_files_admin` RPC with `p_action="configure"` and `p_input={binding:<output binding>,driveId:<verified drive>,enquiriesItemId:<verified intake item>,enabled:false,provisionEnabled:false}`. This is an explicit operator mutation, not part of preflight. Import with the same command, a fresh output path and `--apply`. This writes explicit bindings only; it does not create folders. Re-running an unchanged mapping is idempotent. Changed evidence or a competing project fails for review, preserving earlier bindings. A partly completed batch is safe to replay.
6. Set the database control to `enabled:true,provisionEnabled:false` with the same identity and enable the runtime read flag. Verify a real active project, a project with multiple roots, PDF/photo view, a large Rhino download, expiry/retry and a staff-denied request. Native browser/provider acceptance remains required; synthetic checks do not establish real source coverage.
7. To enable future enquiry folders, set database `provisionEnabled:true` and runtime `SANCTUARY_SHAREPOINT_PROVISION_ENABLED=true`. The prepared Vercel cron dispatches `/api/integrations/sharepoint-project-folders` every minute after the reviewed deployment. It requires the existing minimum-32-character `CRON_SECRET` bearer and rejects query parameters. It claims at most one project per invocation. Expected throughput is one successful setup per minute; paused or failed attempts remain durable for subsequent runs.
8. Verify one approved new enquiry through actual intake, atomic job creation, Microsoft folder creation, all three standard folders and the Portal Files tab. Check that a retry does not create another root. Keep staff changeover as its separate later step.

## Recovery and limits

The insert trigger queues only new project rows while both database flags are enabled. The task is committed atomically with project intake, so rollback leaves no orphan job. It freezes a sanitized project name, full project UUID and New Zealand year. The UUID prevents same-name projects colliding. The worker creates the year, project root and `3 CAD`, `4 RENDERING`, `5 DESIGN PACKAGE` folders with conflict-fail/re-read behavior. It copies no sample PDF or CAD masters. Template-file copying is not enabled; any future template choice needs an explicit versioned source.

Claims have two-minute leases, bounded exponential retries and six attempts before `needs_attention`. A failed completion can safely retry the same deterministic folder names. Expired lease owners cannot publish a binding. Private events retain queue/import/completion/failure evidence. This scoped outbox follows the existing calendar command boundary; it does not activate or alter the generic dark worker or unrelated jobs.

Deleting a Portal project retains the existing administrator deletion behavior. Its local file bindings and pending/running/completed provisioning row cascade away; a private deletion event retains the project UUID/name, root identities/evidence and frozen job/source details. Historical audit events deliberately keep their project UUID without a live-project foreign key. This is metadata retirement only: it makes no Microsoft call and deletes no SharePoint original. A worker completing after deletion cannot recreate the binding or queued work. An already issued Microsoft folder request may still finish; that folder remains intact and can be reconciled using the retained job identity. No automatic provider cleanup is attempted. Worker completion locks the parent project before the job to follow deletion's lock order.

For an outage, disable runtime provisioning and set database `provisionEnabled:false` using the same configured source identity. Pending rows remain for later recovery. To hide reads too, set runtime enabled false and database `enabled:false`. No source file is removed. After restoring access, an operator can call `project_files_admin` with `p_action="retry"`, `p_input={binding,projectId}` for a job in `needs_attention`; the worker resumes normally. No blanket backfill or create-for-every-existing-project command exists. Inspect private job status/error codes and events through an approved database operator route; do not expose raw provider responses or signed URLs in logs.

The importer does not overwrite or unbind a disputed match. Correcting an erroneous already-imported binding requires a separately reviewed repair with evidence. Changing the configured source while old bindings/jobs exist is constrained; do not repoint existing IDs to another library. Microsoft can move or delete files after binding; access then fails safely and can recover after an evidence-based binding repair. Folder browsing is bounded to 40 ancestor hops and 100 items per Graph page.

## Verification

Successful authenticated list responses retain the existing `Server-Timing`
total and append numeric `files_auth`, `files_bindings_rpc`, `files_token`,
`files_library`, `files_source_batch`, `files_ancestry` and `files_children` phases when reached. Open responses use the same observer and add `files_content_redirect` and `files_source_headers` when reached; source-header timing ends before body transfer.
Token/Graph phases include JSON body reads; ancestry covers all required hops.
Only fixed phase labels/durations enter this header, with no file/project names,
IDs, URLs, assertions or cursors and no new logs/settings. The optional observer
cannot change results/errors, ordering, validation, no-store or timeouts.
Non-200 responses retain existing behavior and do not emit these phases;
successful unready states emit only reached phases. Cursor pages are ordinary
successful reads with the same phase measurements.
The timing header itself is observational; the bounded performance arrangement below changes request work and browser preparation.
Focused tests verify finite headers, body-read timing and request/error parity.

Local checks: `node scripts/test-project-sharepoint-files-pglite.mjs`; `node scripts/test-project-sharepoint-files-browser.mjs`; `vitest run apps/portal/lib/projects/sharePointFiles apps/portal/components/projects/ProjectPage/tabs/overview/ProjectSharePointFilesPanel.test.tsx apps/portal/components/projects/ProjectPage/tabs/overview/projectFilesNavigation.test.ts`; Portal TypeScript, focused ESLint, documentation impact and changed architecture checks. The disposable PostgreSQL test exercises the real migration, rollback, dark defaults, no backfill, leases, retries, multi-root replay/conflicts and grants. It also deletes imported, completed, pending and running projects through the existing quote-then-project request sequence, checks retained audit identity and rejects stale worker completion/failure. Actual React/TanStack observer tests cover request deduplication, equivalent-root keys, wrapper Work/project remount, selection/scroll return, bounded cursor finding, root/file races, cancellation, denial/retry, unsafe MIME, owner isolation and current-preview body reuse/refresh.

The isolated headless Chromium harness builds the actual Files component **and actual open-route handler**, substituting authentication/Graph boundaries and a local provider. It selects a synthetic PNG, retries an injected preview failure, clicks Download and checks the received original filename, exact binary bytes and SHA-256. Those original bytes are a transport fixture with a `.3dm` filename, not a valid Rhino document. It checks valid synthetic PDF response bytes/MIME and actual canvas rendering, then verifies expansion does not read the body again. Desktop/mobile action visibility, folder return and list recovery are included. Bundles remain in memory; screenshots go under ignored `test-results/sharepoint-files`. It uses a fresh browser context with no real session or screen control. Both disposable database and browser checks are included in Portal Quality CI.

The earlier private local actual-card comparison used the same synthetic source and
controlled 80 ms metadata delay for old/new wrappers. First Files entry changes
from one metadata plus one website attachment request to one metadata request;
the attachment read is deferred, not removed. Immediate Work return makes zero
metadata requests in both versions. Explorer retains the folder while the old
UI returns to root. This establishes request/task behavior, not real Graph
latency, production cold-start improvement or a general percentage speed gain.

Live Graph timing, real source changes/denial, provider filename behavior and full-size valid Rhino delivery are not established by these local tests. Existing mapping/provisioning acceptance remains with its owning activation record. The local component harness is synthetic and does not establish integrated live authenticated Portal rendering. Production identity is bound to deployed production OIDC; no broader local/staging trust or impersonation is introduced for measurement.

Microsoft references: [token lifetime and client assertions](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-client-creds-grant-flow), [Vercel OIDC](https://vercel.com/docs/oidc), [Graph batching](https://learn.microsoft.com/en-us/graph/json-batching), [provider parent paths](https://learn.microsoft.com/en-us/graph/api/resources/itemreference?view=graph-rest-1.0), [drive item versions](https://learn.microsoft.com/en-us/graph/api/resources/driveitem?view=graph-rest-1.0), [selected permissions](https://learn.microsoft.com/en-us/graph/permissions-selected-overview), [drive item downloads](https://learn.microsoft.com/en-us/graph/api/driveitem-get-content?view=graph-rest-1.0), [SharePoint IDs](https://learn.microsoft.com/en-us/graph/api/resources/sharepointids?view=graph-rest-1.0).
