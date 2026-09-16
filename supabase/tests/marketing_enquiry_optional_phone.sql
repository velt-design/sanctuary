-- Synthetic database contract only; all fixtures roll back. No delivery calls.
begin;
do $$
declare
  v_id uuid := gen_random_uuid();
  v_first record;
  v_other record;
  v_retry record;
  v_payload jsonb := jsonb_build_object(
    'enquiryType', 'residential', 'name', 'Optional phone fixture',
    'email', gen_random_uuid()::text || '@example.invalid',
    'phone', '', 'suburb', 'Albany', 'files', '[]'::jsonb,
    'rawPayload', '{"requestType":"project-discussion","customerBrief":{"design":{"version":1}}}'::jsonb
  );
begin
  select * into strict v_first from public.marketing_enquiry_intake(v_id, '', v_payload);
  if (select phone from public.contacts where id = v_first.contact_id) is not null then
    raise exception 'Absent phone must be stored as null';
  end if;
  select * into strict v_retry from public.marketing_enquiry_intake(v_id, '', v_payload);
  if not v_retry.already_existed or v_retry.project_id <> v_first.project_id then
    raise exception 'Replay must retain original project';
  end if;
  select * into strict v_retry from public.marketing_enquiry_intake(gen_random_uuid(), '', v_payload);
  if v_retry.contact_id <> v_first.contact_id then
    raise exception 'Same email must reuse contact';
  end if;
  -- Include a pre-existing empty-phone record: blank strings must never match.
  insert into public.contacts(name, email, phone) values ('Empty phone fixture', gen_random_uuid()::text || '@example.invalid', '');
  v_payload := jsonb_set(v_payload, '{email}', to_jsonb(gen_random_uuid()::text || '@example.invalid'));
  select * into strict v_other from public.marketing_enquiry_intake(gen_random_uuid(), '', v_payload);
  if v_other.contact_id = v_first.contact_id or not exists (
    select 1 from public.contacts where id = v_other.contact_id and email = v_payload->>'email'
  ) then
    raise exception 'Different customers without phones must remain separate';
  end if;
  begin
    perform public.marketing_enquiry_intake(gen_random_uuid(), '', v_payload - 'rawPayload');
    raise exception 'Legacy enquiry without phone was accepted';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.marketing_enquiry_intake(gen_random_uuid(), '', v_payload - 'email');
    raise exception 'Enquiry without any contact method was accepted';
  exception when invalid_parameter_value then null;
  end;
end $$;
rollback;
