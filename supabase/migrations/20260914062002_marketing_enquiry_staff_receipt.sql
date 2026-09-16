-- Read-only staff projection of the original customer receipt. No provider payload,
-- supplier costs, queue leases or mutable estimate output is exposed here.
create function public.marketing_enquiry_staff_receipts(p_project_id uuid)
returns jsonb language plpgsql security definer set search_path = pg_catalog, pg_temp
as $$
begin
  if auth.uid() is null or public.has_portal_access() is not true then
    raise exception 'Forbidden' using errcode = '42501';
  end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
    'id', e.id, 'submittedAt', e.created_at,
    'customerBrief', coalesce(d.draft_estimate #> '{outputs,snapshot,customerBrief}', e.raw_payload->'customerBrief'),
    'preferences', coalesce(d.draft_estimate #> '{outputs,snapshot,projectPreferences}', e.raw_payload->'projectPreferences'),
    'submittedPrice', d.draft_estimate #> '{outputs,snapshot,submittedPrice}',
    'message', e.raw_payload->'message', 'requestType', e.raw_payload->'requestType',
    'receiptFrozen', d.enquiry_request_id is not null,
    'emailStatus', o.status
  ) order by e.created_at desc, e.id)
  from public.enquiry_requests e
  left join private.marketing_enquiry_deliveries d on d.enquiry_request_id = e.id
  left join public.email_outbox o on o.id = d.outbox_id
  where e.project_id = p_project_id), '[]'::jsonb);
end;
$$;
revoke all on function public.marketing_enquiry_staff_receipts(uuid) from public, anon;
grant execute on function public.marketing_enquiry_staff_receipts(uuid) to authenticated;
