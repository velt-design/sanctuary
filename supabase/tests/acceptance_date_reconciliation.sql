-- Disposable commercial-truth fixture only. No customer records or date policy.
create or replace function public.commercial_truth_assert(p_ok boolean, p_message text)
returns void language plpgsql as $$
begin
  if not coalesce(p_ok,false) then
    raise exception 'acceptance date assertion failed: %',p_message;
  end if;
end;
$$;
alter table public.quote_versions add column if not exists updated_at timestamptz;

insert into public.projects(id,name,pipeline_stage) values
  ('11000000-0000-4000-8000-000000000001','Synthetic historical agreement','COMPLETED');
insert into public.quotes(id,project_id,quote_ref,commercial_scope_id) values
  ('22000000-0000-4000-8000-000000000001','11000000-0000-4000-8000-000000000001','Q-DATE-BASE',null),
  ('22000000-0000-4000-8000-000000000002','11000000-0000-4000-8000-000000000001','Q-DATE-ADDON','22000000-0000-4000-8000-000000000003');
insert into public.quote_versions(id,quote_id,version_number,status,total_inc_gst_cents,total_ex_gst_cents,gst_cents,accepted_at,created_at) values
  ('33000000-0000-4000-8000-000000000001','22000000-0000-4000-8000-000000000001',1,'ACCEPTED',11500,10000,1500,null,'2025-01-01'),
  ('33000000-0000-4000-8000-000000000002','22000000-0000-4000-8000-000000000001',2,'ACCEPTED',23000,20000,3000,null,'2025-02-01'),
  ('33000000-0000-4000-8000-000000000003','22000000-0000-4000-8000-000000000002',1,'ACCEPTED',5750,5000,750,null,'2025-03-01');

do $$
declare
  p constant uuid := '11000000-0000-4000-8000-000000000001';
  older constant uuid := '33000000-0000-4000-8000-000000000001';
  current_version constant uuid := '33000000-0000-4000-8000-000000000002';
  addon constant uuid := '33000000-0000-4000-8000-000000000003';
  selected_before jsonb;
  truth_before jsonb;
  audit_before bigint;
  v uuid;
begin
  -- Legacy PAID without ledger payments reproduces the unwanted reopening.
  update public.projects set pipeline_stage='PAID' where id=p;
  select jsonb_agg(to_jsonb(a) order by quote_id) into selected_before
    from public.commercial_current_accepted_quote_versions(p) a;
  select to_jsonb(t) into truth_before from public.commercial_project_financial_truth(p) t;
  select count(*) into audit_before from public.audit_events where project_id=p;

  -- Even a later date on the older accepted version cannot reorder selection:
  -- the canonical owner ranks version_number, created_at and id, not accepted_at.
  foreach v in array array[older,current_version,addon] loop
    update public.quote_versions set accepted_at='2025-12-01T12:00:00+13',updated_at=clock_timestamp() where id=v;
    perform public.commercial_truth_assert((select pipeline_stage='PAID' from public.projects where id=p),'date-only fill preserves legacy PAID');
    perform public.commercial_truth_assert((select jsonb_agg(to_jsonb(a) order by quote_id)=selected_before from public.commercial_current_accepted_quote_versions(p) a),'competing versions and add-on selection unchanged');
    perform public.commercial_truth_assert((select to_jsonb(t)=truth_before from public.commercial_project_financial_truth(p) t),'all financial totals unchanged');
    perform public.commercial_truth_assert((select count(*)=audit_before from public.audit_events where project_id=p),'no reopen audit or downstream command');
  end loop;

  -- Changing an existing timestamp or clearing it remains on the original path.
  update public.quote_versions set accepted_at=accepted_at+interval '1 day' where id=current_version;
  perform public.commercial_truth_assert((select pipeline_stage='COMPLETED' from public.projects where id=p),'existing-date edit still reconciles');
  update public.projects set pipeline_stage='PAID' where id=p;
  update public.quote_versions set accepted_at=null where id=current_version;
  perform public.commercial_truth_assert((select pipeline_stage='COMPLETED' from public.projects where id=p),'date removal still reconciles');

  -- A simultaneous financial, identity, revision or status change is not exempt.
  update public.projects set pipeline_stage='PAID' where id=p;
  update public.quote_versions set accepted_at=now(),total_inc_gst_cents=24000 where id=current_version;
  perform public.commercial_truth_assert((select pipeline_stage='COMPLETED' from public.projects where id=p),'money and date change still reconciles');
  update public.quote_versions set accepted_at=null where id=current_version;
  update public.projects set pipeline_stage='PAID' where id=p;
  update public.quote_versions set accepted_at=now(),version_number=3 where id=current_version;
  perform public.commercial_truth_assert((select pipeline_stage='COMPLETED' from public.projects where id=p),'version change still reconciles');
  update public.quote_versions set accepted_at=null where id=current_version;
  update public.projects set pipeline_stage='PAID' where id=p;
  update public.quote_versions set accepted_at=now(),status='SUPERSEDED' where id=current_version;
  perform public.commercial_truth_assert((select pipeline_stage='COMPLETED' from public.projects where id=p),'lifecycle change still reconciles');

  -- Other source-table triggers must retain the same real financial effect.
  update public.projects set pipeline_stage='PAID' where id=p;
  insert into public.project_payment_entries(project_id,entry_type,amount_inc_gst_cents,occurred_at)
    values(p,'ADJUSTMENT',-100,now());
  perform public.commercial_truth_assert((select pipeline_stage='COMPLETED' from public.projects where id=p),'negative payment still reconciles');

  update public.projects set pipeline_stage='PAID' where id=p;
  insert into public.quote_versions(quote_id,version_number,status,total_inc_gst_cents,total_ex_gst_cents,gst_cents)
    values('22000000-0000-4000-8000-000000000001',4,'ACCEPTED',11500,10000,1500);
  perform public.commercial_truth_assert((select pipeline_stage='COMPLETED' from public.projects where id=p),'new acceptance still reconciles');

  update public.projects set pipeline_stage='PAID' where id=p;
  insert into public.deposit_invoices(project_id,quote_id,quote_version_id,quote_ref,quote_version_number,
    invoice_ref,status,quote_total_inc_gst_cents,total_inc_gst_cents,total_ex_gst_cents,gst_cents,payment_term_id,payment_term_label)
    values(p,'22000000-0000-4000-8000-000000000002',addon,'Q-DATE-ADDON',1,
      'INV-DATE','OPEN',5750,5750,5000,750,'date-contract','Synthetic instalment');
  perform public.commercial_truth_assert((select pipeline_stage='COMPLETED' from public.projects where id=p),'open invoice still reconciles');
end;
$$;
