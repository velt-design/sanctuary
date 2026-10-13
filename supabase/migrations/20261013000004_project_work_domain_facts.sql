begin;

-- Raw, caller-visible facts only. Commercial selection and queue policy remain
-- in TypeScript. A scalar envelope avoids PostgREST's relation row limit.
create or replace function public.staff_project_work_domain_facts_v1(p_project_ids uuid[])
returns jsonb
language plpgsql
stable
security invoker
set search_path = pg_catalog, public, pg_temp
set row_security = on
as $$
declare
  v_ids uuid[];
  v_active_ids uuid[];
  v_count integer;
  v_child_count bigint;
  v_byte_bound bigint;
  v_result jsonb;
begin
  if not coalesce(public.has_portal_access(), false) then
    raise exception using errcode = '42501', message = 'Portal access required';
  end if;
  if p_project_ids is null or cardinality(p_project_ids) > 500
      or array_position(p_project_ids, null) is not null then
    raise exception using errcode = '22023', message = 'Expected at most 500 non-null project IDs';
  end if;
  select coalesce(array_agg(id order by id), '{}'::uuid[]) into v_ids
  from (select distinct unnest(p_project_ids) as id) requested;
  select count(*), coalesce(array_agg(p.id order by p.id)
      filter (where s.state = 'ACTIVE' and p.archived_at is null), '{}'::uuid[])
    into v_count, v_active_ids
  from public.projects p
  join public.project_work_model_versions m on m.project_id = p.id and m.model_version = 2
  join public.project_operational_states s on s.project_id = p.id
  where p.id = any(v_ids);
  if v_count <> cardinality(v_ids) then
    -- Do not disclose whether a project is hidden, absent or unclassified.
    raise exception using errcode = 'P0001', message = 'PROJECT_WORK_INVENTORY_INCOMPLETE';
  end if;

  -- Preflight before any relation JSON aggregation. Six bytes per text byte
  -- bounds JSON escaping; fixed allowances cover UUIDs, keys, numbers, dates,
  -- nulls and punctuation. LIMIT bounds the counting work for huge histories.
  with child_sizes as (
    select 384::bigint + 6 * coalesce(octet_length(e.status), 0) as bytes
      from public.estimates e where e.project_id = any(v_active_ids)
    union all
    select 224::bigint + 6 * coalesce(octet_length(q.quote_ref), 0)
      from public.quotes q where q.project_id = any(v_active_ids)
    union all
    select 640::bigint + 6 * coalesce(octet_length(v.status), 0)
      from public.quote_versions v join public.quotes q on q.id = v.quote_id
      where q.project_id = any(v_active_ids)
    union all
    select 192::bigint + 6 * coalesce(octet_length(l.status), 0)
      from public.quote_send_logs l
      join public.quote_versions v on v.id = l.quote_version_id
      join public.quotes q on q.id = v.quote_id where q.project_id = any(v_active_ids)
    union all
    select 320::bigint + 6 * (coalesce(octet_length(c.event_kind), 0)
      + coalesce(octet_length(c.confirmation_type), 0))
      from public.project_confirmation_events c
      where c.project_id = any(v_active_ids) and c.confirmation_type = 'SITE_VISIT_COMPLETED'
  )
  select count(*), coalesce(sum(bytes), 0) into v_child_count, v_byte_bound
  from (select bytes from child_sizes limit 50001) bounded;
  select v_byte_bound + 128 + coalesce(sum(case when p.id = any(v_active_ids) then 1024::bigint + 6 * (
      coalesce(octet_length(p.name), 0) + coalesce(octet_length(p.pipeline_stage), 0)
      + coalesce(octet_length(o.owner_key), 0)) else 256::bigint end), 0)
    into v_byte_bound
  from public.projects p
  left join public.project_owner_assignments o on o.project_id = p.id
  where p.id = any(v_ids);
  if v_child_count > 50000 or v_byte_bound > 4194304 then
    raise exception using errcode = 'P0001', message = 'PROJECT_WORK_FACTS_BATCH_TOO_LARGE';
  end if;

  select jsonb_build_object('version', 1, 'requestedCount', cardinality(v_ids),
    'rows', coalesce(jsonb_agg(jsonb_build_object(
      'projectId', p.id, 'eligible', p.id = any(v_active_ids),
      'project', case when p.id = any(v_active_ids) then jsonb_build_object(
        'id', p.id, 'name', p.name, 'pipeline_stage', p.pipeline_stage,
        'ownerAssignment', coalesce((select jsonb_agg(jsonb_build_object('owner_key', o.owner_key))
          from public.project_owner_assignments o where o.project_id = p.id), '[]'::jsonb),
        'estimates', e.facts, 'quotes', q.facts) else null end,
      'confirmations', c.facts,
      'counts', jsonb_build_object('estimates', e.n, 'quotes', q.n,
        'quoteVersions', q.versions, 'sendLogs', q.logs, 'confirmations', c.n)
    ) order by p.id), '[]'::jsonb)) into v_result
  from public.projects p
  cross join lateral (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', e.id, 'project_id', e.project_id, 'commercial_scope_id', e.commercial_scope_id,
      'created_at', e.created_at, 'status', e.status, 'version', e.version
    ) order by e.id), '[]'::jsonb) as facts, count(*) as n
    from public.estimates e where e.project_id = p.id and p.id = any(v_active_ids)
  ) e
  cross join lateral (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', q.id, 'quote_ref', q.quote_ref, 'commercial_scope_id', q.commercial_scope_id,
      'quoteVersions', v.facts
    ) order by q.id), '[]'::jsonb) as facts, count(*) as n,
      coalesce(sum(v.n), 0) as versions, coalesce(sum(v.logs), 0) as logs
    from public.quotes q
    cross join lateral (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', v.id, 'quote_id', v.quote_id, 'version_number', v.version_number,
        'status', v.status, 'source_estimate_version_id', v.source_estimate_version_id,
        'created_at', v.created_at, 'sent_at', v.sent_at, 'accepted_at', v.accepted_at,
        'total_inc_gst_cents', v.total_inc_gst_cents, 'sendLogs', l.facts
      ) order by v.id), '[]'::jsonb) as facts, count(*) as n, coalesce(sum(l.n), 0) as logs
      from public.quote_versions v
      cross join lateral (
        select coalesce(jsonb_agg(jsonb_build_object('status', l.status,
          'created_at', l.created_at, 'sent_at', l.sent_at) order by l.created_at, l.id), '[]'::jsonb) as facts,
          count(*) as n
        from public.quote_send_logs l where l.quote_version_id = v.id
      ) l where v.quote_id = q.id
    ) v where q.project_id = p.id and p.id = any(v_active_ids)
  ) q
  cross join lateral (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', c.id, 'project_id', c.project_id, 'event_kind', c.event_kind,
      'confirmation_type', c.confirmation_type, 'retracts_event_id', c.retracts_event_id
    ) order by c.id), '[]'::jsonb) as facts, count(*) as n
    from public.project_confirmation_events c where c.project_id = p.id
      and c.confirmation_type = 'SITE_VISIT_COMPLETED' and p.id = any(v_active_ids)
  ) c where p.id = any(v_ids);
  if octet_length(v_result::text) > 4194304 then
    raise exception using errcode = 'P0001', message = 'PROJECT_WORK_FACTS_BATCH_TOO_LARGE';
  end if;
  return v_result;
end;
$$;

revoke all on function public.staff_project_work_domain_facts_v1(uuid[]) from public, anon, service_role;
grant execute on function public.staff_project_work_domain_facts_v1(uuid[]) to authenticated;
comment on function public.staff_project_work_domain_facts_v1(uuid[]) is
  'Bounded caller-visible queue source facts. No commercial selection or queue priority policy. Migration-first application rollout.';

commit;
notify pgrst, 'reload schema';
