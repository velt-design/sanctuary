-- Shared accounting truth. Google projection remains byte-for-byte equivalent in output.
create function private.advertising_scope_facts() returns table(quote_id uuid,project_id uuid,facts jsonb)
language sql stable security definer set search_path=pg_catalog,pg_temp as $$
  with accepted as (
    select p.id project_id,a.* from public.projects p cross join lateral public.commercial_current_accepted_quote_versions(p.id) a
  ), facts as (
    select q.id quote_id,q.project_id,a.total_inc_gst_cents,
      e.id receipt_id,e.created_at received_at,e.raw_payload,
      (select min(t.occurred_at) from (
        select entry.occurred_at from public.deposit_invoices i
        join public.xero_deposit_matches m on m.invoice_id=i.id and m.reversed_at is null and m.amount_inc_gst_cents>0
        join public.project_payment_entries entry on entry.id=m.payment_entry_id and entry.entry_type='PAYMENT'
        where i.quote_id=a.quote_id and i.payment_term_position=1 and i.status<>'VOID' and i.currency='NZD'
          and not exists(select 1 from public.project_payment_entries r where r.reverses_entry_id=entry.id)
        union all
        select coalesce((select min(entry.occurred_at) from public.project_payment_entries entry
          where entry.source_invoice_id=i.id and entry.entry_type='PAYMENT' and entry.amount_inc_gst_cents>0
            and not exists(select 1 from public.project_payment_entries r where r.reverses_entry_id=entry.id)),i.paid_at)
        from public.deposit_invoices i where i.quote_id=a.quote_id and i.payment_term_position=1
          and i.status='PAID' and i.total_inc_gst_cents>0 and i.currency='NZD'
      ) t) occurred_at,
      exists(select 1 from public.project_operational_states s where s.project_id=q.project_id and s.state='CLOSED' and s.closed_outcome='CANCELLED') cancelled
    from public.quotes q left join accepted a on a.quote_id=q.id
    left join lateral (select r.* from public.enquiry_requests r where r.project_id=q.project_id
      and r.id<>'f3229ccf-6a1a-4e1a-bcf4-2edf5cc85e70'::uuid order by r.created_at,r.id limit 1) e on true
    where q.project_id<>'10c5db1a-602c-4f0c-8193-855b186215bb'::uuid
  ) select f.quote_id,f.project_id,to_jsonb(f) from facts f
$$;
revoke all on function private.advertising_scope_facts() from public,anon,authenticated,service_role;

create or replace function private.google_ads_sources() returns table(quote_id uuid,project_id uuid,source jsonb)
language sql stable security definer set search_path=pg_catalog,pg_temp as $$
  with bodies as (
    select f.quote_id,f.project_id,jsonb_build_object('quoteId',f.quote_id,'projectId',f.project_id,'receiptId',f.receipt_id,
      'receivedAt',f.received_at,'occurredAt',f.occurred_at,'valueCents',f.total_inc_gst_cents,'currency','NZD',
      'active',coalesce(f.total_inc_gst_cents>0 and f.occurred_at is not null and not f.cancelled,false),
      'marketingConsent',coalesce(f.raw_payload#>'{attribution,consent,marketing}'='true'::jsonb,false)
        and not exists(select 1 from private.google_ads_suppressions s where s.project_id=f.project_id),
      'consentBasis',f.raw_payload#>>'{attribution,consent,basis}',
      'disclosureVersion',case when jsonb_typeof(f.raw_payload->'advertisingDisclosureVersion')='string' then f.raw_payload->>'advertisingDisclosureVersion' end,
      'email',f.raw_payload->>'email','phone',f.raw_payload->>'phone',
      'gclid',f.raw_payload#>>'{attribution,clickIds,gclid}','gbraid',f.raw_payload#>>'{attribution,clickIds,gbraid}',
      'wbraid',f.raw_payload#>>'{attribution,clickIds,wbraid}') body from private.advertising_scope_facts() common cross join lateral jsonb_to_record(common.facts) as f(quote_id uuid,project_id uuid,total_inc_gst_cents bigint,receipt_id uuid,received_at timestamptz,raw_payload jsonb,occurred_at timestamptz,cancelled boolean)
  ) select b.quote_id,b.project_id,b.body||jsonb_build_object('fingerprint',encode(sha256(convert_to(b.body::text,'UTF8')),'hex')) from bodies b
$$;
