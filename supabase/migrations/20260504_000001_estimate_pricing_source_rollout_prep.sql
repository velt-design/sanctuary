-- Estimate pricing source rollout prep.
-- Calculator remains the default live pricing source until server-owned rollout gates enable workbench_solved.

alter table public.estimates
  add column if not exists pricing_source text not null default 'calculator_live',
  add column if not exists pricing_source_metadata jsonb not null default '{}'::jsonb,
  add column if not exists commercial_design_input jsonb null;

update public.estimates
set
  pricing_source = 'calculator_live',
  pricing_source_metadata = coalesce(pricing_source_metadata, '{}'::jsonb)
where pricing_source is null
   or pricing_source not in ('calculator_live', 'workbench_solved');

alter table public.estimates
  drop constraint if exists estimates_pricing_source_check;

alter table public.estimates
  add constraint estimates_pricing_source_check
  check (pricing_source in ('calculator_live', 'workbench_solved'));

notify pgrst, 'reload schema';
