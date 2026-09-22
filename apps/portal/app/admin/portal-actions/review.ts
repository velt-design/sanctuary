import type { PortalActionGrantRequest } from '@/lib/integrations/portalActions/contract';

export type ReviewProject = { projectId: string; name: string; stage: string | null; archivedAt: string | null;
  state: string | null; rowVersion: number | null; closedOutcome: string | null };
export type Review = { environment: string | null; enabled: boolean; projects: ReviewProject[];
  actions: { commandId: string; projectId: string; eligible: boolean; reason: string | null }[] };
export type GrantRow = { id: string; label: string; task_reference: string; environment: string; created_at: string;
  expires_at: string; revoked_at: string | null; project_count: number; action_count: number; committed_count: number };
export const API = '/api/admin/portal-actions/grants';

export class RequestFailure extends Error {
  constructor(public status: number | null) { super('Portal action request failed'); }
}

export async function request(url: string, body?: unknown): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(url, { method: body === undefined ? 'GET' : 'POST', credentials: 'same-origin',
      cache: 'no-store', redirect: 'error', signal: controller.signal,
      headers: body === undefined ? { Accept: 'application/json' } : { Accept: 'application/json', 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    if (!response.ok) throw new RequestFailure(response.status);
    return await response.json();
  } catch (error) {
    if (error instanceof RequestFailure) throw error;
    throw new RequestFailure(null);
  } finally { clearTimeout(timer); }
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Incomplete review');
  return value as Record<string, unknown>;
}
const nullableString = (value: unknown) => value === null || typeof value === 'string';
/** Refuse missing, duplicated, unrelated, or malformed review rows. */
export function parseReview(value: unknown, grant: PortalActionGrantRequest): Review {
  const data = object(value);
  if (!nullableString(data.environment) || typeof data.enabled !== 'boolean' || !Array.isArray(data.projects) || !Array.isArray(data.actions)) throw new Error('Incomplete review');
  const projects = data.projects.map((entry) => {
    const p = object(entry);
    if (typeof p.projectId !== 'string' || typeof p.name !== 'string' || !nullableString(p.stage) || !nullableString(p.archivedAt) ||
      !nullableString(p.state) || !nullableString(p.closedOutcome) || !(p.rowVersion === null || (Number.isSafeInteger(p.rowVersion) && Number(p.rowVersion) > 0))) throw new Error('Incomplete review');
    return p as ReviewProject;
  });
  const actions = data.actions.map((entry) => {
    const a = object(entry);
    if (typeof a.commandId !== 'string' || typeof a.projectId !== 'string' || typeof a.eligible !== 'boolean' || !nullableString(a.reason)) throw new Error('Incomplete review');
    return a as Review['actions'][number];
  });
  if (projects.length !== grant.projectIds.length || new Set(projects.map((p) => p.projectId)).size !== projects.length ||
      projects.some((p) => !grant.projectIds.includes(p.projectId)) || actions.length !== grant.actions.length ||
      new Set(actions.map((a) => a.commandId)).size !== actions.length ||
      actions.some((a) => !grant.actions.some((approved) => approved.commandId === a.commandId && approved.projectId === a.projectId))) throw new Error('Incomplete review');
  return { environment: data.environment as string | null, enabled: data.enabled, projects: projects.sort((a, b) => a.projectId.localeCompare(b.projectId)),
    actions: actions.sort((a, b) => a.commandId.localeCompare(b.commandId)) };
}

export function canIssue(review: Review, grant: PortalActionGrantRequest) {
  return review.enabled && review.environment === grant.environment && review.projects.every((p) => p.rowVersion !== null && Boolean(p.state)) && review.actions.every((a) => a.eligible) &&
    grant.actions.every((a) => review.projects.find((p) => p.projectId === a.projectId)?.rowVersion === a.expectedRowVersion);
}

export function parseInventory(value: unknown): GrantRow[] {
  const data = object(value);
  if (!Array.isArray(data.grants)) throw new Error('Unavailable inventory');
  return data.grants.map((entry) => {
    const g = object(entry);
    if (['id', 'label', 'task_reference', 'environment', 'created_at', 'expires_at'].some((key) => typeof g[key] !== 'string') ||
      !nullableString(g.revoked_at) || ['created_at', 'expires_at'].some((key) => !Number.isFinite(Date.parse(String(g[key])))) ||
      (g.revoked_at !== null && !Number.isFinite(Date.parse(String(g.revoked_at)))) ||
      ['project_count', 'action_count', 'committed_count'].some((key) => !Number.isSafeInteger(g[key]) || Number(g[key]) < 0)) throw new Error('Unavailable inventory');
    return g as GrantRow;
  });
}

export function dateLabel(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat(undefined, {
    day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
  }).format(date) : 'Unavailable';
}
