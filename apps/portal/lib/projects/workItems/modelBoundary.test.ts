import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  getProjectWorkModelV2Ids,
  isProjectWorkModelV2,
  listProjectWorkModelV2Ids,
} from './modelBoundary';

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

function createErrorClient(error: unknown) {
  const eq = vi.fn(async () => ({ data: null, error }));
  const inFilter = vi.fn(() => ({ eq }));
  const select = vi.fn(() => ({ in: inFilter }));
  const from = vi.fn(() => ({ select }));
  return { client: { from } as any, from };
}

function createInventoryClient(
  rows: Array<{ project_id: string; model_version: number }>,
  error: unknown = null,
) {
  const range = vi.fn(async (from: number, to: number) => ({
    data: error ? null : rows.slice(from, to + 1),
    error,
    count: error ? null : rows.length,
  }));
  const order = vi.fn(() => ({ range }));
  const eq = vi.fn(() => ({ order }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  return { client: { from } as any, from, select, eq, order, range };
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

  it('lists every V2 marker directly without an embedded project relationship', async () => {
    const { client, from, select, eq, order, range } = createInventoryClient([
      { project_id: 'project-v2-a', model_version: 2 },
      { project_id: 'project-v2-b', model_version: 2 },
    ]);

    await expect(listProjectWorkModelV2Ids(client)).resolves.toEqual(
      new Set(['project-v2-a', 'project-v2-b']),
    );

    expect(from).toHaveBeenCalledWith('project_work_model_versions');
    expect(select).toHaveBeenCalledWith('project_id,model_version');
    expect(eq).toHaveBeenCalledWith('model_version', 2);
    expect(order).toHaveBeenCalledWith('project_id', { ascending: true });
    expect(range).toHaveBeenCalledWith(0, 999);
  });

  it('fails closed when the authoritative inventory schema is unavailable', async () => {
    const failure = {
      code: 'PGRST205',
      message: "Could not find the table 'public.project_work_model_versions' in the schema cache",
    };
    const { client } = createInventoryClient([], failure);

    await expect(listProjectWorkModelV2Ids(client)).rejects.toEqual(failure);
  });

  it('fails closed instead of silently truncating the authoritative inventory', async () => {
    const inventory = Array.from(
      { length: 5001 },
      (_, index) => ({
        project_id: `project-v2-${String(index).padStart(4, '0')}`,
        model_version: 2,
      }),
    );
    const { client } = createInventoryClient(inventory);

    await expect(listProjectWorkModelV2Ids(client)).rejects.toMatchObject({
      code: 'PROJECT_WORK_INVENTORY_INCOMPLETE',
    });
  });

  it('keeps pre-rollout legacy projects readable when only the V2 marker table is absent', async () => {
    const { client } = createErrorClient({
      code: 'PGRST205',
      message: "Could not find the table 'public.project_work_model_versions' in the schema cache",
    });

    await expect(isProjectWorkModelV2(client, 'project-legacy')).resolves.toBe(false);
  });

  it('does not hide unrelated model-boundary failures', async () => {
    const failure = {
      code: '42501',
      message: 'permission denied for table project_work_model_versions',
    };
    const { client } = createErrorClient(failure);

    await expect(isProjectWorkModelV2(client, 'project-legacy')).rejects.toBe(failure);
  });
});
