-- Source events and their existing GA4 outbox commit with verified accounting.
-- No backfill, provider request, advertising-policy change or control activation.
create function private.marketing_verified_deposit_facts(p_project uuid, p_quote uuid)
returns table(quote_id uuid,quote_version_id uuid,invoice_id uuid,payment_entry_id uuid,occurred_at timestamptz,value_cents integer)
language sql stable security definer set search_path=pg_catalog,pg_temp as $$
 with accepted as (
   select a.* from public.commercial_current_accepted_quote_versions(p_project) a
   where a.total_inc_gst_cents>0 and (p_quote is null or a.quote_id=p_quote)
 ), candidates as (
   -- Issued invoice identity is immutable, but economic ownership can change.
   -- Only its effective family's unallocated residual belongs to that family;
   -- explicit quoted allocations below follow their permitted target instead.
   select a.quote_id,a.quote_version_id,i.id invoice_id,e.id payment_entry_id,e.occurred_at,a.total_inc_gst_cents
   from accepted a join public.deposit_invoices i on public.commercial_invoice_effective_quote(i.id)=a.quote_id and i.project_id=p_project
   join public.project_payment_entries e on e.source_invoice_id=i.id and e.project_id=p_project
   where i.status='PAID' and i.payment_term_position=1 and i.currency='NZD' and i.total_inc_gst_cents>0
     and e.entry_type='PAYMENT' and e.amount_inc_gst_cents>0
     and e.amount_inc_gst_cents>coalesce((select sum(allocation.amount_inc_gst_cents)
       from public.project_payment_allocations allocation where allocation.payment_entry_id=e.id
         and allocation.reversed_at is null and allocation.quote_version_id is not null),0)
   union all
   select a.quote_id,a.quote_version_id,i.id,e.id,e.occurred_at,a.total_inc_gst_cents
   from accepted a join public.deposit_invoices i on public.commercial_invoice_effective_quote(i.id)=a.quote_id and i.project_id=p_project
   join public.xero_deposit_matches m on m.invoice_id=i.id and m.project_id=p_project and m.reversed_at is null
   join public.project_payment_entries e on e.id=m.payment_entry_id and e.project_id=p_project
   where i.status<>'VOID' and i.payment_term_position=1 and i.currency='NZD' and i.total_inc_gst_cents>0
     and e.entry_type='PAYMENT' and e.amount_inc_gst_cents=m.amount_inc_gst_cents and m.amount_inc_gst_cents>0
     and e.amount_inc_gst_cents>coalesce((select sum(allocation.amount_inc_gst_cents)
       from public.project_payment_allocations allocation where allocation.payment_entry_id=e.id
         and allocation.reversed_at is null and allocation.quote_version_id is not null),0)
   union all
   select a.quote_id,a.quote_version_id,owned_invoice.id,e.id,e.occurred_at,a.total_inc_gst_cents
   from accepted a join public.quote_versions v on v.quote_id=a.quote_id
   join public.project_payment_allocations allocation on allocation.quote_version_id=v.id and allocation.project_id=p_project
   join public.project_payment_entries e on e.id=allocation.payment_entry_id and e.project_id=p_project
   left join lateral(select m.invoice_id from public.xero_deposit_matches m where m.payment_entry_id=e.id
     and m.reversed_at is null order by m.approved_at desc limit 1) matched on true
   left join public.deposit_invoices owned_invoice on owned_invoice.id=coalesce(e.source_invoice_id,matched.invoice_id)
   left join public.commercial_invoice_scope_assignments ownership on ownership.invoice_id=owned_invoice.id
   where allocation.reversed_at is null and allocation.standalone_invoice_id is null and allocation.amount_inc_gst_cents>0
     and e.entry_type='PAYMENT' and e.amount_inc_gst_cents>0
     and coalesce(ownership.treatment,'NATIVE')<>'SEPARATE_CHARGE'
     and (owned_invoice.id is null or owned_invoice.currency='NZD')
     and (allocation.payment_term_id=v.payment_terms->0->>'id' or exists(
       select 1 from public.project_invoice_plan_items plan where plan.quote_version_id=v.id
         and plan.payment_term_id=allocation.payment_term_id and plan.position=1 and plan.cancelled_at is null))
     and not exists(select 1 from public.deposit_invoices i where i.quote_version_id=v.id
       and i.payment_term_id=allocation.payment_term_id and i.status<>'VOID' and i.currency<>'NZD')
 )
 select distinct on(c.quote_id) c.quote_id,c.quote_version_id,c.invoice_id,c.payment_entry_id,c.occurred_at,c.total_inc_gst_cents
 from candidates c
 where c.occurred_at<=clock_timestamp()+interval '5 minutes'
   and not exists(select 1 from public.project_payment_entries reversal where reversal.reverses_entry_id=c.payment_entry_id)
 order by c.quote_id,c.occurred_at,c.payment_entry_id,c.invoice_id nulls last
$$;
revoke all on function private.marketing_verified_deposit_facts(uuid,uuid) from public,anon,authenticated,service_role;

create function private.marketing_enqueue_verified_deposit(p_project uuid,p_quote uuid,p_new_evidence boolean,p_payment uuid)
returns void language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare fact record; receipt record; attribution jsonb; event_key text;
begin
 if p_project is null then return; end if;
 perform pg_advisory_xact_lock(hashtextextended('commercial-project-invoice:'||p_project::text,0));
 if private.marketing_test_project(p_project) or exists(select 1 from public.project_operational_states s
   where s.project_id=p_project and s.state='CLOSED' and s.closed_outcome='CANCELLED') then return; end if;
 if exists(select 1 from public.enquiry_requests e where e.project_id=p_project)
   and not exists(select 1 from public.enquiry_requests e where e.project_id=p_project
     and not private.marketing_test_enquiry(e.id,e.project_id)) then return; end if;
 -- This is a project/family lookup, never a sweep of historical paid projects.
 for fact in select * from private.marketing_verified_deposit_facts(p_project,p_quote) loop
   if (not p_new_evidence or (p_payment is not null and p_payment<>fact.payment_entry_id))
     and fact.occurred_at<clock_timestamp()-interval '72 hours' then continue; end if;
   event_key:='marketing:marketing.deposit_received:'||p_project::text||':'||fact.quote_id::text;
   -- Preserve old receipts, including family identities emitted by an older app.
   if exists(select 1 from public.audit_events audit where audit.project_id=p_project and audit.type='marketing.deposit_received'
     and (audit.idempotency_key=event_key or audit.payload->>'quoteId'=fact.quote_id::text
       or exists(select 1 from public.deposit_invoices i where public.commercial_invoice_effective_quote(i.id)=fact.quote_id and i.id::text=audit.payload->>'depositInvoiceId'
         and not(audit.payload ?| array['quoteId','quoteVersionId']))
       or exists(select 1 from public.quote_versions v where v.quote_id=fact.quote_id and v.id::text=audit.payload->>'quoteVersionId')
       or (audit.idempotency_key='marketing:marketing.deposit_received:'||p_project::text||':project'
         and not(audit.payload ?| array['quoteId','depositInvoiceId','quoteVersionId'])))) then continue; end if;
   select e.id,e.raw_payload,e.utm into receipt from public.enquiry_requests e
     where e.project_id=p_project and not private.marketing_test_enquiry(e.id,e.project_id)
     order by e.created_at,e.id limit 1;
   -- Only fields consumed by the analytics sender are retained. Contacts, click
   -- IDs, URLs and free text never enter this lifecycle payload.
   attribution:=jsonb_build_object('enquiryRequestId',receipt.id,
     'consent',jsonb_build_object('analytics',coalesce(receipt.raw_payload#>'{attribution,consent,analytics}'='true'::jsonb,false),
       'marketing',coalesce(receipt.raw_payload#>'{attribution,consent,marketing}'='true'::jsonb,false)),
     'analyticsClientId',case when receipt.raw_payload#>'{attribution,consent,analytics}'='true'::jsonb
       and receipt.raw_payload#>>'{attribution,analyticsClientId}' ~ '^\d{1,20}\.\d{1,20}$'
       then receipt.raw_payload#>>'{attribution,analyticsClientId}' end,
     'utm',case when receipt.raw_payload#>'{attribution,consent,marketing}'='true'::jsonb
       then jsonb_build_object('utm_source',left(coalesce(receipt.raw_payload#>>'{attribution,utm,utm_source}',receipt.utm->>'utm_source'),100)) else '{}'::jsonb end);
   insert into public.audit_events(project_id,type,idempotency_key,created_at,payload)
   values(p_project,'marketing.deposit_received',event_key,fact.occurred_at,jsonb_build_object(
     'producer','verified-payment-v1','projectId',p_project,'quoteId',fact.quote_id,'quoteVersionId',fact.quote_version_id,
     'depositInvoiceId',fact.invoice_id,'paymentEntryId',fact.payment_entry_id,
     'paidDate',(fact.occurred_at at time zone 'Pacific/Auckland')::date,'valueIncGstCents',fact.value_cents,'attribution',attribution))
   on conflict(idempotency_key) do nothing;
 end loop;
end;
$$;
revoke all on function private.marketing_enqueue_verified_deposit(uuid,uuid,boolean,uuid) from public,anon,authenticated,service_role;

-- A DB-first release must tolerate an old application still writing the former
-- project-level event. Re-evaluate truth and suppress that alternate producer.
create function private.marketing_deposit_event_source_guard() returns trigger
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare family uuid;
begin
 if new.payload->>'producer'='verified-payment-v1' and pg_trigger_depth()>1 then return new; end if;
 select public.commercial_invoice_effective_quote(i.id) into family from public.deposit_invoices i where i.project_id=new.project_id
   and i.id::text=new.payload->>'depositInvoiceId';
 if family is null then select v.quote_id into family from public.quote_versions v join public.quotes q on q.id=v.quote_id
   where q.project_id=new.project_id and v.id::text=new.payload->>'quoteVersionId'; end if;
 perform private.marketing_enqueue_verified_deposit(new.project_id,family,false,null);
 return null;
end;
$$;
revoke all on function private.marketing_deposit_event_source_guard() from public,anon,authenticated,service_role;
create trigger marketing_deposit_event_source_guard before insert on public.audit_events
 for each row when(new.type='marketing.deposit_received') execute function private.marketing_deposit_event_source_guard();

create function private.marketing_verified_payment_changed() returns trigger
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare project uuid; family uuid; payment uuid; new_evidence boolean:=false;
begin
 if tg_table_name='project_payment_entries' then
   if tg_op<>'INSERT' or new.entry_type<>'PAYMENT' or new.amount_inc_gst_cents<=0 or new.source_invoice_id is null then return null; end if;
   project:=new.project_id;
   select public.commercial_invoice_effective_quote(i.id) into family from public.deposit_invoices i where i.id=new.source_invoice_id and i.project_id=project;
   new_evidence:=true; payment:=new.id;
 elsif tg_table_name='project_payment_allocations' then
   if tg_op<>'INSERT' or new.reversed_at is not null or new.standalone_invoice_id is not null then return null; end if;
   project:=new.project_id; select v.quote_id into family from public.quote_versions v where v.id=new.quote_version_id;
   new_evidence:=true; payment:=new.payment_entry_id;
 elsif tg_table_name='xero_deposit_matches' then
   if tg_op<>'INSERT' or new.reversed_at is not null then return null; end if;
   project:=new.project_id; select public.commercial_invoice_effective_quote(i.id) into family from public.deposit_invoices i where i.id=new.invoice_id;
   new_evidence:=true; payment:=new.payment_entry_id;
 elsif tg_table_name='deposit_invoices' then
   if new.status<>'PAID' or (tg_op='UPDATE' and old.status='PAID') then return null; end if;
   -- The newly inserted positive ledger/match/allocation admits a late event;
   -- changing an invoice projection cannot unlock an older family's receipt.
   project:=new.project_id; family:=public.commercial_invoice_effective_quote(new.id);
 elsif tg_table_name='commercial_invoice_scope_assignments' then
   if (tg_op='INSERT' and new.treatment='NATIVE') or (tg_op='UPDATE' and old.treatment is not distinct from new.treatment and old.quote_id is not distinct from new.quote_id) then return null; end if;
   project:=new.project_id; family:=public.commercial_invoice_effective_quote(new.invoice_id);
   if family is not null then
     select f.payment_entry_id into payment from private.marketing_verified_deposit_facts(project,family) f where f.invoice_id=new.invoice_id;
     new_evidence:=payment is not null;
   end if;
 elsif tg_table_name='quote_versions' then
   if new.status<>'ACCEPTED' or (tg_op='UPDATE' and old.status='ACCEPTED') then return null; end if;
   select q.project_id into project from public.quotes q where q.id=new.quote_id; family:=new.quote_id;
   -- A revised acceptance is not a new sale or permission for historical repair.
   new_evidence:=not exists(select 1 from public.quote_versions v where v.quote_id=family and v.id<>new.id and v.accepted_at is not null);
 else return null;
 end if;
 if family is not null then perform private.marketing_enqueue_verified_deposit(project,family,new_evidence,payment); end if;
 return null;
end;
$$;
revoke all on function private.marketing_verified_payment_changed() from public,anon,authenticated,service_role;

-- Deferred evaluation observes final allocations/status/reversals, not an
-- intermediate row inside a multi-write financial command. Any failure rolls
-- back the financial command and audit/outbox together; no remote call is added.
create constraint trigger marketing_verified_payment_entries after insert on public.project_payment_entries
 deferrable initially deferred for each row execute function private.marketing_verified_payment_changed();
create constraint trigger marketing_verified_payment_allocations after insert on public.project_payment_allocations
 deferrable initially deferred for each row execute function private.marketing_verified_payment_changed();
create constraint trigger marketing_verified_xero_matches after insert on public.xero_deposit_matches
 deferrable initially deferred for each row execute function private.marketing_verified_payment_changed();
create constraint trigger marketing_verified_deposit_invoices after insert or update on public.deposit_invoices
 deferrable initially deferred for each row execute function private.marketing_verified_payment_changed();
create constraint trigger marketing_verified_quote_acceptance after insert or update on public.quote_versions
 deferrable initially deferred for each row execute function private.marketing_verified_payment_changed();
create constraint trigger marketing_verified_invoice_scope after insert or update on public.commercial_invoice_scope_assignments
 deferrable initially deferred for each row execute function private.marketing_verified_payment_changed();
