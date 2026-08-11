alter table public.estimates
  add column if not exists internal_name text;

alter table public.quotes
  add column if not exists internal_name text;

alter table public.estimates
  drop constraint if exists estimates_internal_name_length_check;
alter table public.estimates
  add constraint estimates_internal_name_length_check
  check (internal_name is null or char_length(internal_name) <= 120);

alter table public.quotes
  drop constraint if exists quotes_internal_name_length_check;
alter table public.quotes
  add constraint quotes_internal_name_length_check
  check (internal_name is null or char_length(internal_name) <= 120);

comment on column public.estimates.internal_name is
  'Optional staff-only name for identifying this saved estimate. Excluded from customer artifacts.';
comment on column public.quotes.internal_name is
  'Optional staff-only name shared by every version in this quote family. Excluded from customer artifacts.';
