-- Explicit release-selected Google policy. Original receipts and cutoff remain unchanged.
-- Installing this function does not change the live control's selected v1 policy.
create function private.google_ads_disclosure_permitted(policy text,receipt text) returns boolean
language sql immutable set search_path=pg_catalog,pg_temp as $$
  select coalesce((policy='2026-10-sale-measurement-v1' and receipt=policy)
    or (policy='2026-10-sale-measurement-v2' and receipt in('2026-10-sale-measurement-v1','2026-10-sale-measurement-v2')),false)
$$;
revoke all on function private.google_ads_disclosure_permitted(text,text) from public,anon,authenticated,service_role;
do $$
declare definition text:=pg_get_functiondef('public.google_ads_command(uuid,text,text,uuid,jsonb)'::regprocedure);
  needle text:='source->>''disclosureVersion'' is distinct from c.disclosure_version';
begin
  if (length(definition)-length(replace(definition,needle,'')))/length(needle)<>1 then
    raise exception 'Google disclosure baseline changed; reconcile before installation'; end if;
  execute replace(definition,needle,'not private.google_ads_disclosure_permitted(c.disclosure_version,source->>''disclosureVersion'')');
end $$;
