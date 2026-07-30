import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getProjectCommandCentre: vi.fn(),
}));

vi.mock('@/lib/projects/commandCentre/getProjectCommandCentre', () => ({
  getProjectCommandCentre: mocks.getProjectCommandCentre,
}));

import { getAuthoritativeProjectWorkProjection } from './getAuthoritativeProjectWorkProjection';

const PROJECT_ID = 'proj_11111111-1111-4111-8111-111111111111';
const SUPABASE = {} as never;
const PROJECT_WORK = {
  projectId: PROJECT_ID,
  modelVersion: 2,
  operationalState: 'ACTIVE',
};

describe('authoritative project-work projection', () => {
  beforeEach(() => {
    mocks.getProjectCommandCentre.mockReset();
  });

  it('returns the exact V2 projection composed by the Command Centre', async () => {
    mocks.getProjectCommandCentre.mockResolvedValue({
      workModel: 'v2',
      projectWork: PROJECT_WORK,
    });

    await expect(
      getAuthoritativeProjectWorkProjection(PROJECT_ID, SUPABASE),
    ).resolves.toBe(PROJECT_WORK);
    expect(mocks.getProjectCommandCentre).toHaveBeenCalledWith(PROJECT_ID, SUPABASE);
  });

  it('does not expose legacy or missing projects as V2 work', async () => {
    mocks.getProjectCommandCentre.mockResolvedValueOnce({
      workModel: 'legacy',
      operations: {},
    });
    await expect(
      getAuthoritativeProjectWorkProjection(PROJECT_ID, SUPABASE),
    ).resolves.toBeNull();

    mocks.getProjectCommandCentre.mockResolvedValueOnce(null);
    await expect(
      getAuthoritativeProjectWorkProjection(PROJECT_ID, SUPABASE),
    ).resolves.toBeNull();
  });
});
