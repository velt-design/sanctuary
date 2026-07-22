-- Keep two-character portal searches index-backed while preserving literal
-- contains matching across the existing Projects and Contacts fields.

create or replace function public.portal_search_document(variadic parts text[])
returns text
language sql
immutable
parallel safe
set search_path = pg_catalog, pg_temp
as $function$
  select lower(array_to_string(parts, E'\n', ''));
$function$;

create or replace function public.portal_search_bigrams(input_value text)
returns text[]
language sql
immutable
parallel safe
set search_path = pg_catalog, pg_temp
as $function$
  with normalized as (
    select lower(coalesce(input_value, '')) as value
  ),
  distinct_bigrams as (
    select distinct substr(normalized.value, position, 2) as bigram
    from normalized
    cross join lateral generate_series(
      1,
      greatest(char_length(normalized.value) - 1, 0)
    ) as position
  )
  select coalesce(
    array_agg(distinct_bigrams.bigram order by distinct_bigrams.bigram),
    array[]::text[]
  )
  from distinct_bigrams;
$function$;

revoke all on function public.portal_search_document(variadic text[]) from public, anon;
revoke all on function public.portal_search_bigrams(text) from public, anon;
grant execute on function public.portal_search_document(variadic text[]) to authenticated, service_role;
grant execute on function public.portal_search_bigrams(text) to authenticated, service_role;

do $indexes$
declare
  trgm_schema name;
begin
  select namespace.nspname
  into trgm_schema
  from pg_extension as extension
  join pg_namespace as namespace on namespace.oid = extension.extnamespace
  where extension.extname = 'pg_trgm';

  execute format(
    'create index if not exists projects_portal_search_document_trgm_idx on public.projects using gin (public.portal_search_document(name, quote_ref, site_address) %I.gin_trgm_ops)',
    trgm_schema
  );
  execute format(
    'create index if not exists contacts_portal_search_document_trgm_idx on public.contacts using gin (public.portal_search_document(name, email, phone, address) %I.gin_trgm_ops)',
    trgm_schema
  );
end
$indexes$;

create index if not exists projects_portal_search_document_bigram_idx
  on public.projects using gin (
    public.portal_search_bigrams(
      public.portal_search_document(name, quote_ref, site_address)
    )
  );

create index if not exists contacts_portal_search_document_bigram_idx
  on public.contacts using gin (
    public.portal_search_bigrams(
      public.portal_search_document(name, email, phone, address)
    )
  );

create index if not exists contacts_name_portal_search_bigram_idx
  on public.contacts using gin (
    public.portal_search_bigrams(public.portal_search_document(name))
  );

-- The combined document indexes supersede the per-field trigram indexes. The
-- contact-name index remains because projects can be found by linked contact.
drop index if exists public.projects_name_trgm_idx;
drop index if exists public.projects_quote_ref_trgm_idx;
drop index if exists public.projects_site_address_trgm_idx;
drop index if exists public.contacts_email_trgm_idx;
drop index if exists public.contacts_phone_trgm_idx;
drop index if exists public.contacts_address_trgm_idx;

create or replace function public.portal_search_v1(
  search_query text,
  result_limit integer default 5
)
returns table (
  access_granted boolean,
  entity_kind text,
  entity_id uuid,
  name text,
  reference text,
  site_address text,
  contact_name text,
  pipeline_stage text,
  archived_at timestamptz,
  email text,
  phone text,
  address text
)
language sql
stable
security invoker
set search_path = public, extensions, pg_temp
as $function$
  with access_state as (
    select public.has_portal_access() as allowed
  ),
  search_input as (
    select
      lower(btrim(search_query)) as normalized_query,
      '%' || replace(
        replace(
          replace(lower(btrim(search_query)), E'\\', E'\\\\'),
          '%',
          E'\\%'
        ),
        '_',
        E'\\_'
      ) || '%' as contains_pattern,
      replace(
        replace(
          replace(lower(btrim(search_query)), E'\\', E'\\\\'),
          '%',
          E'\\%'
        ),
        '_',
        E'\\_'
      ) || '%' as prefix_pattern,
      greatest(1, least(coalesce(result_limit, 5), 20)) as bounded_limit
  ),
  project_candidate_ids as (
    select project.id
    from public.projects as project
    cross join search_input as input
    where length(input.normalized_query) = 2
      and (select allowed from access_state)
      and public.portal_search_bigrams(
        public.portal_search_document(
          project.name,
          project.quote_ref,
          project.site_address
        )
      ) @> array[input.normalized_query]

    union

    select project.id
    from public.projects as project
    cross join search_input as input
    where length(input.normalized_query) >= 3
      and (select allowed from access_state)
      and public.portal_search_document(
        project.name,
        project.quote_ref,
        project.site_address
      ) ilike input.contains_pattern escape E'\\'

    union

    select project.id
    from public.contacts as contact
    join public.projects as project on project.contact_id = contact.id
    cross join search_input as input
    where length(input.normalized_query) = 2
      and (select allowed from access_state)
      and public.portal_search_bigrams(
        public.portal_search_document(contact.name)
      ) @> array[input.normalized_query]

    union

    select project.id
    from public.contacts as contact
    join public.projects as project on project.contact_id = contact.id
    cross join search_input as input
    where length(input.normalized_query) >= 3
      and (select allowed from access_state)
      and contact.name ilike input.contains_pattern escape E'\\'
  ),
  project_ranked as (
    select
      project.id,
      project.name,
      project.quote_ref as reference,
      project.site_address,
      contact.name as contact_name,
      project.pipeline_stage,
      project.archived_at,
      min(
        case
          when lower(btrim(field_value.candidate)) = input.normalized_query
            then field_value.priority
          when lower(btrim(field_value.candidate)) like input.prefix_pattern escape E'\\'
            then 10 + field_value.priority
          when exists (
            select 1
            from regexp_split_to_table(lower(btrim(field_value.candidate)), E'\\s+') as token
            where token like input.prefix_pattern escape E'\\'
          )
            then 20 + field_value.priority
          else 30 + field_value.priority
        end
      )::integer as search_rank
    from project_candidate_ids as candidate
    join public.projects as project on project.id = candidate.id
    left join public.contacts as contact on contact.id = project.contact_id
    cross join search_input as input
    cross join lateral (
      values
        (project.name, 0),
        (project.quote_ref, 1),
        (project.site_address, 2),
        (contact.name, 3)
    ) as field_value(candidate, priority)
    where field_value.candidate is not null
      and field_value.candidate ilike input.contains_pattern escape E'\\'
    group by
      project.id,
      project.name,
      project.quote_ref,
      project.site_address,
      contact.name,
      project.pipeline_stage,
      project.archived_at
  ),
  project_results as (
    select *
    from project_ranked
    order by search_rank, lower(name), id
    limit (select bounded_limit from search_input)
  ),
  contact_candidate_ids as (
    select contact.id
    from public.contacts as contact
    cross join search_input as input
    where length(input.normalized_query) = 2
      and (select allowed from access_state)
      and public.portal_search_bigrams(
        public.portal_search_document(
          contact.name,
          contact.email,
          contact.phone,
          contact.address
        )
      ) @> array[input.normalized_query]

    union

    select contact.id
    from public.contacts as contact
    cross join search_input as input
    where length(input.normalized_query) >= 3
      and (select allowed from access_state)
      and public.portal_search_document(
        contact.name,
        contact.email,
        contact.phone,
        contact.address
      ) ilike input.contains_pattern escape E'\\'
  ),
  contact_ranked as (
    select
      contact.id,
      contact.name,
      contact.email,
      contact.phone,
      contact.address,
      min(
        case
          when lower(btrim(field_value.candidate)) = input.normalized_query
            then field_value.priority
          when lower(btrim(field_value.candidate)) like input.prefix_pattern escape E'\\'
            then 10 + field_value.priority
          when exists (
            select 1
            from regexp_split_to_table(lower(btrim(field_value.candidate)), E'\\s+') as token
            where token like input.prefix_pattern escape E'\\'
          )
            then 20 + field_value.priority
          else 30 + field_value.priority
        end
      )::integer as search_rank
    from contact_candidate_ids as candidate
    join public.contacts as contact on contact.id = candidate.id
    cross join search_input as input
    cross join lateral (
      values
        (contact.name, 0),
        (contact.email, 1),
        (contact.phone, 2),
        (contact.address, 3)
    ) as field_value(candidate, priority)
    where field_value.candidate is not null
      and field_value.candidate ilike input.contains_pattern escape E'\\'
    group by
      contact.id,
      contact.name,
      contact.email,
      contact.phone,
      contact.address
  ),
  contact_results as (
    select *
    from contact_ranked
    order by search_rank, lower(name), id
    limit (select bounded_limit from search_input)
  )
  select
    combined.access_granted,
    combined.entity_kind,
    combined.entity_id,
    combined.name,
    combined.reference,
    combined.site_address,
    combined.contact_name,
    combined.pipeline_stage,
    combined.archived_at,
    combined.email,
    combined.phone,
    combined.address
  from (
    select
      -1 as kind_order,
      -1 as search_rank,
      access.allowed as access_granted,
      null::text as entity_kind,
      null::uuid as entity_id,
      null::text as name,
      null::text as reference,
      null::text as site_address,
      null::text as contact_name,
      null::text as pipeline_stage,
      null::timestamptz as archived_at,
      null::text as email,
      null::text as phone,
      null::text as address
    from access_state as access

    union all

    select
      0 as kind_order,
      project.search_rank,
      true as access_granted,
      'project'::text as entity_kind,
      project.id as entity_id,
      project.name,
      project.reference,
      project.site_address,
      project.contact_name,
      project.pipeline_stage,
      project.archived_at,
      null::text as email,
      null::text as phone,
      null::text as address
    from project_results as project

    union all

    select
      1 as kind_order,
      contact.search_rank,
      true as access_granted,
      'contact'::text as entity_kind,
      contact.id as entity_id,
      contact.name,
      null::text as reference,
      null::text as site_address,
      null::text as contact_name,
      null::text as pipeline_stage,
      null::timestamptz as archived_at,
      contact.email,
      contact.phone,
      contact.address
    from contact_results as contact
  ) as combined
  order by combined.kind_order, combined.search_rank, lower(combined.name), combined.entity_id;
$function$;

revoke all on function public.portal_search_v1(text, integer) from public, anon;
grant execute on function public.portal_search_v1(text, integer) to authenticated, service_role;

comment on function public.portal_search_v1(text, integer) is
  'Bounded Projects and Contacts header search with bigram support for two-character contains queries. SECURITY INVOKER preserves caller RLS and reports portal access in-band.';

notify pgrst, 'reload schema';
