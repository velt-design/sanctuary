import type { ProjectWorkEffectiveAssignee } from './types';

export function resolveProjectWorkEffectiveAssignee(
  assigneeUserId: string | null,
  projectOwnerKey: string | null,
): ProjectWorkEffectiveAssignee {
  if (assigneeUserId) return { kind: 'staff', userId: assigneeUserId };
  if (projectOwnerKey) return { kind: 'projectOwner', ownerKey: projectOwnerKey };
  return { kind: 'unassigned' };
}
