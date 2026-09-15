begin;
do $$
declare a uuid:=gen_random_uuid(); t uuid:=gen_random_uuid(); c uuid:=gen_random_uuid(); r jsonb;
begin
 insert into auth.users(id) values(a);
 insert into public.contacts(id) values(a);
 insert into public.projects(id,contact_id) values(a,a);
 insert into public.xero_payment_approvers(user_id,granted_by) values(a,'Synthetic mapping status');
 insert into public.deposit_invoices(id,project_id,status,invoice_ref,customer_name) values(a,a,'OPEN','STATUS-TEST','Synthetic status');
 update private.xero_invoice_transfer_control set tenant_id=t,enabled=false;
 r:=public.xero_finance_mapping_status(a,a,t);
 if r->'link' is distinct from 'null'::jsonb then raise exception 'absent mapping not null'; end if;
 insert into private.xero_customer_mappings(tenant_id,portal_contact_id,xero_contact_id,verified_at,verified_by) values(t,a,c,now(),a);
 r:=public.xero_finance_mapping_status(a,a,t);
 if r->'link'->>'contactId' is distinct from c::text then raise exception 'saved mapping not returned'; end if;
 update private.xero_customer_mappings set revoked_at=now() where tenant_id=t and portal_contact_id=a;
 if public.xero_finance_mapping_status(a,a,t)->'link' is distinct from 'null'::jsonb then raise exception 'revoked mapping returned'; end if;
 begin
  perform public.xero_finance_mapping_status(a,a,gen_random_uuid());
  raise exception 'wrong tenant accepted';
 exception when raise_exception then if sqlerrm<>'XERO_TENANT_MISMATCH' then raise; end if; end;
 update public.xero_payment_approvers set revoked_at=now() where user_id=a;
 begin
  perform public.xero_finance_mapping_status(a,a,t);
  raise exception 'revoked actor accepted';
 exception when insufficient_privilege then null; end;
 if has_function_privilege('anon','public.xero_finance_mapping_status(uuid,uuid,uuid)','EXECUTE') or has_function_privilege('authenticated','public.xero_finance_mapping_status(uuid,uuid,uuid)','EXECUTE') then raise exception 'browser execution granted'; end if;
end $$;
rollback;
