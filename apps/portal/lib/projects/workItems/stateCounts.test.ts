import { describe, expect, it, vi } from 'vitest';
import {
  getProjectOperationalStateCounts,
  mapProjectOperationalStateCounts,
} from './stateCounts';

describe('project operational state counts', () => {
  it('maps a complete effective-state count response', () => {
    expect(mapProjectOperationalStateCounts({
      ACTIVE: 8,
      WAITING: 2,
      CLOSED: 3,
      ARCHIVED: 1,
      totalCount: 14,
    })).toEqual({
      ACTIVE: 8,
      WAITING: 2,
      CLOSED: 3,
      ARCHIVED: 1,
      totalCount: 14,
    });
  });

  it('rejects incomplete or inconsistent counts', () => {
    expect(() => mapProjectOperationalStateCounts({
      ACTIVE: 8,
      WAITING: 2,
      CLOSED: 3,
      ARCHIVED: 1,
      totalCount: 13,
    })).toThrow('inconsistent total');
    expect(() => mapProjectOperationalStateCounts(null)).toThrow(
      'invalid response',
    );
  });

  it('loads through the authenticated RPC boundary', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        ACTIVE: 8,
        WAITING: 2,
        CLOSED: 3,
        ARCHIVED: 1,
        totalCount: 14,
      },
      error: null,
    });
    await expect(
      getProjectOperationalStateCounts({ rpc } as never),
    ).resolves.toMatchObject({ ACTIVE: 8, totalCount: 14 });
    expect(rpc).toHaveBeenCalledWith('staff_project_state_counts_v1');
  });

  it('propagates the server error without inventing empty counts', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { code: '42501', message: 'permission denied' },
    });
    await expect(
      getProjectOperationalStateCounts({ rpc } as never),
    ).rejects.toMatchObject({ code: '42501' });
  });
});
