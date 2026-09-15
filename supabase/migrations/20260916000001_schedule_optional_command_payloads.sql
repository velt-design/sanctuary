-- JSON null in the command envelope must retain the SQL NULL semantics of
-- optional direct-RPC arguments. Keep all crew guards and permissions intact.
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
      p_finish_early => nullif(p_args->'p_finish_early', 'null'::jsonb));
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
      p_move => nullif(p_args->'p_move', 'null'::jsonb));
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
notify pgrst, 'reload schema';
