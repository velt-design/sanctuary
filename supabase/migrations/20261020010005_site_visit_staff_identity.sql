-- Root-configured identities only. Seed verified recognised staff addresses privately,
-- scoped to the existing source binding; no customer/name inference or source rewrite.
create table private.site_visit_staff_identities (
 source_binding text not null check(source_binding ~ '^[0-9a-f]{64}$'),
 email text not null check(email=lower(btrim(email)) and email ~ '^[^[:space:]@]+@[^[:space:]@]+$'),
 staff_id text not null check(staff_id ~ '^[a-z][a-z0-9_-]{0,79}$'),
 primary key(source_binding,email)
);
alter table private.site_visit_staff_identities enable row level security;
revoke all on private.site_visit_staff_identities from public,anon,authenticated,service_role;

create function private.site_visit_person_key(p jsonb) returns text language sql stable set search_path=pg_catalog,private as $$
 select case when coalesce(p->>'email','')<>'' then coalesce(
   (select 'staff:'||i.staff_id from private.site_visit_staff_identities i join private.outlook_calendar_control c on c.binding=i.source_binding and c.singleton
    where i.email=lower(p->>'email')),'email:'||lower(p->>'email'))
   when coalesce(p->>'staffId','')<>'' then 'staff:'||(p->>'staffId') else 'unidentified:'||p::text end
$$;
create or replace function private.site_visit_people_equal(expected jsonb,actual jsonb) returns boolean language sql stable set search_path=pg_catalog,private as $$
 select coalesce((select array_agg(k order by k) from (select distinct private.site_visit_person_key(p) k from jsonb_array_elements(coalesce(expected,'[]')) p) x),'{}'::text[])
      =coalesce((select array_agg(k order by k) from (select distinct private.site_visit_person_key(p) k from jsonb_array_elements(coalesce(actual,'[]')) p) x),'{}'::text[])
$$;
create function private.site_visit_identified_people(people jsonb) returns jsonb language sql stable set search_path=pg_catalog,private as $$
 select coalesce(jsonb_agg(case when coalesce(p->>'email','')='' then p
   when i.staff_id is not null then (p-'staffId')||jsonb_build_object('staffId',i.staff_id) else p-'staffId' end order by n),'[]')
 from jsonb_array_elements(coalesce(people,'[]')) with ordinality x(p,n)
 left join private.site_visit_staff_identities i on i.email=lower(p->>'email')
 and i.source_binding=(select binding from private.outlook_calendar_control where singleton)
$$;
create function private.site_visit_identified_json(v jsonb) returns jsonb language plpgsql stable set search_path=pg_catalog,private as $$
begin
 v:=jsonb_set(v,'{staff}',private.site_visit_identified_people(v->'staff'));
 if v#>'{correction,details,staff}' is not null then
  v:=jsonb_set(v,'{correction,details,staff}',private.site_visit_identified_people(v#>'{correction,details,staff}'));
 end if;
 return v;
end $$;
alter function private.outlook_calendar_visit_json(private.outlook_calendar_visits) rename to outlook_calendar_unidentified_visit_json;
create function private.outlook_calendar_visit_json(v private.outlook_calendar_visits) returns jsonb language sql stable security definer set search_path=pg_catalog,private as $$
 select private.site_visit_identified_json(private.outlook_calendar_unidentified_visit_json(v))
$$;
alter function private.site_visit_history_json(private.site_visit_details) rename to site_visit_unidentified_history_json;
create function private.site_visit_history_json(d private.site_visit_details) returns jsonb language sql stable security definer set search_path=pg_catalog,private as $$
 select private.site_visit_identified_json(private.site_visit_unidentified_history_json(d))
$$;
revoke all on function private.site_visit_person_key(jsonb),private.site_visit_people_equal(jsonb,jsonb),private.site_visit_identified_people(jsonb),private.site_visit_identified_json(jsonb),private.outlook_calendar_visit_json(private.outlook_calendar_visits),private.site_visit_history_json(private.site_visit_details),private.outlook_calendar_unidentified_visit_json(private.outlook_calendar_visits),private.site_visit_unidentified_history_json(private.site_visit_details) from public,anon,authenticated,service_role;
