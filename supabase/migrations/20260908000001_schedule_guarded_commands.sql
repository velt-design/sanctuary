-- Deploy this forward migration before the matching Schedule API release.
alter table public.schedule_crews
  add column if not exists schedule_revision bigint not null default 0,
  add column if not exists queue_anchor_date date;

alter table public.scheduled_jobs add column if not exists accepted_overlaps jsonb not null default '[]'::jsonb;

create or replace function public.schedule_v2_version_crew_settings()
returns trigger language plpgsql security invoker set search_path = pg_catalog, public as $$
begin
  if (NEW.base_available_date, NEW.calendar_region, NEW.queue_anchor_date, NEW.is_active)
    is distinct from (OLD.base_available_date, OLD.calendar_region, OLD.queue_anchor_date, OLD.is_active) then
    NEW.schedule_revision := greatest(NEW.schedule_revision, OLD.schedule_revision + 1);
  end if;
  return NEW;
end $$;
drop trigger if exists schedule_v2_settings_revision on public.schedule_crews;
create trigger schedule_v2_settings_revision before update on public.schedule_crews
  for each row execute function public.schedule_v2_version_crew_settings();

create or replace function public.schedule_v2_version_calendar()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_crew uuid;
begin
  for v_crew in select id from public.schedule_crews order by id loop
    update public.schedule_crews set schedule_revision = schedule_revision + 1 where id = v_crew;
  end loop;
  return null;
end $$;
drop trigger if exists schedule_v2_calendar_revision on public.nz_holidays;
create trigger schedule_v2_calendar_revision after insert or update or delete on public.nz_holidays
  for each statement execute function public.schedule_v2_version_calendar();
drop trigger if exists schedule_v2_calendar_revision on public.company_closures;
create trigger schedule_v2_calendar_revision after insert or update or delete on public.company_closures
  for each statement execute function public.schedule_v2_version_calendar();
revoke all on function public.schedule_v2_version_crew_settings() from public, anon, authenticated;
revoke all on function public.schedule_v2_version_calendar() from public, anon, authenticated;

create or replace function public.schedule_v2_keep_overlap(p_scheduled_job_id uuid, p_overlap_key text)
returns jsonb language plpgsql security invoker set search_path = pg_catalog, public as $$
begin
  if p_overlap_key is null or length(p_overlap_key) > 300 then raise exception 'Invalid overlap key'; end if;
  update public.scheduled_jobs set accepted_overlaps = accepted_overlaps || jsonb_build_array(p_overlap_key)
    where id = p_scheduled_job_id and not (accepted_overlaps ? p_overlap_key);
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.schedule_v2_keep_overlap(uuid, text) from public, anon, authenticated;
grant execute on function public.schedule_v2_keep_overlap(uuid, text) to service_role;

create or replace function public.schedule_v2_bump_crew_revision()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  v_crew uuid;
  v_crews uuid[];
  v_allowed jsonb := nullif(current_setting('sanctuary.schedule_write_crews', true), '')::jsonb;
begin
  if TG_OP = 'INSERT' then v_crews := array[NEW.crew_id];
  elsif TG_OP = 'DELETE' then v_crews := array[OLD.crew_id];
  else v_crews := array[OLD.crew_id, NEW.crew_id]; end if;
  for v_crew in select distinct id from unnest(v_crews) id order by id loop
    if v_allowed is not null and not (v_allowed ? v_crew::text) then
      raise exception using errcode = 'PT409', message = 'Schedule command reached a crew outside its checked snapshot';
    end if;
    update public.schedule_crews set schedule_revision = schedule_revision + 1 where id = v_crew;
  end loop;
  if TG_OP = 'DELETE' then return OLD; end if;
  return NEW;
end $$;

do $$ declare v_table text; begin
  foreach v_table in array array['scheduled_jobs', 'crew_schedule_items', 'crew_downtimes'] loop
    execute format('drop trigger if exists schedule_v2_revision on public.%I', v_table);
    execute format('create trigger schedule_v2_revision before insert or update or delete on public.%I for each row execute function public.schedule_v2_bump_crew_revision()', v_table);
  end loop;
end $$;

create or replace function public.schedule_v2_guarded_command(p_command text, p_args jsonb, p_expected_revisions jsonb)
returns jsonb language plpgsql security invoker set search_path = pg_catalog, public as $$
declare
  v_entry record;
  v_revision bigint;
  v_result jsonb;
begin
  if p_expected_revisions is null or jsonb_typeof(p_expected_revisions) <> 'object' or p_expected_revisions = '{}'::jsonb then
    raise exception using errcode = 'PT409', message = 'A checked crew snapshot is required';
  end if;
  -- Lock every involved crew in stable order, including both sides of a move.
  for v_entry in select key, value from jsonb_each(p_expected_revisions) order by key loop
    select schedule_revision into v_revision from public.schedule_crews where id = v_entry.key::uuid for update;
    if not found or v_revision is distinct from (v_entry.value->>'revision')::bigint then
      raise exception using errcode = 'PT409', message = 'The crew schedule changed before this command could save';
    end if;
    if v_entry.value->>'anchor_date' is null then raise exception using errcode = 'PT409', message = 'A queue anchor is required'; end if;
    update public.schedule_crews set queue_anchor_date = (v_entry.value->>'anchor_date')::date, schedule_revision = schedule_revision + 1
      where id = v_entry.key::uuid and queue_anchor_date is null;
  end loop;
  perform set_config('sanctuary.schedule_write_crews', p_expected_revisions::text, true);
  -- Only the existing, explicitly allowed Schedule commands may run here.
  case p_command
    when 'schedule_v2_keep_overlap' then v_result := public.schedule_v2_keep_overlap((p_args->>'p_scheduled_job_id')::uuid, p_args->>'p_overlap_key');
    when 'schedule_v2_reorder_queue' then v_result := public.schedule_v2_reorder_queue(
      p_crew_id => (p_args->>'p_crew_id')::uuid,
      p_positions => p_args->'p_positions',
      p_forecast_updates => p_args->'p_forecast_updates');
    when 'schedule_v2_set_days_remaining' then v_result := public.schedule_v2_set_days_remaining(
      p_scheduled_job_id => (p_args->>'p_scheduled_job_id')::uuid,
      p_days_remaining => (p_args->>'p_days_remaining')::integer,
      p_forecast_updates => p_args->'p_forecast_updates');
    when 'schedule_v2_unassign_job' then v_result := public.schedule_v2_unassign_job(
      p_scheduled_job_id => (p_args->>'p_scheduled_job_id')::uuid,
      p_job_item_id => (p_args->>'p_job_item_id')::uuid,
      p_positions => p_args->'p_positions',
      p_forecast_updates => p_args->'p_forecast_updates');
    when 'schedule_v2_delete_downtime' then v_result := public.schedule_v2_delete_downtime(
      p_downtime_id => (p_args->>'p_downtime_id')::uuid,
      p_downtime_item_id => (p_args->>'p_downtime_item_id')::uuid,
      p_positions => p_args->'p_positions',
      p_forecast_updates => p_args->'p_forecast_updates');
    when 'schedule_v2_mark_done' then v_result := public.schedule_v2_mark_done(
      p_scheduled_job_id => (p_args->>'p_scheduled_job_id')::uuid,
      p_actual_start => (p_args->>'p_actual_start')::date,
      p_actual_finish => (p_args->>'p_actual_finish')::date,
      p_forecast_updates => p_args->'p_forecast_updates',
      p_finish_early => p_args->'p_finish_early');
    when 'schedule_v2_apply_job_patch' then v_result := public.schedule_v2_apply_job_patch(
      p_scheduled_job_id => (p_args->>'p_scheduled_job_id')::uuid,
      p_job_patch => p_args->'p_job_patch',
      p_forecast_updates => p_args->'p_forecast_updates');
    when 'schedule_v2_apply_commitment' then v_result := public.schedule_v2_apply_commitment(
      p_scheduled_job_id => (p_args->>'p_scheduled_job_id')::uuid,
      p_job_patch => p_args->'p_job_patch',
      p_history => p_args->'p_history',
      p_forecast_updates => p_args->'p_forecast_updates');
    when 'schedule_v2_ack_client_update' then v_result := public.schedule_v2_ack_client_update(
      p_scheduled_job_id => (p_args->>'p_scheduled_job_id')::uuid,
      p_ack_at => (p_args->>'p_ack_at')::timestamptz,
      p_ack_by => (p_args->>'p_ack_by')::text);
    when 'schedule_v2_assign_job' then v_result := public.schedule_v2_assign_job(
      p_target_crew_id => (p_args->>'p_target_crew_id')::uuid,
      p_target_insert_position => (p_args->>'p_target_insert_position')::integer,
      p_target_positions => p_args->'p_target_positions',
      p_target_forecast_updates => p_args->'p_target_forecast_updates',
      p_assignment => p_args->'p_assignment',
      p_move => p_args->'p_move');
    when 'schedule_v2_create_downtime' then v_result := public.schedule_v2_create_downtime(
      p_crew_id => (p_args->>'p_crew_id')::uuid,
      p_duration_days => (p_args->>'p_duration_days')::integer,
      p_reason => (p_args->>'p_reason')::text,
      p_note => (p_args->>'p_note')::text,
      p_insert_position => (p_args->>'p_insert_position')::integer,
      p_positions => p_args->'p_positions',
      p_forecast_updates => p_args->'p_forecast_updates');
    when 'schedule_v2_update_downtime' then v_result := public.schedule_v2_update_downtime(
      p_downtime_id => (p_args->>'p_downtime_id')::uuid,
      p_patch => p_args->'p_patch',
      p_forecast_updates => p_args->'p_forecast_updates');
    else raise exception using errcode = '22023', message = 'Unknown schedule command';
  end case;
  update public.schedule_crews crew set queue_anchor_date = null, schedule_revision = schedule_revision + 1
    where p_expected_revisions ? crew.id::text and queue_anchor_date is not null
      and not exists (select 1 from public.crew_schedule_items item where item.crew_id = crew.id);
  perform set_config('sanctuary.schedule_write_crews', '', true);
  return v_result;
end $$;

revoke all on function public.schedule_v2_guarded_command(text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.schedule_v2_guarded_command(text, jsonb, jsonb) to service_role;
revoke all on function public.schedule_v2_bump_crew_revision() from public, anon, authenticated;
notify pgrst, 'reload schema';
