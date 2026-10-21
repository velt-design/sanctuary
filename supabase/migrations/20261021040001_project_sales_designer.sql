-- Sales attribution is independent of visit attendance and current project ownership.
create table private.project_sales_designers (
  project_id uuid primary key references public.projects(id),
  designer_key text check (designer_key in ('ellen','jordan','jp','joe','bruce','dave')),
  revision integer not null check (revision > 0),
  basis text not null check (length(btrim(basis)) between 3 and 500),
  updated_at timestamptz not null,
  updated_by uuid not null references auth.users(id)
);
create table private.project_sales_designer_commands (
  command_id uuid primary key,
  project_id uuid not null references public.projects(id),
  actor_id uuid not null references auth.users(id),
  request jsonb not null,
  before_assignment jsonb not null,
  result jsonb not null,
  recorded_at timestamptz not null default now()
);
alter table private.project_sales_designers enable row level security;
alter table private.project_sales_designer_commands enable row level security;
revoke all on private.project_sales_designers,private.project_sales_designer_commands from public,anon,authenticated,service_role;

create function private.sales_designer_actor() returns uuid
language plpgsql volatile security definer set search_path=pg_catalog,pg_temp as $$
declare actor uuid:=auth.uid();
begin
  if actor is null then raise exception 'Owner access required' using errcode='42501'; end if;
  perform 1 from auth.users u where u.id=actor and lower(u.email)='jordan@sanctuarypergolas.co.nz'
    and u.email_confirmed_at is not null and u.deleted_at is null and (u.banned_until is null or u.banned_until<now()) for share;
  if not found then raise exception 'Owner access required' using errcode='42501'; end if;
  perform 1 from public.portal_users p where p.user_id=actor and p.role in ('staff','admin') for share;
  if not found then raise exception 'Staff access required' using errcode='42501'; end if;
  return actor;
end $$;
revoke all on function private.sales_designer_actor() from public,anon,authenticated,service_role;

create function private.sales_designer_json(p_project uuid) returns jsonb
language sql stable set search_path=pg_catalog,pg_temp as $$
  select jsonb_build_object('projectId',p_project,'designerKey',a.designer_key,'revision',coalesce(a.revision,0),
    'updatedAt',a.updated_at,'basis',a.basis) from (select 1) seed
    left join private.project_sales_designers a on a.project_id=p_project
$$;
revoke all on function private.sales_designer_json(uuid) from public,anon,authenticated,service_role;

-- POST RPCs are VOLATILE because the actor guard deliberately locks authority rows.
create function public.project_sales_designer_read(p_project uuid) returns jsonb
language plpgsql volatile security definer set search_path=pg_catalog,pg_temp as $$
begin
  perform private.sales_designer_actor();
  if not exists(select 1 from public.projects where id=p_project) then raise exception 'Project unavailable' using errcode='P0002'; end if;
  return private.sales_designer_json(p_project);
end $$;

create function public.project_sales_designer_assign(p_project uuid,p_command uuid,p_expected_revision integer,p_designer text,p_basis text) returns jsonb
language plpgsql volatile security definer set search_path=pg_catalog,pg_temp as $$
declare actor uuid; body jsonb; previous private.project_sales_designer_commands%rowtype; before_value jsonb; result jsonb;
begin
  actor:=private.sales_designer_actor();
  if p_project is null or p_command is null or p_expected_revision is null or p_expected_revision<0
    or (p_designer is not null and p_designer not in ('ellen','jordan','jp','joe','bruce','dave'))
    or p_basis is null or length(btrim(p_basis)) not between 3 and 500 then
    raise exception 'Invalid sales designer assignment' using errcode='22023'; end if;
  body:=jsonb_build_object('projectId',p_project,'expectedRevision',p_expected_revision,'designerKey',p_designer,'basis',btrim(p_basis));
  perform pg_advisory_xact_lock(hashtextextended('sales-designer:'||p_command::text,0));
  select * into previous from private.project_sales_designer_commands where command_id=p_command;
  if found then
    if previous.actor_id<>actor or previous.request<>body then raise exception 'Command already used' using errcode='40001'; end if;
    return previous.result;
  end if;
  perform 1 from public.projects where id=p_project for update;
  if not found then raise exception 'Project unavailable' using errcode='P0002'; end if;
  before_value:=private.sales_designer_json(p_project);
  if (before_value->>'revision')::integer<>p_expected_revision then raise exception 'Assignment changed; reload before saving' using errcode='40001'; end if;
  insert into private.project_sales_designers(project_id,designer_key,revision,basis,updated_at,updated_by)
    values(p_project,p_designer,p_expected_revision+1,btrim(p_basis),now(),actor)
    on conflict(project_id) do update set designer_key=excluded.designer_key,revision=excluded.revision,basis=excluded.basis,
      updated_at=excluded.updated_at,updated_by=excluded.updated_by;
  result:=private.sales_designer_json(p_project);
  insert into private.project_sales_designer_commands(command_id,project_id,actor_id,request,before_assignment,result)
    values(p_command,p_project,actor,body,before_value,result);
  return result;
end $$;
revoke all on function public.project_sales_designer_read(uuid),public.project_sales_designer_assign(uuid,uuid,integer,text,text) from public,anon,service_role;
grant execute on function public.project_sales_designer_read(uuid),public.project_sales_designer_assign(uuid,uuid,integer,text,text) to authenticated;

-- Additive report projection. Visit, commercial and access semantics are unchanged.
create or replace function public.marketing_designer_performance_read(p_start date,p_end date) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,pg_temp as $$
declare result jsonb;
begin
  if auth.uid() is null or public.has_portal_access() is not true then raise exception 'Staff access required' using errcode='42501'; end if;
  if not exists(select 1 from auth.users u where u.id=auth.uid() and lower(u.email)='jordan@sanctuarypergolas.co.nz'
    and u.email_confirmed_at is not null and u.deleted_at is null and (u.banned_until is null or u.banned_until<now())) then
    raise exception 'Developer access required' using errcode='42501'; end if;
  if p_start is null or p_end is null or p_end<p_start or p_end-p_start>365 or p_end>(now() at time zone 'Pacific/Auckland')::date then
    raise exception 'Choose up to 366 days ending today or earlier' using errcode='22023'; end if;
  -- Full retained history is needed to anchor the first original visit. Never truncate it.
  if (select count(*) from private.outlook_calendar_visits where not hidden and (select enabled from private.outlook_calendar_control where singleton))+(select count(*) from private.site_visit_details where source_visit_id is null)>5000
    or (select count(*) from public.quotes)>5000 or (select count(*) from private.project_sales_designers)>5000 then raise exception 'Designer reporting limit reached' using errcode='54000'; end if;
  with visits as materialized (
    select private.designer_visit_fact(private.outlook_calendar_visit_json(v)) body from private.outlook_calendar_visits v where not v.hidden
      and (select enabled from private.outlook_calendar_control where singleton)
    union all select private.designer_visit_fact(private.site_visit_history_json(d)) from private.site_visit_details d where d.source_visit_id is null
  ), accepted as materialized (
    select a.* from public.projects p cross join lateral public.commercial_current_accepted_quote_versions(p.id) a
  ), scopes as (
    select q.id,q.project_id,jsonb_build_object('id',q.id,'projectId',q.project_id,'reference',q.quote_ref,
      'addOn',q.commercial_scope_id is not null,
      'firstSentAt',(select min(v.sent_at) from public.quote_versions v where v.quote_id=q.id),
      'undatedSend',exists(select 1 from public.quote_versions v where v.quote_id=q.id and v.sent_at is null and (v.accepted_at is not null or v.status in ('SENT','ACCEPTED'))),
      'acceptedAt',av.accepted_at,'accepted',a.quote_id is not null,'valueCents',a.total_inc_gst_cents,
      'paymentEvidence',a.quote_id is not null and (f.facts->>'cancelled')::boolean is false and exists(select 1 from public.deposit_invoices i where i.quote_id=a.quote_id and i.payment_term_position=1 and i.currency='NZD' and i.status<>'VOID'
        and ((i.status='PAID' and i.total_inc_gst_cents>0) or exists(select 1 from public.xero_deposit_matches m
          join public.project_payment_entries e on e.id=m.payment_entry_id and e.entry_type='PAYMENT'
          where m.invoice_id=i.id and m.reversed_at is null and m.amount_inc_gst_cents>0
            and not exists(select 1 from public.project_payment_entries r where r.reverses_entry_id=e.id)))),
      'paidAt',case when (f.facts->>'cancelled')::boolean is false and a.total_inc_gst_cents>0 then f.facts->>'occurred_at' end) body
    from public.quotes q left join accepted a on a.quote_id=q.id left join public.quote_versions av on av.id=a.quote_version_id
    left join private.advertising_scope_facts() f on f.quote_id=q.id
    where q.project_id not in ('10c5db1a-602c-4f0c-8193-855b186215bb'::uuid,'9d98b82b-679a-4ecb-8265-9fa05eaa78ef'::uuid)
  ) select jsonb_build_object('schemaVersion',1,'asOf',now(),'start',p_start,'end',p_end,
    'source',(select jsonb_build_object('enabled',enabled,'lastSuccess',last_success,'failed',last_error is not null,
      'rangeStart',range_start,'rangeEnd',range_end,'firstImportedAt',(select min(first_seen) from private.outlook_calendar_visits)) from private.outlook_calendar_control where singleton),
    'visits',coalesce((select jsonb_agg(v.body||jsonb_build_object('contactId',p.contact_id) order by v.body->>'id') from visits v
      left join public.projects p on p.id=(v.body->>'projectId')::uuid
      where p.id is null or p.id not in ('10c5db1a-602c-4f0c-8193-855b186215bb'::uuid,'9d98b82b-679a-4ecb-8265-9fa05eaa78ef'::uuid)),'[]'),
    'scopes',coalesce((select jsonb_agg(body order by id) from scopes),'[]'),
    'assignments',coalesce((select jsonb_agg(private.sales_designer_json(a.project_id) order by a.project_id) from private.project_sales_designers a),'[]')) into result;
  return result;
end $$;
revoke all on function public.marketing_designer_performance_read(date,date) from public,anon,service_role;
grant execute on function public.marketing_designer_performance_read(date,date) to authenticated;
