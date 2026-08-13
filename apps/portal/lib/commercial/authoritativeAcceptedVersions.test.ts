import { describe, expect, it } from 'vitest';
import { selectAuthoritativeAcceptedVersions, type AcceptedLifecycleCandidate } from './authoritativeAcceptedVersions';

function version(overrides: Partial<AcceptedLifecycleCandidate>): AcceptedLifecycleCandidate {
  return {
    id: 'qv-1', familyKey: 'base', status: 'ACCEPTED', versionNumber: 1,
    createdAt: '2026-08-01T00:00:00Z', acceptedAt: '2026-08-02T00:00:00Z',
    ...overrides,
  };
}

describe('selectAuthoritativeAcceptedVersions', () => {
  it('selects the newest acceptance independently for base and add-on families', () => {
    const selected = selectAuthoritativeAcceptedVersions([
      version({ id: 'base-v1' }),
      version({ id: 'base-v2', versionNumber: 2 }),
      version({ id: 'addon-v1', familyKey: 'addon-1' }),
    ]);
    expect(selected.map((candidate) => candidate.id).sort()).toEqual(['addon-v1', 'base-v2']);
  });

  it('does not revive an older acceptance after the newer accepted version is superseded', () => {
    expect(selectAuthoritativeAcceptedVersions([
      version({ id: 'base-v1' }),
      version({ id: 'base-v2', versionNumber: 2, status: 'SUPERSEDED' }),
    ])).toEqual([]);
  });

  it('keeps the contract when a never-accepted replacement is superseded', () => {
    const selected = selectAuthoritativeAcceptedVersions([
      version({ id: 'base-v1' }),
      version({ id: 'base-v2', versionNumber: 2, status: 'SUPERSEDED', acceptedAt: null }),
    ]);
    expect(selected.map((candidate) => candidate.id)).toEqual(['base-v1']);
  });

  it('does not revive an older acceptance when the latest accepted version is declined', () => {
    expect(selectAuthoritativeAcceptedVersions([
      version({ id: 'base-v1' }),
      version({ id: 'base-v2', versionNumber: 2, status: 'DECLINED' }),
    ])).toEqual([]);
  });
});
