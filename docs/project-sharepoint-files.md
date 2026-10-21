# Project SharePoint files

Status: implemented locally on 22 October 2026; dark by default. No production migration, Microsoft grant, import, schedule or staff changeover is implied by this document.

## Outcome and ownership

The owner's request is to link SharePoint files to their Portal projects and automatically prepare project folders for new enquiries, while leaving staff changeover for later. The existing Project Work **Files** tab now includes verified SharePoint roots and preserves website enquiry attachments. Multiple roots can belong to one project. Runtime/import requires an explicit project UUID and verified SharePoint item identity; there is no runtime name-based auto-matching. Private preparation records the evidence used for each proposed identity, which may include a unique exact full-name match in its dated context rather than an independently confirmed street address.

SharePoint remains the file authority. Portal stores explicit drive/item/project bindings and provisioning state, not copies or public links. Staff can navigate folders, page through results, open PDF and raster image previews, and download originals including Rhino. Files beyond the 50 MB inline preview limit remain downloadable. SVG and HTML are download-only. This does not merge the historical unassigned files, copy website attachments into SharePoint, or move current folders when a project changes stage.

Implementation map:

| Surface | Owner |
| --- | --- |
| Staff project Files UI | `ProjectSharePointFilesPanel`, inside existing `ProjectWorkFilesCard` |
| Authenticated reads and file access | `apps/portal/app/api/staff/v1/projects/[projectId]/files` and `lib/projects/sharePointFiles/server.ts` |
| Microsoft source and ancestry checks | `lib/projects/sharePointFiles/graph.ts` |
| New enquiry folder job | `lib/projects/sharePointFiles/provision.ts`, `api/integrations/sharepoint-project-folders` |
| Private state, grants and atomic enqueue | `supabase/migrations/20261022090001_project_sharepoint_files.sql` |
| Verified existing-folder import | `scripts/sharepoint-project-files.ts`, domain `import.ts` |

## Access and delivery contract

Every staff request authenticates first and calls the user-bound `project_files_read` RPC. The RPC rechecks confirmed, active staff/admin membership. It exposes roots only for the requested existing project and configured drive. The service role is used only by the operator importer and the scoped provisioning command, never to bypass staff read checks.

Microsoft uses a **separate** app registration with application `Sites.Selected` and an explicit Jobs-site write assignment for folder creation. Consent alone is insufficient. The existing mailbox-only Outlook app is not reused. Configure a narrowly bound Vercel OIDC federated identity for the approved Portal environment; do not grant broad site, directory or administrative permissions to the runtime app. The credential resolver accepts only the supplied assertion and does not prompt or discover desktop credentials.

Every Graph session verifies the configured drive's root URL is exactly the configured Jobs site's `Shared Documents` library. The importer additionally requires the manifest's exact site URL and Documents library. Remote shortcuts, foreign drives, non-descendant file IDs and cross-folder pagination URLs fail closed. Provisioning verifies the configured intake item resolves to `02 Enquiries and quotes` before writing.

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

Local checks: `node scripts/test-project-sharepoint-files-pglite.mjs`; `node scripts/test-project-sharepoint-files-browser.mjs`; `vitest run apps/portal/lib/projects/sharePointFiles`; `vitest run apps/portal/components/projects/ProjectPage/tabs/overview/ProjectSharePointFilesPanel.test.tsx`; Portal TypeScript, focused ESLint, documentation impact and changed architecture checks. The disposable PostgreSQL test exercises the real migration, rollback, dark defaults, no backfill, leases, retries, multi-root replay/conflicts and grants. It also deletes imported, completed, pending and running projects through the existing quote-then-project request sequence, checks retained audit identity and rejects stale worker completion/failure. Component tests exercise folder entry/return, multi-root selection, paging, file links and failure recovery.

The isolated headless Chromium harness builds the actual Files component **and actual open-route handler**, substituting only authentication/Graph boundaries and a local provider. It clicks View, verifies a synthetic PNG renders, retries an injected action failure, clicks Download and checks the received original filename, exact binary bytes and SHA-256. Those original bytes are a transport fixture with a `.3dm` filename, not a valid Rhino document. It separately checks a valid synthetic PDF's route response bytes and MIME header without claiming native PDF-viewer acceptance. The harness also checks desktop/mobile action visibility, browsing return and list recovery. Bundles remain in memory; screenshots go under ignored `test-results/sharepoint-files`. It uses a fresh browser context with no real session or screen control. Both disposable database and browser checks are included in Portal Quality CI.

Live Graph metadata/permissions, the actual private mapping import, original filename behavior, large-download completion, integrated authenticated Portal rendering and automatic new-enquiry end-to-end acceptance are not established by these local tests. No preview URL or background production operation is claimed.

Microsoft references: [selected permissions](https://learn.microsoft.com/en-us/graph/permissions-selected-overview), [drive item downloads](https://learn.microsoft.com/en-us/graph/api/driveitem-get-content?view=graph-rest-1.0), [SharePoint IDs](https://learn.microsoft.com/en-us/graph/api/resources/sharepointids?view=graph-rest-1.0).
