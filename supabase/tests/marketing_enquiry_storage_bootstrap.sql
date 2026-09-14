-- Storage metadata only: this harness never uploads files or calls Storage HTTP.
create schema if not exists storage;
-- Supabase owns its existing Storage relation. Only plain PostgreSQL needs the
-- minimal stub; even CREATE TABLE IF NOT EXISTS checks protected schema rights.
do $$
begin
  if to_regclass('storage.objects') is null then
    execute 'create table storage.objects(id uuid primary key default gen_random_uuid(),
      bucket_id text not null, name text not null, unique(bucket_id, name))';
    execute 'alter table storage.objects owner to postgres';
    execute 'alter table storage.objects enable row level security';
  end if;
end;
$$;
