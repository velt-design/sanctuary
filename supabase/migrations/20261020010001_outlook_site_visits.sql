-- Outlook is the booking source. These records have no legacy booking, email or conversion side effects.
create table private.outlook_calendar_control (
 singleton boolean primary key default true check(singleton), enabled boolean not null default false,
 binding text check(binding ~ '^[a-f0-9]{64}$'), lease_token uuid, lease_until timestamptz,
 last_attempt timestamptz, last_success timestamptz, last_error text,
 range_start timestamptz, range_end timestamptz, source_count integer, visit_count integer
);
insert into private.outlook_calendar_control(singleton) values(true);
create table private.outlook_calendar_visits (
 id uuid primary key default gen_random_uuid(), source_key text not null unique,
 payload jsonb not null, starts_at timestamptz not null, ends_at timestamptz not null,
 project_id uuid references public.projects(id) on delete set null,
 link_mode text not null default 'auto' check(link_mode in ('auto','manual')),
 kind_override text check(kind_override in ('visit','provisional','review','excluded')),
 removed boolean not null default false, hidden boolean not null default false,
 revision bigint not null default 1, seen_operation uuid not null,
 first_seen timestamptz not null default clock_timestamp(), updated_at timestamptz not null default clock_timestamp()
);
create index outlook_calendar_visits_project on private.outlook_calendar_visits(project_id,starts_at);
create index outlook_calendar_visits_range on private.outlook_calendar_visits(starts_at,ends_at);
create table private.outlook_calendar_reviews (
 id bigint generated always as identity primary key, visit_id uuid not null references private.outlook_calendar_visits(id),
 actor_id uuid not null references auth.users(id), before_value jsonb not null, after_value jsonb not null,
 created_at timestamptz not null default clock_timestamp()
);
alter table private.outlook_calendar_control enable row level security;
alter table private.outlook_calendar_visits enable row level security;
alter table private.outlook_calendar_reviews enable row level security;
revoke all on private.outlook_calendar_control,private.outlook_calendar_visits,private.outlook_calendar_reviews from public,anon,authenticated,service_role;

create function private.outlook_calendar_actor() returns void language plpgsql security definer set search_path=pg_catalog,public,private as $$
begin
 perform 1 from auth.users u join public.portal_users p on p.user_id=u.id
 where u.id=auth.uid() and p.role::text in ('staff','admin') and u.email_confirmed_at is not null
 and u.deleted_at is null and (u.banned_until is null or u.banned_until<=clock_timestamp()) for share of u,p;
 if not found then raise exception using errcode='42501',message='Access denied'; end if;
end $$;
create function private.outlook_calendar_street(v text) returns text language sql immutable set search_path=pg_catalog as $$
 -- Preserve unit separators, numbers and word boundaries. Only expand a final street suffix;
 -- "St. James" is a street name, not a reason to discard everything after its period.
 select regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(
 btrim(regexp_replace(replace(lower(split_part(coalesce(v,''),',',1)),'.',' '),'\s+',' ','g')),
 '\mrd$','road'),'\mst$','street'),'\mave$','avenue'),'\mln$','lane'),'\mdr$','drive'),'\mpl$','place')
$$;
create function private.outlook_calendar_match(e jsonb) returns uuid language sql stable security definer set search_path=pg_catalog,public,private as $$
 select case when count(*)=1 then (array_agg(p.id))[1] else null end
 from public.projects p join public.contacts c on c.id=p.contact_id
 where p.archived_at is null and lower(btrim(c.email)) in (select jsonb_array_elements_text(e->'customerEmails'))
 and length(private.outlook_calendar_street(e->>'address'))>=6
 and private.outlook_calendar_street(p.site_address)=private.outlook_calendar_street(e->>'address')
$$;

-- A complete source read is staged in memory; publication and absence reconciliation are one transaction.
create function public.outlook_calendar_sync(p_action text,p_binding text,p_operation uuid,p_input jsonb default '{}') returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare c private.outlook_calendar_control; e jsonb; matched uuid; begin_at timestamptz; end_at timestamptz; n integer;
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception using errcode='42501',message='Access denied'; end if;
 select * into c from private.outlook_calendar_control where singleton for update;
 if not c.enabled or c.binding is null or c.binding is distinct from p_binding then raise exception using errcode='42501',message='Calendar binding unavailable'; end if;
 if p_operation is null then raise exception using errcode='22023',message='Operation required'; end if;
 if p_action='claim' then
   if c.lease_until>clock_timestamp() then return jsonb_build_object('claimed',false,'reason','busy'); end if;
   if c.last_attempt>clock_timestamp()-interval '5 minutes' then return jsonb_build_object('claimed',false,'reason','recent'); end if;
   update private.outlook_calendar_control set lease_token=p_operation,lease_until=clock_timestamp()+interval '2 minutes',last_attempt=clock_timestamp() where singleton;
   return jsonb_build_object('claimed',true);
 end if;
 if c.lease_token is distinct from p_operation or c.lease_until<=clock_timestamp() then raise exception using errcode='40001',message='Calendar run expired'; end if;
 if p_action='fail' then
   update private.outlook_calendar_control set lease_token=null,lease_until=null,last_error=case when p_input->>'code' in ('ACCESS_REQUIRED','SOURCE_UNAVAILABLE','SOURCE_LIMIT','SOURCE_INVALID') then p_input->>'code' else 'SYNC_FAILED' end where singleton;
   return jsonb_build_object('failed',true);
 end if;
 if p_action<>'publish' or jsonb_typeof(p_input->'events') is distinct from 'array' or jsonb_array_length(p_input->'events')>2000
 or jsonb_typeof(p_input->'hiddenKeys') is distinct from 'array' then raise exception using errcode='22023',message='Invalid calendar snapshot'; end if;
 begin_at:=(p_input->>'from')::timestamptz;end_at:=(p_input->>'to')::timestamptz;
 if begin_at is null or end_at is null or end_at<=begin_at or end_at-begin_at>interval '125 days' or begin_at<clock_timestamp()-interval '35 days'
 or end_at>clock_timestamp()+interval '95 days' then raise exception using errcode='22023',message='Invalid calendar range'; end if;
 select count(distinct x->>'sourceKey') into n from jsonb_array_elements(p_input->'events') x;
 if n<>jsonb_array_length(p_input->'events') then raise exception using errcode='22023',message='Duplicate calendar identity'; end if;
 for e in select value from jsonb_array_elements(p_input->'events') loop
   if length(e->>'sourceKey') not between 1 and 1200 or length(e->>'subject')>500 or e->>'kind' not in ('visit','provisional','review','excluded')
   or jsonb_typeof(e->'staff') is distinct from 'array' or jsonb_typeof(e->'customerEmails') is distinct from 'array'
   or (e->>'endsAt')::timestamptz<=(e->>'startsAt')::timestamptz
   or (e->>'startsAt')::timestamptz>=end_at or (e->>'endsAt')::timestamptz<=begin_at
   then raise exception using errcode='22023',message='Invalid calendar event'; end if;
   matched:=private.outlook_calendar_match(e);
   insert into private.outlook_calendar_visits as v(source_key,payload,starts_at,ends_at,project_id,seen_operation)
   values(e->>'sourceKey',e,(e->>'startsAt')::timestamptz,(e->>'endsAt')::timestamptz,matched,p_operation)
   on conflict(source_key) do update set payload=excluded.payload,starts_at=excluded.starts_at,ends_at=excluded.ends_at,
   project_id=case when v.link_mode='manual' then v.project_id else excluded.project_id end,
   removed=false,hidden=false,seen_operation=p_operation,updated_at=clock_timestamp(),
   revision=v.revision+case when v.payload is distinct from excluded.payload or v.removed or v.hidden or
     (v.link_mode='auto' and v.project_id is distinct from excluded.project_id) then 1 else 0 end;
 end loop;
 update private.outlook_calendar_visits set removed=true,revision=revision+1,updated_at=clock_timestamp()
 where not removed and starts_at<end_at and ends_at>begin_at and seen_operation is distinct from p_operation;
 -- Private/confidential appointments must not retain a staff-visible former title after a sensitivity change.
 update private.outlook_calendar_visits set hidden=true,removed=true,revision=revision+1
 where source_key in (select jsonb_array_elements_text(p_input->'hiddenKeys')) and not hidden;
 update private.outlook_calendar_control set lease_token=null,lease_until=null,last_success=clock_timestamp(),last_error=null,
 range_start=begin_at,range_end=end_at,source_count=(p_input->>'sourceCount')::integer,visit_count=n where singleton;
 return jsonb_build_object('published',true,'count',n);
end $$;

create function private.outlook_calendar_visit_json(v private.outlook_calendar_visits) returns jsonb language sql stable security definer set search_path=pg_catalog,public,private as $$
 select jsonb_build_object('id',v.id,'revision',v.revision,'sourceKey',v.source_key,'subject',v.payload->>'subject',
 'startsAt',v.starts_at,'endsAt',v.ends_at,'sourceUrl',v.payload->'sourceUrl','address',v.payload->'address',
 'staff',v.payload->'staff','assignmentHint',v.payload->'assignmentHint','kind',coalesce(v.kind_override,v.payload->>'kind'),
 'sourceKind',v.payload->>'kind','cancelled',v.payload->'cancelled','removed',v.removed,'duplicate',case when v.kind_override='visit' then 'false'::jsonb else v.payload->'duplicate' end,
 'reviewReasons',(select coalesce(jsonb_agg(r),'[]') from jsonb_array_elements(v.payload->'reviewReasons') r where v.kind_override is null or
 r#>>'{}' not in ('Check whether this appointment is a site visit.','Possible duplicate invitation. Check the staff booking at this time.')),
 'projectId',v.project_id,'projectName',p.name,'contactName',c.name,'phone',c.phone,'linkMode',v.link_mode,'kindOverride',v.kind_override)
 from (select 1) x left join public.projects p on p.id=v.project_id left join public.contacts c on c.id=p.contact_id
$$;
create function public.outlook_site_visits_read(p_project uuid default null) returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare c private.outlook_calendar_control; items jsonb;
begin
 perform private.outlook_calendar_actor();select * into c from private.outlook_calendar_control where singleton;
 select coalesce(jsonb_agg(private.outlook_calendar_visit_json(v) order by v.starts_at,v.id),'[]') into items
 from private.outlook_calendar_visits v where c.enabled and not v.hidden and (p_project is null or v.project_id=p_project)
 and v.starts_at<c.range_end and v.ends_at>c.range_start;
 return jsonb_build_object('enabled',c.enabled,'lastSuccess',c.last_success,'lastAttempt',c.last_attempt,'error',c.last_error,
 'rangeStart',c.range_start,'rangeEnd',c.range_end,'syncing',coalesce(c.lease_until>clock_timestamp(),false),'events',items);
end $$;
create function public.outlook_site_visit_projects(p_query text) returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare items jsonb;
begin
 perform private.outlook_calendar_actor();
 if length(btrim(p_query)) not between 2 and 100 then raise exception using errcode='22023',message='Search must contain 2 to 100 characters'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'address',site_address) order by name,id),'[]') into items
 from (select p.id,p.name,p.site_address from public.projects p left join public.contacts c on c.id=p.contact_id
 where p.archived_at is null and (position(lower(btrim(p_query)) in lower(p.name))>0 or position(lower(btrim(p_query)) in lower(coalesce(c.email,'')))>0
 or position(lower(btrim(p_query)) in lower(coalesce(p.site_address,'')))>0) order by p.name,p.id limit 21) matches;
 return jsonb_build_object('projects',items,'truncated',jsonb_array_length(items)>20);
end $$;
create function public.outlook_site_visit_review(p_input jsonb) returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare v private.outlook_calendar_visits; pid uuid; mode text; kind text; before_value jsonb;
begin
 perform private.outlook_calendar_actor();
 if jsonb_typeof(p_input) is distinct from 'object' or (select count(*) from jsonb_object_keys(p_input))<>5 then raise exception using errcode='22023',message='Invalid review'; end if;
 pid:=(p_input->>'projectId')::uuid;mode:=p_input->>'linkMode';kind:=p_input->>'kind';
 if mode is null or mode not in ('manual','auto') or (kind is not null and kind not in ('visit','provisional','review','excluded'))
 then raise exception using errcode='22023',message='Invalid review'; end if;
 select * into v from private.outlook_calendar_visits where id=(p_input->>'id')::uuid and not hidden for update;
 if not found then raise exception using errcode='P0002',message='Visit unavailable'; end if;
 if v.revision is distinct from (p_input->>'revision')::bigint then raise exception using errcode='40001',message='Visit changed. Reload before saving.'; end if;
 if pid is not null then perform 1 from public.projects where id=pid and archived_at is null for share;
   if not found then raise exception using errcode='22023',message='Project unavailable'; end if; end if;
 if mode='auto' then pid:=private.outlook_calendar_match(v.payload);end if;
 before_value:=jsonb_build_object('projectId',v.project_id,'linkMode',v.link_mode,'kind',v.kind_override);
 update private.outlook_calendar_visits set project_id=pid,link_mode=mode,kind_override=kind,revision=revision+1,updated_at=clock_timestamp() where id=v.id returning * into v;
 insert into private.outlook_calendar_reviews(visit_id,actor_id,before_value,after_value) values(v.id,auth.uid(),before_value,
 jsonb_build_object('projectId',v.project_id,'linkMode',v.link_mode,'kind',v.kind_override));
 return private.outlook_calendar_visit_json(v);
end $$;
revoke all on function private.outlook_calendar_actor(),private.outlook_calendar_street(text),private.outlook_calendar_match(jsonb),private.outlook_calendar_visit_json(private.outlook_calendar_visits) from public,anon,authenticated,service_role;
revoke all on function public.outlook_calendar_sync(text,text,uuid,jsonb),public.outlook_site_visits_read(uuid),public.outlook_site_visit_projects(text),public.outlook_site_visit_review(jsonb) from public,anon,authenticated,service_role;
grant execute on function public.outlook_calendar_sync(text,text,uuid,jsonb) to service_role;
grant execute on function public.outlook_site_visits_read(uuid),public.outlook_site_visit_projects(text),public.outlook_site_visit_review(jsonb) to authenticated;
