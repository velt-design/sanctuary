# Project-linked website enquiry files

Status: implementation approved. The exact schema migrations are applied and ledgered in staging and production. The production historical dry run is complete, but its backfill is not applied because ambiguous declarations and changed-project evidence require separate review.

## User experience

Project Overview keeps **Work** as the default secondary tab inside the existing **Project Work** card. **Files** is the adjacent tab. It lists the original filename, submitted date, size, and separate View and Download actions. There is no upload, rename, move, or delete control in this slice.

The list response contains metadata only. A View or Download click calls a staff-authenticated portal route and proves that the exact attachment belongs to the exact project through the caller's auth-bound Supabase client. Only then does the server-owned Supabase client sign the private object, the route writes an access audit event, and the response redirects to the newly generated 60-second Storage URL. Authenticated browser sessions have no `storage.objects` select policy for this bucket and therefore cannot bypass the audited route. Responses are `private, no-store` and use `Referrer-Policy: no-referrer`. The private `enquiry-attachments` bucket is unchanged.

## Data contract

`project_enquiry_attachments` is the canonical project/file link. Each row has one enquiry request, its current project, the immutable submission UUID, JSON-array ordinal, private bucket/path, original filename, content type, byte count, link origin, and link/unlink timestamps. Constraints enforce:

- one row per bucket/path and one row per enquiry ordinal;
- ordinals 0 through 7;
- the existing `pending/{submission_id}/...` path ownership;
- the existing PDF/JPEG/PNG/WebP and 20 MB per-file bounds;
- a project link identical to `enquiry_requests.project_id` and a submission UUID identical to `enquiry_requests.submission_id`.

`project_enquiry_attachment_events` records link, relink, unlink, View-URL, and Download-URL events. Access events include the staff user and portal request ID but never store a signed URL or token. `project_enquiry_attachment_backfill_runs` records the reviewed command UUID, canonical payload hash, inserted/existing counts, and application time.

An `AFTER INSERT` enquiry trigger expands the already-verified `enquiry_requests.files` JSON into link rows inside the same database transaction. Every declared path must have an exact `storage.objects` row. A missing or invalid object raises an error and rolls the enquiry intake transaction back. An explicit later change to `enquiry_requests.project_id` moves every linked file to the same project and records the transition.

This does not alter autoresponder delivery. Verified files totalling 8 MB or less remain inline attachments; larger totals retain the existing seven-day email links. Portal visibility is independent of that email threshold.

Migration sources:

- `supabase/migrations/20260827000001_project_enquiry_attachments.sql`
- `supabase/migrations/20260827000002_project_enquiry_attachments_schema_cache.sql`
- `supabase/migrations/20260827000003_project_enquiry_attachment_signing_boundary.sql`

## Deployment evidence

On 2026-08-27 the exact migrations were rollback-rehearsed, then applied individually to positively identified staging `tnsiprehuldksnuowubv` and production `iytanftukulcnavossmd`. Blanket `db push` was not used. Completed physical backups were confirmed first: staging backup `1489369286` and production backup `1491102067`. The canonical-LF SHA-256 values were `daaffed16756a84608ef12da039dfce139325c217e6211341bc57993f55925f4` for `20260827000001`, `a977270fe5892e98f033598bc66678466ebb39e6da5dfd0c9594d992ef7e7f32` for `20260827000002`, and `a30875a29b713ccf7dd6f410dde41145f6fcc66ea26fc69a0921dfaa50932f70` for the reviewed signing-boundary correction `20260827000003`.

Final postflight found three RLS-enabled tables, three feature policies, four triggers, five functions, no anonymous table grants, service-role-only backfill execution, the private Storage bucket, all three unique migration-ledger versions, and zero deployment-created attachment, event, or backfill-run rows. The signing-boundary postflight separately proved the removed Storage policy count is zero in both environments.

The staging dry run was empty. Its report SHA-256 is `b89e1f3220357156b271a1344b0a78cbeaa1da572569fbe45496a8bf3a327ef2`. The production report SHA-256 is `7a5ee65b62449b71ec5af8028275a4ee64c8d730cde71a6ca64c699bbafba322`; it reports 59 exact linkable files, 22 ambiguous declarations, nine projects whose current link changed, zero missing Storage objects, and zero unmatched Storage objects. No historical rows were linked and no Storage object was moved, renamed, or deleted.

## Historical dry run and reviewed apply

The tool is dry-run by default and requires the intended environment plus exact Supabase project ref. Its JSON report must be written outside the repository with create-only semantics:

```bash
npx tsx scripts/project-enquiry-attachments-backfill.ts --target=staging --confirm-project-ref=<exact-ref> --output=<absolute-path-outside-repo>
```

The report contains exact linkable candidates, already-linked files, referenced paths with missing objects, Storage objects unmatched to any enquiry JSON path, ambiguous/conflicting evidence, and known current project-link changes. The repository has no historical project-merge ledger, so the report states that limitation and never infers a merge from project names, contacts, filenames, or similar metadata.

The read phase never writes database rows and never moves, renames, or deletes Storage objects. Applying a report is intentionally separate and is not authorized by implementing this feature. After the report and migration plan are reviewed, an operator must use a new UUID, the matching report/environment/ref, `--apply`, and the exact confirmation environment value documented by the script. A report containing missing, unmatched, ambiguous, or changed-project evidence also requires the explicit `--accept-reviewed-exceptions` acknowledgement; this does not add those exceptions to the candidate set. The service-only RPC rechecks every candidate against current `enquiry_requests.project_id`, `submission_id`, the exact `files[ordinal]` metadata, and `storage.objects` in one transaction. Any changed or ambiguous source rejects the complete run. Replaying the same run UUID and identical payload is safe; using that UUID with different candidates is rejected. A reviewed report with zero candidates is a no-op and creates no run row.

## Remaining rollout sequence

1. Review the exact production dry-run report, especially every ambiguous declaration and changed-project entry. Never infer the intended project.
2. If the exact 59-candidate subset is approved, apply only that immutable report with a new run UUID and the explicit reviewed-exceptions acknowledgement. Do not include any ambiguous or changed-project evidence.
3. Rerun the production dry run. The applied candidates must move to `alreadyLinkedFiles`; all exceptions must remain visible for separate resolution.
4. Verify staff and non-staff authorization, exact-project denial, View/Download audit events, 60-second redirects, Work-default/Files-tab UI, and both sides of the 8 MB email boundary.

## Focused verification

```bash
npm test -- --run test/project-enquiry-attachments-migration.test.ts
npm test -- --run scripts/project-enquiry-attachments-backfill-lib.test.ts
npm test -- --run apps/portal/lib/projects/enquiryAttachments
npm test -- --run "apps/portal/app/api/staff/v1/projects/[projectId]/enquiry-attachments"
npm test -- --run apps/portal/components/projects/ProjectPage/tabs/overview/ProjectEnquiryFilesPanel.test.tsx apps/portal/components/projects/ProjectPage/tabs/overview/ProjectWorkSection.test.tsx
npm test -- --run apps/marketing/app/api/enquiry/route.test.ts
```
