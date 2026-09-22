-- Extract the current command after delivery and financial-reopening migrations.
-- This creates no delegated grants and enables no agent access. The public wrapper
-- preserves internal financial SYSTEM reopening, including its nullable actor.
-- Delegated callers must reject that internal context before reaching the core.
begin;

create schema if not exists private;

-- Refuse an unknown deployed owner rather than overwriting a newer business rule.
-- A replay is accepted only when both extracted definitions still match exactly.
do $guard$
declare v_public_hash text; v_core_hash text;
begin
  select md5(btrim(replace(prosrc, chr(13), ''), E' \t\r\n')) into v_public_hash
    from pg_proc where oid = to_regprocedure('public.project_operational_state_command(uuid,uuid,text,jsonb)');
  select md5(btrim(replace(prosrc, chr(13), ''), E' \t\r\n')) into v_core_hash
    from pg_proc where oid = to_regprocedure('private.project_operational_state_command_core(uuid,uuid,text,jsonb,uuid)');
  if not (
    (v_public_hash is not distinct from '7b3a8409961b096736c2e2dc9003df7d'
      and (v_core_hash is null or v_core_hash is not distinct from '1ef7528765f030d2532fef9df6932332'))
    or (v_public_hash is not distinct from 'dd2989e7256e5d03805cebbba3fd8389'
      and v_core_hash is not distinct from '1ef7528765f030d2532fef9df6932332')
  ) then
    raise exception 'Operational state command owner changed; review extraction';
  end if;
end;
$guard$;

create or replace function private.project_operational_state_command_core(
  p_project_id uuid,
  p_command_id uuid,
  p_command text,
  p_payload jsonb,
  p_actor uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_actor uuid := p_actor;
  v_command text := upper(btrim(coalesce(p_command, '')));
  v_payload jsonb := coalesce(p_payload, '{}'::jsonb);
  v_command_type text;
  v_replay jsonb;
  v_project public.projects%rowtype;
  v_state public.project_operational_states%rowtype;
  v_before public.project_operational_states%rowtype;
  v_expected_version bigint;
  v_waiting_until timestamptz;
  v_reason text;
  v_cancel_reason text;
  v_cancelled integer := 0;
  v_result jsonb;
  v_previous_setting text;
begin
  if not exists (
    select 1 from public.portal_users where user_id = v_actor
  ) and not (v_command = 'REOPEN' and coalesce(current_setting('sanctuary.financial_reopen',true),'') = 'allowed') then
    raise exception 'staff access required' using errcode = '42501';
  end if;
  if p_command_id is null
    or v_command not in ('ACTIVATE','WAIT','CLOSE','REOPEN')
    or jsonb_typeof(v_payload) is distinct from 'object'
  then
    raise exception 'invalid project-state command' using errcode = '22023';
  end if;
  v_expected_version := (v_payload->>'expectedRowVersion')::bigint;
  if v_expected_version is null or v_expected_version <= 0 then
    raise exception 'expected state row version is required' using errcode = '22023';
  end if;

  v_command_type := 'PROJECT_STATE_' || v_command;
  perform pg_advisory_xact_lock(hashtextextended(p_command_id::text, 1));
  v_replay := public.project_work_items_receipt_replay(
    p_project_id,
    p_command_id,
    v_command_type,
    v_payload
  );
  if v_replay is not null then
    return v_replay;
  end if;

  perform public.project_work_items_assert_v2(p_project_id, true);
  select project.*
  into v_project
  from public.projects project
  where project.id = p_project_id;
  if v_project.archived_at is not null then
    raise exception 'archived projects must be restored before changing state'
      using errcode = '22023';
  end if;
  select state.*
  into v_state
  from public.project_operational_states state
  where state.project_id = p_project_id
  for update;
  if v_state.row_version <> v_expected_version then
    raise exception 'STALE_PROJECT_STATE: expected row version %, found %',
      v_expected_version, v_state.row_version
      using errcode = '40001';
  end if;
  v_before := v_state;
  v_reason := nullif(btrim(v_payload->>'reason'), '');
  v_cancel_reason := nullif(btrim(v_payload->>'cancellationReason'), '');

  v_previous_setting := current_setting('sanctuary.project_work_command', true);
  perform set_config('sanctuary.project_work_command', 'allowed', true);

  if v_command = 'WAIT' then
    v_waiting_until := (v_payload->>'waitingUntil')::timestamptz;
    v_reason := nullif(btrim(v_payload->>'reason'), '');
    if v_state.state not in ('ACTIVE','WAITING')
      or v_waiting_until is null
      or v_waiting_until <= clock_timestamp()
      or v_reason is null
      or char_length(v_reason) > 500
      or v_cancel_reason is null
    then
      raise exception
        'Active project, future waiting time, waiting reason, and cancellation reason are required'
        using errcode = '22023';
    end if;
    v_cancelled := public.project_work_items_cancel_active(
      p_project_id,
      p_command_id,
      v_cancel_reason,
      v_actor,
      case when current_setting('sanctuary.financial_reopen',true) = 'allowed' then 'SYSTEM' else 'STAFF' end
    );
    update public.project_operational_states
    set
      state = 'WAITING',
      waiting_until = v_waiting_until,
      waiting_reason = v_reason,
      closed_outcome = null,
      closed_note = null,
      row_version = row_version + 1,
      updated_by = v_actor
    where project_id = p_project_id
    returning * into v_state;
  elsif v_command = 'ACTIVATE' then
    if v_state.state <> 'WAITING' then
      raise exception 'only a Waiting project can be activated'
        using errcode = '22023';
    end if;
    update public.project_operational_states
    set
      state = 'ACTIVE',
      waiting_until = null,
      waiting_reason = null,
      closed_outcome = null,
      closed_note = null,
      row_version = row_version + 1,
      updated_by = v_actor
    where project_id = p_project_id
    returning * into v_state;
  elsif v_command = 'CLOSE' then
    if v_state.state not in ('ACTIVE','WAITING')
      or v_payload->>'outcome' not in (
        'LOST_NO_RESPONSE','LOST_BUDGET_PRICE','LOST_OTHER_SUPPLIER',
        'LOST_TIMING_DEFERRED','LOST_NOT_SUITABLE','CANCELLED','COMPLETE'
      )
      or v_cancel_reason is null
    then
      raise exception 'open project, valid outcome, and cancellation reason are required'
        using errcode = '22023';
    end if;
    if v_payload->>'outcome' = 'COMPLETE' then
      if not exists (select 1 from public.commercial_project_financial_truth(p_project_id) truth
        where truth.accepted_total_inc_gst_cents > 0 and truth.open_invoice_inc_gst_cents = 0
          and truth.paid_inc_gst_cents >= truth.accepted_total_inc_gst_cents) then
        raise exception 'PROJECT_NOT_COMPLETE: delivery and reconciled billing are required' using errcode = '22023';
      end if;
      if not public.project_has_delivery_completion(p_project_id) then
        raise exception
          'PROJECT_NOT_COMPLETE: delivery has not been confirmed'
          using errcode = '22023';
      end if;
      if exists (
        select 1
        from public.quotes quote
        join public.quote_versions version on version.quote_id = quote.id
        where quote.project_id = p_project_id
          and version.status = 'ACCEPTED'
      )
      and v_project.final_payment_date is null
      then
        raise exception
          'PROJECT_NOT_COMPLETE: final commercial payment is still unconfirmed'
          using errcode = '22023';
      end if;
      if exists (
        select 1
        from public.deposit_invoices invoice
        where invoice.project_id = p_project_id
          and invoice.status = 'OPEN'
      )
      and v_project.deposit_paid_date is null
      then
        raise exception
          'PROJECT_NOT_COMPLETE: deposit payment is still unconfirmed'
          using errcode = '22023';
      end if;
    end if;
    v_cancelled := public.project_work_items_cancel_active(
      p_project_id,
      p_command_id,
      v_cancel_reason,
      v_actor,
      case when current_setting('sanctuary.financial_reopen',true) = 'allowed' then 'SYSTEM' else 'STAFF' end
    );
    update public.project_operational_states
    set
      state = 'CLOSED',
      waiting_until = null,
      waiting_reason = null,
      closed_outcome = v_payload->>'outcome',
      closed_note = nullif(btrim(v_payload->>'note'), ''),
      row_version = row_version + 1,
      updated_by = v_actor
    where project_id = p_project_id
    returning * into v_state;
  elsif v_command = 'REOPEN' then
    if v_state.state <> 'CLOSED' then
      raise exception 'only a Closed project can be reopened'
        using errcode = '22023';
    end if;
    update public.project_operational_states
    set
      state = 'ACTIVE',
      waiting_until = null,
      waiting_reason = null,
      closed_outcome = null,
      closed_note = null,
      row_version = row_version + 1,
      updated_by = v_actor
    where project_id = p_project_id
    returning * into v_state;
  end if;

  insert into public.project_state_events(
    project_id,
    command_id,
    event_sequence,
    event_type,
    before_state,
    after_state,
    reason,
    actor_user_id,
    actor_kind
  )
  values (
    p_project_id,
    p_command_id,
    0,
    v_command,
    to_jsonb(v_before),
    to_jsonb(v_state),
    coalesce(v_reason, v_cancel_reason),
    v_actor,
    case when current_setting('sanctuary.financial_reopen',true) = 'allowed' then 'SYSTEM' else 'STAFF' end
  );

  perform public.project_work_items_refresh_projection(p_project_id);
  v_result := jsonb_build_object(
    'project_id', p_project_id,
    'work_item_id', null,
    'row_version', v_state.row_version,
    'cancelled_count', v_cancelled,
    'replayed', false,
    'refresh_required', false
  );
  perform public.project_work_items_store_receipt(
    p_project_id,
    p_command_id,
    v_command_type,
    v_payload,
    v_actor,
    case when current_setting('sanctuary.financial_reopen',true) = 'allowed' then 'SYSTEM' else 'STAFF' end,
    v_result
  );
  perform set_config(
    'sanctuary.project_work_command',
    coalesce(v_previous_setting, ''),
    true
  );
  return v_result;
exception
  when others then
    perform set_config(
      'sanctuary.project_work_command',
      coalesce(v_previous_setting, ''),
      true
    );
    raise;
end;
$$;

create or replace function public.project_operational_state_command(
  p_project_id uuid,
  p_command_id uuid,
  p_command text,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_command text := upper(btrim(coalesce(p_command, '')));
begin
  if not public.has_portal_access() and not (v_command = 'REOPEN' and coalesce(current_setting('sanctuary.financial_reopen',true),'') = 'allowed') then
    raise exception 'staff access required' using errcode = '42501';
  end if;
  return private.project_operational_state_command_core(
    p_project_id, p_command_id, p_command, p_payload, auth.uid()
  );
end;
$$;

-- CREATE OR REPLACE preserves the public RPC's existing owner and grants.
-- The actor-explicit core must never be exposed to an API database role.
alter function private.project_operational_state_command_core(uuid,uuid,text,jsonb,uuid)
  owner to postgres;
revoke all on function private.project_operational_state_command_core(uuid,uuid,text,jsonb,uuid)
  from public, anon, authenticated, service_role;

commit;
notify pgrst, 'reload schema';
