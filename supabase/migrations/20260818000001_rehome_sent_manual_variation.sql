-- Repair the sent pelmet variation that was created as version 5 of an
-- already-accepted base quote. Keeping it in that family would replace the
-- base contract's accepted value and make its first invoice exceed job truth.
do $$
declare
  v_quote_version_id constant uuid := 'ff2c34be-b033-403d-9bb9-8486f6b3cbb8';
  v_old_quote public.quotes%rowtype;
  v_version public.quote_versions%rowtype;
  v_new_quote_id uuid;
  v_new_quote_ref text;
begin
  select version.* into v_version
  from public.quote_versions version
  where version.id = v_quote_version_id;

  if not found then
    return;
  end if;

  select quote.* into strict v_old_quote
  from public.quotes quote
  where quote.id = v_version.quote_id;

  perform pg_advisory_xact_lock(hashtextextended(
    'commercial-project-invoice:' || v_old_quote.project_id::text,
    0
  ));

  select version.* into strict v_version
  from public.quote_versions version
  where version.id = v_quote_version_id
  for update;
  select quote.* into strict v_old_quote
  from public.quotes quote
  where quote.id = v_version.quote_id
  for update;

  if v_old_quote.commercial_scope_id = v_quote_version_id then
    return;
  end if;

  if v_version.status <> 'SENT'
    or v_version.accepted_at is not null
    or v_old_quote.commercial_scope_id is not null
    or exists (
      select 1 from public.deposit_invoices invoice
      where invoice.quote_version_id = v_quote_version_id
    )
    or not exists (
      select 1
      from public.quote_versions accepted
      where accepted.quote_id = v_old_quote.id
        and accepted.id <> v_quote_version_id
        and (accepted.status = 'ACCEPTED' or accepted.accepted_at is not null)
    ) then
    raise exception 'Target quote variation no longer matches the safe repair preconditions'
      using errcode = '55000';
  end if;

  select quote.id, quote.quote_ref
  into v_new_quote_id, v_new_quote_ref
  from public.quotes quote
  where quote.project_id = v_old_quote.project_id
    and quote.commercial_scope_id = v_quote_version_id;

  if v_new_quote_id is null then
    v_new_quote_ref := public.next_quote_ref();
    insert into public.quotes (
      project_id, quote_ref, created_by, internal_name, commercial_scope_id
    ) values (
      v_old_quote.project_id,
      v_new_quote_ref,
      v_version.created_by,
      v_old_quote.internal_name,
      v_quote_version_id
    )
    returning id into v_new_quote_id;
  end if;

  update public.quote_versions
  set quote_id = v_new_quote_id,
    version_number = 1,
    revised_from_quote_version_id = null
  where id = v_quote_version_id;

  insert into public.audit_events (project_id, type, idempotency_key, payload)
  values (
    v_old_quote.project_id,
    'quote.commercial_scope_repaired',
    'quote.commercial_scope_repaired:' || v_quote_version_id::text,
    jsonb_build_object(
      'quoteVersionId', v_quote_version_id,
      'fromQuoteId', v_old_quote.id,
      'toQuoteId', v_new_quote_id,
      'toQuoteRef', v_new_quote_ref,
      'commercialScopeId', v_quote_version_id,
      'reason', 'sent_manual_variation_was_created_in_accepted_base_family'
    )
  )
  on conflict (idempotency_key) do nothing;
end;
$$;

notify pgrst, 'reload schema';
