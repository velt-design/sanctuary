import type { ProjectCommandOwnerSummary, ProjectOwnerKey, ProjectOwnerOption } from './types';
import { resolveProjectJourney } from '../projectJourney';

export const ENQUIRY_OWNER_KEY = 'ellen' satisfies ProjectOwnerKey;
export const DELIVERY_OWNER_KEY = 'dave' satisfies ProjectOwnerKey;

export const PROJECT_OWNER_REQUIRED_STAGES = new Set([
  'new',
  'contacted',
  'site_visit',
  'quoting',
  'sent',
  'deposit',
  'scheduled',
  'completed',
]);

export const PROJECT_OWNER_OPTIONS: readonly ProjectOwnerOption[] = [
  { key: ENQUIRY_OWNER_KEY, displayName: 'Ellen' },
  { key: 'jordan', displayName: 'Jordan' },
  { key: 'jp', displayName: 'JP' },
  { key: 'joe', displayName: 'Joe' },
  { key: 'bruce', displayName: 'Bruce' },
  { key: DELIVERY_OWNER_KEY, displayName: 'Dave' },
];

const PROJECT_OWNER_BY_KEY = new Map(PROJECT_OWNER_OPTIONS.map((owner) => [owner.key, owner]));

export function isProjectOwnerKey(value: unknown): value is ProjectOwnerKey {
  return typeof value === 'string' && PROJECT_OWNER_BY_KEY.has(value as ProjectOwnerKey);
}

export function projectOwnerOption(value: unknown): ProjectOwnerOption | null {
  return isProjectOwnerKey(value) ? (PROJECT_OWNER_BY_KEY.get(value) ?? null) : null;
}

function projectOwnerRequired(stage: string): boolean {
  return PROJECT_OWNER_REQUIRED_STAGES.has(stage.trim().toLowerCase());
}

export function projectOwnerHandoffGuidance(stage: unknown): string {
  const journey = resolveProjectJourney(stage);
  if (!journey.knownStage) {
    return 'Keep ownership aligned with the current project phase.';
  }
  if (journey.phase === 'ENQUIRY') {
    return 'Ellen owns every Enquiry project. Change the stage manually before assigning the Proposal owner.';
  }
  if (journey.phase === 'PROPOSAL') {
    return 'Assign the Proposal owner manually. Before leaving Proposal, hand over the project and assign Dave.';
  }
  if (journey.phase === 'CONFIRMED' || journey.phase === 'DELIVERY') {
    return 'Dave owns confirmed work and delivery after the Proposal handoff.';
  }
  return 'Keep the final recorded owner for settled-project accountability.';
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
