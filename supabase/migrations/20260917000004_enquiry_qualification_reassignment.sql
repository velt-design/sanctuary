-- Qualification belongs to the stable enquiry; project_id on each event is historical context.
-- First validate its current project above the history lookup; old-project reads/writes stay denied.
create or replace function public.enquiry_qualification_read(p_project_id uuid, p_enquiry_id uuid) returns jsonb
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
  from private.enquiry_qualification_events q where q.enquiry_id = p_enquiry_id
  order by q.version desc limit 1;
  select coalesce(jsonb_agg(h.entry order by h.version desc), '[]'::jsonb) into v_history from (
    select q.version, jsonb_build_object('version',q.version,'state',q.state,'criteria',q.criteria,
      'reason',q.reason,'actorId',q.actor_id,'actorEmail',q.actor_email,'recordedAt',q.recorded_at,
      'criteriaVersion',q.criteria_version) entry
    from private.enquiry_qualification_events q where q.enquiry_id=p_enquiry_id
    order by q.version desc limit 20
  ) h;
  return jsonb_build_object('enquiryId',p_enquiry_id,'projectId',p_project_id,'eligible',v_eligible,
    'current',coalesce(v_current,jsonb_build_object('version',0,'state','unreviewed',
      'criteria',jsonb_build_object('location',null,'project',null,'contactAndConfiguration',null,'intent',null),
      'reason','','actorId',null,'actorEmail',null,'recordedAt',null,'criteriaVersion','configured-enquiry-v1')),
    'history',v_history);
end;
$$;
