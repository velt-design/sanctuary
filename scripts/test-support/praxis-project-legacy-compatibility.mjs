// Run before the core migration, against a disposable bootstrap only.
export async function verifyProjectLegacyCompatibility(execute, migration) {
  const cases = [
    { name: 'both present', version: true, deposit: true },
    { name: 'both absent', version: false, deposit: false },
    { name: 'version absent', version: false, deposit: true },
    { name: 'deposit absent', version: true, deposit: false },
    { name: 'both present null', version: true, deposit: true, nulls: true },
  ];
  for (const scenario of cases) {
    const version = scenario.version && !scenario.nulls ? "'37'::jsonb" : "'null'::jsonb";
    const deposit = scenario.deposit && !scenario.nulls
      ? "to_jsonb('2026-01-02T03:04:05.123456Z'::timestamptz)" : "'null'::jsonb";
    await execute(`
      begin;
      alter table public.projects alter column version drop not null;
      update public.projects set version = ${scenario.nulls ? 'null' : '37'},
        deposit_received_at = ${scenario.nulls ? 'null' : "'2026-01-02T03:04:05.123456Z'::timestamptz"};
      ${scenario.version ? '' : 'alter table public.projects drop column version;'}
      ${scenario.deposit ? '' : 'alter table public.projects drop column deposit_received_at;'}
      alter table public.projects add column private_project_payload text default 'legacy-private-probe';
      create temporary table legacy_source_before as select to_jsonb(project) as row
        from public.projects project;
      ${migration}
      do $$
      declare projected jsonb; initial_hash text; next_hash text;
      begin
        select payload, record_version into projected, initial_hash
          from praxis_reporting.projects_v1 where id = '10000000-0000-4000-8000-000000000001';
        if projected -> 'version' is distinct from ${version}
           or projected -> 'depositReceivedAt' is distinct from ${deposit} then
          raise exception 'Legacy project values or required null keys changed: %', projected;
        end if;
        if projected ? 'private_project_payload' or projected::text like '%legacy-private-probe%'
           or projected ? 'data' or projected ? 'deposit_received_at' then
          raise exception 'Raw project row escaped its allowlist';
        end if;
        if exists (
          (select to_jsonb(project) from public.projects project except select row from legacy_source_before)
          union all
          (select row from legacy_source_before except select to_jsonb(project) from public.projects project)
        ) then raise exception 'Core migration mutated project source history'; end if;
        if (select count(distinct resource) from praxis_reporting.context_page_v1(
          'all', '10000000-0000-4000-8000-000000000001', null, now() + interval '1 minute',
          null, null, null, 100)) <> 12 then
          raise exception 'Legacy compatibility lost a context resource';
        end if;
        update public.projects set name = 'Changed legacy fixture', updated_at = '2026-09-01T12:34:56.123456Z'
          where id = '10000000-0000-4000-8000-000000000001';
        select record_version into next_hash from praxis_reporting.projects_v1
          where id = '10000000-0000-4000-8000-000000000001';
        if next_hash is not distinct from initial_hash then
          raise exception 'Project content change did not change its record hash';
        end if;
        if (select recorded_at from praxis_reporting.projects_v1
          where id = '10000000-0000-4000-8000-000000000001')
          is distinct from '2026-09-01T12:34:56.123456Z'::timestamptz then
          raise exception 'Project source freshness timestamp changed';
        end if;
      end;
      $$;
      rollback;
    `);
    process.stdout.write(`praxis-project-legacy: ${scenario.name} values/null keys, privacy, 12 resources and hash passed\n`);
  }
}
