import { describe, expect, it } from 'vitest';
import {
  buildProjectOwnerSummary,
  projectOwnerRequired,
} from './projectOwners';

describe('project owner summary', () => {
  it.each(['new', 'contacted', 'site_visit', 'quoting', 'sent', 'deposit'])(
    'requires an owner during %s',
    (stage) => {
      expect(projectOwnerRequired(stage)).toBe(true);
    },
  );

  it('does not make legacy task retirement change project-owner management', () => {
    expect(
      buildProjectOwnerSummary({
        stage: 'quoting',
        assignment: {
          ownerKey: 'jordan',
          updatedAt: '2026-07-30T00:00:00.000Z',
        },
        isAdmin: true,
      }),
    ).toEqual({
      owner: { key: 'jordan', displayName: 'Jordan' },
      required: true,
      missing: false,
      version: '2026-07-30T00:00:00.000Z',
      permissions: { canManage: true },
    });
  });
});
