-- A historical date fill cannot change commercial scope selection when the
-- version is already ACCEPTED and every other commercial field is unchanged.
-- Keep real lifecycle/financial mutations on the existing reconciliation path.
create or replace function public.commercial_reconcile_paid_stage_trigger()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_project_id uuid;
begin
  if tg_table_name = 'quote_versions' and tg_op = 'UPDATE' then
    if old.status = 'ACCEPTED' and new.status = 'ACCEPTED'
      and old.accepted_at is null and new.accepted_at is not null
      and (to_jsonb(new) - array['accepted_at', 'updated_at'])
        = (to_jsonb(old) - array['accepted_at', 'updated_at']) then
      return new;
    end if;
  end if;

  if tg_table_name = 'quote_versions' then
    select quote.project_id into strict v_project_id
    from public.quotes quote where quote.id = new.quote_id;
  else
    v_project_id := (to_jsonb(new)->>'project_id')::uuid;
  end if;
  perform public.commercial_reopen_paid_project_if_unsettled(
    v_project_id,
    tg_table_name || '.' || tg_op
  );
  return new;
end;
$$;
