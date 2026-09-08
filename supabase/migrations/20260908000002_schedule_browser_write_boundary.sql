-- Preserve staff reads and admin crew metadata editing, while routing all
-- scheduled-job, queue and downtime writes through authenticated staff APIs.
do $$
declare
  v_table text;
  v_columns text;
  v_function record;
begin
  foreach v_table in array array['scheduled_jobs', 'crew_schedule_items', 'crew_downtimes'] loop
    execute format('revoke insert, update, delete, truncate, references, trigger on table public.%I from public, anon, authenticated', v_table);
    select string_agg(quote_ident(attname), ', ' order by attnum) into v_columns
      from pg_attribute where attrelid = ('public.' || v_table)::regclass and attnum > 0 and not attisdropped;
    execute format('revoke insert (%s), update (%s), references (%s) on table public.%I from public, anon, authenticated', v_columns, v_columns, v_columns, v_table);
  end loop;

  -- Legacy RPCs must not remain an alternative browser write path. Retain
  -- each function's existing effective service-role permission, including
  -- permission previously inherited through PUBLIC.
  for v_function in
    select p.oid::regprocedure as signature,
      has_function_privilege('service_role', p.oid, 'execute') as service_execute
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and starts_with(p.proname, 'schedule_v2_')
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', v_function.signature);
    if v_function.service_execute then
      execute format('grant execute on function %s to service_role', v_function.signature);
    end if;
  end loop;
end $$;

-- Crew revision/anchor values are server-owned. Keep the existing admin API
-- metadata fields writable, with its existing RLS and revision trigger intact.
-- No app route deletes crews; revocation also prevents cascading queue deletion.
revoke insert, update, delete, truncate, references, trigger on table public.schedule_crews from public, anon, authenticated;
revoke insert (schedule_revision, queue_anchor_date), update (id, schedule_revision, queue_anchor_date) on table public.schedule_crews from public, anon, authenticated;
grant insert (id, name, color, sort_order, is_active, calendar_region, base_available_date) on table public.schedule_crews to authenticated;
grant update (name, color, sort_order, is_active, calendar_region, base_available_date) on table public.schedule_crews to authenticated;

notify pgrst, 'reload schema';
