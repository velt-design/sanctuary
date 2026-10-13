import { describe, expect, it, vi } from 'vitest';
import { getProjectCommandCentre } from './getProjectCommandCentre';

const projectUuid = '11111111-1111-4111-8111-111111111111';
const projectId = `proj_${projectUuid}`;

function client(overrides: Record<string, { data: unknown[]; error?: { code: string; message: string } }> = {}) {
  const tables: Record<string, unknown[]> = {
    projects: [{
      id: projectUuid, pipeline_stage: 'QUOTING', archived_at: '2026-10-12T00:00:00.000Z',
      ownerAssignment: [{ owner_key: 'jordan', updated_at: '2026-10-01T00:00:00.000Z' }], estimates: [], quotes: [],
    }],
    project_work_model_versions: [{ project_id: projectUuid, model_version: 2 }],
    project_work_repair_signals: [],
    project_operational_states: [{ state: 'ACTIVE', waiting_until: null, waiting_reason: null, closed_outcome: null, row_version: 1 }],
    project_work_items: [],
    project_confirmation_events: [],
  };
  const requests: string[] = [];
  const supabase = {
    from: vi.fn((table: string) => {
      const result = overrides[table] ?? { data: tables[table] };
      if (!result.data) throw new Error(`Unexpected source: ${table}`);
      let single = false;
      const builder: any = {
        select: () => builder, eq: () => builder, neq: () => builder, in: () => builder,
        limit: () => builder, order: () => builder,
        maybeSingle: () => { single = true; return builder; },
        then: (resolve: (value: unknown) => unknown) => {
          requests.push(table);
          return Promise.resolve({ data: single ? result.data[0] ?? null : result.data, error: result.error ?? null }).then(resolve);
        },
      };
      return builder;
    }),
  } as any;
  return { supabase, requests };
}

describe('Command Centre to Project Work read boundary', () => {
  it('uses authenticated project facts once while preserving archived work and owner', async () => {
    const { supabase, requests } = client();
    const result = await getProjectCommandCentre(projectId, supabase);
    expect(result).toMatchObject({
      workModel: 'v2', owner: { owner: { key: 'jordan' } },
      projectWork: { effectiveState: 'ARCHIVED', primaryAction: { kind: 'none', title: 'Project archived' } },
    });
    expect(requests).toHaveLength(6);
    expect(requests.filter((table) => table === 'projects')).toHaveLength(1);
    expect(requests.filter((table) => table === 'project_work_model_versions')).toHaveLength(1);
    expect(requests).not.toContain('project_owner_assignments');
  });

  it('returns null for a project the authenticated read cannot see', async () => {
    const { supabase } = client({ projects: { data: [] } });
    await expect(getProjectCommandCentre(projectId, supabase)).resolves.toBeNull();
    expect(supabase.from).not.toHaveBeenCalledWith('project_operational_states');
  });

  it('preserves the missing-model legacy boundary', async () => {
    const { supabase } = client({ project_work_model_versions: { data: [] } });
    await expect(getProjectCommandCentre(projectId, supabase)).resolves.toMatchObject({ workModel: 'legacy' });
    expect(supabase.from).not.toHaveBeenCalledWith('project_operational_states');
  });

  it.each(['projects', 'project_work_model_versions', 'project_operational_states', 'project_work_items', 'project_confirmation_events'])(
    'propagates %s failures instead of manufacturing complete work', async (table) => {
      const { supabase } = client({ [table]: { data: [], error: { code: '42501', message: 'permission denied' } } });
      await expect(getProjectCommandCentre(projectId, supabase)).rejects.toThrow('permission denied');
    },
  );

  it('still rejects a marked V2 project with no operational state', async () => {
    const { supabase } = client({ project_operational_states: { data: [] } });
    await expect(getProjectCommandCentre(projectId, supabase)).rejects.toThrow('missing its operational state');
  });
});
