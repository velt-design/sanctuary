-- Configured residential enquiries accept email without a phone number.
-- Never deduplicate contacts using an absent phone. Other enquiry paths retain
-- their phone requirement; the authenticated service remains the only caller.

create or replace function public.marketing_enquiry_intake(
  p_submission_id uuid,
  p_upload_token_hash text,
  p_payload jsonb
)
returns table (
  contact_id uuid,
  project_id uuid,
  enquiry_request_id uuid,
  already_existed boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing public.enquiry_requests%rowtype;
  v_session public.marketing_enquiry_upload_sessions%rowtype;
  v_contact_id uuid;
  v_project_id uuid;
  v_enquiry_id uuid;
  v_enquiry_type text;
  v_name text;
  v_email text;
  v_phone text;
  v_phone_raw text;
  v_suburb text;
  v_files jsonb;
  v_has_stored_files boolean;
begin
  if p_submission_id is null or jsonb_typeof(p_payload) is distinct from 'object' then
    raise exception 'invalid_enquiry_intake_input' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_submission_id::text, 0));

  select *
  into v_existing
  from public.enquiry_requests
  where submission_id = p_submission_id;

  if found then
    contact_id := v_existing.contact_id;
    project_id := v_existing.project_id;
    enquiry_request_id := v_existing.id;
    already_existed := true;
    return next;
    return;
  end if;

  v_enquiry_type := lower(btrim(coalesce(p_payload->>'enquiryType', '')));
  v_name := btrim(coalesce(p_payload->>'name', ''));
  v_email := lower(btrim(coalesce(p_payload->>'email', '')));
  v_phone := btrim(coalesce(p_payload->>'phone', ''));
  v_phone_raw := btrim(coalesce(p_payload->>'phoneRaw', ''));
  v_suburb := btrim(coalesce(p_payload->>'suburb', ''));
  v_files := coalesce(p_payload->'files', '[]'::jsonb);

  if v_enquiry_type not in ('residential', 'commercial', 'professional')
     or v_name = ''
     or (v_phone = '' and not coalesce(
       v_enquiry_type = 'residential'
       and v_email <> '' and v_suburb <> ''
       and p_payload->'rawPayload'->>'requestType' = 'project-discussion'
       and jsonb_typeof(p_payload->'rawPayload'->'customerBrief'->'design') = 'object',
       false
     ))
     or jsonb_typeof(v_files) is distinct from 'array'
     or jsonb_array_length(v_files) > 8 then
    raise exception 'invalid_enquiry_intake_input' using errcode = '22023';
  end if;

  select exists (
    select 1
    from jsonb_array_elements(v_files) entry
    where nullif(entry->>'path', '') is not null
  ) into v_has_stored_files;

  if v_has_stored_files then
    if p_upload_token_hash !~ '^[a-f0-9]{64}$' then
      raise exception 'invalid_upload_session' using errcode = '22023';
    end if;

    select *
    into v_session
    from public.marketing_enquiry_upload_sessions
    where submission_id = p_submission_id
      and token_hash = p_upload_token_hash
      and consumed_at is null
      and expires_at > clock_timestamp()
    for update;

    if not found or exists (
      select 1
      from jsonb_array_elements(v_files) supplied
      where nullif(supplied->>'path', '') is not null
        and not exists (
          select 1
          from jsonb_array_elements(v_session.expected_files) expected
          where expected->>'path' = supplied->>'path'
            and expected->>'name' = supplied->>'name'
            and expected->>'type' = supplied->>'type'
            and (expected->>'size')::bigint = (supplied->>'size')::bigint
        )
    ) then
      raise exception 'invalid_upload_session' using errcode = '22023';
    end if;
  end if;

  if v_email <> '' then
    select id
    into v_contact_id
    from public.contacts
    where lower(email) = v_email
    limit 1;
  end if;

  if v_contact_id is null and v_phone <> '' then
    select id
    into v_contact_id
    from public.contacts
    where phone = v_phone
    limit 1;
  end if;

  if v_contact_id is null and v_phone_raw <> '' and v_phone_raw <> v_phone then
    select id
    into v_contact_id
    from public.contacts
    where phone = v_phone_raw
    limit 1;
  end if;

  if v_contact_id is null then
    insert into public.contacts (name, email, phone)
    values (v_name, nullif(v_email, ''), nullif(v_phone, ''))
    returning id into v_contact_id;
  else
    update public.contacts
    set
      name = case when nullif(btrim(name), '') is null then v_name else name end,
      email = case when nullif(btrim(email), '') is null then nullif(v_email, '') else email end,
      phone = case when nullif(btrim(phone), '') is null then nullif(v_phone, '') else phone end
    where id = v_contact_id;
  end if;

  insert into public.projects (
    contact_id,
    name,
    pipeline_stage,
    site_address
  )
  values (
    v_contact_id,
    v_name || ' - ' || coalesce(nullif(v_suburb, ''), 'Enquiry'),
    'NEW',
    nullif(v_suburb, '')
  )
  returning id into v_project_id;

  insert into public.enquiry_requests (
    submission_id,
    contact_id,
    project_id,
    enquiry_type,
    suburb,
    message,
    width_m,
    depth_m,
    height_m,
    style,
    roof_materials,
    add_ons,
    base_budget_low_inc_gst,
    base_budget_high_inc_gst,
    blinds_budget_low_inc_gst,
    blinds_budget_high_inc_gst,
    budget_basis,
    company,
    files,
    source,
    page,
    utm,
    raw_payload
  )
  values (
    p_submission_id,
    v_contact_id,
    v_project_id,
    v_enquiry_type,
    nullif(v_suburb, ''),
    nullif(p_payload->>'message', ''),
    nullif(p_payload->>'widthM', '')::numeric,
    nullif(p_payload->>'depthM', '')::numeric,
    nullif(p_payload->>'heightM', '')::numeric,
    nullif(p_payload->>'style', ''),
    case
      when jsonb_typeof(p_payload->'roofMaterials') = 'array'
        then array(select jsonb_array_elements_text(p_payload->'roofMaterials'))
      else null
    end,
    coalesce(p_payload->'addOns', '{}'::jsonb),
    nullif(p_payload->>'baseBudgetLowIncGst', '')::integer,
    nullif(p_payload->>'baseBudgetHighIncGst', '')::integer,
    nullif(p_payload->>'blindsBudgetLowIncGst', '')::integer,
    nullif(p_payload->>'blindsBudgetHighIncGst', '')::integer,
    nullif(p_payload->>'budgetBasis', ''),
    nullif(p_payload->>'company', ''),
    v_files,
    coalesce(nullif(p_payload->>'source', ''), 'website'),
    nullif(p_payload->>'page', ''),
    coalesce(p_payload->'utm', '{}'::jsonb),
    coalesce(p_payload->'rawPayload', '{}'::jsonb)
  )
  returning id into v_enquiry_id;

  if v_has_stored_files then
    update public.marketing_enquiry_upload_sessions
    set
      consumed_at = clock_timestamp(),
      enquiry_request_id = v_enquiry_id,
      updated_at = clock_timestamp()
    where submission_id = p_submission_id;
  end if;

  contact_id := v_contact_id;
  project_id := v_project_id;
  enquiry_request_id := v_enquiry_id;
  already_existed := false;
  return next;
end;
$$;

revoke all on function public.marketing_enquiry_intake(uuid,text,jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.marketing_enquiry_intake(uuid,text,jsonb)
  to service_role;

