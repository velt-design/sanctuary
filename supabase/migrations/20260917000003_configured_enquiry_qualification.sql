-- Staff assessment of an exact configured enquiry; deliberately separate from pipeline/cadence.
create table private.enquiry_qualification_events (
  command_id uuid primary key,
  enquiry_id uuid not null references public.enquiry_requests(id),
  project_id uuid not null,
  version integer not null check (version > 0),
  criteria_version text not null default 'configured-enquiry-v1' check (criteria_version = 'configured-enquiry-v1'),
  state text not null check (state in ('unreviewed', 'qualified', 'not_qualified')),
  criteria jsonb not null,
  reason text not null check (length(reason) <= 1000),
  actor_id uuid not null,
  actor_email text,
  recorded_at timestamptz not null default clock_timestamp(),
  request jsonb not null,
  unique (enquiry_id, version),
  check (jsonb_typeof(criteria) = 'object' and criteria ?& array['location','project','contactAndConfiguration','intent']),
  check (criteria - array['location','project','contactAndConfiguration','intent'] = '{}'::jsonb),
  check (criteria->'location' in ('true'::jsonb,'false'::jsonb,'null'::jsonb)
    and criteria->'project' in ('true'::jsonb,'false'::jsonb,'null'::jsonb)
    and criteria->'contactAndConfiguration' in ('true'::jsonb,'false'::jsonb,'null'::jsonb)
    and criteria->'intent' in ('true'::jsonb,'false'::jsonb,'null'::jsonb)),
  check (state <> 'qualified' or criteria = '{"location":true,"project":true,"contactAndConfiguration":true,"intent":true}'::jsonb),
  check (state <> 'not_qualified' or (length(btrim(reason)) > 0 and (
    criteria->'location' = 'false'::jsonb or criteria->'project' = 'false'::jsonb
    or criteria->'contactAndConfiguration' = 'false'::jsonb or criteria->'intent' = 'false'::jsonb))),
  check (version = 1 or length(btrim(reason)) > 0)
);
revoke all on private.enquiry_qualification_events from public, anon, authenticated;
alter table private.enquiry_qualification_events enable row level security;

create function private.enquiry_qualification_append_only() returns trigger
language plpgsql set search_path = pg_catalog, pg_temp as $$
begin raise exception 'Qualification history is append-only'; end;
$$;
create trigger enquiry_qualification_append_only before update or delete on private.enquiry_qualification_events
for each row execute function private.enquiry_qualification_append_only();

-- Returns only eligibility and staff decisions, never a second copy of the customer payload.
create function public.enquiry_qualification_read(p_project_id uuid, p_enquiry_id uuid) returns jsonb
language plpgsql security definer set search_path = pg_catalog, pg_temp as $$
declare v_brief jsonb; v_request_type text; v_eligible boolean; v_current jsonb; v_history jsonb;
begin
  if auth.uid() is null or public.has_portal_access() is not true then
    raise exception 'Forbidden' using errcode = '42501';
  end if;
  select coalesce(d.draft_estimate #> '{outputs,snapshot,customerBrief}', e.raw_payload->'customerBrief'),
    e.raw_payload->>'requestType' into v_brief, v_request_type
  from public.enquiry_requests e left join private.marketing_enquiry_deliveries d on d.enquiry_request_id = e.id
  where e.id = p_enquiry_id and e.project_id = p_project_id;
  if not found then raise exception 'Enquiry not found' using errcode = 'PT404'; end if;
  v_eligible := coalesce(v_request_type = 'project-discussion' and v_brief->>'audience' = 'residential'
    and v_brief->>'version' = '1' and jsonb_typeof(v_brief->'design') = 'object'
    and jsonb_typeof(v_brief #> '{design,input}') = 'object'
    and jsonb_typeof(v_brief #> '{design,roof}') = 'object', false);
  select jsonb_build_object('version', q.version, 'state', q.state, 'criteria', q.criteria,
    'reason', q.reason, 'actorId', q.actor_id, 'actorEmail', q.actor_email,
    'recordedAt', q.recorded_at, 'criteriaVersion', q.criteria_version) into v_current
  from private.enquiry_qualification_events q where q.enquiry_id = p_enquiry_id and q.project_id = p_project_id
  order by q.version desc limit 1;
  select coalesce(jsonb_agg(h.entry order by h.version desc), '[]'::jsonb) into v_history from (
    select q.version, jsonb_build_object('version',q.version,'state',q.state,'criteria',q.criteria,
      'reason',q.reason,'actorId',q.actor_id,'actorEmail',q.actor_email,'recordedAt',q.recorded_at,
      'criteriaVersion',q.criteria_version) entry
    from private.enquiry_qualification_events q where q.enquiry_id=p_enquiry_id and q.project_id=p_project_id
    order by q.version desc limit 20
  ) h;
  return jsonb_build_object('enquiryId',p_enquiry_id,'projectId',p_project_id,'eligible',v_eligible,
    'current',coalesce(v_current,jsonb_build_object('version',0,'state','unreviewed',
      'criteria',jsonb_build_object('location',null,'project',null,'contactAndConfiguration',null,'intent',null),
      'reason','','actorId',null,'actorEmail',null,'recordedAt',null,'criteriaVersion','configured-enquiry-v1')),
    'history',v_history);
end;
$$;

create function public.enquiry_qualification_record(p_project_id uuid,p_enquiry_id uuid,p_command_id uuid,
  p_expected_version integer,p_state text,p_criteria jsonb,p_reason text) returns jsonb
language plpgsql security definer set search_path = pg_catalog, pg_temp as $$
declare v_read jsonb; v_request jsonb; v_previous private.enquiry_qualification_events%rowtype;
  v_version integer; v_reason text := btrim(coalesce(p_reason,''));
begin
  if auth.uid() is null or public.has_portal_access() is not true then
    raise exception 'Forbidden' using errcode = '42501';
  end if;
  if p_command_id is null or p_expected_version is null or p_expected_version < 0
    or p_state is null or p_state not in ('unreviewed','qualified','not_qualified')
    or p_criteria is null or jsonb_typeof(p_criteria) <> 'object'
    or not p_criteria ?& array['location','project','contactAndConfiguration','intent']
    or p_criteria - array['location','project','contactAndConfiguration','intent'] <> '{}'::jsonb
    or exists(select 1 from jsonb_each(p_criteria) x where x.value not in ('true'::jsonb,'false'::jsonb,'null'::jsonb))
    or length(v_reason) > 1000 then raise exception 'Invalid assessment' using errcode = 'PT400'; end if;
  -- Serialize all assessments of this source, including simultaneous first decisions.
  perform 1 from public.enquiry_requests where id=p_enquiry_id and project_id=p_project_id for update;
  if not found then raise exception 'Enquiry not found' using errcode = 'PT404'; end if;
  v_read := public.enquiry_qualification_read(p_project_id,p_enquiry_id);
  if (v_read->>'eligible')::boolean is not true then
    raise exception 'Only submitted residential configured enquiries can be assessed here' using errcode = 'PT400';
  end if;
  v_request := jsonb_build_object('projectId',p_project_id,'enquiryId',p_enquiry_id,'expectedVersion',p_expected_version,
    'state',p_state,'criteria',p_criteria,'reason',v_reason);
  select * into v_previous from private.enquiry_qualification_events where command_id=p_command_id;
  if found then
    if v_previous.request <> v_request or v_previous.actor_id <> auth.uid() then
      raise exception 'This request ID was already used for a different assessment' using errcode = 'PT409';
    end if;
    -- Return the newest view if a later correction happened after the original request.
    return v_read || jsonb_build_object('replayed',true);
  end if;
  v_version := (v_read #>> '{current,version}')::integer;
  if v_version <> p_expected_version then
    raise exception 'Another staff review was saved. Reload before reviewing again.' using errcode = 'PT409';
  end if;
  if p_state='qualified' and p_criteria <> '{"location":true,"project":true,"contactAndConfiguration":true,"intent":true}'::jsonb then
    raise exception 'Qualified requires all four criteria confirmed' using errcode = 'PT400';
  end if;
  if p_state='not_qualified' and (v_reason='' or not exists(select 1 from jsonb_each(p_criteria) x where x.value='false'::jsonb)) then
    raise exception 'Not qualified requires a failed criterion and a reason' using errcode = 'PT400';
  end if;
  if v_version>0 and v_reason='' then raise exception 'Explain the correction to retain its context' using errcode='PT400'; end if;
  insert into private.enquiry_qualification_events(command_id,enquiry_id,project_id,version,state,criteria,reason,actor_id,actor_email,request)
  values(p_command_id,p_enquiry_id,p_project_id,v_version+1,p_state,p_criteria,v_reason,auth.uid(),nullif(auth.jwt()->>'email',''),v_request);
  return public.enquiry_qualification_read(p_project_id,p_enquiry_id) || jsonb_build_object('replayed',false);
end;
$$;
revoke all on function public.enquiry_qualification_read(uuid,uuid) from public, anon;
revoke all on function public.enquiry_qualification_record(uuid,uuid,uuid,integer,text,jsonb,text) from public, anon;
grant execute on function public.enquiry_qualification_read(uuid,uuid) to authenticated;
grant execute on function public.enquiry_qualification_record(uuid,uuid,uuid,integer,text,jsonb,text) to authenticated;
