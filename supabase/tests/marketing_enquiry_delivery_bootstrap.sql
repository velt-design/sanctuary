-- Disposable jobs-harness prerequisites only. Real intake and queue functions
-- are loaded from their source migrations; these are legacy domain table stubs.
create table public.contacts(id uuid primary key default gen_random_uuid(), name text, email text, phone text);
alter table public.projects alter column id set default gen_random_uuid();
alter table public.projects add column contact_id uuid references public.contacts(id),
  add column name text, add column pipeline_stage text, add column site_address text,
  add column archived_at timestamptz;
create table public.estimates(id uuid primary key default gen_random_uuid(), project_id uuid references public.projects(id),
  status text, version integer not null default 1, created_by text, summary_json jsonb, inputs jsonb, outputs jsonb, warnings jsonb,
  costing_manifest text, costing_rules text, costing_config_version_id uuid, crew_hours numeric, duration_days numeric,
  materials_ex_gst numeric, install_payout_ex_gst numeric, overhead_ex_gst numeric,
  total_true_cost_ex_gst numeric, total_true_cost_inc_gst numeric);
create table public.email_templates(id text primary key, subject text, body_html text, body_text text, variables jsonb);
create table public.email_outbox(id uuid primary key default gen_random_uuid(), project_id uuid references public.projects(id),
  contact_id uuid references public.contacts(id), email_type text, to_email text, subject text,
  template_id text references public.email_templates(id), variables jsonb, status text,
  idempotency_key text unique, error text, sent_at timestamptz);
create table public.audit_events(project_id uuid references public.projects(id), type text, idempotency_key text unique, payload jsonb);
-- Storage metadata only: this harness never uploads files or calls Storage HTTP.
create schema if not exists storage;
-- Supabase owns its existing Storage relation. Only plain PostgreSQL needs the
-- minimal stub; even CREATE TABLE IF NOT EXISTS checks protected schema rights.
do $$
begin
  if to_regclass('storage.objects') is null then
    execute 'create table storage.objects(id uuid primary key default gen_random_uuid(),
      bucket_id text not null, name text not null, unique(bucket_id, name))';
    execute 'alter table storage.objects enable row level security';
  end if;
end;
$$;
