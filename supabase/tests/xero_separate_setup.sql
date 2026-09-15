begin;
do $$
declare a uuid:=gen_random_uuid(); t uuid:=gen_random_uuid(); c uuid:=gen_random_uuid(); cmd uuid:=gen_random_uuid(); before_control jsonb; before_link jsonb; proof jsonb;
begin
 insert into auth.users(id) values(a);
 insert into public.contacts(id) values(a);
 insert into public.projects(id,contact_id) values(a,a);
 insert into public.xero_payment_approvers(user_id,granted_by) values(a,'Synthetic setup separation');
 insert into public.deposit_invoices(id,project_id,status,invoice_ref,customer_name) values(a,a,'OPEN','SETUP-TEST','Synthetic setup');
 update private.xero_invoice_transfer_control set tenant_id=t,enabled=false;
 select to_jsonb(x) into before_control from private.xero_invoice_transfer_control x where singleton;
 proof:=jsonb_build_object('id',c,'name','Synthetic customer','email','');
 perform public.xero_finance_save_setup(cmd,a,a,t,a,'customer',proof);
 if before_control is distinct from (select to_jsonb(x) from private.xero_invoice_transfer_control x where singleton) then raise exception 'customer command changed company defaults'; end if;
 perform public.xero_finance_save_setup(cmd,a,a,t,a,'customer',proof);
 if (select count(*) from private.xero_finance_mapping_events where id=cmd)<>1 then raise exception 'duplicate event'; end if;
 select to_jsonb(x) into before_link from private.xero_customer_mappings x where tenant_id=t and portal_contact_id=a;
 proof:='{"account":{"code":"200"},"tax":{"type":"OUTPUT2","effectiveRate":15}}';
 perform public.xero_finance_save_setup(gen_random_uuid(),a,a,t,a,'defaults',proof);
 if before_link is distinct from (select to_jsonb(x) from private.xero_customer_mappings x where tenant_id=t and portal_contact_id=a) then raise exception 'defaults command changed customer link'; end if;
 if public.xero_finance_mapping_status(a,a,t)->'defaults'->>'accountCode' is distinct from '200' then raise exception 'saved defaults not reported'; end if;
 begin
  perform public.xero_finance_save_setup(gen_random_uuid(),a,a,t,a,'defaults','{"account":{"code":"200"},"tax":{"type":"NONE","effectiveRate":0}}');
  raise exception 'invalid tax accepted';
 exception when raise_exception then if sqlerrm<>'XERO_TAX_MAPPING_REVIEW_REQUIRED' then raise; end if; end;
 begin
  perform public.xero_finance_save_setup(cmd,a,a,t,a,'defaults',proof);
  raise exception 'command reused across scopes';
 exception when raise_exception then if sqlerrm<>'XERO_MAPPING_COMMAND_CONFLICT' then raise; end if; end;
 if exists(select 1 from private.xero_invoice_transfers where invoice_id=a) then raise exception 'setup dispatched invoice'; end if;
 if has_function_privilege('authenticated','public.xero_finance_save_setup(uuid,uuid,uuid,uuid,uuid,text,jsonb)','EXECUTE') or has_function_privilege('anon','public.xero_finance_save_setup(uuid,uuid,uuid,uuid,uuid,text,jsonb)','EXECUTE') then raise exception 'browser command grant'; end if;
 update public.xero_payment_approvers set revoked_at=now() where user_id=a;
 begin
  perform public.xero_finance_save_setup(gen_random_uuid(),a,a,t,a,'defaults',proof);
  raise exception 'revoked approver accepted';
 exception when insufficient_privilege then null; end;
end $$;
rollback;
