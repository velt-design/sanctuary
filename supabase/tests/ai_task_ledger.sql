-- Executable database contract for PR-AI-004.
-- The harness applies the migration to a disposable database before this file.

begin;

insert into auth.users (id) values
  ('10000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000002'),
  ('10000000-0000-0000-0000-000000000003');

insert into public.portal_users (user_id, role) values
  ('10000000-0000-0000-0000-000000000001', 'staff'),
  ('10000000-0000-0000-0000-000000000002', 'staff'),
  ('10000000-0000-0000-0000-000000000003', 'admin');

do $$
declare
  v_rls_count integer;
  v_private_policy_count integer;
begin
  select count(*)
  into v_rls_count
  from pg_catalog.pg_class relation
  join pg_catalog.pg_namespace namespace on namespace.oid = relation.relnamespace
  where (namespace.nspname, relation.relname) in (
    ('public', 'ai_tasks'),
    ('public', 'ai_task_events'),
    ('private', 'ai_task_payloads'),
    ('private', 'ai_task_command_receipts')
  )
    and relation.relrowsecurity;

  if v_rls_count <> 4 then
    raise exception 'all AI ledger tables must have RLS enabled';
  end if;

  select count(*)
  into v_private_policy_count
  from pg_catalog.pg_policy policy
  join pg_catalog.pg_class relation on relation.oid = policy.polrelid
  join pg_catalog.pg_namespace namespace on namespace.oid = relation.relnamespace
  where namespace.nspname = 'private'
    and relation.relname in ('ai_task_payloads', 'ai_task_command_receipts');

  if v_private_policy_count <> 0 then
    raise exception 'private AI ledger tables must not expose RLS policies';
  end if;

  if not has_table_privilege('authenticated', 'public.ai_tasks', 'SELECT')
     or not has_table_privilege('authenticated', 'public.ai_task_events', 'SELECT')
     or has_table_privilege('authenticated', 'public.ai_tasks', 'INSERT,UPDATE,DELETE')
     or has_table_privilege('authenticated', 'public.ai_task_events', 'INSERT,UPDATE,DELETE') then
    raise exception 'authenticated must have read-only access to safe AI tables';
  end if;

  if has_table_privilege('anon', 'public.ai_tasks', 'SELECT,INSERT,UPDATE,DELETE')
     or has_table_privilege('service_role', 'public.ai_tasks', 'SELECT,INSERT,UPDATE,DELETE')
     or has_table_privilege('authenticated', 'private.ai_task_payloads', 'SELECT,INSERT,UPDATE,DELETE')
     or has_table_privilege('service_role', 'private.ai_task_payloads', 'SELECT,INSERT,UPDATE,DELETE')
     or has_schema_privilege('authenticated', 'private', 'USAGE')
     or has_schema_privilege('service_role', 'private', 'USAGE') then
    raise exception 'private AI data or mutation access escaped its boundary';
  end if;

  if not has_function_privilege(
      'authenticated',
      'public.ai_task_create_synthetic(text,text)',
      'EXECUTE'
    )
    or not has_function_privilege(
      'authenticated',
      'public.ai_task_cancel_synthetic(uuid,uuid,text)',
      'EXECUTE'
    )
    or has_function_privilege(
      'anon',
      'public.ai_task_create_synthetic(text,text)',
      'EXECUTE'
    )
    or has_function_privilege(
      'service_role',
      'public.ai_task_create_synthetic(text,text)',
      'EXECUTE'
    ) then
    raise exception 'AI semantic command privileges do not match the contract';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'ai_tasks'
      and column_name in ('objective', 'payload', 'fixture_key')
  ) then
    raise exception 'raw AI inputs must not be present on the public task table';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'private'
      and table_name = 'ai_task_payloads'
      and column_name = 'payload'
  ) then
    raise exception 'private AI payload storage is missing';
  end if;
end;
$$;

set local role authenticated;
set local "request.jwt.claim.sub" = '10000000-0000-0000-0000-000000000001';

create temporary table ai_task_test_state on commit drop as
select *
from public.ai_task_create_synthetic('db-contract.intent-1', 'echo_v1');

do $$
declare
  v_result record;
begin
  select * into v_result from ai_task_test_state;
  if v_result.created_status <> 'proposed'
     or v_result.was_replayed
     or v_result.created_input_snapshot_hash !~ '^sha256:[0-9a-f]{64}$' then
    raise exception 'first synthetic create returned an invalid contract';
  end if;
end;
$$;

do $$
declare
  v_original uuid;
  v_replay record;
begin
  select created_task_id into v_original from ai_task_test_state;
  select * into v_replay
  from public.ai_task_create_synthetic('db-contract.intent-1', 'echo_v1');
  if v_replay.created_task_id <> v_original or not v_replay.was_replayed then
    raise exception 'same create intent did not replay its original task';
  end if;
end;
$$;

do $$
begin
  perform public.ai_task_create_synthetic(
    'db-contract.intent-1',
    'classification_v1'
  );
  raise exception 'changed input reused an idempotency key';
exception
  when unique_violation then null;
end;
$$;

reset role;

do $$
declare
  v_task_id uuid;
  v_public_task public.ai_tasks%rowtype;
  v_payload private.ai_task_payloads%rowtype;
begin
  select created_task_id into v_task_id from ai_task_test_state;
  select * into strict v_public_task from public.ai_tasks where id = v_task_id;
  select * into strict v_payload from private.ai_task_payloads where task_id = v_task_id;

  if v_public_task.execution_mode <> 'synthetic'
     or v_public_task.effect_class <> 'none'
     or v_public_task.max_cost_cents <> 0
     or v_public_task.actual_cost_cents <> 0
     or v_public_task.input_snapshot_hash <> v_payload.input_snapshot_hash then
    raise exception 'synthetic/no-effect/no-spend or payload identity invariant failed';
  end if;

  if (select count(*) from public.ai_task_events where task_id = v_task_id) <> 1 then
    raise exception 'create must append exactly one event';
  end if;
end;
$$;

set local role authenticated;
set local "request.jwt.claim.sub" = '10000000-0000-0000-0000-000000000002';

do $$
declare
  v_task_id uuid;
begin
  if (select count(*) from public.ai_tasks) <> 0 then
    raise exception 'unrelated staff member could read another staff task';
  end if;

  select created_task_id into v_task_id from ai_task_test_state;

  perform public.ai_task_cancel_synthetic(
    v_task_id,
    '20000000-0000-0000-0000-000000000001',
    'operator_requested'
  );
  raise exception 'unrelated staff member cancelled another staff task';
exception
  when insufficient_privilege then null;
end;
$$;

reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = '10000000-0000-0000-0000-000000000003';

do $$
declare
  v_task_id uuid;
  v_first record;
  v_replay record;
  v_second record;
begin
  if (select count(*) from public.ai_tasks) <> 1 then
    raise exception 'admin could not read the safe task ledger';
  end if;

  select created_task_id into v_task_id from ai_task_test_state;

  select * into v_first
  from public.ai_task_cancel_synthetic(
    v_task_id,
    '20000000-0000-0000-0000-000000000002',
    'operator_requested'
  );
  select * into v_replay
  from public.ai_task_cancel_synthetic(
    v_task_id,
    '20000000-0000-0000-0000-000000000002',
    'operator_requested'
  );
  select * into v_second
  from public.ai_task_cancel_synthetic(
    v_task_id,
    '20000000-0000-0000-0000-000000000003',
    'test_cleanup'
  );

  if v_first.cancelled_status <> 'cancelled'
     or v_first.was_replayed
     or v_first.was_already_applied
     or not v_replay.was_replayed
     or v_replay.was_already_applied
     or v_second.was_replayed
     or not v_second.was_already_applied then
    raise exception 'cancel idempotency results do not match the contract';
  end if;
end;
$$;

do $$
declare
  v_task_id uuid;
begin
  select created_task_id into v_task_id from ai_task_test_state;

  perform public.ai_task_cancel_synthetic(
    v_task_id,
    '20000000-0000-0000-0000-000000000002',
    'superseded'
  );
  raise exception 'changed cancellation reused a command ID';
exception
  when unique_violation then null;
end;
$$;

reset role;

do $$
declare
  v_task_id uuid;
begin
  select created_task_id into v_task_id from ai_task_test_state;

  if (select status from public.ai_tasks where id = v_task_id) <> 'cancelled'
     or (select count(*) from public.ai_task_events where task_id = v_task_id) <> 2
     or (select count(*) from private.ai_task_command_receipts where task_id = v_task_id) <> 2 then
    raise exception 'cancelled ledger history is incomplete or duplicated';
  end if;

  begin
    update public.ai_task_events
    set safe_summary = 'Mutated.'
    where task_id = v_task_id;
    raise exception 'event history accepted an update';
  exception
    when invalid_parameter_value then null;
  end;

  begin
    update private.ai_task_payloads
    set objective = 'Mutated.'
    where task_id = v_task_id;
    raise exception 'private payload accepted an update';
  exception
    when invalid_parameter_value then null;
  end;

  begin
    delete from public.ai_tasks where id = v_task_id;
    raise exception 'task with command receipts was deleted';
  exception
    when foreign_key_violation or invalid_parameter_value then null;
  end;
end;
$$;

rollback;
