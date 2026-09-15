begin;
do $$
declare v_user uuid := gen_random_uuid();
begin
  if exists(select 1 from public.xero_payment_approvers) then raise exception 'audit migration granted access'; end if;
  insert into auth.users(id) values(v_user);
  insert into public.xero_payment_approvers(user_id,granted_by) values(v_user,'Synthetic approved grant');
  update public.xero_payment_approvers set revoked_at=clock_timestamp() where user_id=v_user;
  update public.xero_payment_approvers set revoked_at=null,granted_by='Synthetic reapproval' where user_id=v_user;
  if (select array_agg(event order by recorded_at) from private.xero_finance_access_events where user_id=v_user)
    is distinct from array['granted','revoked','granted']::text[] then raise exception 'access history incomplete'; end if;
  begin
    delete from private.xero_finance_access_events where user_id=v_user;
    raise exception 'audit deletion accepted' using errcode='22023';
  exception when raise_exception then
    if sqlerrm <> 'Finance access history is append-only' then raise; end if;
  end;
  if has_table_privilege('authenticated','private.xero_finance_access_events','select')
    or has_table_privilege('service_role','private.xero_finance_access_events','update') then raise exception 'audit access exposed'; end if;
end;
$$;
rollback;
