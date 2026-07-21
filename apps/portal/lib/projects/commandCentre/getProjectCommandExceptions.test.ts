import { describe, expect, it, vi } from 'vitest';
import { getProjectCommandExceptions } from './getProjectCommandExceptions';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';

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

    expect(projectQuery.select).toHaveBeenCalledWith('id,name,pipeline_stage,created_at');
    expect(result.projects).toHaveLength(1);
    expect(result.projects[0]).toMatchObject({
      projectId: `proj_${PROJECT_ID}`,
      stage: 'new',
      reasons: expect.arrayContaining(['no_action', 'missing_owner']),
    });
  });
});
