-- Project pipeline accountability read model.
--
-- Adds Project Owner filtering and state context to the bounded Projects index.
-- This is a read-only forward contract; existing V2 project/work mutations and
-- the portfolio rollout remain unchanged.

create or replace function public.staff_projects_index_v3(
  p_archive text default 'active',
  p_search text default '',
  p_status text default 'all',
  p_due text default 'all',
  p_today date default current_date,
  p_page integer default 1,
  p_page_size integer default 50,
  p_sort text default 'newest',
  p_state text default 'all',
  p_stages text[] default null,
  p_owner text default 'all'
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public, extensions, pg_temp
as $function$
declare
  v_result jsonb;
begin
  if exists (
    select 1
    from public.projects project
    left join public.project_work_model_versions model
      on model.project_id = project.id
      and model.model_version = 2
    left join public.project_operational_states state
      on state.project_id = project.id
    where model.project_id is null
      or state.project_id is null
  ) then
    raise exception
      'PROJECT_WORK_ROLLOUT_INCOMPLETE: project marker/state is missing'
      using errcode = 'P0001';
  end if;

  with input as (
    select
      case
        when p_archive in ('active','archived','all') then p_archive
        else 'active'
      end as archive_filter,
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
      regexp_replace(coalesce(p_search, ''), '[^0-9]+', '', 'g')
        as phone_query,
      upper(btrim(coalesce(p_status, 'all'))) as status_filter,
      coalesce(
        array(
          select distinct upper(btrim(stage))
          from unnest(coalesce(p_stages, array[]::text[])) stage
          where nullif(btrim(stage), '') is not null
        ),
        array[]::text[]
      ) as stage_filters,
      case
        when upper(btrim(coalesce(p_state, 'all'))) in (
          'ALL','ACTIVE','WAITING','CLOSED','ARCHIVED'
        ) then upper(btrim(coalesce(p_state, 'all')))
        else 'ALL'
      end as state_filter,
      case
        when lower(btrim(coalesce(p_owner, 'all'))) in (
          'all','unassigned','jordan','jp','joe','bruce'
        ) then lower(btrim(coalesce(p_owner, 'all')))
        else 'all'
      end as owner_filter,
      case
        when p_due in ('all','due','overdue','today') then p_due
        else 'all'
      end as due_filter,
      coalesce(p_today, current_date) as today,
      greatest(1, coalesce(p_page, 1)) as page_number,
      greatest(10, least(coalesce(p_page_size, 50), 100)) as page_size,
      case
        when p_sort in (
          'newest',
          'oldest',
          'name_asc',
          'name_desc',
          'next_action_asc',
          'next_action_desc'
        ) then p_sort
        else 'newest'
      end as sort_key
  ),
  filtered as materialized (
    select
      project.*,
      state.state as operational_state,
      state.waiting_until,
      state.waiting_reason,
      state.closed_outcome,
      case
        when project.archived_at is not null then 'ARCHIVED'
        else state.state
      end as effective_state,
      owner_assignment.owner_key as project_owner_key,
      contact.name as contact_name,
      contact.email as contact_email,
      contact.phone as contact_phone,
      contact.created_at as contact_created_at,
      contact.updated_at as contact_updated_at
    from public.projects project
    join public.project_work_model_versions model
      on model.project_id = project.id
      and model.model_version = 2
    join public.project_operational_states state
      on state.project_id = project.id
    left join public.project_owner_assignments owner_assignment
      on owner_assignment.project_id = project.id
    left join public.contacts contact on contact.id = project.contact_id
    cross join input
    where (select public.has_portal_access())
      and (
        input.archive_filter = 'all'
        or (
          input.archive_filter = 'active'
          and project.archived_at is null
        )
        or (
          input.archive_filter = 'archived'
          and project.archived_at is not null
        )
      )
      and (
        (
          cardinality(input.stage_filters) > 0
          and upper(project.pipeline_stage::text) = any(input.stage_filters)
        )
        or (
          cardinality(input.stage_filters) = 0
          and (
            input.status_filter = 'ALL'
            or upper(project.pipeline_stage::text) = input.status_filter
          )
        )
      )
      and (
        input.state_filter = 'ALL'
        or case
          when project.archived_at is not null then 'ARCHIVED'
          else state.state
        end = input.state_filter
      )
      and (
        input.owner_filter = 'all'
        or (
          input.owner_filter = 'unassigned'
          and owner_assignment.project_id is null
        )
        or owner_assignment.owner_key = input.owner_filter
      )
      and (
        input.due_filter = 'all'
        or (
          input.due_filter = 'due'
          and project.follow_up_date <= input.today
        )
        or (
          input.due_filter = 'overdue'
          and project.follow_up_date < input.today
        )
        or (
          input.due_filter = 'today'
          and project.follow_up_date = input.today
        )
      )
      and (
        input.normalized_query = ''
        or project.portal_search_document
          ilike input.contains_pattern escape E'\\'
        or contact.portal_search_document
          ilike input.contains_pattern escape E'\\'
        or lower(coalesce(project.region, ''))
          ilike input.contains_pattern escape E'\\'
        or (
          length(input.phone_query) >= 3
          and regexp_replace(
            coalesce(contact.phone, ''),
            '[^0-9]+',
            '',
            'g'
          ) like '%' || input.phone_query || '%'
        )
      )
  ),
  ordered as (
    select filtered.*
    from filtered
    cross join input
    order by
      case
        when input.sort_key = 'newest' then filtered.created_at
      end desc nulls last,
      case
        when input.sort_key = 'oldest' then filtered.created_at
      end asc nulls last,
      case
        when input.sort_key = 'name_asc' then lower(filtered.name)
      end asc nulls last,
      case
        when input.sort_key = 'name_desc' then lower(filtered.name)
      end desc nulls last,
      case
        when input.sort_key = 'next_action_asc'
          then filtered.follow_up_date
      end asc nulls last,
      case
        when input.sort_key = 'next_action_desc'
          then filtered.follow_up_date
      end desc nulls last,
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
          'operational_state', ordered.operational_state,
          'effective_state', ordered.effective_state,
          'waiting_until', ordered.waiting_until,
          'waiting_reason', ordered.waiting_reason,
          'closed_outcome', ordered.closed_outcome,
          'project_owner_key', ordered.project_owner_key,
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
          case
            when input.sort_key = 'newest' then ordered.created_at
          end desc nulls last,
          case
            when input.sort_key = 'oldest' then ordered.created_at
          end asc nulls last,
          case
            when input.sort_key = 'name_asc' then lower(ordered.name)
          end asc nulls last,
          case
            when input.sort_key = 'name_desc' then lower(ordered.name)
          end desc nulls last,
          case
            when input.sort_key = 'next_action_asc'
              then ordered.follow_up_date
          end asc nulls last,
          case
            when input.sort_key = 'next_action_desc'
              then ordered.follow_up_date
          end desc nulls last,
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
  into v_result
  from rows_json;

  return v_result;
end;
$function$;

revoke all on function public.staff_projects_index_v3(
  text,text,text,text,date,integer,integer,text,text,text[],text
) from public, anon, authenticated, service_role;
grant execute on function public.staff_projects_index_v3(
  text,text,text,text,date,integer,integer,text,text,text[],text
) to authenticated, service_role;

comment on function public.staff_projects_index_v3(
  text,text,text,text,date,integer,integer,text,text,text[],text
) is
  'Bounded staff Projects index with authoritative state, Project Owner filtering, and state context.';

select pg_notify('pgrst', 'reload schema');
