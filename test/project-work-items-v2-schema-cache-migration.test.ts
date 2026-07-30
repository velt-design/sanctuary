// @vitest-environment node

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';

const schemaCacheRepair = readFileSync(
  path.join(
    process.cwd(),
    'supabase/migrations/20260729_000003_project_work_items_v2_schema_cache.sql',
  ),
  'utf8',
);

describe('Project Work Items V2 relationship repair migration', () => {
  it('adds the exact project_id relationships, ignores unrelated FKs, and replays safely', async () => {
    const database = new PGlite();
    await database.waitReady;
    try {
      await database.exec(`
        create table public.projects (id uuid primary key);
        create table public.project_work_model_versions (
          project_id uuid primary key,
          unrelated_project_id uuid,
          model_version integer not null,
          constraint custom_model_project_link
            foreign key (project_id) references public.projects(id)
        );
        create table public.project_operational_states (
          project_id uuid primary key,
          unrelated_project_id uuid,
          state text not null,
          constraint project_operational_states_project_id_fkey
            foreign key (unrelated_project_id) references public.projects(id)
        );
      `);

      await database.exec(schemaCacheRepair);
      await database.exec(schemaCacheRepair);

      const constraints = await database.query<{
        conname: string;
        definition: string;
      }>(`
        select conname, pg_get_constraintdef(oid) as definition
        from pg_constraint
        where conname in (
          'project_work_model_versions_project_id_fkey',
          'project_operational_states_project_id_fkey'
        )
        order by conname
      `);

      expect(constraints.rows).toHaveLength(2);
      for (const constraint of constraints.rows) {
        expect(constraint.definition).toMatch(
          /^FOREIGN KEY \(project_id\) REFERENCES projects\(id\) ON DELETE CASCADE$/,
        );
      }
      const retiredConstraints = await database.query<{ count: string }>(`
        select count(*)::text as count
        from pg_constraint
        where conname = 'custom_model_project_link'
      `);
      expect(retiredConstraints.rows[0]?.count).toBe('0');
    } finally {
      await database.close();
    }
  });

  it.each([
    {
      setup: 'create table public.projects (id uuid primary key);',
      message: /project_work_model_versions is missing/i,
    },
    {
      setup: `
        create table public.projects (id uuid primary key);
        create table public.project_work_model_versions (
          project_id uuid primary key,
          model_version integer not null
        );
      `,
      message: /project_operational_states is missing/i,
    },
  ])('fails closed when a prerequisite table is missing', async ({ setup, message }) => {
    const database = new PGlite();
    await database.waitReady;
    try {
      await database.exec(setup);
      await expect(database.exec(schemaCacheRepair)).rejects.toThrow(message);
    } finally {
      await database.close();
    }
  });
});
