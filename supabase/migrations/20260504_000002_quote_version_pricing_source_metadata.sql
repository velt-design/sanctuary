-- Quote-version pricing source provenance.
-- Metadata is nullable and intentionally not backfilled so historical quote versions are not rewritten.

alter table public.quote_versions
  add column if not exists pricing_source text null,
  add column if not exists pricing_source_metadata jsonb null;

alter table public.quote_versions
  drop constraint if exists quote_versions_pricing_source_check;

alter table public.quote_versions
  add constraint quote_versions_pricing_source_check
  check (
    pricing_source is null
    or pricing_source in ('calculator_live', 'workbench_solved')
  );

notify pgrst, 'reload schema';
