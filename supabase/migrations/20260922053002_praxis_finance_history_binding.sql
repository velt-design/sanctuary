-- Read-only application-owned mapping boundary. No reporting-role or vault grants.
begin;
create function public.xero_customer_history_binding(p_actor uuid,p_project_id uuid,p_tenant_id uuid,p_source_key text,p_connection_id uuid,p_environment text)
returns jsonb language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare result jsonb;
begin
  if not exists(select 1 from praxis_reporting.source_identity_v1 where singleton
    and source_key=p_source_key and connection_id=p_connection_id and environment=p_environment
    and projection_version='sanctuary.praxis.core.v1') then raise exception 'Finance source binding unavailable'; end if;
  perform public.xero_require_payment_approver(p_actor);
  if not exists(select 1 from auth.users u join public.portal_users p on p.user_id=u.id
    where u.id=p_actor and nullif(btrim(u.email),'') is not null and u.email_confirmed_at is not null
      and u.deleted_at is null and (u.banned_until is null or u.banned_until<=clock_timestamp())
      and p.role in ('admin','staff'))
    then raise exception 'Finance identity unavailable' using errcode='42501'; end if;
  if p_tenant_id is null or not exists(select 1 from private.xero_invoice_transfer_control where singleton and tenant_id=p_tenant_id)
    then raise exception 'Finance tenant unavailable'; end if;
  select jsonb_build_object('projectId',p.id,'portalContactId',p.contact_id,'tenantId',m.tenant_id,
    'xeroContactId',m.xero_contact_id,'mappingVerifiedAt',m.verified_at)
  into result from public.projects p join private.xero_customer_mappings m
    on m.portal_contact_id=p.contact_id and m.tenant_id=p_tenant_id and m.revoked_at is null
  where p.id=p_project_id;
  if result is null then raise exception 'Finance mapping unavailable'; end if;
  return result;
end; $$;
revoke all on function public.xero_customer_history_binding(uuid,uuid,uuid,text,uuid,text) from public,anon,authenticated;
grant execute on function public.xero_customer_history_binding(uuid,uuid,uuid,text,uuid,text) to service_role;
notify pgrst,'reload schema';
commit;
