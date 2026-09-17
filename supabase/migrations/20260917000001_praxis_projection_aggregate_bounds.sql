begin;
-- Reporting projection only; no business records, grants or history are changed.
create or replace function praxis_reporting.safe_payload_v1(p_payload jsonb)
returns table (
  payload jsonb,
  policy_version text,
  redaction_count integer,
  omission_count integer,
  categories text[]
)
language plpgsql
immutable
strict
security invoker
set search_path = pg_catalog, pg_temp
as $$
declare
  result jsonb := '{}'::jsonb;
  item record;
  child record;
  largest record;
  evidence jsonb := '{}'::jsonb;
  root_redactions integer := 0;
  used_entries integer := 0;
  redactions integer := 0;
  omissions integer := 0;
  found_categories text[] := array[]::text[];
  marker constant jsonb := '{"_praxisOmitted":"source_bounds_v1"}'::jsonb;
begin
  if jsonb_typeof(p_payload) <> 'object'
     or (select count(*) from jsonb_each(p_payload)) > 256 then
    raise exception 'Praxis payload root exceeds the v1 schema bounds' using errcode = '54000';
  end if;

  for item in select entry.key, entry.value from jsonb_each(p_payload) entry order by entry.key loop
    if praxis_reporting.forbidden_nested_key_v1(item.key) then
      root_redactions := root_redactions + 1;
      continue;
    end if;
    select * into child from praxis_reporting.sanitize_json_internal_v1(
      item.value,
      1,
      256
    );
    result := result || jsonb_build_object(item.key, child.sanitized);
    evidence := evidence || jsonb_build_object(item.key, jsonb_build_object(
      'childEntries', child.child_entries,
      'redactionCount', child.redaction_count,
      'omissionCount', child.omission_count,
      'categories', to_jsonb(child.categories)
    ));
    used_entries := used_entries + 1 + child.child_entries;
  end loop;

  -- Bound the complete payload after preserving every allowlisted root key.
  -- Replacing a scalar with a marker can itself add an aggregate entry.
  while used_entries > 256 or octet_length(convert_to(result::text, 'UTF8')) > 65536 loop
    select entry.key, entry.value, (evidence -> entry.key ->> 'childEntries')::integer as child_entries into largest
    from jsonb_each(result) entry
    where entry.value <> marker
      and case when used_entries > 256
        then (evidence -> entry.key ->> 'childEntries')::integer > 1
        else octet_length(convert_to(entry.value::text, 'UTF8')) > octet_length(convert_to(marker::text, 'UTF8'))
      end
    order by case when used_entries > 256
      then (evidence -> entry.key ->> 'childEntries')::integer
      else octet_length(convert_to(entry.value::text, 'UTF8'))
    end desc, entry.key
    limit 1;
    if largest.key is null then
      raise exception 'Praxis payload cannot fit the v1 projection bounds' using errcode = '54000';
    end if;
    used_entries := used_entries - largest.child_entries + 1;
    result := jsonb_set(result, array[largest.key], marker, false);
    evidence := jsonb_set(evidence, array[largest.key], jsonb_build_object(
      'childEntries', 1,
      'redactionCount', 0,
      'omissionCount', 1,
      'categories', jsonb_build_array('source_bounds')
    ), false);
  end loop;

  redactions := root_redactions;
  omissions := 0;
  found_categories := case
    when root_redactions > 0 then array['credential_key']::text[]
    else array[]::text[]
  end;
  for item in select entry.value from jsonb_each(evidence) entry loop
    redactions := redactions + (item.value ->> 'redactionCount')::integer;
    omissions := omissions + (item.value ->> 'omissionCount')::integer;
    found_categories := found_categories || array(
      select jsonb_array_elements_text(item.value -> 'categories')
    );
  end loop;

  return query select
    result,
    'sanctuary.praxis.sanitizer.v1'::text,
    redactions,
    omissions,
    (select coalesce(array_agg(distinct category order by category), array[]::text[])
     from unnest(found_categories) category);
end;
$$;
commit;
