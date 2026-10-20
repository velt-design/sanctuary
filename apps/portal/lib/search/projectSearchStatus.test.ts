import { describe, expect, it, vi } from 'vitest';
import { projectSearchStatuses } from './projectSearchStatus';

describe('bounded search current-state read', () => {
  const id = (index: number) => `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`;
  const clientFor = (data: unknown[]) => {
    const inQuery = vi.fn().mockResolvedValue({ data, error: null });
    const select = vi.fn(() => ({ in: inQuery }));
    return { client: { from: vi.fn(() => ({ select })) } as any, inQuery, select };
  };
  it('reads at most five unique ranked project IDs in one authenticated query', async () => {
    const { client, inQuery } = clientFor([]);
    await projectSearchStatuses(client, [id(1), id(1), ...Array.from({ length: 7 }, (_, index) => id(index + 2))].map((uuid) => `proj_${uuid}`));
    expect(client.from).toHaveBeenCalledTimes(1);
    expect(inQuery).toHaveBeenCalledWith('id', [id(1), id(2), id(3), id(4), id(5)]);
  });
  it('does no extra read for contacts-only or empty results', async () => {
    const { client } = clientFor([]);
    expect((await projectSearchStatuses(client, [])).size).toBe(0);
    expect(client.from).not.toHaveBeenCalled();
  });
  it('handles one-to-one representations, preserves unknown V2 state and archive precedence', async () => {
    const { client } = clientFor([
      { id: id(1), project_work_model_versions: [{ model_version: 2 }], project_operational_states: [{ state: 'WAITING' }] },
      { id: id(2), project_work_model_versions: { model_version: 2 }, project_operational_states: null },
      { id: id(3), archived_at: '2026-10-20T00:00:00Z', project_work_model_versions: { model_version: 2 }, project_operational_states: { state: 'CLOSED', closed_outcome: 'CANCELLED' } },
      { id: id(4), project_work_model_versions: null, project_operational_states: null },
    ]);
    const statuses = await projectSearchStatuses(client, [id(1), id(2), id(3), id(4)].map((uuid) => `proj_${uuid}`));
    expect(statuses.get(`proj_${id(1)}`)?.effectiveState).toBe('WAITING');
    expect(statuses.get(`proj_${id(2)}`)).toEqual({ workModel: 'v2', effectiveState: null, closedOutcome: null });
    expect(statuses.get(`proj_${id(3)}`)?.effectiveState).toBe('ARCHIVED');
    expect(statuses.get(`proj_${id(4)}`)).toEqual({ workModel: 'unknown', effectiveState: null, closedOutcome: null });
    expect(statuses.has(`proj_${id(5)}`)).toBe(false);
  });
});
