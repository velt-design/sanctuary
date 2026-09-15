begin;
do $$
declare v_actor uuid:=gen_random_uuid(); v_result jsonb; v_count integer;
begin
  insert into auth.users(id) values(v_actor);
  insert into public.contacts(id) values(v_actor);
  insert into public.projects(id,contact_id) values(v_actor,v_actor);
  insert into public.xero_payment_approvers(user_id,granted_by) values(v_actor,'Synthetic finance views');
  update private.xero_invoice_transfer_control set enabled=false;
  insert into public.deposit_invoices(id,project_id,status,invoice_ref,customer_name)
    select gen_random_uuid(),v_actor,'OPEN','VIEW-OK-'||n,'Synthetic view customer' from generate_series(1,60) n;
  -- Older paid records without corresponding receipts must not disappear from attention.
  insert into public.deposit_invoices(id,project_id,status,invoice_ref,customer_name)
    select gen_random_uuid(),v_actor,'PAID','VIEW-ISSUE-'||n,'Synthetic view customer' from generate_series(1,55) n;
  v_result:=public.xero_finance_review_filtered(v_actor,'VIEW-',0,'attention');
  if jsonb_array_length(v_result->'rows')<>51 then raise exception 'attention must return lookahead'; end if;
  if exists(select 1 from jsonb_array_elements(v_result->'rows') r where r->>'invoiceRef' not like 'VIEW-ISSUE-%') then raise exception 'history leaked into attention'; end if;
  v_result:=public.xero_finance_review_filtered(v_actor,'VIEW-',50,'attention');
  if jsonb_array_length(v_result->'rows')<>5 then raise exception 'filter must run before pagination'; end if;
  if jsonb_array_length(public.xero_finance_review_filtered(v_actor,'VIEW-OK-',0,'attention')->'rows')<>0 then raise exception 'clean history is not an attention task'; end if;
  if jsonb_array_length(public.xero_finance_review_filtered(v_actor,'VIEW-',0,'current')->'rows')<>0 then raise exception 'historical invoice treated as captured'; end if;
  if jsonb_array_length(public.xero_finance_review_filtered(v_actor,'VIEW-OK-',50,'history')->'rows')<>10 then raise exception 'history must remain reachable'; end if;
  if public.xero_finance_review(v_actor,'VIEW-',0)->'rows' is distinct from public.xero_finance_review_filtered(v_actor,'VIEW-',0,'all')->'rows' then raise exception 'legacy reader parity'; end if;
  begin
    perform public.xero_finance_review_filtered(v_actor,'',0,'invalid');
    raise exception 'invalid view accepted';
  exception when invalid_parameter_value then null; end;
  update public.xero_payment_approvers set revoked_at=now() where user_id=v_actor;
  begin
    perform public.xero_finance_review_filtered(v_actor,'',0,'attention');
    raise exception 'revoked finance actor accepted';
  exception when insufficient_privilege then null; end;
  if has_function_privilege('anon','public.xero_finance_review_filtered(uuid,text,integer,text)','EXECUTE')
    or has_function_privilege('authenticated','public.xero_finance_review_filtered(uuid,text,integer,text)','EXECUTE') then raise exception 'browser execution granted'; end if;
  select count(*) into v_count from private.xero_invoice_transfers where invoice_id in(select id from public.deposit_invoices where project_id=v_actor);
  if v_count<>0 then raise exception 'read fixture captured historical invoices'; end if;
end $$;
rollback;
