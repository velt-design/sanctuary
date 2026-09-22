import { PROJECT_LOST_OUTCOMES } from '@/lib/projects/workItems/types';

export const PORTAL_ACTIONS_VERSION = 'portal_actions_v1' as const;
export const PORTAL_ACTIONS_MAX_PROJECTS = 1000;
export const PORTAL_ACTIONS_MAX_APPROVALS = 100;
export const PORTAL_ACTIONS_MAX_GRANT_MS = 30 * 24 * 60 * 60 * 1000;
export const PORTAL_ACTIONS_MAX_APPROVAL_MS = 24 * 60 * 60 * 1000;

type LostOutcome = (typeof PROJECT_LOST_OUTCOMES)[number];
type StateActionBase = {
  commandId: string;
  projectId: string;
  expectedRowVersion: number;
  expiresAt: string;
};

export type ApprovedPortalStateAction = StateActionBase & (
  | { command: 'CLOSE'; outcome: LostOutcome; note: string; cancellationReason: string }
  | { command: 'REOPEN'; reason: string }
);

export type PortalActionGrantRequest = {
  version: typeof PORTAL_ACTIONS_VERSION;
  environment: 'staging' | 'production';
  taskReference: string;
  label: string;
  expiresAt: string;
  projectIds: string[];
  actions: ApprovedPortalStateAction[];
};

export class PortalActionInputError extends Error {
  constructor() {
    super('Invalid Portal action grant');
    this.name = 'PortalActionInputError';
  }
}

function invalid(): never { throw new PortalActionInputError(); }

function object(value: unknown, keys: string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid();
  const result = value as Record<string, unknown>;
  if (Object.keys(result).some((key) => !keys.includes(key))) return invalid();
  return result;
}

function text(value: unknown, maximum: number): string {
  if (typeof value !== 'string' || !value.trim() || value.length > maximum || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) return invalid();
  return value.trim();
}

function uuid(value: unknown): string {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) return invalid();
  return value.toLowerCase();
}

function expiry(value: unknown, now: number, maximum: number): string {
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(value)) return invalid();
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || parsed <= now || parsed > now + maximum) return invalid();
  const normalized = new Date(parsed).toISOString();
  if (normalized.slice(0, 19) !== value.slice(0, 19)) return invalid();
  return normalized;
}

/** This parses approval input, not execution input. Execution accepts only a saved command ID. */
export function parsePortalActionGrant(value: unknown, now: number): PortalActionGrantRequest {
  if (!Number.isFinite(now)) return invalid();
  const input = object(value, ['version', 'environment', 'taskReference', 'label', 'expiresAt', 'projectIds', 'actions']);
  if (input.version !== PORTAL_ACTIONS_VERSION || !['staging', 'production'].includes(String(input.environment))) return invalid();
  const expiresAt = expiry(input.expiresAt, now, PORTAL_ACTIONS_MAX_GRANT_MS);
  if (!Array.isArray(input.projectIds) || !input.projectIds.length || input.projectIds.length > PORTAL_ACTIONS_MAX_PROJECTS) return invalid();
  const projectIds = input.projectIds.map(uuid);
  const projects = new Set(projectIds);
  if (projects.size !== projectIds.length) return invalid();
  if (!Array.isArray(input.actions) || input.actions.length > PORTAL_ACTIONS_MAX_APPROVALS) return invalid();
  const commandIds = new Set<string>();
  const actionProjects = new Set<string>();
  const actions: ApprovedPortalStateAction[] = input.actions.map((candidate) => {
    const common = ['commandId', 'projectId', 'command', 'expectedRowVersion', 'expiresAt'];
    const action = object(candidate, [...common, 'outcome', 'note', 'cancellationReason', 'reason']);
    if (action.command !== 'CLOSE' && action.command !== 'REOPEN') return invalid();
    object(action, [...common, ...(action.command === 'CLOSE' ? ['outcome', 'note', 'cancellationReason'] : ['reason'])]);
    const commandId = uuid(action.commandId);
    const projectId = uuid(action.projectId);
    if (commandIds.has(commandId) || actionProjects.has(projectId) || !projects.has(projectId)) return invalid();
    commandIds.add(commandId);
    actionProjects.add(projectId);
    if (!Number.isSafeInteger(action.expectedRowVersion) || Number(action.expectedRowVersion) < 1) return invalid();
    const actionExpiry = expiry(action.expiresAt, now, PORTAL_ACTIONS_MAX_APPROVAL_MS);
    if (Date.parse(actionExpiry) > Date.parse(expiresAt)) return invalid();
    const base = { commandId, projectId, expectedRowVersion: Number(action.expectedRowVersion), expiresAt: actionExpiry };
    if (action.command === 'REOPEN') return { ...base, command: 'REOPEN', reason: text(action.reason, 500) };
    if (!PROJECT_LOST_OUTCOMES.includes(action.outcome as LostOutcome)) return invalid();
    return { ...base, command: 'CLOSE', outcome: action.outcome as LostOutcome, note: text(action.note, 1000), cancellationReason: text(action.cancellationReason, 500) };
  });
  return {
    version: PORTAL_ACTIONS_VERSION,
    environment: input.environment as PortalActionGrantRequest['environment'],
    taskReference: text(input.taskReference, 200),
    label: text(input.label, 100),
    expiresAt,
    projectIds,
    actions,
  };
}

export function parsePortalActionExecution(value: unknown): { commandId: string } {
  const input = object(value, ['commandId']);
  return { commandId: uuid(input.commandId) };
}
