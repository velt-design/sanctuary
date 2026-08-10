alter table public.quote_versions
  add column if not exists superseded_at timestamptz,
  add column if not exists superseded_by text;

alter table public.quote_versions
  drop constraint if exists quote_versions_status_check;

alter table public.quote_versions
  add constraint quote_versions_status_check
  check (status in ('DRAFT', 'SENT', 'ACCEPTED', 'DECLINED', 'SUPERSEDED'));

comment on column public.quote_versions.superseded_at is
  'When an admin manually retired this quote version as superseded.';

comment on column public.quote_versions.superseded_by is
  'Portal actor that manually retired this quote version as superseded.';

select pg_notify('pgrst', 'reload schema');
