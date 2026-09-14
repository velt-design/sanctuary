-- Dark infrastructure only. Provision a dedicated LOGIN inheriting this role separately.
create schema if not exists xero_private;
revoke all on schema xero_private from public, anon, authenticated;
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'sanctuary_xero_connector') then
    create role sanctuary_xero_connector nologin nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
  end if;
end $$;
create table xero_private.connection (
  singleton boolean primary key default true check (singleton),
  tenant_id uuid,
  tenant_name text,
  encrypted_tokens text,
  connected_by uuid,
  connected_at timestamptz,
  last_verified_at timestamptz,
  last_error text check (last_error in ('RECONNECT_REQUIRED','PROVIDER_UNAVAILABLE','INVALID_PROVIDER_RESPONSE','INSUFFICIENT_SCOPE','EXCESS_SCOPE','READ_FAILED','CONNECTION_UNAVAILABLE'))
);
insert into xero_private.connection(singleton) values (true);
create table xero_private.oauth_attempts (
  state_hash text primary key,
  user_id uuid not null,
  expires_at timestamptz not null
);
create table xero_private.events (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  actor_id uuid,
  event text not null check (event in ('connected','connection_error')),
  tenant_id uuid,
  detail text
);
revoke all on all tables in schema xero_private from public, anon, authenticated;
revoke all on all sequences in schema xero_private from public, anon, authenticated;
grant usage on schema xero_private to sanctuary_xero_connector;
grant select, update on xero_private.connection to sanctuary_xero_connector;
grant select, insert, delete on xero_private.oauth_attempts to sanctuary_xero_connector;
grant insert on xero_private.events to sanctuary_xero_connector;
grant usage on all sequences in schema xero_private to sanctuary_xero_connector;
