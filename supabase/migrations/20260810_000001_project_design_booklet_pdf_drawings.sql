-- Allow Design Booklet drawing slots to retain their original PDF source while
-- continuing to store a lightweight JPEG preview beside it.

alter table public.project_design_booklet_assets
  drop constraint if exists project_design_booklet_assets_media_type_check;

alter table public.project_design_booklet_assets
  add constraint project_design_booklet_assets_media_type_check
  check (media_type in ('image/jpeg', 'image/png', 'application/pdf'));

alter table public.project_design_booklet_assets
  add column if not exists page_count integer not null default 1
  check (page_count between 1 and 50);

comment on table public.project_design_booklet_assets is
  'Private image previews and original drawing PDF metadata for project Design Booklet drafts.';

comment on column public.project_design_booklet_assets.page_count is
  'Validated page count. Images use one; drawing PDFs may contain up to fifty pages.';

notify pgrst, 'reload schema';
