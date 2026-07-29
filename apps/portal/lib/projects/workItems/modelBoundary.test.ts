import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { getProjectWorkModelV2Ids, isProjectWorkModelV2 } from './modelBoundary';

function createClient(v2Ids: Set<string>) {
  const inFilter = vi.fn((_column: string, ids: string[]) => ({
    eq: vi.fn(async () => ({
      data: ids
        .filter((id) => v2Ids.has(id))
        .map((projectId) => ({ project_id: projectId, model_version: 2 })),
      error: null,
    })),
  }));
  const select = vi.fn(() => ({ in: inFilter }));
  const from = vi.fn(() => ({ select }));
  return { client: { from } as any, from, select, inFilter };
}

describe('project work model boundary', () => {
  it('classifies one project through the direct marker table', async () => {
    const { client, from, select, inFilter } = createClient(new Set(['project-v2']));

    await expect(isProjectWorkModelV2(client, 'project-v2')).resolves.toBe(true);
    await expect(isProjectWorkModelV2(client, 'project-legacy')).resolves.toBe(false);

    expect(from).toHaveBeenCalledWith('project_work_model_versions');
    expect(select).toHaveBeenCalledWith('project_id,model_version');
    expect(inFilter).toHaveBeenCalledWith('project_id', ['project-v2']);
    expect(inFilter).toHaveBeenCalledWith('project_id', ['project-legacy']);
  });

  it('deduplicates and chunks large project sets without embedded relationships', async () => {
    const ids = Array.from(
      { length: 205 },
      (_, index) => `11111111-1111-4111-8111-${String(index).padStart(12, '0')}`,
    );
    const { client, inFilter } = createClient(new Set([ids[0], ids[204]]));

    const result = await getProjectWorkModelV2Ids(client, ['', ...ids, ids[0]]);

    expect(result).toEqual(new Set([ids[0], ids[204]]));
    expect(inFilter).toHaveBeenCalledTimes(3);
    expect(inFilter.mock.calls.every((call) => call[1].length <= 100)).toBe(true);
  });
});
