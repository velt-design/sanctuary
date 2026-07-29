-- Bounded staff list read models and normalized duplicate detection.
-- These functions are SECURITY INVOKER: the request's authenticated role and
-- existing Projects/Contacts RLS remain authoritative.

create or replace function public.staff_find_contact_duplicates_v1(
  p_email text default null,
  p_phone text default null,
  p_exclude_contact_id uuid default null
)
returns table (
  id uuid,
  name text,
  email text,
  phone text,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security invoker
set search_path = public, extensions, pg_temp
as $function$
  with input as (
    select
      lower(btrim(coalesce(p_email, ''))) as normalized_email,
      regexp_replace(coalesce(p_phone, ''), '[^0-9]+', '', 'g') as normalized_phone
  )
  select
    contact.id,
    contact.name,
    contact.email,
    contact.phone,
    contact.created_at,
    contact.updated_at
  from public.contacts as contact
  cross join input
  where (select public.has_portal_access())
    and (p_exclude_contact_id is null or contact.id <> p_exclude_contact_id)
    and (
      (
        input.normalized_email <> ''
        and lower(btrim(coalesce(contact.email, ''))) = input.normalized_email
      )
      or (
        length(input.normalized_phone) >= 7
        and regexp_replace(coalesce(contact.phone, ''), '[^0-9]+', '', 'g') = input.normalized_phone
      )
    )
  order by
    case
      when input.normalized_email <> ''
        and lower(btrim(coalesce(contact.email, ''))) = input.normalized_email
      then 0
      else 1
    end,
    lower(contact.name),
    contact.id
  limit 10;
$function$;

create or replace function public.staff_contacts_index_v1(
  p_search text default '',
  p_page integer default 1,
  p_page_size integer default 50,
  p_sort text default 'name_asc'
)
returns jsonb
language sql
stable
security invoker
set search_path = public, extensions, pg_temp
as $function$
  with input as (
    select
      lower(btrim(coalesce(p_search, ''))) as normalized_query,
      '%' || replace(
        replace(
          replace(lower(btrim(coalesce(p_search, ''))), E'\\', E'\\\\'),
          '%',
          E'\\%'
        ),
        '_',
        E'\\_'
      ) || '%' as contains_pattern,
      regexp_replace(coalesce(p_search, ''), '[^0-9]+', '', 'g') as phone_query,
      greatest(1, coalesce(p_page, 1)) as page_number,
      greatest(10, least(coalesce(p_page_size, 50), 100)) as page_size,
      case
        when p_sort in ('name_asc', 'name_desc', 'created_desc', 'created_asc') then p_sort
        else 'name_asc'
      end as sort_key
  ),
  filtered as materialized (
    select contact.*
    from public.contacts as contact
    cross join input
    where (select public.has_portal_access())
      and (
        input.normalized_query = ''
        or contact.portal_search_document ilike input.contains_pattern escape E'\\'
        or (
          length(input.phone_query) >= 3
          and regexp_replace(coalesce(contact.phone, ''), '[^0-9]+', '', 'g')
            like '%' || input.phone_query || '%'
        )
      )
  ),
  ordered as (
    select filtered.*
    from filtered
    cross join input
    order by
      case when input.sort_key = 'name_asc' then lower(filtered.name) end asc nulls last,
      case when input.sort_key = 'name_desc' then lower(filtered.name) end desc nulls last,
      case when input.sort_key = 'created_desc' then filtered.created_at end desc nulls last,
      case when input.sort_key = 'created_asc' then filtered.created_at end asc nulls last,
      filtered.id asc
    offset (
      select (page_number - 1) * page_size
      from input
    )
    limit (select page_size from input)
  ),
  rows_json as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', ordered.id,
          'name', ordered.name,
          'email', ordered.email,
          'phone', ordered.phone,
          'created_at', ordered.created_at,
          'updated_at', ordered.updated_at
        )
        order by
          case when input.sort_key = 'name_asc' then lower(ordered.name) end asc nulls last,
          case when input.sort_key = 'name_desc' then lower(ordered.name) end desc nulls last,
          case when input.sort_key = 'created_desc' then ordered.created_at end desc nulls last,
          case when input.sort_key = 'created_asc' then ordered.created_at end asc nulls last,
          ordered.id asc
      ),
      '[]'::jsonb
    ) as rows
    from ordered
    cross join input
  )
  select jsonb_build_object(
    'rows', rows_json.rows,
    'totalCount', (select count(*) from filtered),
    'page', (select page_number from input),
    'pageSize', (select page_size from input)
  )
  from rows_json;
$function$;

create or replace function public.staff_projects_index_v1(
  p_archive text default 'active',
  p_search text default '',
  p_status text default 'all',
  p_due text default 'all',
  p_today date default current_date,
  p_page integer default 1,
  p_page_size integer default 50,
  p_sort text default 'newest'
)
returns jsonb
language sql
stable
security invoker
set search_path = public, extensions, pg_temp
as $function$
  with input as (
    select
      case when p_archive in ('active', 'archived', 'all') then p_archive else 'active' end as archive_filter,
      lower(btrim(coalesce(p_search, ''))) as normalized_query,
      '%' || replace(
        replace(
          replace(lower(btrim(coalesce(p_search, ''))), E'\\', E'\\\\'),
          '%',
          E'\\%'
        ),
        '_',
        E'\\_'
      ) || '%' as contains_pattern,
      regexp_replace(coalesce(p_search, ''), '[^0-9]+', '', 'g') as phone_query,
      upper(btrim(coalesce(p_status, 'all'))) as status_filter,
      case when p_due in ('all', 'due', 'overdue', 'today') then p_due else 'all' end as due_filter,
      coalesce(p_today, current_date) as today,
      greatest(1, coalesce(p_page, 1)) as page_number,
      greatest(10, least(coalesce(p_page_size, 50), 100)) as page_size,
      case
        when p_sort in ('newest', 'oldest', 'name_asc', 'name_desc', 'next_action_asc', 'next_action_desc') then p_sort
        else 'newest'
      end as sort_key
  ),
  filtered as materialized (
    select
      project.*,
      contact.name as contact_name,
      contact.email as contact_email,
      contact.phone as contact_phone,
      contact.created_at as contact_created_at,
      contact.updated_at as contact_updated_at
    from public.projects as project
    left join public.contacts as contact on contact.id = project.contact_id
    cross join input
    where (select public.has_portal_access())
      and (
        input.archive_filter = 'all'
        or (input.archive_filter = 'active' and project.archived_at is null)
        or (input.archive_filter = 'archived' and project.archived_at is not null)
      )
      and (
        input.status_filter = 'ALL'
        or upper(project.pipeline_stage) = input.status_filter
      )
      and (
        input.due_filter = 'all'
        or (input.due_filter = 'due' and project.follow_up_date <= input.today)
        or (input.due_filter = 'overdue' and project.follow_up_date < input.today)
        or (input.due_filter = 'today' and project.follow_up_date = input.today)
      )
      and (
        input.normalized_query = ''
        or project.portal_search_document ilike input.contains_pattern escape E'\\'
        or contact.portal_search_document ilike input.contains_pattern escape E'\\'
        or lower(coalesce(project.region, '')) ilike input.contains_pattern escape E'\\'
        or (
          length(input.phone_query) >= 3
          and regexp_replace(coalesce(contact.phone, ''), '[^0-9]+', '', 'g')
            like '%' || input.phone_query || '%'
        )
      )
  ),
  ordered as (
    select filtered.*
    from filtered
    cross join input
    order by
      case when input.sort_key = 'newest' then filtered.created_at end desc nulls last,
      case when input.sort_key = 'oldest' then filtered.created_at end asc nulls last,
      case when input.sort_key = 'name_asc' then lower(filtered.name) end asc nulls last,
      case when input.sort_key = 'name_desc' then lower(filtered.name) end desc nulls last,
      case when input.sort_key = 'next_action_asc' then filtered.follow_up_date end asc nulls last,
      case when input.sort_key = 'next_action_desc' then filtered.follow_up_date end desc nulls last,
      filtered.created_at desc,
      filtered.id asc
    offset (
      select (page_number - 1) * page_size
      from input
    )
    limit (select page_size from input)
  ),
  rows_json as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', ordered.id,
          'contact_id', ordered.contact_id,
          'name', ordered.name,
          'quote_ref', ordered.quote_ref,
          'region', ordered.region,
          'site_address', ordered.site_address,
          'pipeline_stage', ordered.pipeline_stage,
          'follow_up_date', ordered.follow_up_date,
          'archived_at', ordered.archived_at,
          'notes', ordered.notes,
          'created_at', ordered.created_at,
          'updated_at', ordered.updated_at,
          'deposit_amount_cents', ordered.deposit_amount_cents,
          'deposit_paid_date', ordered.deposit_paid_date,
          'final_payment_date', ordered.final_payment_date,
          'contact_name', ordered.contact_name,
          'contact_email', ordered.contact_email,
          'contact_phone', ordered.contact_phone,
          'contact_created_at', ordered.contact_created_at,
          'contact_updated_at', ordered.contact_updated_at
        )
        order by
          case when input.sort_key = 'newest' then ordered.created_at end desc nulls last,
          case when input.sort_key = 'oldest' then ordered.created_at end asc nulls last,
          case when input.sort_key = 'name_asc' then lower(ordered.name) end asc nulls last,
          case when input.sort_key = 'name_desc' then lower(ordered.name) end desc nulls last,
          case when input.sort_key = 'next_action_asc' then ordered.follow_up_date end asc nulls last,
          case when input.sort_key = 'next_action_desc' then ordered.follow_up_date end desc nulls last,
          ordered.created_at desc,
          ordered.id asc
      ),
      '[]'::jsonb
    ) as rows
    from ordered
    cross join input
  )
  select jsonb_build_object(
    'rows', rows_json.rows,
    'totalCount', (select count(*) from filtered),
    'page', (select page_number from input),
    'pageSize', (select page_size from input)
  )
  from rows_json;
$function$;

revoke all on function public.staff_find_contact_duplicates_v1(text, text, uuid) from public, anon;
revoke all on function public.staff_contacts_index_v1(text, integer, integer, text) from public, anon;
revoke all on function public.staff_projects_index_v1(text, text, text, text, date, integer, integer, text) from public, anon;

grant execute on function public.staff_find_contact_duplicates_v1(text, text, uuid) to authenticated, service_role;
grant execute on function public.staff_contacts_index_v1(text, integer, integer, text) to authenticated, service_role;
grant execute on function public.staff_projects_index_v1(text, text, text, text, date, integer, integer, text) to authenticated, service_role;

comment on function public.staff_find_contact_duplicates_v1(text, text, uuid) is
  'Returns at most ten strong normalized email/phone duplicate candidates for staff project creation.';
comment on function public.staff_contacts_index_v1(text, integer, integer, text) is
  'Returns one bounded, filtered, sorted Contacts page for the staff portal.';
comment on function public.staff_projects_index_v1(text, text, text, text, date, integer, integer, text) is
  'Returns one bounded, filtered, sorted Projects page with its linked contact display fields.';

select pg_notify('pgrst', 'reload schema');
