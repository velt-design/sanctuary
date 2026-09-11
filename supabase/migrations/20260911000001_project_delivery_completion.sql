-- Delivery evidence is independent from payment settlement.
begin;

alter table public.project_confirmation_events
  drop constraint project_confirmation_events_confirmation_type_check;
alter table public.project_confirmation_events
  add constraint project_confirmation_events_confirmation_type_check check (confirmation_type in (
    'FIRST_ENQUIRY_EMAIL_SENT','ENQUIRY_FOLLOW_UP_EMAIL_SENT','ENQUIRY_CUSTOMER_REPLY_RECEIVED',
    'QUOTE_FOLLOW_UP_EMAIL_SENT','QUOTE_CUSTOMER_REPLY_RECEIVED','SITE_VISIT_COMPLETED','DELIVERY_COMPLETED'
  )),
  add column delivery_details jsonb null;

create or replace function public.project_has_delivery_completion(p_project_id uuid)
returns boolean language sql stable security definer
set search_path = pg_catalog, public, pg_temp as $$
  select case when exists (select 1 from public.scheduled_jobs where job_id = p_project_id)
    then exists (select 1 from public.scheduled_jobs where job_id = p_project_id and status = 'done' and actual_finish is not null)
    else exists (
      select 1 from public.project_confirmation_events e
      where e.project_id = p_project_id and e.confirmation_type = 'DELIVERY_COMPLETED' and e.event_kind = 'CONFIRMED'
        and not exists (select 1 from public.project_confirmation_events r where r.retracts_event_id = e.id)
    ) end
$$;

create or replace function public.project_confirm_delivery_stage(p_project_id uuid)
returns void language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
begin
  if not public.has_portal_access() then raise exception 'staff access required' using errcode = '42501'; end if;
  if not public.project_has_delivery_completion(p_project_id) then
    raise exception 'Confirm delivery in Schedule or record unscheduled delivery first' using errcode = '22023';
  end if;
  update public.projects set pipeline_stage = 'COMPLETED'
    where id = p_project_id and archived_at is null and pipeline_stage <> 'PAID';
end;
$$;

create or replace function public.project_record_delivery_completion(
  p_project_id uuid, p_command_id uuid, p_completed_date date, p_note text
) returns jsonb language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
declare
  v_project public.projects%rowtype;
  v_result jsonb;
  v_intent jsonb := jsonb_build_object('date', p_completed_date, 'note', btrim(p_note));
  v_previous text := current_setting('sanctuary.project_work_command', true);
begin
  if not public.has_portal_access() then raise exception 'staff access required' using errcode = '42501'; end if;
  if p_command_id is null or p_completed_date is null or p_completed_date > (now() at time zone 'Pacific/Auckland')::date
    or coalesce(char_length(btrim(p_note)),0) not between 1 and 500
  then raise exception 'Completion date and a short note are required; date cannot be in the future' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_command_id::text, 1));
  v_result := public.project_work_items_receipt_replay(p_project_id, p_command_id, 'DELIVERY_COMPLETED', v_intent);
  if v_result is not null then return v_result; end if;
  perform public.project_work_items_assert_v2(p_project_id, true);
  select * into strict v_project from public.projects where id = p_project_id for update;
  if v_project.archived_at is not null or exists (
    select 1 from public.project_operational_states where project_id = p_project_id and state = 'CLOSED'
  ) then raise exception 'Restore or reopen the project before recording delivery' using errcode = '22023'; end if;
  if exists (select 1 from public.scheduled_jobs where job_id = p_project_id) then
    raise exception 'Use Schedule completion for scheduled installations' using errcode = '22023';
  end if;
  if public.project_has_delivery_completion(p_project_id) then
    raise exception 'Delivery is already completed; correct the existing confirmation to change it' using errcode = '22023';
  end if;
  perform set_config('sanctuary.project_work_command', 'allowed', true);
  insert into public.project_confirmation_events (
    project_id, command_id, event_kind, confirmation_type, subject_kind, subject_id,
    occurred_at, recorded_by, actor_kind, delivery_details
  ) values (
    p_project_id, p_command_id, 'CONFIRMED', 'DELIVERY_COMPLETED', 'PROJECT', p_project_id,
    p_completed_date::timestamp at time zone 'Pacific/Auckland', auth.uid(), 'STAFF',
    jsonb_build_object('note', btrim(p_note), 'previousStage', v_project.pipeline_stage)
  );
  v_result := jsonb_build_object('projectId', p_project_id, 'completed', true, 'replayed', false);
  perform public.project_work_items_store_receipt(p_project_id, p_command_id, 'DELIVERY_COMPLETED', v_intent, auth.uid(), 'STAFF', v_result);
  perform set_config('sanctuary.project_work_command', coalesce(v_previous,''), true);
  return v_result;
end;
$$;

-- Schedule commands remain the only schedule writers. Their transaction also
-- projects completion so Overview and Running Jobs cannot diverge after refresh.
create or replace function public.project_delivery_stage_projection()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
declare
  v_project_id uuid;
  v_previous_stage text := 'SCHEDULED';
begin
  if tg_table_name = 'scheduled_jobs' then
    v_project_id := new.job_id;
  else
    if new.confirmation_type <> 'DELIVERY_COMPLETED' then return new; end if;
    v_project_id := new.project_id;
    if new.event_kind = 'RETRACTED' then
      select coalesce(delivery_details->>'previousStage','SCHEDULED') into v_previous_stage
        from public.project_confirmation_events where id = new.retracts_event_id;
    end if;
  end if;
  if public.project_has_delivery_completion(v_project_id) then
    update public.projects set pipeline_stage = 'COMPLETED'
      where id = v_project_id and archived_at is null and pipeline_stage not in ('COMPLETED','PAID');
  else
    update public.projects set pipeline_stage = v_previous_stage
      where id = v_project_id and archived_at is null and pipeline_stage in ('COMPLETED','PAID');
  end if;
  return new;
end;
$$;
create trigger project_delivery_schedule_projection
after insert or update of status, actual_finish on public.scheduled_jobs
for each row execute function public.project_delivery_stage_projection();
create trigger project_delivery_confirmation_projection
after insert on public.project_confirmation_events
for each row execute function public.project_delivery_stage_projection();

-- Keep the existing operational command, changing only its delivery-evidence
-- predicate. The commercial closure wrapper still proves settlement.
do $migration$
declare
  v_definition text := replace(pg_get_functiondef('public.project_operational_state_command(uuid,uuid,text,jsonb)'::regprocedure), chr(13), '');
  v_old text := $predicate$if not exists (
        select 1
        from public.scheduled_jobs scheduled
        where scheduled.job_id = p_project_id
          and scheduled.status = 'done'
          and scheduled.actual_finish is not null
      ) then$predicate$;
begin
  if position(v_old in v_definition) = 0 then raise exception 'Operational completion predicate changed; review migration'; end if;
  execute replace(replace(v_definition, v_old, 'if not public.project_has_delivery_completion(p_project_id) then'),
    'PROJECT_NOT_COMPLETE: Schedule V2 has not confirmed completion', 'PROJECT_NOT_COMPLETE: delivery has not been confirmed');
end;
$migration$;

revoke all on function public.project_has_delivery_completion(uuid) from public, anon, authenticated;
revoke all on function public.project_delivery_stage_projection() from public, anon, authenticated;
revoke all on function public.project_record_delivery_completion(uuid,uuid,date,text) from public, anon;
grant execute on function public.project_record_delivery_completion(uuid,uuid,date,text) to authenticated;
revoke all on function public.project_confirm_delivery_stage(uuid) from public, anon;
grant execute on function public.project_confirm_delivery_stage(uuid) to authenticated;
notify pgrst, 'reload schema';
commit;
