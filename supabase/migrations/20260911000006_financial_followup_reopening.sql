-- Keep the Project Work command as the sole operational-state writer. Financial
-- reversal reopens only settled closures; cancelled/lost outcomes stay distinct.
begin;
do $patch$
declare v_definition text; v_anchor text;
begin
  v_definition := replace(pg_get_functiondef('public.project_operational_state_command(uuid,uuid,text,jsonb)'::regprocedure),chr(13),'');
  v_anchor := '  if not public.has_portal_access() then';
  if strpos(v_definition,v_anchor) = 0 then raise exception 'Operational auth owner changed'; end if;
  v_definition := replace(v_definition,v_anchor,
    '  if not public.has_portal_access() and not (v_command = ''REOPEN'' and coalesce(current_setting(''sanctuary.financial_reopen'',true),'''') = ''allowed'') then');
  v_definition := replace(v_definition,'''STAFF''',
    'case when current_setting(''sanctuary.financial_reopen'',true) = ''allowed'' then ''SYSTEM'' else ''STAFF'' end');
  v_anchor := '    if v_payload->>''outcome'' = ''COMPLETE'' then';
  if strpos(v_definition,v_anchor) = 0 then raise exception 'Operational completion owner changed'; end if;
  v_definition := replace(v_definition,v_anchor,v_anchor || '
      if not exists (select 1 from public.commercial_project_financial_truth(p_project_id) truth
        where truth.accepted_total_inc_gst_cents > 0 and truth.open_invoice_inc_gst_cents = 0
          and truth.paid_inc_gst_cents >= truth.accepted_total_inc_gst_cents) then
        raise exception ''PROJECT_NOT_COMPLETE: delivery and reconciled billing are required'' using errcode = ''22023'';
      end if;');
  execute v_definition;
end;
$patch$;

create or replace function public.project_reopen_financial_followup(p_project_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = pg_catalog, pg_temp as $$
declare v_version bigint; v_previous text := current_setting('sanctuary.financial_reopen',true);
begin
  select row_version into v_version from public.project_operational_states
    where project_id = p_project_id and state = 'CLOSED' and closed_outcome = 'COMPLETE' for update;
  if not found then return; end if;
  perform set_config('sanctuary.financial_reopen','allowed',true);
  perform public.project_operational_state_command(p_project_id,gen_random_uuid(),'REOPEN',
    jsonb_build_object('expectedRowVersion',v_version,'reason','Project requires follow-up: ' || p_reason));
  perform set_config('sanctuary.financial_reopen',coalesce(v_previous,''),true);
end;
$$;
revoke all on function public.project_reopen_financial_followup(uuid,text) from public, anon, authenticated, service_role;

-- Retraction remains owned by Schedule/the audited confirmation command. Its
-- projection must also restore visibility if delivery evidence is corrected.
do $patch$
declare v_definition text; v_anchor text := '  else
    update public.projects set pipeline_stage = v_previous_stage';
begin
  v_definition := replace(pg_get_functiondef('public.project_delivery_stage_projection()'::regprocedure),chr(13),'');
  if strpos(v_definition,v_anchor) = 0 then raise exception 'Delivery projection owner changed'; end if;
  execute replace(v_definition,v_anchor,'  else
    perform public.project_reopen_financial_followup(v_project_id,''Delivery completion was corrected'');
    update public.projects set pipeline_stage = v_previous_stage');
end;
$patch$;

do $patch$
declare v_definition text; v_anchor text;
begin
  v_definition := replace(pg_get_functiondef('public.commercial_reopen_paid_project_if_unsettled(uuid,text)'::regprocedure),chr(13),'');
  v_anchor := '  if v_project.pipeline_stage <> ''PAID'' then return false; end if;';
  if strpos(v_definition,v_anchor) = 0 then raise exception 'Financial reopen owner changed'; end if;
  v_definition := replace(v_definition,v_anchor,
    '  if v_project.pipeline_stage <> ''PAID'' and not exists (select 1 from public.project_operational_states
      where project_id = p_project_id and state = ''CLOSED'' and closed_outcome = ''COMPLETE'') then return false; end if;');
  v_definition := replace(v_definition,'  return true;',
    '  if v_project.archived_at is null then perform public.project_reopen_financial_followup(p_project_id,p_reason); end if;
  return true;');
  v_definition := replace(v_definition,'set pipeline_stage = ''COMPLETED'', final_payment_date = null',
    'set pipeline_stage = case when pipeline_stage = ''PAID'' then ''COMPLETED'' else pipeline_stage end, final_payment_date = null');
  v_definition := replace(v_definition,'''fromStage'', ''PAID'', ''toStage'', ''COMPLETED''',
    '''fromStage'', v_project.pipeline_stage, ''toStage'', case when v_project.pipeline_stage = ''PAID'' then ''COMPLETED'' else v_project.pipeline_stage end');
  execute v_definition;
end;
$patch$;
notify pgrst, 'reload schema';
commit;
