-- Preserve Outlook all-day calendar dates in staff projections. Existing payloads
-- without the flag stay timed until the next complete source refresh.
create or replace function private.outlook_calendar_visit_json(v private.outlook_calendar_visits) returns jsonb language sql stable security definer set search_path=pg_catalog,public,private as $$
 select jsonb_build_object('id',v.id,'revision',v.revision,'sourceKey',v.source_key,'subject',v.payload->>'subject',
 'startsAt',v.starts_at,'endsAt',v.ends_at,'isAllDay',coalesce(v.payload->'isAllDay','false'::jsonb),
 'allDayStartDate',v.payload->'allDayStartDate','allDayEndDate',v.payload->'allDayEndDate',
 'sourceUrl',v.payload->'sourceUrl','address',v.payload->'address',
 'staff',v.payload->'staff','assignmentHint',v.payload->'assignmentHint','kind',coalesce(v.kind_override,v.payload->>'kind'),
 'sourceKind',v.payload->>'kind','cancelled',v.payload->'cancelled','removed',v.removed,'duplicate',case when v.kind_override='visit' then 'false'::jsonb else v.payload->'duplicate' end,
 'reviewReasons',(select coalesce(jsonb_agg(r),'[]') from jsonb_array_elements(v.payload->'reviewReasons') r where v.kind_override is null or
 r#>>'{}' not in ('Check whether this appointment is a site visit.','Possible duplicate invitation. Check the staff booking at this time.')),
 'projectId',v.project_id,'projectName',p.name,'contactName',c.name,'phone',c.phone,'linkMode',v.link_mode,'kindOverride',v.kind_override)
 from (select 1) x left join public.projects p on p.id=v.project_id left join public.contacts c on c.id=p.contact_id
$$;
