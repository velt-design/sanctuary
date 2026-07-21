import type { ProjectOwnerKey, ProjectOwnerOption } from './types';

export const PROJECT_OWNER_OPTIONS: readonly ProjectOwnerOption[] = [
  { key: 'jordan', displayName: 'Jordan' },
  { key: 'jp', displayName: 'JP' },
  { key: 'joe', displayName: 'Joe' },
  { key: 'bruce', displayName: 'Bruce' },
];

const PROJECT_OWNER_BY_KEY = new Map(PROJECT_OWNER_OPTIONS.map((owner) => [owner.key, owner]));

export function isProjectOwnerKey(value: unknown): value is ProjectOwnerKey {
  return typeof value === 'string' && PROJECT_OWNER_BY_KEY.has(value as ProjectOwnerKey);
}

export function projectOwnerOption(value: unknown): ProjectOwnerOption | null {
  return isProjectOwnerKey(value) ? PROJECT_OWNER_BY_KEY.get(value) ?? null : null;
}
