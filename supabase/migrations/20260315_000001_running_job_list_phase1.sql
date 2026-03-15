alter table if exists public.projects
  add column if not exists deposit_paid_date date,
  add column if not exists final_payment_date date,
  add column if not exists deposit_amount_cents integer;

create table if not exists public.project_running_job_meta (
  project_id uuid primary key references public.projects(id) on delete cascade,
  lights_status text null check (lights_status in ('No','Yes','TBC')),
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_running_job_meta_notes_len check (notes is null or char_length(notes) <= 1000)
);

drop trigger if exists project_running_job_meta_set_updated_at on public.project_running_job_meta;
create trigger project_running_job_meta_set_updated_at before update on public.project_running_job_meta
for each row execute function public.set_updated_at();

grant select, insert, update, delete on public.project_running_job_meta to authenticated;

alter table public.project_running_job_meta enable row level security;

drop policy if exists portal_access_all on public.project_running_job_meta;
create policy portal_access_all on public.project_running_job_meta
  for all
  using (public.has_portal_access())
  with check (public.has_portal_access());

alter table if exists public.schedule_crews
  add column if not exists short_code text null;

update public.schedule_crews
set short_code = case lower(trim(name))
  when 'alistair' then 'AW'
  when 'jayden' then 'JW'
  when 'jesse' then 'JI'
  when 'jordan' then 'JB'
  when 'steve' then 'SC'
  when 'bruce' then 'BB'
  when 'david' then 'DH'
  else short_code
end
where short_code is null or btrim(short_code) = '';

notify pgrst, 'reload schema';
