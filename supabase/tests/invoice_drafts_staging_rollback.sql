-- STAGING ONLY: run after the seven 20260911 migrations in a rollback transaction.
-- Creates only synthetic identities/projects; sends no email; retains no fixture records.
-- The caller must positively identify staging and refuse production before execution.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '90s';
do $smoke$
declare actor uuid; project uuid:=gen_random_uuid(); invoice uuid:=gen_random_uuid(); issue uuid:=gen_random_uuid(); receipt uuid; rv bigint; row public.deposit_invoices; value jsonb;
begin
 actor:=gen_random_uuid();
 insert into auth.users(id,email) values(actor,'codex-rollback-'||actor::text||'@example.invalid');
 insert into public.portal_users(user_id,role) values(actor,'admin');
 perform set_config('request.jwt.claim.sub',actor::text,true);
 perform set_config('request.jwt.claim.role','authenticated',true);
 insert into public.projects(id,name,pipeline_stage) values(project,'Codex rollback-only invoice QA','NEW');
 perform public.project_work_items_initialize_project_v2(project,now(),actor,'NEW_PROJECT');
 row:=public.commercial_invoice_save_draft(invoice,project,0,null,
 '{"version":1,"items":[{"id":"qa-line","description":"Rollback-only work","qty":1.5,"unitPriceIncGstCents":101,"lineTotalIncGstCents":152}],"billingName":"Synthetic QA","billingEmail":"qa@example.invalid","billingAddress":"","notes":"Rollback only"}'::jsonb,
 '{"mode":"custom","label":"QA invoice","dueDate":"2026-09-30","amountIncGstCents":152}'::jsonb);
 if row.status<>'DRAFT' or row.invoice_ref is not null then raise exception 'Draft exposed'; end if;
 value:=public.commercial_project_value_breakdown(project);
 if (value->>'billableIncGstCents')::int<>0 then raise exception 'Draft exposure'; end if;
 row:=public.commercial_invoice_issue_draft(invoice,1,issue,'Test bank');
 if row.status<>'OPEN' or row.total_inc_gst_cents<>152 then raise exception 'Issue mismatch'; end if;
 row:=public.commercial_invoice_issue_draft(invoice,1,issue,'Test bank');
 perform public.project_record_delivery_completion(project,gen_random_uuid(),current_date,'Rollback-only collection');
 select payment_entry_id into receipt from public.commercial_mark_invoice_paid_with_project_lock(invoice,actor::text,null,null,null,null);
 select row_version into rv from public.project_operational_states where project_id=project;
 perform public.commercial_complete_project_operational_state_command(project,gen_random_uuid(),jsonb_build_object('expectedRowVersion',rv,'outcome','COMPLETE','cancellationReason','Rollback-only settled QA'));
 if not exists(select 1 from public.project_operational_states where project_id=project and state='CLOSED') then raise exception 'Not closed'; end if;
 perform public.commercial_reverse_payment_entry_with_project_lock(receipt,'Rollback-only reversal',actor::text);
 if not exists(select 1 from public.project_operational_states where project_id=project and state='ACTIVE') then raise exception 'Not reopened'; end if;
 if not exists(select 1 from public.projects where id=project and pipeline_stage='COMPLETED') then raise exception 'Delivery lost'; end if;
 perform public.commercial_mark_invoice_paid_with_project_lock(invoice,actor::text,null,null,null,null);
 if (select sum(amount_inc_gst_cents) from public.project_payment_entries where project_id=project)<>152 then raise exception 'Repayment balance'; end if;
end;
$smoke$;
rollback;
select 'Standalone draft/issue/retry/manual delivery/payment/closure/reversal/repayment passed and rolled back' as verification;