-- Synthetic regression cases; only called inside a disposable database harness.
create function pg_temp.count_projection_entries(value jsonb) returns integer
language plpgsql as $$
declare total integer := 0; item jsonb;
begin
  if jsonb_typeof(value) = 'object' then
    for item in select e.value from jsonb_each(value) e loop
      total := total + 1 + pg_temp.count_projection_entries(item);
    end loop;
  elsif jsonb_typeof(value) = 'array' then
    for item in select jsonb_array_elements(value) loop
      total := total + 1 + pg_temp.count_projection_entries(item);
    end loop;
  end if;
  return total;
end;
$$;

do $$
declare
  source jsonb;
  nested jsonb;
  projected record;
  field_count integer;
  marker constant jsonb := '{"_praxisOmitted":"source_bounds_v1"}'::jsonb;
begin
  select jsonb_agg(i) into nested from generate_series(1, 200) i;
  source := jsonb_build_object('inputs', nested, 'outputs', nested, 'version', 2);
  select * into projected from praxis_reporting.safe_payload_v1(source);
  assert pg_temp.count_projection_entries(projected.payload) <= 256, 'aggregate overflow';
  assert projected.payload->'version' = '2'::jsonb, 'scalar version lost';
  assert projected.omission_count = 1 and projected.categories = array['source_bounds'], 'omission evidence mismatch';
  assert (select count(*) from jsonb_each(projected.payload)) = 3, 'root keys lost';

  -- A byte reduction adds a marker entry: the aggregate limit still applies.
  select jsonb_object_agg('field' || i, 0) into source from generate_series(1, 250) i;
  source := source || jsonb_build_object('a', repeat('x', 40000), 'b', repeat('y', 40000), 'nested', '[1,2,3]'::jsonb);
  select * into projected from praxis_reporting.safe_payload_v1(source);
  assert pg_temp.count_projection_entries(projected.payload) <= 256;
  assert octet_length(convert_to(projected.payload::text, 'UTF8')) <= 65536;
  assert projected.omission_count = 2;

  -- Exact scalar boundary is valid; excess roots and impossible marker budgets fail closed.
  select jsonb_object_agg('field' || i, 0) into source from generate_series(1, 256) i;
  select * into projected from praxis_reporting.safe_payload_v1(source);
  assert projected.payload = source and projected.omission_count = 0;
  begin
    perform * from praxis_reporting.safe_payload_v1(source || '{"extra":1}');
    raise exception 'excess roots accepted';
  exception when program_limit_exceeded then null;
  end;
  begin
    perform * from praxis_reporting.safe_payload_v1(source || jsonb_build_object('field1', repeat('x', 70000)));
    raise exception 'impossible marker budget accepted';
  exception when program_limit_exceeded then null;
  end;

  -- Exercise broad combinations; independently count the final JSON structure.
  for field_count in 1..32 loop
    select jsonb_object_agg('field' || i, nested) into source from generate_series(1, field_count) i;
    select * into projected from praxis_reporting.safe_payload_v1(source);
    assert pg_temp.count_projection_entries(projected.payload) <= 256;
    assert octet_length(convert_to(projected.payload::text, 'UTF8')) <= 65536;
    assert (select count(*) from jsonb_each(projected.payload)) = field_count;
    assert projected.omission_count = (select count(*) from jsonb_each(projected.payload) e where e.value = marker);
    assert projected.redaction_count = 0;
  end loop;
end;
$$;
