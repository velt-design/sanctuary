-- Supabase schema for enquiry_requests.
-- Note: `gen_random_uuid()` requires `pgcrypto`.

create extension if not exists pgcrypto;

create table if not exists public.enquiry_requests (
  id uuid primary key default gen_random_uuid(),

  contact_id uuid references public.contacts(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,

  enquiry_type text not null check (enquiry_type in ('residential','commercial','professional')),
  suburb text,
  message text,

  width_m numeric,
  depth_m numeric,
  height_m numeric,

  style text,
  roof_materials text[],
  add_ons jsonb not null default '{}'::jsonb,

  base_budget_low_inc_gst integer,
  base_budget_high_inc_gst integer,
  blinds_budget_low_inc_gst integer,
  blinds_budget_high_inc_gst integer,
  budget_basis text,

  company text,
  files jsonb not null default '[]'::jsonb,

  source text not null default 'website',
  page text,
  utm jsonb not null default '{}'::jsonb,
  raw_payload jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now()
);

create index if not exists enquiry_requests_contact_id_idx on public.enquiry_requests(contact_id);
create index if not exists enquiry_requests_project_id_idx on public.enquiry_requests(project_id);
create index if not exists enquiry_requests_created_at_idx on public.enquiry_requests(created_at);

-- Prompt PostgREST to refresh its schema cache after DDL changes.
notify pgrst, 'reload schema';
