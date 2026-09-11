-- A reversed receipt remains immutable history. A subsequent payment gets a new
-- ledger entry; only one unreversed receipt may own an invoice at a time.
begin;
drop index public.project_payment_entries_source_invoice_unique;
create index project_payment_entries_source_invoice_idx on public.project_payment_entries(source_invoice_id)
  where source_invoice_id is not null;

create or replace function public.commercial_invoice_payment_receipt_guard()
returns trigger language plpgsql security definer set search_path = pg_catalog, pg_temp as $$
begin
  if new.source_invoice_id is not null and new.entry_type = 'PAYMENT' then
    perform pg_advisory_xact_lock(hashtextextended('commercial-project-invoice:' || new.project_id::text,0));
    if exists (select 1 from public.project_payment_entries e
      where e.source_invoice_id = new.source_invoice_id and e.entry_type = 'PAYMENT'
        and not exists (select 1 from public.project_payment_entries r where r.reverses_entry_id = e.id)) then
      raise exception 'Invoice already has an unreversed payment receipt' using errcode = '55000';
    end if;
  end if;
  return new;
end;
$$;
create trigger project_payment_entries_invoice_receipt_guard before insert on public.project_payment_entries
for each row execute function public.commercial_invoice_payment_receipt_guard();
revoke all on function public.commercial_invoice_payment_receipt_guard() from public, anon, authenticated;

do $patch$
declare v_definition text; v_anchor text;
begin
  v_definition := replace(pg_get_functiondef('public.commercial_mark_invoice_paid_and_record_payment(uuid,text,timestamptz,text,text,text)'::regprocedure),chr(13),'');
  v_anchor := 'where entry.source_invoice_id = p_invoice_id and entry.entry_type = ''PAYMENT''';
  if strpos(v_definition,v_anchor) = 0 then raise exception 'Invoice payment owner changed'; end if;
  v_definition := replace(v_definition,v_anchor,v_anchor || '
    and not exists (select 1 from public.project_payment_entries reversal where reversal.reverses_entry_id = entry.id)');
  execute v_definition;
end;
$patch$;
notify pgrst, 'reload schema';
commit;
