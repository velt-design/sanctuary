begin;

-- Review decisions are append-only, and never create or reverse money.
create table public.xero_deposit_review_notes (
  id uuid primary key,
  tenant_id uuid not null,
  receipt_id uuid not null,
  invoice_id uuid not null references public.deposit_invoices(id) on delete restrict,
  disposition text not null check (disposition in ('REJECTED','INVESTIGATE')),
  reason text not null check (length(btrim(reason)) between 3 and 1000),
  recorded_by uuid not null references auth.users(id) on delete restrict,
  recorded_at timestamptz not null default now()
);
create index xero_deposit_review_notes_invoice on public.xero_deposit_review_notes(invoice_id,recorded_at desc);
alter table public.xero_deposit_review_notes enable row level security;
revoke all on public.xero_deposit_review_notes from public,anon,authenticated,service_role;
grant select on public.xero_deposit_review_notes to service_role;

create function public.xero_record_deposit_review_note(
  p_id uuid,p_actor uuid,p_tenant_id uuid,p_receipt_id uuid,p_invoice_id uuid,p_disposition text,p_reason text
) returns uuid language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare v_note public.xero_deposit_review_notes%rowtype;
begin
  perform public.xero_require_payment_approver(p_actor);
  perform pg_advisory_xact_lock(hashtextextended('xero-review-note:'||p_id::text,0));
  select * into v_note from public.xero_deposit_review_notes where id=p_id;
  if found then
    if v_note.recorded_by is distinct from p_actor or v_note.tenant_id is distinct from p_tenant_id
      or v_note.receipt_id is distinct from p_receipt_id or v_note.invoice_id is distinct from p_invoice_id
      or v_note.disposition is distinct from p_disposition or v_note.reason is distinct from btrim(p_reason) then
      raise exception 'Review note identity reused for different evidence' using errcode='22023';
    end if;
    return v_note.id;
  end if;
  insert into public.xero_deposit_review_notes(id,tenant_id,receipt_id,invoice_id,disposition,reason,recorded_by)
    values(p_id,p_tenant_id,p_receipt_id,p_invoice_id,p_disposition,btrim(p_reason),p_actor);
  return p_id;
end;
$$;
revoke all on function public.xero_record_deposit_review_note(uuid,uuid,uuid,uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.xero_record_deposit_review_note(uuid,uuid,uuid,uuid,uuid,text,text) to service_role;

commit;
