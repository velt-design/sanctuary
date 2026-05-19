-- Ensure the column exists (matches 20260208_000002 -- safe to re-run
-- in case that migration was skipped in some environment).
alter table public.projects
  add column if not exists archived_at timestamptz;

create index if not exists projects_archived_at_idx
  on public.projects(archived_at);

-- Legacy archive path backfill.
--
-- Before the archived_at column was added, projects were "archived"
-- by setting pipeline_stage = 'archived' (case-insensitive). That
-- value normalises to isArchived=true on the client, which causes
-- those rows to be filtered OUT of the Active list AND not returned
-- by the new Archived query (because archived_at IS NULL) -- they
-- become invisible from both filters.
--
-- Backfill archived_at from updated_at for every legacy-archived row
-- so they reappear in the Archived filter and can be unarchived via
-- the existing UI. Skip rows that ALREADY have archived_at set so
-- this migration is idempotent and never overwrites a more accurate
-- archive timestamp.
update public.projects
   set archived_at = coalesce(updated_at, now())
 where archived_at is null
   and lower(coalesce(pipeline_stage, '')) = 'archived';
