-- Dashboard snapshot RPC for instant portal load.

create or replace function public.dashboard_snapshot_v1(
  queue_mode text default 'today',
  tz text default 'Pacific/Auckland'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  today_date date;
  next7_date date;
  queue_to date;
  today_start timestamptz;
  tomorrow_start timestamptz;
  next7_start timestamptz;
  has_next_action_type boolean;
  has_archived_at boolean;
  archived_filter text;
  follow_up_col text;
  actions_due_count int;
  overdue_count int;
  due_today_count int;
  oldest_overdue_days int;
  new_leads_count int;
  quotes_to_send_count int;
  kpis_json jsonb;
  attention_json jsonb;
  pipeline_json jsonb;
  work_queue_json jsonb;
  schedule_starting_json jsonb;
  crew_next_json jsonb;
  site_visits_json jsonb;
  result jsonb;
begin
  today_date := (now() at time zone tz)::date;
  next7_date := (today_date + 7);

  if queue_mode = 'today' then
    queue_to := today_date;
  elsif queue_mode = 'next7' then
    queue_to := next7_date;
  else
    queue_to := null;
  end if;

  today_start := (today_date::timestamp at time zone tz);
  tomorrow_start := ((today_date + 1)::timestamp at time zone tz);
  next7_start := (next7_date::timestamp at time zone tz);

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'projects'
      and column_name = 'next_action_type'
  ) into has_next_action_type;

  select column_name
  into follow_up_col
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'projects'
    and column_name in ('follow_up_date', 'next_action_date')
  order by case when column_name = 'follow_up_date' then 1 else 2 end
  limit 1;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'projects'
      and column_name = 'archived_at'
  ) into has_archived_at;

  archived_filter := case when has_archived_at then ' and p.archived_at is null' else '' end;

  if follow_up_col is not null then
    execute format(
      'select count(*) from projects p where p.%I is not null and p.%I <= $1%s',
      follow_up_col,
      follow_up_col,
      archived_filter
    ) into actions_due_count using today_date;

    execute format(
      'select count(*) from projects p where p.%I is not null and p.%I < $1%s',
      follow_up_col,
      follow_up_col,
      archived_filter
    ) into overdue_count using today_date;

    execute format(
      'select count(*) from projects p where p.%I = $1%s',
      follow_up_col,
      archived_filter
    ) into due_today_count using today_date;

    execute format(
      'select ($1::date - min(p.%I))::int from projects p where p.%I is not null and p.%I < $1%s',
      follow_up_col,
      follow_up_col,
      follow_up_col,
      archived_filter
    ) into oldest_overdue_days using today_date;
  else
    actions_due_count := 0;
    overdue_count := 0;
    due_today_count := 0;
    oldest_overdue_days := null;
  end if;

  execute format(
    'select count(*) from projects p where p.pipeline_stage = ''NEW''%s',
    archived_filter
  ) into new_leads_count;

  execute format(
    'select count(*) from projects p where p.pipeline_stage = ''QUOTING''%s',
    archived_filter
  ) into quotes_to_send_count;

  select jsonb_build_object(
    'actions_due', actions_due_count,
    'new_leads', new_leads_count,
    'quotes_to_send', quotes_to_send_count,
    'installs_this_week', (
      select count(*)
      from schedule_items si
      where si.start_date >= today_date
        and si.start_date < next7_date
    )
  )
  into kpis_json;

  select jsonb_build_object(
    'overdue_actions', overdue_count,
    'due_today', due_today_count,
    'oldest_overdue_days', oldest_overdue_days,
    'unscheduled_estimates', (
      select count(*)
      from (
        select distinct e.project_id
        from estimates e
        where coalesce(e.status, 'draft') <> 'archived'
          and not exists (
            select 1
            from schedule_items si
            where si.project_id = e.project_id
          )
      ) x
    ),
    'site_visits_to_book', (
      select count(*)
      from site_visit_events sv
      where sv.status = 'UNSCHEDULED'
    ),
    'quotes_to_send', quotes_to_send_count,
    'email_failures', (
      select count(*)
      from email_outbox eo
      where eo.status = 'FAILED'
    )
  )
  into attention_json;

  execute format(
    'select coalesce(jsonb_object_agg(stage, cnt), ''{}''::jsonb)
     from (
       select p.pipeline_stage as stage, count(*)::int as cnt
       from projects p
       where 1=1%s
       group by p.pipeline_stage
     ) s',
    archived_filter
  ) into pipeline_json;

  if follow_up_col is null then
    work_queue_json := '[]'::jsonb;
  elsif has_next_action_type then
    execute format(
      'select coalesce(jsonb_agg(row_to_json(x)::jsonb), ''[]''::jsonb) from (
        select
          p.id as project_id,
          p.name as project_name,
          p.pipeline_stage as status,
          p.next_action_type as next_action_label,
          p.%I as next_action_date,
          p.updated_at as last_activity_at,
          c.name as client_name
        from projects p
        left join contacts c on c.id = p.contact_id
        where p.%I is not null
          %s
          and ($1::date is null or p.%I <= $1)
        order by p.%I asc
        limit 15
      ) x',
      follow_up_col,
      follow_up_col,
      archived_filter,
      follow_up_col,
      follow_up_col
    )
    into work_queue_json
    using queue_to;
  else
    execute format(
      'select coalesce(jsonb_agg(row_to_json(x)::jsonb), ''[]''::jsonb) from (
        select
          p.id as project_id,
          p.name as project_name,
          p.pipeline_stage as status,
          null::text as next_action_label,
          p.%I as next_action_date,
          p.updated_at as last_activity_at,
          c.name as client_name
        from projects p
        left join contacts c on c.id = p.contact_id
        where p.%I is not null
          %s
          and ($1::date is null or p.%I <= $1)
        order by p.%I asc
        limit 15
      ) x',
      follow_up_col,
      follow_up_col,
      archived_filter,
      follow_up_col,
      follow_up_col
    )
    into work_queue_json
    using queue_to;
  end if;

  if has_archived_at then
    select coalesce(jsonb_agg(row_to_json(x)::jsonb), '[]'::jsonb)
    into schedule_starting_json
    from (
      select
        si.start_date,
        si.duration_days,
        sc.name as crew_name,
        p.id as project_id,
        p.name as project_name
      from schedule_items si
      join schedule_crews sc on sc.id = si.crew_id
      join projects p on p.id = si.project_id
      where si.start_date >= today_date
        and si.start_date < next7_date
        and p.archived_at is null
      order by si.start_date asc
      limit 10
    ) x;
  else
    select coalesce(jsonb_agg(row_to_json(x)::jsonb), '[]'::jsonb)
    into schedule_starting_json
    from (
      select
        si.start_date,
        si.duration_days,
        sc.name as crew_name,
        p.id as project_id,
        p.name as project_name
      from schedule_items si
      join schedule_crews sc on sc.id = si.crew_id
      join projects p on p.id = si.project_id
      where si.start_date >= today_date
        and si.start_date < next7_date
      order by si.start_date asc
      limit 10
    ) x;
  end if;

  select coalesce(jsonb_agg(row_to_json(x)::jsonb), '[]'::jsonb)
  into crew_next_json
  from (
    select
      sc.name as crew_name,
      coalesce((max(si.end_date) + 1), today_date) as next_available_date
    from schedule_crews sc
    left join schedule_items si on si.crew_id = sc.id and si.end_date >= today_date
    group by sc.name
    order by sc.name asc
  ) x;

  if has_archived_at then
    select jsonb_build_object(
      'unscheduled_count', (
        select count(*)
        from site_visit_events sv
        where sv.status = 'UNSCHEDULED'
      ),
      'today', coalesce((
        select jsonb_agg(row_to_json(x)::jsonb)
        from (
          select
            sv.id,
            sv.scheduled_start as starts_at,
            sv.assigned_sales_owner_id as assigned_to,
            p.id as project_id,
            p.name as project_name,
            p.site_address as location_label,
            c.name as client_name
          from site_visit_events sv
          join projects p on p.id = sv.project_id
          left join contacts c on c.id = p.contact_id
          where sv.status in ('TENTATIVE','CONFIRMED','COMPLETED','RESCHEDULED')
            and sv.scheduled_start is not null
            and sv.scheduled_start >= today_start
            and sv.scheduled_start < tomorrow_start
            and p.archived_at is null
          order by sv.scheduled_start asc
          limit 15
        ) x
      ), '[]'::jsonb),
      'next7', coalesce((
        select jsonb_agg(row_to_json(x)::jsonb)
        from (
          select
            sv.id,
            sv.scheduled_start as starts_at,
            sv.assigned_sales_owner_id as assigned_to,
            p.id as project_id,
            p.name as project_name,
            p.site_address as location_label,
            c.name as client_name
          from site_visit_events sv
          join projects p on p.id = sv.project_id
          left join contacts c on c.id = p.contact_id
          where sv.status in ('TENTATIVE','CONFIRMED','COMPLETED','RESCHEDULED')
            and sv.scheduled_start is not null
            and sv.scheduled_start >= today_start
            and sv.scheduled_start < next7_start
            and p.archived_at is null
          order by sv.scheduled_start asc
          limit 15
        ) x
      ), '[]'::jsonb)
    )
    into site_visits_json;
  else
    select jsonb_build_object(
      'unscheduled_count', (
        select count(*)
        from site_visit_events sv
        where sv.status = 'UNSCHEDULED'
      ),
      'today', coalesce((
        select jsonb_agg(row_to_json(x)::jsonb)
        from (
          select
            sv.id,
            sv.scheduled_start as starts_at,
            sv.assigned_sales_owner_id as assigned_to,
            p.id as project_id,
            p.name as project_name,
            p.site_address as location_label,
            c.name as client_name
          from site_visit_events sv
          join projects p on p.id = sv.project_id
          left join contacts c on c.id = p.contact_id
          where sv.status in ('TENTATIVE','CONFIRMED','COMPLETED','RESCHEDULED')
            and sv.scheduled_start is not null
            and sv.scheduled_start >= today_start
            and sv.scheduled_start < tomorrow_start
          order by sv.scheduled_start asc
          limit 15
        ) x
      ), '[]'::jsonb),
      'next7', coalesce((
        select jsonb_agg(row_to_json(x)::jsonb)
        from (
          select
            sv.id,
            sv.scheduled_start as starts_at,
            sv.assigned_sales_owner_id as assigned_to,
            p.id as project_id,
            p.name as project_name,
            p.site_address as location_label,
            c.name as client_name
          from site_visit_events sv
          join projects p on p.id = sv.project_id
          left join contacts c on c.id = p.contact_id
          where sv.status in ('TENTATIVE','CONFIRMED','COMPLETED','RESCHEDULED')
            and sv.scheduled_start is not null
            and sv.scheduled_start >= today_start
            and sv.scheduled_start < next7_start
          order by sv.scheduled_start asc
          limit 15
        ) x
      ), '[]'::jsonb)
    )
    into site_visits_json;
  end if;

  select jsonb_build_object(
    'updated_at', now(),
    'kpis', kpis_json,
    'attention_counts', attention_json,
    'pipeline_counts', pipeline_json,
    'work_queue', work_queue_json,
    'schedule', jsonb_build_object(
      'starting_soon', schedule_starting_json,
      'crew_next_available', crew_next_json
    ),
    'site_visits', site_visits_json
  )
  into result;

  return result;
end;
$$;

revoke all on function public.dashboard_snapshot_v1(text, text) from public;
grant execute on function public.dashboard_snapshot_v1(text, text) to authenticated;
grant execute on function public.dashboard_snapshot_v1(text, text) to service_role;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'projects'
      and column_name = 'follow_up_date'
  ) then
    create index if not exists projects_follow_up_date_idx on public.projects(follow_up_date);
  elsif exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'projects'
      and column_name = 'next_action_date'
  ) then
    create index if not exists projects_next_action_date_idx on public.projects(next_action_date);
  end if;
end $$;

create index if not exists projects_pipeline_stage_idx on public.projects(pipeline_stage);
create index if not exists schedule_items_start_date_idx on public.schedule_items(start_date);
create index if not exists schedule_items_crew_id_idx on public.schedule_items(crew_id);
create index if not exists site_visit_events_scheduled_start_idx on public.site_visit_events(scheduled_start);

select pg_notify('pgrst', 'reload schema');
