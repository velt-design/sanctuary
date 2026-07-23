alter table public.costing_configuration_versions
  add column name text,
  add column purpose text;

update public.costing_configuration_versions
set
  name = case
    when status = 'published' then 'Published pricing v' || version_number::text
    else 'Pricing draft v' || version_number::text
  end,
  purpose = case
    when status = 'published' and publish_note is not null then publish_note
    else 'Created before named costing changes were introduced.'
  end
where name is null or purpose is null;

alter table public.costing_configuration_versions
  alter column name set not null,
  alter column purpose set not null,
  add constraint costing_configuration_name_length
    check (length(trim(name)) between 3 and 80),
  add constraint costing_configuration_purpose_length
    check (length(trim(purpose)) between 3 and 500);

comment on column public.costing_configuration_versions.name is
  'Human-readable identity for this immutable configuration version; separate from publish audit metadata.';
comment on column public.costing_configuration_versions.purpose is
  'Plain-language intended change and reason; separate from the publication confirmation note.';

select pg_notify('pgrst', 'reload schema');
