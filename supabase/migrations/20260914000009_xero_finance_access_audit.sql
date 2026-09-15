-- No grants are issued by this migration. Existing Jordan access is preserved.
create table private.xero_finance_access_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  event text not null check (event in ('granted','changed','revoked','removed')),
  recorded_at timestamptz not null default clock_timestamp(),
  database_actor text not null,
  grant_provenance text not null,
  previous_revoked_at timestamptz,
  revoked_at timestamptz
);
alter table private.xero_finance_access_events enable row level security;
revoke all on private.xero_finance_access_events from public,anon,authenticated,service_role;

create function private.xero_finance_access_audit()
returns trigger language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
begin
  if tg_op='UPDATE' then
    if old.user_id is distinct from new.user_id then raise exception 'Finance grant identity is immutable'; end if;
    if old is not distinct from new then return new; end if;
  end if;
  if tg_op='DELETE' then
    insert into private.xero_finance_access_events(user_id,event,database_actor,grant_provenance,previous_revoked_at)
      values(old.user_id,'removed',session_user,old.granted_by,old.revoked_at);
    return old;
  end if;
  insert into private.xero_finance_access_events(user_id,event,database_actor,grant_provenance,previous_revoked_at,revoked_at)
    values(new.user_id,case when new.revoked_at is not null then 'revoked'
      when tg_op='INSERT' or old.revoked_at is not null then 'granted' else 'changed' end,
      session_user,new.granted_by,case when tg_op='UPDATE' then old.revoked_at end,new.revoked_at);
  return new;
end;
$$;
revoke all on function private.xero_finance_access_audit() from public,anon,authenticated,service_role;
create trigger xero_finance_access_audit after insert or update or delete on public.xero_payment_approvers
for each row execute function private.xero_finance_access_audit();

create function private.xero_finance_access_event_immutable()
returns trigger language plpgsql set search_path=pg_catalog,pg_temp as $$
begin raise exception 'Finance access history is append-only'; end;
$$;
revoke all on function private.xero_finance_access_event_immutable() from public,anon,authenticated,service_role;
create trigger xero_finance_access_event_immutable before update or delete on private.xero_finance_access_events
for each row execute function private.xero_finance_access_event_immutable();
