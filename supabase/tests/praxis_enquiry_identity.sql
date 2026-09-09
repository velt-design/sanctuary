-- Shared by PGlite and real PostgreSQL. No shared target; all synthetic changes roll back.
begin;
do $grants$ declare denied_role text; begin
  foreach denied_role in array array['anon', 'authenticated', 'service_role'] loop
    if has_table_privilege(denied_role, 'praxis_reporting.enquiry_identities_v1', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE')
      or has_function_privilege(denied_role, 'praxis_reporting.enquiry_identity_snapshot_v1(timestamptz,timestamptz,uuid[])', 'EXECUTE') then
      raise exception 'Unexpected enquiry projection grant to %', denied_role;
    end if;
  end loop;
end $grants$;
insert into public.enquiry_requests (
  id, submission_id, enquiry_type, add_ons, files, source, utm, raw_payload,
  message, company, created_at, updated_at
)
select ('90000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
  ('92000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
  'residential', '{}', '[]', 'website', '{}', '{"secret":"PRIVATE_PAYLOAD"}',
  'PRIVATE_MESSAGE', 'PRIVATE_COMPANY',
  case n when 1 then '2020-01-01T00:00:00Z'::timestamptz
    when 2 then '2020-01-01T00:00:00.000001Z'::timestamptz
    when 3 then '2020-01-02T00:00:00Z'::timestamptz
    when 4 then '2019-12-31T23:59:59.999999Z'::timestamptz
    else '2020-01-01T12:00:00Z'::timestamptz end,
  '2025-01-01T00:00:00Z'
from generate_series(1, 7) n;

select public.marketing_enquiry_email_begin(
  ('91000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
  ('90000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
  ('92000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid, repeat('a', 64)
) from generate_series(1, 6) n;
select public.marketing_enquiry_email_record('91000000-0000-4000-8000-000000000001', repeat('a', 64), 'accepted', 'synthetic-provider-api-id', 'RESEND_ACCEPTED');
select public.marketing_enquiry_email_record('91000000-0000-4000-8000-000000000002', repeat('a', 64), 'failed', null, 'RESEND_VALIDATION_REJECTED');
select public.marketing_enquiry_email_record('91000000-0000-4000-8000-000000000006', repeat('a', 64), 'unknown', null, 'RESEND_TIMEOUT');

set local role sanctuary_praxis_reader;
do $contract$
declare rows_json jsonb; total integer; window_count integer; denied boolean; statement text;
begin
  select jsonb_agg(to_jsonb(v)), count(*), count(*) filter (where in_window)
  into rows_json, total, window_count
  from praxis_reporting.enquiry_identity_snapshot_v1('2020-01-01T00:00:00Z','2020-01-02T00:00:00Z',array[
    '91000000-0000-4000-8000-000000000001'::uuid,
    '91000000-0000-4000-8000-000000000001'::uuid,
    '91000000-0000-4000-8000-000000000003'::uuid,
    '91000000-0000-4000-8000-000000000004'::uuid,
    '91000000-0000-4000-8000-000000000099'::uuid
  ]) v;
  if total <> 7 or window_count <> 5 then raise exception 'Window/candidate union or deduplication failed'; end if;
  if rows_json::text ~ 'PRIVATE_|payload_hash|provider_idempotency_key|message|company' then
    -- provider_api_message_id and verified_rfc_message_id are explicit safe keys.
    if replace(replace(rows_json::text, 'provider_api_message_id', ''), 'verified_rfc_message_id', '')
       ~ 'PRIVATE_|payload_hash|provider_idempotency_key|message|company' then
      raise exception 'Projection leaked excluded fields';
    end if;
  end if;
  if exists (select 1 from jsonb_array_elements(rows_json) r where r->'verified_rfc_message_id' <> 'null'::jsonb) then
    raise exception 'Unverified RFC identity was fabricated';
  end if;
  if not exists (select 1 from jsonb_array_elements(rows_json) r where r->>'receipt_state'='no_intent' and r->'outcome'='null'::jsonb)
     or not exists (select 1 from jsonb_array_elements(rows_json) r where r->>'receipt_state'='missing' and r->>'outcome'='unknown' and r->>'code'='ENQUIRY_EMAIL_RECEIPT_MISSING')
     or not exists (select 1 from jsonb_array_elements(rows_json) r where r->>'receipt_state'='recorded' and r->>'outcome'='unknown' and r->>'code'='RESEND_TIMEOUT')
     or not exists (select 1 from jsonb_array_elements(rows_json) r where r->>'outcome'='accepted' and r->>'provider_api_message_id'='synthetic-provider-api-id')
     or not exists (select 1 from jsonb_array_elements(rows_json) r where r->>'outcome'='failed') then
    raise exception 'Receipt provenance states collapsed';
  end if;
  if exists (select 1 from jsonb_array_elements(rows_json) r where r->'reference'<>'null'::jsonb and r->>'submission_id'<>r->>'dispatch_submission_id') then
    raise exception 'Dispatch/canonical identity mapping drifted';
  end if;
  select count(*) into total from praxis_reporting.enquiry_identity_snapshot_v1(
    '2020-01-01T00:00:00.000001Z','2020-01-01T00:00:00.000002Z','{}');
  if total <> 1 then raise exception 'Microsecond interval comparison was rounded'; end if;
  select count(*) into total from praxis_reporting.enquiry_identity_snapshot_v1('2020-01-01T00:00:00Z','2020-02-01T00:00:00Z','{}');
  if total <> 6 then raise exception 'Exact31day boundary rejected'; end if;

  foreach statement in array array[
    $q$select * from praxis_reporting.enquiry_identity_snapshot_v1('2020-01-01T00:00:00Z','2020-02-01T00:00:00.000001Z','{}')$q$,
    $q$select * from praxis_reporting.enquiry_identity_snapshot_v1('2020-01-02T00:00:00Z','2020-01-01T00:00:00Z','{}')$q$,
    $q$select * from praxis_reporting.enquiry_identity_snapshot_v1('2020-01-01T00:00:00Z','2020-01-01T00:00:00Z','{}')$q$,
    $q$select * from praxis_reporting.enquiry_identity_snapshot_v1(now(),now()+interval '1day','{}')$q$,
    $q$select * from praxis_reporting.enquiry_identity_snapshot_v1('-infinity','2020-01-01T00:00:00Z','{}')$q$,
    $q$select * from praxis_reporting.enquiry_identity_snapshot_v1('2020-01-01T00:00:00Z','2020-01-02T00:00:00Z',null)$q$,
    $q$select * from praxis_reporting.enquiry_identity_snapshot_v1('2020-01-01T00:00:00Z','2020-01-02T00:00:00Z',array[null::uuid])$q$,
    $q$select * from praxis_reporting.enquiry_identity_snapshot_v1('2020-01-01T00:00:00Z','2020-01-02T00:00:00Z',array[['91000000-0000-4000-8000-000000000001'::uuid]])$q$,
    $q$select * from praxis_reporting.enquiry_identity_snapshot_v1('2020-01-01T00:00:00Z','2020-01-02T00:00:00Z',array_fill('91000000-0000-4000-8000-000000000001'::uuid,array[101]))$q$,
    $q$select * from praxis_reporting.enquiry_identity_snapshot_v1('2020-01-01T00:00:00Z','2020-01-02T00:00:00Z',array['91000000-0000-1000-8000-000000000001'::uuid])$q$
  ] loop
    denied := false;
    begin execute statement; exception when invalid_parameter_value then denied := true; end;
    if not denied then raise exception 'Invalid query unexpectedly succeeded: %', statement; end if;
  end loop;

  -- This transaction is READ WRITE: denials must come from privileges, not a default setting.
  if has_table_privilege(current_user, 'praxis_reporting.enquiry_identities_v1', 'INSERT,UPDATE,DELETE,TRUNCATE') then
    raise exception 'Reader has a projection write grant';
  end if;
  foreach statement in array array[
    'select * from public.enquiry_requests',
    'select * from private.marketing_enquiry_email_intents',
    'select * from private.marketing_enquiry_email_receipts',
    'delete from praxis_reporting.enquiry_identities_v1',
    'update public.enquiry_requests set message=''changed''',
    'create table praxis_reporting.unauthorized_write(id integer)',
    $q$select public.marketing_enquiry_email_read('91000000-0000-4000-8000-000000000001')$q$,
    $q$select public.marketing_enquiry_email_begin('91000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000001',repeat('a',64))$q$,
    $q$select public.marketing_enquiry_email_record('91000000-0000-4000-8000-000000000001',repeat('a',64),'accepted','unauthorized','RESEND_ACCEPTED')$q$
  ] loop
    denied := false;
    begin execute statement;
    exception when insufficient_privilege then denied := true;
      when object_not_in_prerequisite_state then
        if statement <> 'delete from praxis_reporting.enquiry_identities_v1' then raise; end if;
        denied := true; -- PostgreSQL can reject the non-updatable view before checking ACLs.
    end;
    if not denied then raise exception 'Reader operation unexpectedly succeeded: %', statement; end if;
  end loop;
end;
$contract$;
reset role;

-- Exactly100 rows, then101 across the window/reference union.
insert into public.enquiry_requests (id, submission_id, enquiry_type, add_ons, files, source, utm, raw_payload, created_at, updated_at)
select ('93000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
  ('94000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
  'residential','{}','[]','website','{}','{}','2020-03-01T00:00:00Z','2020-03-01T00:00:00Z'
from generate_series(1,100) n;
set local role sanctuary_praxis_reader;
do $$ declare total integer; begin
  select count(*) into total from praxis_reporting.enquiry_identity_snapshot_v1('2020-03-01T00:00:00Z','2020-03-02T00:00:00Z','{}');
  if total<>100 then raise exception 'Exact100row snapshot failed'; end if;
  select count(*) into total from praxis_reporting.enquiry_identity_snapshot_v1('2020-03-01T00:00:00Z','2020-03-02T00:00:00Z',array['91000000-0000-4000-8000-000000000001'::uuid]);
  if total<>101 then raise exception 'Combined101row sentinel missing'; end if;
end $$;
reset role;
rollback;
