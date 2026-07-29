import { describe, expect, it, vi } from 'vitest';

const dependencies = vi.hoisted(() => ({
  getProjectWorkProjection: vi.fn(),
  getProjectWorkModelV2Ids: vi.fn(),
}));

vi.mock('@/lib/projects/workItems/repository', () => ({
  getProjectWorkProjection: dependencies.getProjectWorkProjection,
}));

vi.mock('@/lib/projects/workItems/modelBoundary', () => ({
  getProjectWorkModelV2Ids: dependencies.getProjectWorkModelV2Ids,
}));

import { getProjectCommandExceptions } from './getProjectCommandExceptions';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const LEGACY_PROJECT_ID = '22222222-2222-4222-8222-222222222222';

function queryResult(data: unknown) {
  const builder: Record<string, any> = {};
  builder.select = vi.fn(() => builder);
  builder.in = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.then = (resolve: (value: unknown) => unknown) => Promise.resolve({ data, error: null }).then(resolve);
  return builder;
}

describe('getProjectCommandExceptions', () => {
  it('reads the canonical pipeline stage without selecting a legacy project status column', async () => {
    dependencies.getProjectWorkProjection.mockReset();
    dependencies.getProjectWorkModelV2Ids.mockReset().mockResolvedValue(new Set());
    const projectQuery = queryResult([{
      id: PROJECT_ID,
      name: 'Test project',
      pipeline_stage: 'NEW',
      created_at: '2026-07-21T00:00:00.000Z',
    }]);
    const emptyQuery = queryResult([]);
    const client = {
      from: vi.fn((table: string) => table === 'projects' ? projectQuery : emptyQuery),
      rpc: vi.fn(async () => ({ data: [], error: null })),
    } as any;

    const result = await getProjectCommandExceptions(
      client,
      { userId: 'staff-user', isAdmin: false },
      new Date('2026-07-21T01:00:00.000Z'),
    );

    expect(projectQuery.select).toHaveBeenCalledWith(
      'id,name,pipeline_stage,created_at',
    );
    expect(result.projects).toHaveLength(1);
    expect(result.projects[0]).toMatchObject({
      projectId: `proj_${PROJECT_ID}`,
      stage: 'new',
      reasons: expect.arrayContaining(['no_action', 'missing_owner']),
    });
  });

  it('chunks related-table filters when the active project set is large', async () => {
    dependencies.getProjectWorkProjection.mockReset();
    dependencies.getProjectWorkModelV2Ids.mockReset().mockResolvedValue(new Set());
    const projectRows = Array.from({ length: 205 }, (_, index) => ({
      id: `11111111-1111-4111-8111-${String(index).padStart(12, '0')}`,
      name: `Project ${index}`,
      pipeline_stage: 'NEW',
      created_at: '2026-07-21T00:00:00.000Z',
    }));
    const projectQuery = queryResult(projectRows);
    const relatedQuery = queryResult([]);
    const client = {
      from: vi.fn((table: string) => table === 'projects' ? projectQuery : relatedQuery),
      rpc: vi.fn(async () => ({ data: [], error: null })),
    } as any;

    const result = await getProjectCommandExceptions(
      client,
      { userId: 'staff-user', isAdmin: false },
      new Date('2026-07-21T01:00:00.000Z'),
    );

    const filteredChunks = relatedQuery.in.mock.calls.map((call: unknown[]) => call[1] as string[]);
    expect(filteredChunks).toHaveLength(18);
    expect(filteredChunks.every((chunk: string[]) => chunk.length > 0 && chunk.length <= 100)).toBe(true);
    expect(result.totalProjects).toBe(205);
  });

  it('uses the V2 projection for triage without reading legacy action tables', async () => {
    dependencies.getProjectWorkProjection.mockReset().mockResolvedValue({
      projectId: PROJECT_ID,
      modelVersion: 2,
      operationalState: 'ACTIVE',
      effectiveState: 'ACTIVE',
      waitingUntil: null,
      waitingReason: null,
      closedOutcome: null,
      stateRowVersion: 1,
      primaryAction: {
        kind: 'needsTriage',
        title: 'Needs triage',
        reason: 'Blocked project work requires review.',
      },
      openItems: [],
      blockedItems: [{ id: 'blocked-item' }],
      confirmedFacts: [],
      generatedAt: '2026-07-21T01:00:00.000Z',
    });
    dependencies.getProjectWorkModelV2Ids.mockReset().mockResolvedValue(new Set([PROJECT_ID]));
    const projectQuery = queryResult([{
      id: PROJECT_ID,
      name: 'V2 project',
      pipeline_stage: 'NEW',
      created_at: '2026-07-21T00:00:00.000Z',
    }]);
    const emptyQuery = queryResult([]);
    const client = {
      from: vi.fn((table: string) => table === 'projects' ? projectQuery : emptyQuery),
      rpc: vi.fn(async () => ({ data: [], error: null })),
    } as any;
    const now = new Date('2026-07-21T01:00:00.000Z');

    const result = await getProjectCommandExceptions(
      client,
      { userId: 'staff-user', isAdmin: false },
      now,
    );

    expect(dependencies.getProjectWorkProjection).toHaveBeenCalledWith({
      supabase: client,
      projectUuid: PROJECT_ID,
      now,
    });
    const tables = client.from.mock.calls.map((call: unknown[]) => call[0]);
    expect(tables).not.toContain('tasks');
    expect(tables).not.toContain('followup_tasks');
    expect(tables).not.toContain('project_manual_actions');
    expect(tables).not.toContain('project_action_controls');
    expect(tables).not.toContain('project_primary_action_selections');
    expect(result.projects).toEqual([
      expect.objectContaining({
        projectId: `proj_${PROJECT_ID}`,
        reasons: expect.arrayContaining(['no_action', 'missing_owner']),
      }),
    ]);
  });

  it('filters V2 project ids out of legacy queries in a mixed cohort', async () => {
    dependencies.getProjectWorkProjection.mockReset().mockResolvedValue({
      projectId: PROJECT_ID,
      modelVersion: 2,
      operationalState: 'ACTIVE',
      effectiveState: 'ACTIVE',
      primaryAction: {
        kind: 'needsTriage',
        title: 'Needs triage',
        reason: 'No current work is recorded.',
      },
    });
    dependencies.getProjectWorkModelV2Ids.mockReset().mockResolvedValue(new Set([PROJECT_ID]));
    const projectQuery = queryResult([
      {
        id: PROJECT_ID,
        name: 'V2 project',
        pipeline_stage: 'NEW',
        created_at: '2026-07-21T00:00:00.000Z',
      },
      {
        id: LEGACY_PROJECT_ID,
        name: 'Legacy project',
        pipeline_stage: 'NEW',
        created_at: '2026-07-21T00:00:00.000Z',
      },
    ]);
    const tableQueries = new Map<string, ReturnType<typeof queryResult>>();
    const client = {
      from: vi.fn((table: string) => {
        if (table === 'projects') return projectQuery;
        const query = queryResult([]);
        tableQueries.set(table, query);
        return query;
      }),
      rpc: vi.fn(async () => ({ data: [], error: null })),
    } as any;

    await getProjectCommandExceptions(
      client,
      { userId: 'staff-user', isAdmin: false },
      new Date('2026-07-21T01:00:00.000Z'),
    );

    for (const table of [
      'tasks',
      'followup_tasks',
      'project_manual_actions',
      'project_action_controls',
      'project_primary_action_selections',
    ]) {
      expect(tableQueries.get(table)?.in).toHaveBeenCalledWith(
        'project_id',
        [LEGACY_PROJECT_ID],
      );
    }
  });
});
