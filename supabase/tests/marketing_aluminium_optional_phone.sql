-- Disposable-database contract. All synthetic records and failure fixtures roll
-- back. Run only through the isolated harness, never shared intake or delivery.
begin;

create function public.test_aluminium_enquiry_failure() returns trigger
language plpgsql as $$
begin
  if new.message = 'force_atomic_failure' then
    raise exception 'synthetic_intake_failure' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger test_aluminium_enquiry_failure before insert on public.enquiry_requests
for each row execute function public.test_aluminium_enquiry_failure();

do $$
declare
  v_page text;
  v_id uuid;
  v_first record;
  v_retry record;
  v_other record;
  v_invalid jsonb;
  v_before bigint[];
  v_payload jsonb := jsonb_build_object(
    'enquiryType', 'residential', 'name', 'Aluminium SEO fixture',
    'email', gen_random_uuid()::text || '@example.invalid',
    'phone', '', 'phoneRaw', '', 'suburb', 'Albany', 'files', '[]'::jsonb,
    'rawPayload', '{"requestType":"project-discussion","customerBrief":{"design":null}}'::jsonb
  );
begin
  if not has_function_privilege('service_role', 'public.marketing_enquiry_intake(uuid,text,jsonb)', 'EXECUTE')
     or has_function_privilege('anon', 'public.marketing_enquiry_intake(uuid,text,jsonb)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.marketing_enquiry_intake(uuid,text,jsonb)', 'EXECUTE')
     or not exists (
       select 1 from pg_proc where oid = 'public.marketing_enquiry_intake(uuid,text,jsonb)'::regprocedure
       and prosecdef and proconfig = array['search_path=""']
     ) then
    raise exception 'Intake must retain its service-only definer boundary and empty search path';
  end if;

  foreach v_page in array array['/aluminium-pergolas-auckland'] loop
    v_id := gen_random_uuid();
    v_payload := v_payload || jsonb_build_object('page', v_page, 'email', gen_random_uuid()::text || '@example.invalid');
    select * into strict v_first from public.marketing_enquiry_intake(v_id, '', v_payload);
    if (select phone from public.contacts where id = v_first.contact_id) is not null
       or not exists (select 1 from public.enquiry_requests where id = v_first.enquiry_request_id
         and page = v_page and raw_payload = v_payload->'rawPayload') then
      raise exception 'Direct funnel must preserve its page and design-free receipt with null phone';
    end if;
    select * into strict v_retry from public.marketing_enquiry_intake(v_id, '', v_payload || '{"message":"changed retry"}');
    if not v_retry.already_existed or v_retry.project_id <> v_first.project_id
       or v_retry.enquiry_request_id <> v_first.enquiry_request_id
       or exists (select 1 from public.enquiry_requests where id = v_first.enquiry_request_id and message is not null) then
      raise exception 'Replay must preserve the original receipt and project';
    end if;
    select * into strict v_retry from public.marketing_enquiry_intake(gen_random_uuid(), '', v_payload);
    if v_retry.contact_id <> v_first.contact_id then
      raise exception 'Matching email must reuse its contact';
    end if;
    insert into public.contacts(name, email, phone)
      values ('Empty phone fixture', gen_random_uuid()::text || '@example.invalid', '');
    select * into strict v_other from public.marketing_enquiry_intake(gen_random_uuid(), '',
      v_payload || jsonb_build_object('email', gen_random_uuid()::text || '@example.invalid'));
    if v_other.contact_id = v_first.contact_id then
      raise exception 'Absent phones must never merge separate email identities';
    end if;

    -- Configured requests still use the established discussion/design exception.
    select * into strict v_other from public.marketing_enquiry_intake(gen_random_uuid(), '',
      jsonb_set(v_payload, '{rawPayload,customerBrief,design}', '{"version":1}'));
    if not exists (select 1 from public.enquiry_requests where id = v_other.enquiry_request_id
      and raw_payload->'customerBrief'->'design' = '{"version":1}'::jsonb) then
      raise exception 'Configured design must be retained';
    end if;
  end loop;

  -- Every refusal must happen without creating or updating business records.
  v_before := array[(select count(*) from public.contacts), (select count(*) from public.projects), (select count(*) from public.enquiry_requests)];
  for v_invalid in
    select v_payload || patch from (values
      ('{"enquiryType":"commercial"}'::jsonb), ('{"enquiryType":"professional"}'),
      ('{"page":"/auckland-outdoor-living-extra"}'), ('{"page":"/acrylic-roof-pergolas-auckland/"}'),
      ('{"page":"/aluminium-pergolas-auckland/"}'), ('{"page":"/aluminium-pergolas-auckland-extra"}'), ('{"page":"/aluminium-pergolas-auckland?test=1"}'), ('{"page":"/contact"}'), ('{"page":"/pergolas-auckland"}'),
      ('{"page":"/ads/acrylic-pergolas-extra"}'), ('{"page":"/ads/acrylic-pergolas/"}'),
      ('{"page":"/ads/acrylic-pergolas?campaign=test"}'), ('{"page":"/ads/acrylic-pergolas#contact"}'),
      ('{"page":"/ADS/acrylic-pergolas"}'), ('{"page":null}'),
      ('{"name":" "}'), ('{"name":null}'), ('{"email":" "}'), ('{"email":null}'),
      ('{"suburb":" "}'), ('{"suburb":null}'),
      ('{"rawPayload":{"requestType":"site-measure"}}'),
      ('{"rawPayload":{"requestType":"unknown"}}'), ('{"rawPayload":{}}'),
      ('{"files":{}}')
    ) invalid(patch)
  loop
    begin
      perform public.marketing_enquiry_intake(gen_random_uuid(), '', v_invalid);
      raise exception 'Invalid direct funnel accepted: %', v_invalid;
    exception when invalid_parameter_value then null;
    end;
  end loop;
  if v_before <> array[(select count(*) from public.contacts), (select count(*) from public.projects), (select count(*) from public.enquiry_requests)] then
    raise exception 'Refused intake changed business records';
  end if;

  -- Failure after contact/project creation must roll back the whole RPC.
  begin
    perform public.marketing_enquiry_intake(gen_random_uuid(), '', v_payload || jsonb_build_object(
      'email', gen_random_uuid()::text || '@example.invalid', 'message', 'force_atomic_failure'));
    raise exception 'Expected synthetic insert failure';
  exception when check_violation then null;
  end;
  if v_before <> array[(select count(*) from public.contacts), (select count(*) from public.projects), (select count(*) from public.enquiry_requests)] then
    raise exception 'Failed intake did not roll back atomically';
  end if;
  begin
    perform public.marketing_enquiry_intake(gen_random_uuid(), '', v_payload ||
      '{"files":[{"path":"unverified/plan.pdf","name":"plan.pdf","type":"application/pdf","size":42}]}');
    raise exception 'Expected upload-session rejection';
  exception when invalid_parameter_value then null;
  end;
  if v_before <> array[(select count(*) from public.contacts), (select count(*) from public.projects), (select count(*) from public.enquiry_requests)] then
    raise exception 'Unverified upload changed business records';
  end if;

  -- Existing configured/contact and phone-provided Facebook paths remain valid.
  perform public.marketing_enquiry_intake(gen_random_uuid(), '', jsonb_set(
    v_payload || '{"page":"/contact"}', '{rawPayload,customerBrief,design}', '{"version":1}'));
  foreach v_page in array array['/auckland-outdoor-living', '/acrylic-roof-pergolas-auckland'] loop
    perform public.marketing_enquiry_intake(gen_random_uuid(), '', v_payload || jsonb_build_object('page', v_page, 'phone', '021000000'));
  end loop;
end;
$$;

rollback;
