-- Reviewed facts are separate from the Outlook mirror. No booking, lifecycle,
-- notification, analytics or source-provider command is invoked by these records.
create table private.site_visit_details (
 id uuid primary key, source_visit_id uuid unique references private.outlook_calendar_visits(id),
 project_id uuid references public.projects(id), details jsonb not null, questions jsonb not null default '[]',
 basis text not null, reference_url text, reviewed_source jsonb, active boolean not null default true,
 withdrawn boolean not null default false, revision bigint not null default 1,
 created_by uuid not null references auth.users(id), updated_by uuid not null references auth.users(id),
 created_at timestamptz not null default clock_timestamp(), updated_at timestamptz not null default clock_timestamp(),
 check ((source_visit_id is not null and source_visit_id=id and project_id is null) or (source_visit_id is null and project_id is not null))
);
create index site_visit_details_project on private.site_visit_details(project_id);
create table private.site_visit_detail_history (
 id bigint generated always as identity primary key, detail_id uuid not null references private.site_visit_details(id),
 actor_id uuid not null references auth.users(id), action text not null,
 before_value jsonb, after_value jsonb not null, created_at timestamptz not null default clock_timestamp()
);
alter table private.site_visit_details enable row level security;
alter table private.site_visit_detail_history enable row level security;
revoke all on private.site_visit_details,private.site_visit_detail_history from public,anon,authenticated,service_role;

create function private.site_visit_material_source(v private.outlook_calendar_visits) returns jsonb language sql immutable set search_path=pg_catalog as $$
 select jsonb_build_object('source',v.payload-'sourceUrl'-'sourceId'-'reviewReasons','removed',v.removed,'projectId',v.project_id)
$$;

create function private.site_visit_people_equal(expected jsonb,actual jsonb) returns boolean language sql immutable set search_path=pg_catalog as $$
 select jsonb_array_length(expected)=jsonb_array_length(actual) and not exists(
 select 1 from jsonb_array_elements(expected) e where not exists(select 1 from jsonb_array_elements(actual) a
 where case when coalesce(e->>'email','')<>'' then lower(e->>'email')=lower(a->>'email') else lower(btrim(e->>'name'))=lower(btrim(a->>'name')) end))
$$;
create function private.site_visit_correction_changed(v private.outlook_calendar_visits,d private.site_visit_details) returns boolean language plpgsql stable set search_path=pg_catalog,private as $$
declare previous jsonb:=d.reviewed_source->'source';current jsonb:=v.payload;detail jsonb:=d.details;t jsonb:=d.details->'timing';matches boolean;
begin
 if (d.reviewed_source->>'removed')::boolean is distinct from v.removed or (d.reviewed_source->>'projectId')::uuid is distinct from v.project_id then return true;end if;
 if (select jsonb_agg(x order by x) from jsonb_array_elements(previous->'customerEmails') x) is distinct from (select jsonb_agg(x order by x) from jsonb_array_elements(current->'customerEmails') x) then return true;end if;
 if previous->'duplicate' is distinct from current->'duplicate' and current->>'duplicate'='true' then return true;end if;
 if not private.site_visit_people_equal(previous->'staff',current->'staff') then
  if not(detail?'staff') then return true;end if;
  matches:=private.site_visit_people_equal(detail->'staff',current->'staff');
  if not matches then return true;end if;
 end if;
 if previous->'address' is distinct from current->'address' and (not(detail?'address') or
  btrim(regexp_replace(lower(coalesce(current->>'address','')),'[[:space:],.]+',' ','g'))<>btrim(regexp_replace(lower(coalesce(detail->>'address','')),'[[:space:],.]+',' ','g'))) then return true;end if;
 if previous->'kind' is distinct from current->'kind' and not coalesce((detail->>'status' in ('booked','attended') and current->>'kind'='visit') or (detail->>'status'='provisional' and current->>'kind'='provisional'),false) then return true;end if;
 if previous->'cancelled' is distinct from current->'cancelled' and not(detail?'status' and (current->>'cancelled')::boolean=(detail->>'status' in ('cancelled','not_attended'))) then return true;end if;
 if (previous->'startsAt',previous->'endsAt',previous->'isAllDay',previous->'allDayStartDate',previous->'allDayEndDate') is distinct from
    (current->'startsAt',current->'endsAt',current->'isAllDay',current->'allDayStartDate',current->'allDayEndDate') then
  if t is null or t->>'mode'='unknown' then return true;end if;
  if ((current->>'startsAt')::timestamptz at time zone 'Pacific/Auckland')::date::text<>t->>'date' then return true;end if;
  if t->>'mode' in ('agreed','window') and (coalesce((current->>'isAllDay')::boolean,false) or to_char((current->>'startsAt')::timestamptz at time zone 'Pacific/Auckland','HH24:MI')<>t->>'time') then return true;end if;
  if t->>'mode'='window' and (to_char((current->>'endsAt')::timestamptz at time zone 'Pacific/Auckland','HH24:MI')<>t->>'endTime' or ((current->>'endsAt')::timestamptz at time zone 'Pacific/Auckland')::date::text<>t->>'date') then return true;end if;
 end if;
 return false;
end $$;

create function private.site_visit_validate_details(p jsonb) returns void language plpgsql set search_path=pg_catalog as $$
declare d jsonb:=p->'details';t jsonb; x jsonb; m text; dt date;
begin
 if jsonb_typeof(d) is distinct from 'object' or exists(select 1 from jsonb_object_keys(d) k where k not in ('staff','address','purpose','status','timing'))
 or jsonb_typeof(p->'questions') is distinct from 'array' or jsonb_array_length(p->'questions')>8
 or jsonb_typeof(p->'basis') is distinct from 'string' or length(btrim(p->>'basis')) not between 5 and 2000
 or (p->>'referenceUrl' is not null and (jsonb_typeof(p->'referenceUrl')<>'string' or length(p->>'referenceUrl')>3000 or p->>'referenceUrl' !~ '^https://[^[:space:]]+$'))
 then raise exception using errcode='22023',message='Invalid visit details'; end if;
 for x in select value from jsonb_array_elements(p->'questions') loop
  if jsonb_typeof(x)<>'string' or length(btrim(x#>>'{}')) not between 3 and 300 then raise exception using errcode='22023',message='Invalid question'; end if;
 end loop;
 if d?'address' and d->'address'<>'null'::jsonb and (jsonb_typeof(d->'address')<>'string' or length(d->>'address')>500) then raise exception using errcode='22023',message='Invalid address'; end if;
 if d?'purpose' and coalesce(d->>'purpose','') not in ('site_visit','initial','measurement','follow_up') then raise exception using errcode='22023',message='Invalid visit type'; end if;
 if d?'status' and coalesce(d->>'status','') not in ('booked','provisional','cancelled','attended','not_attended') then raise exception using errcode='22023',message='Invalid visit status'; end if;
 if d?'staff' then
  if jsonb_typeof(d->'staff')<>'array' or jsonb_array_length(d->'staff')>20 then raise exception using errcode='22023',message='Invalid attending staff'; end if;
  for x in select value from jsonb_array_elements(d->'staff') loop
   if jsonb_typeof(x)<>'object' or exists(select 1 from jsonb_object_keys(x) k where k not in ('name','email','staffId'))
   or jsonb_typeof(x->'name') is distinct from 'string' or length(btrim(x->>'name')) not between 1 and 150
   or jsonb_typeof(x->'email') is distinct from 'string' or length(x->>'email')>254
   or ((x->>'email')<>'' and (x->>'email') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
   or (x?'staffId' and (jsonb_typeof(x->'staffId')<>'string' or length(x->>'staffId')>80))
   then raise exception using errcode='22023',message='Invalid attending person'; end if;
  end loop;
 end if;
 if d?'timing' then
  t:=d->'timing';m:=t->>'mode';
  if jsonb_typeof(t)<>'object' or (select count(*) from jsonb_object_keys(t))<>4 or not(t ?& array['mode','date','time','endTime'])
  or coalesce(m,'') not in ('agreed','window','date','unknown') then raise exception using errcode='22023',message='Invalid visit timing'; end if;
  if m='unknown' then
   if t->>'date' is not null or t->>'time' is not null or t->>'endTime' is not null then raise exception using errcode='22023',message='Unknown timing must remain empty'; end if;
  else
   if coalesce(t->>'date','') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception using errcode='22023',message='Date required'; end if;
   dt:=(t->>'date')::date;
   if dt::text<>t->>'date' then raise exception using errcode='22023',message='Invalid date'; end if;
   if m='date' then
    if t->>'time' is not null or t->>'endTime' is not null then raise exception using errcode='22023',message='Date-only timing must not invent times'; end if;
   else
    if coalesce(t->>'time','') !~ '^([01]\d|2[0-3]):[0-5]\d$' then raise exception using errcode='22023',message='Time required'; end if;
    if (m='agreed' and t->>'endTime' is not null) or (m='window' and (coalesce(t->>'endTime','') !~ '^([01]\d|2[0-3]):[0-5]\d$' or t->>'endTime'<=t->>'time'))
    then raise exception using errcode='22023',message='Invalid access window'; end if;
   end if;
  end if;
 end if;
end $$;

-- Preserve the existing source projection and wire additional provenance beside it.
alter function private.outlook_calendar_visit_json(private.outlook_calendar_visits) rename to outlook_calendar_source_json;
create function private.outlook_calendar_visit_json(v private.outlook_calendar_visits) returns jsonb language sql stable security definer set search_path=pg_catalog,public,private as $$
 select private.outlook_calendar_source_json(v)||jsonb_build_object('origin','outlook','correction',case when d.active then
 jsonb_build_object('details',d.details,'questions',d.questions,'basis',d.basis,'referenceUrl',d.reference_url,'updatedAt',d.updated_at,
 'sourceChanged',private.site_visit_correction_changed(v,d)) else null end)
 from (select 1) x left join private.site_visit_details d on d.source_visit_id=v.id
$$;
create function private.site_visit_history_json(d private.site_visit_details) returns jsonb language sql stable security definer set search_path=pg_catalog,public,private as $$
 select jsonb_build_object('id',d.id,'revision',d.revision,'sourceKey','manual:'||d.id,'subject','Historical site visit',
 'startsAt',null,'endsAt',null,'isAllDay',false,'allDayStartDate',null,'allDayEndDate',null,'sourceUrl',null,'address',null,'staff','[]'::jsonb,
 'assignmentHint',null,'kind',case when d.withdrawn then 'excluded' else 'visit' end,'sourceKind','visit','cancelled',false,'removed',false,'duplicate',false,
 'reviewReasons','[]'::jsonb,'projectId',d.project_id,'projectName',p.name,'contactName',c.name,'phone',c.phone,'linkMode','manual','kindOverride',null,
 'origin','history','withdrawn',d.withdrawn,'correction',jsonb_build_object('details',d.details,'questions',d.questions,'basis',d.basis,'referenceUrl',d.reference_url,'updatedAt',d.updated_at,'sourceChanged',false))
 from public.projects p left join public.contacts c on c.id=p.contact_id where p.id=d.project_id
$$;

create or replace function public.outlook_site_visits_read(p_project uuid default null) returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare c private.outlook_calendar_control;items jsonb;
begin
 perform private.outlook_calendar_actor();select * into c from private.outlook_calendar_control where singleton;
 select coalesce(jsonb_agg(value),'[]') into items from (
  select private.outlook_calendar_visit_json(v) value from private.outlook_calendar_visits v
  where c.enabled and not v.hidden and (p_project is null or v.project_id=p_project)
  and (p_project is not null or (v.starts_at<c.range_end and v.ends_at>c.range_start) or exists(select 1 from private.site_visit_details d where d.source_visit_id=v.id and d.active))
  union all
  select private.site_visit_history_json(d) from private.site_visit_details d where d.source_visit_id is null and (p_project is null or d.project_id=p_project)
 ) records;
 return jsonb_build_object('enabled',c.enabled,'lastSuccess',c.last_success,'lastAttempt',c.last_attempt,'error',c.last_error,
 'rangeStart',c.range_start,'rangeEnd',c.range_end,'syncing',coalesce(c.lease_until>clock_timestamp(),false),'events',items);
end $$;

create function public.site_visit_correct(p_input jsonb) returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare v private.outlook_calendar_visits;d private.site_visit_details;before_value jsonb;action text:=p_input->>'action';
begin
 perform private.outlook_calendar_actor();
 if jsonb_typeof(p_input) is distinct from 'object' or (select count(*) from jsonb_object_keys(p_input))<>10
 or not(p_input ?& array['action','id','revision','projectId','linkMode','kind','details','questions','basis','referenceUrl'])
 or coalesce(action,'') not in ('save','restore') then raise exception using errcode='22023',message='Invalid correction'; end if;
 perform private.site_visit_validate_details(p_input);
 select * into v from private.outlook_calendar_visits where id=(p_input->>'id')::uuid and not hidden for update;
 if not found then raise exception using errcode='P0002',message='Visit unavailable'; end if;
 if v.revision is distinct from (p_input->>'revision')::bigint then raise exception using errcode='40001',message='Visit changed. Reload before saving.'; end if;
 select jsonb_build_object('details',to_jsonb(x),'projectId',v.project_id,'linkMode',v.link_mode,'kind',v.kind_override,'sourceRevision',v.revision) into before_value
 from (select 1) seed left join private.site_visit_details x on x.id=v.id;
 -- An existing linked closed project is valid history. The legacy linker excludes
 -- archived projects, so retain an unchanged link here without reopening it.
 if (p_input->>'projectId')::uuid is not distinct from v.project_id and p_input->>'linkMode'='manual' then
  if p_input->>'kind' is not null and p_input->>'kind' not in ('visit','provisional','review','excluded') then raise exception using errcode='22023',message='Invalid classification'; end if;
  update private.outlook_calendar_visits set link_mode='manual',kind_override=case when action='restore' then null else p_input->>'kind' end,
   revision=revision+1,updated_at=clock_timestamp() where id=v.id;
 else
  perform public.outlook_site_visit_review(jsonb_build_object('id',v.id,'revision',v.revision,'projectId',p_input->'projectId','linkMode',p_input->'linkMode','kind',case when action='restore' then null else p_input->>'kind' end));
 end if;
 select * into v from private.outlook_calendar_visits where id=v.id;
 insert into private.site_visit_details(id,source_visit_id,details,questions,basis,reference_url,reviewed_source,active,created_by,updated_by)
 values(v.id,v.id,p_input->'details',p_input->'questions',btrim(p_input->>'basis'),p_input->>'referenceUrl',private.site_visit_material_source(v),action='save',auth.uid(),auth.uid())
 on conflict(id) do update set details=excluded.details,questions=excluded.questions,basis=excluded.basis,reference_url=excluded.reference_url,
 reviewed_source=excluded.reviewed_source,active=excluded.active,revision=private.site_visit_details.revision+1,updated_by=auth.uid(),updated_at=clock_timestamp() returning * into d;
 insert into private.site_visit_detail_history(detail_id,actor_id,action,before_value,after_value) values(d.id,auth.uid(),action,before_value,
 jsonb_build_object('details',to_jsonb(d),'projectId',v.project_id,'linkMode',v.link_mode,'kind',v.kind_override,'sourceRevision',v.revision));
 return private.outlook_calendar_visit_json(v);
end $$;

create function public.site_visit_history_save(p_input jsonb) returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare d private.site_visit_details;before_value jsonb;pid uuid:=(p_input->>'projectId')::uuid;rid uuid:=(p_input->>'id')::uuid;action text:=p_input->>'action';
begin
 perform private.outlook_calendar_actor();
 if jsonb_typeof(p_input) is distinct from 'object' or (select count(*) from jsonb_object_keys(p_input))<>8
 or not(p_input ?& array['action','id','revision','projectId','details','questions','basis','referenceUrl'])
 or coalesce(action,'') not in ('save','withdraw','restore') or coalesce((p_input->>'revision')::bigint,-1)<0
 then raise exception using errcode='22023',message='Invalid historical visit'; end if;
 perform private.site_visit_validate_details(p_input);
 if coalesce(jsonb_array_length(p_input->'details'->'staff'),0)=0 or not(p_input->'details'?'timing') or not(p_input->'details'?'purpose')
 or coalesce(p_input->'details'->>'status','') not in ('attended','not_attended')
 or coalesce(p_input->'details'->'timing'->>'date','0001-01-01')>(clock_timestamp() at time zone 'Pacific/Auckland')::date::text
 then raise exception using errcode='22023',message='Historical visit needs known staff, past or unknown timing and an explicit outcome'; end if;
 perform 1 from public.projects where id=pid for share;
 if not found then raise exception using errcode='22023',message='Project unavailable'; end if;
 -- Serialize retry/create by the client-held record ID; repeated network retries
 -- cannot create two original visits or silently overwrite a later edit.
 perform pg_advisory_xact_lock(hashtextextended(rid::text,0));
 select * into d from private.site_visit_details where id=rid for update;
 if found then
  if d.source_visit_id is not null or d.project_id<>pid then raise exception using errcode='22023',message='Invalid historical record'; end if;
  if (p_input->>'revision')::bigint=0 and d.revision=1 and d.created_by=auth.uid() and d.details=p_input->'details' and d.questions=p_input->'questions' and d.basis=btrim(p_input->>'basis') and d.reference_url is not distinct from p_input->>'referenceUrl' and action='save'
  then return private.site_visit_history_json(d);end if;
  if d.revision is distinct from (p_input->>'revision')::bigint then raise exception using errcode='40001',message='Visit changed. Reload before saving.'; end if;
  before_value:=to_jsonb(d);
  update private.site_visit_details set details=case when action='save' then p_input->'details' else details end,
   questions=case when action='save' then p_input->'questions' else questions end,basis=case when action='save' then btrim(p_input->>'basis') else basis end,
   reference_url=case when action='save' then p_input->>'referenceUrl' else reference_url end,withdrawn=case when action='withdraw' then true when action='restore' then false else withdrawn end,
   revision=revision+1,updated_by=auth.uid(),updated_at=clock_timestamp() where id=rid returning * into d;
 else
  if (p_input->>'revision')::bigint<>0 or action<>'save' then raise exception using errcode='40001',message='Visit unavailable'; end if;
  insert into private.site_visit_details(id,project_id,details,questions,basis,reference_url,created_by,updated_by)
  values(rid,pid,p_input->'details',p_input->'questions',btrim(p_input->>'basis'),p_input->>'referenceUrl',auth.uid(),auth.uid()) returning * into d;
 end if;
 insert into private.site_visit_detail_history(detail_id,actor_id,action,before_value,after_value) values(d.id,auth.uid(),action,before_value,to_jsonb(d));
 return private.site_visit_history_json(d);
end $$;
revoke all on function private.site_visit_material_source(private.outlook_calendar_visits),private.site_visit_people_equal(jsonb,jsonb),private.site_visit_correction_changed(private.outlook_calendar_visits,private.site_visit_details),private.site_visit_validate_details(jsonb),private.outlook_calendar_visit_json(private.outlook_calendar_visits),private.site_visit_history_json(private.site_visit_details) from public,anon,authenticated,service_role;
revoke all on function public.site_visit_correct(jsonb),public.site_visit_history_save(jsonb) from public,anon,authenticated,service_role;
grant execute on function public.site_visit_correct(jsonb),public.site_visit_history_save(jsonb) to authenticated;
