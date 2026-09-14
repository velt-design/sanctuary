-- Table grants do not stop FK cascades from a browser-writable parent project.
-- Check the caller's SET ROLE, not current_user inside this definer trigger.
create or replace function public.schedule_v2_bump_crew_revision()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  v_crew uuid;
  v_crews uuid[];
  v_allowed jsonb := nullif(current_setting('sanctuary.schedule_write_crews', true), '')::jsonb;
begin
  if current_setting('role', true) in ('anon', 'authenticated') then
    raise exception using errcode = '42501', message = 'Schedule writes require the staff API';
  end if;
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

revoke all on function public.schedule_v2_bump_crew_revision() from public, anon, authenticated;
notify pgrst, 'reload schema';
