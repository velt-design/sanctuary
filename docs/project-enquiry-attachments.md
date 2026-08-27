# Project-linked website enquiry files

Status: implementation complete in the repository; migrations and historical backfill are not applied. Production migration, backfill, push, and deployment require a separate reviewed approval.

## User experience

Project Overview keeps **Work** as the default secondary tab inside the existing **Project Work** card. **Files** is the adjacent tab. It lists the original filename, submitted date, size, and separate View and Download actions. There is no upload, rename, move, or delete control in this slice.

The list response contains metadata only. A View or Download click calls a staff-authenticated portal route, proves that the exact attachment belongs to the exact project through the caller's auth-bound Supabase client, writes an access audit event, and redirects to a newly generated 60-second Storage URL. Responses are `private, no-store` and use `Referrer-Policy: no-referrer`. The private `enquiry-attachments` bucket is unchanged.

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

## Historical dry run and reviewed apply

The tool is dry-run by default and requires the intended environment plus exact Supabase project ref. Its JSON report must be written outside the repository with create-only semantics:

```bash
npm run portal:enquiry-attachments:backfill -- --target=staging --confirm-project-ref=<exact-ref> --output=<absolute-path-outside-repo>
```

The report contains exact linkable candidates, already-linked files, referenced paths with missing objects, Storage objects unmatched to any enquiry JSON path, ambiguous/conflicting evidence, and known current project-link changes. The repository has no historical project-merge ledger, so the report states that limitation and never infers a merge from project names, contacts, filenames, or similar metadata.

The read phase never writes database rows and never moves, renames, or deletes Storage objects. Applying a report is intentionally separate and is not authorized by implementing this feature. After the report and migration plan are reviewed, an operator must use a new UUID, the matching report/environment/ref, `--apply`, and the exact confirmation environment value documented by the script. A report containing missing, unmatched, ambiguous, or changed-project evidence also requires the explicit `--accept-reviewed-exceptions` acknowledgement; this does not add those exceptions to the candidate set. The service-only RPC rechecks every candidate against current `enquiry_requests.project_id`, `submission_id`, the exact `files[ordinal]` metadata, and `storage.objects` in one transaction. Any changed or ambiguous source rejects the complete run. Replaying the same run UUID and identical payload is safe; using that UUID with different candidates is rejected. A reviewed report with zero candidates is a no-op and creates no run row.

## Review and rollout sequence

1. Review this implementation, migration SQL, focused tests, and the dry-run report format. Do not run against a live environment during implementation review.
2. Back up and positively identify the target database and private bucket using the normal migration-readiness process.
3. Apply the ordered schema migrations to staging only after approval. Do not run the backfill yet.
4. Run the staging dry run, review every category and every ambiguous/project-history limitation, then explicitly approve or reject the exact report.
5. If approved, apply only that report UUID/payload in staging and rerun the dry run. Expected linkable count is zero; all applied candidates are already linked.
6. Verify staff and non-staff authorization, exact-project denial, View/Download audit events, 60-second redirects, Work-default/Files-tab UI, and both sides of the 8 MB email boundary.
7. Present staging evidence and a production migration/dry-run plan for separate approval. No production migration, live backfill, push, or deployment is implied by these steps.

## Focused verification

```bash
npm test -- --run test/project-enquiry-attachments-migration.test.ts
npm test -- --run scripts/project-enquiry-attachments-backfill-lib.test.ts
npm test -- --run apps/portal/lib/projects/enquiryAttachments
npm test -- --run "apps/portal/app/api/staff/v1/projects/[projectId]/enquiry-attachments"
npm test -- --run apps/portal/components/projects/ProjectPage/tabs/overview/ProjectEnquiryFilesPanel.test.tsx apps/portal/components/projects/ProjectPage/tabs/overview/ProjectWorkSection.test.tsx
npm test -- --run apps/marketing/app/api/enquiry/route.test.ts
```
