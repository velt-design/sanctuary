import type {
  ProjectCommandOwnerSummary,
  ProjectOwnerKey,
  ProjectOwnerOption,
} from './types';

const ACTIVE_LEAD_TO_QUOTE_STAGES = new Set([
  'new',
  'contacted',
  'site_visit',
  'quoting',
  'sent',
]);

export const PROJECT_OWNER_REQUIRED_STAGES = new Set([
  ...ACTIVE_LEAD_TO_QUOTE_STAGES,
  'deposit',
]);

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

function projectOwnerRequired(stage: string): boolean {
  return PROJECT_OWNER_REQUIRED_STAGES.has(stage.trim().toLowerCase());
}

export function buildProjectOwnerSummary(args: {
  stage: string;
  assignment: { ownerKey: string; updatedAt: string } | null;
  isAdmin: boolean;
}): ProjectCommandOwnerSummary {
  const owner = projectOwnerOption(args.assignment?.ownerKey);
  const required = projectOwnerRequired(args.stage);
  return {
    owner,
    required,
    missing: required && !owner,
    version: args.assignment?.updatedAt ?? null,
    permissions: { canManage: args.isAdmin },
  };
}
