-- Executable database contract for PR-AI-005.
-- The harness applies AI-004 and AI-005 to a disposable database first.

begin;

insert into auth.users (id) values
  ('30000000-0000-0000-0000-000000000001'),
  ('30000000-0000-0000-0000-000000000002'),
  ('30000000-0000-0000-0000-000000000003');

insert into public.portal_users (user_id, role) values
  ('30000000-0000-0000-0000-000000000001', 'staff'),
  ('30000000-0000-0000-0000-000000000002', 'staff'),
  ('30000000-0000-0000-0000-000000000003', 'admin');

do $$
declare
  v_rls_count integer;
begin
  select count(*)
  into v_rls_count
  from pg_catalog.pg_class relation
  join pg_catalog.pg_namespace namespace on namespace.oid = relation.relnamespace
  where (namespace.nspname, relation.relname) in (
    ('public', 'ai_approvals'),
    ('private', 'ai_approval_envelopes'),
    ('private', 'ai_approval_command_receipts')
  )
    and relation.relrowsecurity;

  if v_rls_count <> 3 then
    raise exception 'all AI approval tables must have RLS enabled';
  end if;

  if not has_table_privilege('authenticated', 'public.ai_approvals', 'SELECT')
     or has_table_privilege('authenticated', 'public.ai_approvals', 'INSERT,UPDATE,DELETE')
     or has_table_privilege('anon', 'public.ai_approvals', 'SELECT,INSERT,UPDATE,DELETE')
     or has_table_privilege('service_role', 'public.ai_approvals', 'SELECT,INSERT,UPDATE,DELETE')
     or has_table_privilege('authenticated', 'private.ai_approval_envelopes', 'SELECT,INSERT,UPDATE,DELETE')
     or has_table_privilege('service_role', 'private.ai_approval_envelopes', 'SELECT,INSERT,UPDATE,DELETE') then
    raise exception 'AI approval grants escaped their safe read/semantic command boundary';
  end if;

  if not has_function_privilege(
      'authenticated',
      'public.ai_approval_request_synthetic(uuid,uuid,integer)',
      'EXECUTE'
    )
    or not has_function_privilege(
      'authenticated',
      'public.ai_approval_decide_synthetic(uuid,uuid,text)',
      'EXECUTE'
    )
    or not has_function_privilege(
      'authenticated',
      'public.ai_approval_consume_synthetic(uuid,uuid,text)',
      'EXECUTE'
    )
    or not has_function_privilege(
      'authenticated',
      'public.ai_approval_invalidate_synthetic(uuid,uuid,text,text)',
      'EXECUTE'
    )
    or has_function_privilege(
      'anon',
      'public.ai_approval_request_synthetic(uuid,uuid,integer)',
      'EXECUTE'
    )
    or has_function_privilege(
      'service_role',
      'public.ai_approval_request_synthetic(uuid,uuid,integer)',
      'EXECUTE'
    ) then
    raise exception 'AI approval semantic command privileges do not match the contract';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'ai_approvals'
      and column_name in ('payload', 'private_objective', 'task_input')
  ) then
    raise exception 'raw approval payload must not be public';
  end if;

  if (
    select count(*)
    from pg_catalog.pg_policy policy
    join pg_catalog.pg_class relation on relation.oid = policy.polrelid
    join pg_catalog.pg_namespace namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'private'
      and relation.relname in ('ai_approval_envelopes', 'ai_approval_command_receipts')
  ) <> 0 then
    raise exception 'private AI approval tables must not expose RLS policies';
  end if;
end;
$$;

set local role authenticated;
set local "request.jwt.claim.sub" = '30000000-0000-0000-0000-000000000001';

create temporary table ai_approval_test_state (
  label text primary key,
  task_id uuid not null,
  approval_id uuid null,
  payload_hash text null
) on commit drop;

insert into ai_approval_test_state (label, task_id)
select 'primary', created_task_id
from public.ai_task_create_synthetic('approval-contract.primary', 'echo_v1');

with requested as (
  select request_result.*
  from ai_approval_test_state state
  cross join lateral public.ai_approval_request_synthetic(
    state.task_id,
    '40000000-0000-0000-0000-000000000001',
    900
  ) request_result
  where state.label = 'primary'
)
update ai_approval_test_state state
set approval_id = requested.requested_approval_id,
    payload_hash = requested.requested_payload_hash
from requested
where state.label = 'primary';

do $$
declare
  v_state record;
  v_replay record;
  v_same_active record;
begin
  select * into strict v_state
  from ai_approval_test_state where label = 'primary';

  select * into v_replay
  from public.ai_approval_request_synthetic(
    v_state.task_id,
    '40000000-0000-0000-0000-000000000001',
    900
  );
  select * into v_same_active
  from public.ai_approval_request_synthetic(
    v_state.task_id,
    '40000000-0000-0000-0000-000000000002',
    900
  );

  if v_state.approval_id is null
     or v_state.payload_hash !~ '^sha256:[0-9a-f]{64}$'
     or v_replay.requested_approval_id <> v_state.approval_id
     or not v_replay.was_replayed
     or v_same_active.requested_approval_id <> v_state.approval_id
     or v_same_active.was_replayed
     or not v_same_active.was_already_applied then
    raise exception 'approval request replay/active-envelope contract failed';
  end if;

  begin
    perform public.ai_approval_request_synthetic(
      v_state.task_id,
      '40000000-0000-0000-0000-000000000001',
      901
    );
    raise exception 'changed approval request reused a command ID';
  exception
    when unique_violation then null;
  end;
end;
$$;

reset role;

do $$
declare
  v_state record;
  v_public public.ai_approvals%rowtype;
  v_private private.ai_approval_envelopes%rowtype;
begin
  select * into strict v_state
  from ai_approval_test_state where label = 'primary';
  select * into strict v_public
  from public.ai_approvals where id = v_state.approval_id;
  select * into strict v_private
  from private.ai_approval_envelopes where approval_id = v_state.approval_id;

  if v_public.status <> 'pending'
     or not v_public.single_use
     or v_public.required_role <> 'admin'
     or v_public.action_type <> 'synthetic.effect'
     or v_public.target_type <> 'synthetic.fixture'
     or v_public.payload_hash <> v_private.payload_hash
     or v_private.payload ->> 'effectClass' <> 'none'
     or v_private.payload ->> 'taskInputSnapshotHash' is null then
    raise exception 'exact synthetic approval envelope is inconsistent';
  end if;
end;
$$;

set local role authenticated;
set local "request.jwt.claim.sub" = '30000000-0000-0000-0000-000000000002';

do $$
declare
  v_state record;
begin
  if (select count(*) from public.ai_approvals) <> 0 then
    raise exception 'unrelated staff member could read another task approval';
  end if;

  select * into strict v_state
  from ai_approval_test_state where label = 'primary';
  begin
    perform public.ai_approval_decide_synthetic(
      v_state.approval_id,
      '40000000-0000-0000-0000-000000000003',
      'approved'
    );
    raise exception 'non-admin decided an approval';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = '30000000-0000-0000-0000-000000000003';

do $$
declare
  v_state record;
  v_first record;
  v_replay record;
begin
  if (select count(*) from public.ai_approvals) <> 1 then
    raise exception 'admin could not read the approval inbox';
  end if;
  select * into strict v_state
  from ai_approval_test_state where label = 'primary';

  select * into v_first
  from public.ai_approval_decide_synthetic(
    v_state.approval_id,
    '40000000-0000-0000-0000-000000000004',
    'approved'
  );
  select * into v_replay
  from public.ai_approval_decide_synthetic(
    v_state.approval_id,
    '40000000-0000-0000-0000-000000000004',
    'approved'
  );

  if v_first.decided_status <> 'approved'
     or v_first.was_replayed
     or v_first.was_already_applied
     or not v_replay.was_replayed then
    raise exception 'approval decision replay contract failed';
  end if;

  begin
    perform public.ai_approval_decide_synthetic(
      v_state.approval_id,
      '40000000-0000-0000-0000-000000000004',
      'rejected'
    );
    raise exception 'changed decision reused a command ID';
  exception
    when unique_violation then null;
  end;

  begin
    perform public.ai_approval_consume_synthetic(
      v_state.approval_id,
      '40000000-0000-0000-0000-000000000005',
      'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    );
    raise exception 'wrong payload hash consumed an approval';
  exception
    when invalid_parameter_value then null;
  end;
end;
$$;

reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = '30000000-0000-0000-0000-000000000001';

do $$
declare
  v_state record;
begin
  select * into strict v_state
  from ai_approval_test_state where label = 'primary';
  begin
    perform public.ai_approval_consume_synthetic(
      v_state.approval_id,
      '40000000-0000-0000-0000-000000000006',
      v_state.payload_hash
    );
    raise exception 'non-admin consumed an approval';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = '30000000-0000-0000-0000-000000000003';

do $$
declare
  v_state record;
  v_first record;
  v_replay record;
begin
  select * into strict v_state
  from ai_approval_test_state where label = 'primary';
  select * into v_first
  from public.ai_approval_consume_synthetic(
    v_state.approval_id,
    '40000000-0000-0000-0000-000000000007',
    v_state.payload_hash
  );
  select * into v_replay
  from public.ai_approval_consume_synthetic(
    v_state.approval_id,
    '40000000-0000-0000-0000-000000000007',
    v_state.payload_hash
  );

  if v_first.consumed_status <> 'consumed'
     or v_first.was_replayed
     or not v_replay.was_replayed then
    raise exception 'approval consumption replay contract failed';
  end if;

  begin
    perform public.ai_approval_consume_synthetic(
      v_state.approval_id,
      '40000000-0000-0000-0000-000000000008',
      v_state.payload_hash
    );
    raise exception 'single-use approval was consumed twice';
  exception
    when unique_violation then null;
  end;
end;
$$;

reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = '30000000-0000-0000-0000-000000000001';

insert into ai_approval_test_state (label, task_id)
select 'expiry', created_task_id
from public.ai_task_create_synthetic('approval-contract.expiry', 'echo_v1');

with requested as (
  select request_result.*
  from ai_approval_test_state state
  cross join lateral public.ai_approval_request_synthetic(
    state.task_id,
    '40000000-0000-0000-0000-000000000009',
    1
  ) request_result
  where state.label = 'expiry'
)
update ai_approval_test_state state
set approval_id = requested.requested_approval_id,
    payload_hash = requested.requested_payload_hash
from requested
where state.label = 'expiry';

select pg_sleep(1.1);

reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = '30000000-0000-0000-0000-000000000003';

do $$
declare
  v_state record;
  v_result record;
begin
  select * into strict v_state
  from ai_approval_test_state where label = 'expiry';
  select * into v_result
  from public.ai_approval_decide_synthetic(
    v_state.approval_id,
    '40000000-0000-0000-0000-000000000010',
    'approved'
  );
  if v_result.decided_status <> 'expired'
     or (select decision from public.ai_approvals where id = v_state.approval_id) is not null then
    raise exception 'expired approval accepted a decision';
  end if;
end;
$$;

reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = '30000000-0000-0000-0000-000000000001';

insert into ai_approval_test_state (label, task_id)
select 'rejected', created_task_id
from public.ai_task_create_synthetic('approval-contract.rejected', 'echo_v1');

with requested as (
  select request_result.*
  from ai_approval_test_state state
  cross join lateral public.ai_approval_request_synthetic(
    state.task_id,
    '40000000-0000-0000-0000-000000000017',
    900
  ) request_result
  where state.label = 'rejected'
)
update ai_approval_test_state state
set approval_id = requested.requested_approval_id,
    payload_hash = requested.requested_payload_hash
from requested
where state.label = 'rejected';

reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = '30000000-0000-0000-0000-000000000003';

do $$
declare
  v_state record;
  v_result record;
begin
  select * into strict v_state
  from ai_approval_test_state where label = 'rejected';
  select * into v_result
  from public.ai_approval_decide_synthetic(
    v_state.approval_id,
    '40000000-0000-0000-0000-000000000018',
    'rejected'
  );
  if v_result.decided_status <> 'rejected'
     or (select decision from public.ai_approvals where id = v_state.approval_id) <> 'rejected' then
    raise exception 'exact approval rejection was not recorded';
  end if;

  begin
    perform public.ai_approval_consume_synthetic(
      v_state.approval_id,
      '40000000-0000-0000-0000-000000000019',
      v_state.payload_hash
    );
    raise exception 'rejected approval was consumed';
  exception
    when invalid_parameter_value then null;
  end;
end;
$$;

reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = '30000000-0000-0000-0000-000000000001';

insert into ai_approval_test_state (label, task_id)
select 'cancelled', created_task_id
from public.ai_task_create_synthetic('approval-contract.cancelled', 'classification_v1');

with requested as (
  select request_result.*
  from ai_approval_test_state state
  cross join lateral public.ai_approval_request_synthetic(
    state.task_id,
    '40000000-0000-0000-0000-000000000011',
    900
  ) request_result
  where state.label = 'cancelled'
)
update ai_approval_test_state state
set approval_id = requested.requested_approval_id,
    payload_hash = requested.requested_payload_hash
from requested
where state.label = 'cancelled';

reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = '30000000-0000-0000-0000-000000000003';

do $$
declare
  v_state record;
begin
  select * into strict v_state
  from ai_approval_test_state where label = 'cancelled';
  perform public.ai_approval_decide_synthetic(
    v_state.approval_id,
    '40000000-0000-0000-0000-000000000012',
    'approved'
  );
end;
$$;

reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = '30000000-0000-0000-0000-000000000001';

do $$
declare
  v_state record;
begin
  select * into strict v_state
  from ai_approval_test_state where label = 'cancelled';
  perform public.ai_task_cancel_synthetic(
    v_state.task_id,
    '50000000-0000-0000-0000-000000000001',
    'test_cleanup'
  );
end;
$$;

reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = '30000000-0000-0000-0000-000000000003';

do $$
declare
  v_state record;
  v_result record;
begin
  select * into strict v_state
  from ai_approval_test_state where label = 'cancelled';
  select * into v_result
  from public.ai_approval_consume_synthetic(
    v_state.approval_id,
    '40000000-0000-0000-0000-000000000013',
    v_state.payload_hash
  );
  if v_result.consumed_status <> 'invalidated'
     or (select invalidation_reason_code from public.ai_approvals where id = v_state.approval_id) <> 'task_cancelled'
     or (select consumed_at from public.ai_approvals where id = v_state.approval_id) is not null then
    raise exception 'cancelled task approval was not invalidated before consumption';
  end if;
end;
$$;

reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = '30000000-0000-0000-0000-000000000001';

insert into ai_approval_test_state (label, task_id)
select 'invalidate', created_task_id
from public.ai_task_create_synthetic('approval-contract.invalidate', 'echo_v1');

with requested as (
  select request_result.*
  from ai_approval_test_state state
  cross join lateral public.ai_approval_request_synthetic(
    state.task_id,
    '40000000-0000-0000-0000-000000000014',
    900
  ) request_result
  where state.label = 'invalidate'
)
update ai_approval_test_state state
set approval_id = requested.requested_approval_id,
    payload_hash = requested.requested_payload_hash
from requested
where state.label = 'invalidate';

do $$
declare
  v_state record;
  v_first record;
  v_replay record;
  v_second record;
begin
  select * into strict v_state
  from ai_approval_test_state where label = 'invalidate';
  select * into v_first
  from public.ai_approval_invalidate_synthetic(
    v_state.approval_id,
    '40000000-0000-0000-0000-000000000015',
    v_state.payload_hash,
    'test_cleanup'
  );
  select * into v_replay
  from public.ai_approval_invalidate_synthetic(
    v_state.approval_id,
    '40000000-0000-0000-0000-000000000015',
    v_state.payload_hash,
    'test_cleanup'
  );
  select * into v_second
  from public.ai_approval_invalidate_synthetic(
    v_state.approval_id,
    '40000000-0000-0000-0000-000000000016',
    v_state.payload_hash,
    'test_cleanup'
  );

  if v_first.invalidated_status <> 'invalidated'
     or v_first.was_replayed
     or not v_replay.was_replayed
     or v_second.was_replayed
     or not v_second.was_already_applied then
    raise exception 'approval invalidation replay contract failed';
  end if;
end;
$$;

reset role;

do $$
declare
  v_primary record;
  v_cancelled record;
  v_invalidated record;
begin
  select * into strict v_primary
  from ai_approval_test_state where label = 'primary';
  select * into strict v_cancelled
  from ai_approval_test_state where label = 'cancelled';
  select * into strict v_invalidated
  from ai_approval_test_state where label = 'invalidate';

  if (select status from public.ai_approvals where id = v_primary.approval_id) <> 'consumed'
     or (select decision from public.ai_approvals where id = v_primary.approval_id) <> 'approved'
     or (select count(*) from private.ai_approval_command_receipts where approval_id = v_primary.approval_id) <> 4
     or (select count(*) from public.ai_task_events where task_id = v_primary.task_id) <> 4 then
    raise exception 'primary exact approval history is incomplete or duplicated';
  end if;

  if (select decision from public.ai_approvals where id = v_cancelled.approval_id) <> 'approved'
     or (select status from public.ai_approvals where id = v_cancelled.approval_id) <> 'invalidated' then
    raise exception 'invalidation erased prior approval evidence';
  end if;

  begin
    update public.ai_approvals
    set decided_at = decided_at + interval '1 second'
    where id = v_primary.approval_id;
    raise exception 'recorded approval decision accepted an update';
  exception
    when invalid_parameter_value then null;
  end;

  begin
    update private.ai_approval_envelopes
    set payload = jsonb_build_object('mutated', true)
    where approval_id = v_primary.approval_id;
    raise exception 'private approval envelope accepted an update';
  exception
    when invalid_parameter_value then null;
  end;

  begin
    update private.ai_approval_command_receipts
    set applied = false
    where approval_id = v_primary.approval_id;
    raise exception 'approval command receipt accepted an update';
  exception
    when invalid_parameter_value then null;
  end;

  begin
    delete from public.ai_approvals where id = v_invalidated.approval_id;
    raise exception 'approval with command receipts was deleted';
  exception
    when restrict_violation or foreign_key_violation then null;
  end;
end;
$$;

rollback;
