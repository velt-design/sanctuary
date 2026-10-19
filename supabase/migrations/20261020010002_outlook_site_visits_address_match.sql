-- A place/suburb or provisional address label is not street-level corroboration.
-- Keep unnumbered addresses visible for an explicit staff link rather than guess.
create or replace function private.outlook_calendar_match(e jsonb) returns uuid
language sql stable security definer set search_path=pg_catalog,public,private as $$
 select case when count(*)=1 then (array_agg(p.id))[1] else null end
 from public.projects p join public.contacts c on c.id=p.contact_id
 where p.archived_at is null and lower(btrim(c.email)) in (select jsonb_array_elements_text(e->'customerEmails'))
 and e->>'address' ~* '^\s*[0-9]+[a-z]?(\s|/|-)'
 and length(private.outlook_calendar_street(e->>'address'))>=6
 and private.outlook_calendar_street(p.site_address)=private.outlook_calendar_street(e->>'address')
$$;
revoke all on function private.outlook_calendar_match(jsonb) from public,anon,authenticated,service_role;
