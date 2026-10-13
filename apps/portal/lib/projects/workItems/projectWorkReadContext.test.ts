import { describe, expect, it, vi } from 'vitest';
import { getProjectWorkReadContext } from './projectWorkReadContext';

const projectUuid = '11111111-1111-4111-8111-111111111111';

function client(overrides: Record<string, { data: unknown; error: unknown }> = {}) {
  const defaults: Record<string, unknown> = {
    projects: [{ id: projectUuid, archived_at: '2026-10-13T00:00:00Z' }],
    project_work_model_versions: [{ model_version: 2 }],
    project_owner_assignments: [{ owner_key: ' jordan ' }],
  };
  return {
    from: vi.fn((table: string) => {
      const result = overrides[table] ?? { data: defaults[table], error: null };
      const builder: any = {
        select: () => builder, eq: () => builder, limit: () => builder,
        then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve),
      };
      return builder;
    }),
  } as any;
}

describe('request-local project work read context', () => {
  it('keeps the standalone authenticated project, model and owner reads', async () => {
    const supabase = client();
    expect(await getProjectWorkReadContext({ supabase, projectUuid })).toEqual({
      supabase, projectUuid, archivedAt: '2026-10-13T00:00:00.000Z', modelVersion: 2, projectOwnerKey: 'jordan',
    });
    expect(supabase.from).toHaveBeenCalledTimes(3);
  });

  it('reuses facts only with the same project and authenticated client', async () => {
    const supabase = client();
    const readContext = { supabase, projectUuid, archivedAt: null, modelVersion: 2 as const, projectOwnerKey: null };
    await expect(getProjectWorkReadContext({ supabase, projectUuid, readContext })).resolves.toBe(readContext);
    expect(supabase.from).not.toHaveBeenCalled();
    await expect(getProjectWorkReadContext({ supabase, projectUuid: 'another-project', readContext })).rejects.toThrow('does not match');
    await expect(getProjectWorkReadContext({ supabase: client(), projectUuid, readContext })).rejects.toThrow('does not match');
  });

  it('does not turn an inaccessible project or missing marker into V2 work', async () => {
    await expect(getProjectWorkReadContext({ supabase: client({ projects: { data: [], error: null } }), projectUuid })).resolves.toBeNull();
    const result = await getProjectWorkReadContext({
      supabase: client({ project_work_model_versions: { data: [], error: null }, project_owner_assignments: { data: [], error: null } }),
      projectUuid,
    });
    expect(result).toMatchObject({ modelVersion: null, projectOwnerKey: null });
  });

  it.each(['projects', 'project_work_model_versions', 'project_owner_assignments'])('preserves %s read errors', async (table) => {
    await expect(getProjectWorkReadContext({
      supabase: client({ [table]: { data: null, error: { code: '42501', message: 'permission denied' } } }), projectUuid,
    })).rejects.toMatchObject({ code: '42501', message: 'permission denied' });
  });
});
