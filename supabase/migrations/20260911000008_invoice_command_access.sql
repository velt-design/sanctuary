-- Invoice mutations are command-owned. Existing broad portal table grants must
-- not let a staff client bypass admin draft checks or issuance revision locks.
begin;
revoke insert, update, delete on public.deposit_invoices from authenticated, anon;
alter table public.deposit_invoices enable row level security;
create policy invoice_draft_admin_read on public.deposit_invoices
as restrictive for select to authenticated
using (status <> 'DRAFT' or public.is_portal_admin());
notify pgrst, 'reload schema';
commit;
