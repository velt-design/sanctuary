-- Disposable local database contract. No remote mutation or provider calls.
begin;
do $$
declare
  v_project uuid := gen_random_uuid();
  v_other_project uuid := gen_random_uuid();
  v_source uuid := gen_random_uuid();
  v_actor uuid := gen_random_uuid();
  v_request uuid := gen_random_uuid();
  v_first record;
  v_retry record;
  v_original jsonb := '{"snapshot":{"source":"marketing_enquiry","submittedPrice":{"amount":12000}}}';
  v_prepared jsonb := '{"inputs":{"width":7},"outputs":{"derived":{"pricingMode":"configured_customer_snapshot"},"snapshot":{"source":"marketing_enquiry","configuredQuoteInputs":{"width":7},"frozenConfiguratorPrice":{"schemaVersion":"configurator-pricing.v1","design":{"width":7},"customerPrice":{"currency":"NZD","includesGst":true,"amountIncGst":15000,"breakdown":[{"label":"Pergola","amountIncGst":12000},{"label":"Ziptrak","amountIncGst":3000}]}}}}}';
begin
  if has_function_privilege('anon','public.configurator_estimate_revision_create(uuid,uuid,uuid,uuid,jsonb)','EXECUTE')
    or has_function_privilege('authenticated','public.configurator_estimate_revision_create(uuid,uuid,uuid,uuid,jsonb)','EXECUTE')
    or not has_function_privilege('service_role','public.configurator_estimate_revision_create(uuid,uuid,uuid,uuid,jsonb)','EXECUTE')
    or has_table_privilege('authenticated','private.configurator_estimate_revisions','SELECT')
    or has_table_privilege('service_role','private.configurator_estimate_revisions','UPDATE') then
    raise exception 'revision privilege boundary failed';
  end if;
  insert into auth.users(id) values(v_actor);
  insert into public.portal_users(user_id,role) values(v_actor,'staff');
  insert into public.projects(id) values(v_project),(v_other_project);
  insert into public.estimates(id,project_id,outputs) values(v_source,v_project,v_original);
  begin
    perform public.configurator_estimate_revision_create(v_project,v_source,v_request,gen_random_uuid(),v_prepared);
    raise exception 'unknown actor accepted';
  exception when sqlstate '42501' then null; end;
  begin
    perform public.configurator_estimate_revision_create(v_other_project,v_source,v_request,v_actor,v_prepared);
    raise exception 'wrong project accepted';
  exception when sqlstate 'P0002' then null; end;
  begin
    perform public.configurator_estimate_revision_create(v_project,v_source,v_request,v_actor,
      jsonb_set(v_prepared,'{outputs,snapshot,frozenConfiguratorPrice,customerPrice,amountIncGst}','12000'));
    raise exception 'incomplete accessory total accepted';
  exception when sqlstate '22023' then null; end;
  if (select count(*) from public.estimates where project_id=v_project) <> 1 then
    raise exception 'invalid save retained partial estimate';
  end if;
  select * into strict v_first from public.configurator_estimate_revision_create(v_project,v_source,v_request,v_actor,v_prepared);
  select * into strict v_retry from public.configurator_estimate_revision_create(v_project,v_source,v_request,v_actor,v_prepared);
  if v_first.already_existed or not v_retry.already_existed or v_first.estimate_id <> v_retry.estimate_id
    or v_first.revision_id <> v_retry.revision_id then raise exception 'revision replay failed'; end if;
  if (select count(*) from public.estimates where project_id=v_project) <> 2
    or (select outputs from public.estimates where id=v_source) is distinct from v_original then
    raise exception 'revision duplicated or changed original';
  end if;
  if (select version from public.estimates where id=v_first.estimate_id) <> 2 then
    raise exception 'new estimate version label was not advanced';
  end if;
  begin
    perform public.configurator_estimate_revision_create(v_project,v_source,v_request,v_actor,
      jsonb_set(v_prepared,'{inputs,width}','8'));
    raise exception 'request id reused for different content';
  exception when sqlstate '23505' then null; end;
  update public.estimates set outputs='{}' where id=v_first.estimate_id;
  if (select prepared_estimate from private.configurator_estimate_revisions where id=v_first.revision_id) is distinct from v_prepared then
    raise exception 'working estimate mutation changed frozen revision';
  end if;
  if (select count(*) from public.email_outbox where project_id=v_project) <> 0 then
    raise exception 'revision unexpectedly sent email';
  end if;
end;
$$;
rollback;
