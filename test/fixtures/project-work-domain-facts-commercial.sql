-- Minimal source-schema supplement to the repository's actual V2 migration test
-- bootstrap. The selected source columns have their canonical scalar types.
-- Unused invoice/email/customer artifact writers are deliberately not installed.
create table public.estimates (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id),
  commercial_scope_id uuid,
  created_at timestamptz not null default now(),
  status text not null default 'draft' check(status in ('draft','archived')),
  version integer not null default 1
);
alter table public.quotes add column quote_ref text, add column commercial_scope_id uuid;
alter table public.quote_versions
  add column source_estimate_version_id uuid references public.estimates(id),
  add column created_at timestamptz not null default now(),
  add column accepted_at timestamptz,
  add column total_inc_gst_cents integer not null default 0;
alter table public.quote_versions add constraint quote_versions_quote_id_version_key unique(quote_id,version_number);
create index estimates_by_project on public.estimates(project_id);
create index estimates_by_project_commercial_scope on public.estimates(project_id,commercial_scope_id,created_at desc);
create index quotes_by_project on public.quotes(project_id);
create unique index quotes_unique_base_project on public.quotes(project_id) where commercial_scope_id is null;
create unique index quotes_unique_project_scope on public.quotes(project_id,commercial_scope_id) where commercial_scope_id is not null;
create index quote_versions_by_quote on public.quote_versions(quote_id,version_number);
create index quote_send_logs_by_quote_version on public.quote_send_logs(quote_version_id,created_at desc);
create index quote_send_logs_by_project on public.quote_send_logs(project_id,created_at desc);
