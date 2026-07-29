import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  COMMAND_CENTRE_COMMERCIAL_RELATIONS_SELECT,
  commandCentreQuoteDeliveryState,
  normalizeCommandCentreCommercialCandidates,
} from '@/lib/projects/commandCentre/commercialSelection';
import { resolveCommandCentreSelection } from '@/lib/projects/commandCentre/resolve';
import { appIdFromUuid, isRecord } from '@/lib/supabase/mappers';
import {
  commercialProjectWorkActions,
  type ProjectWorkDomainActions,
} from './domainActionAdapters';
import { resolveProjectWorkEffectiveAssignee } from './effectiveAssignee';
import type {
  ProjectWorkItemPriority,
  ProjectWorkItemSourceType,
  ProjectWorkQueueActionKind,
  ProjectWorkQueueEntry,
  ProjectWorkQueueGroup,
} from './types';

const ACTIVE_V2_COMMERCIAL_PROJECTS_SELECT = `
  id,
  name,
  pipeline_stage,
  ownerAssignment:project_owner_assignments(owner_key),
  workModel:project_work_model_versions!inner(model_version),
  operationalState:project_operational_states!inner(state),
  ${COMMAND_CENTRE_COMMERCIAL_RELATIONS_SELECT}
`;

const ACTIVE_PROJECT_PAGE_SIZE = 500;
const QUEUE_GROUPS = new Set<ProjectWorkQueueGroup>([
  'overdue',
  'today',
  'nextSevenBusinessDays',
  'blocked',
  'needsTriage',
]);
const SOURCE_TYPES = new Set<ProjectWorkItemSourceType>([
  'LEAD_CADENCE',
  'QUOTE_CADENCE',
  'MANUAL',
  'LEGACY_REVIEW',
]);
const GROUP_RANK: Record<ProjectWorkQueueGroup, number> = {
  overdue: 0,
  today: 1,
  nextSevenBusinessDays: 2,
  blocked: 3,
  needsTriage: 4,
};

type Row = Record<string, unknown>;

export type ActiveProjectDomainCandidate = {
  projectUuid: string;
  projectId: string;
  projectName: string;
  stage: string;
  projectOwnerKey: string | null;
  actions: ProjectWorkDomainActions;
};

function rows(value: unknown): Row[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is Row => isRecord(entry))
    : [];
}

function relationRows(value: unknown): Row[] {
  if (Array.isArray(value)) return value.filter((entry): entry is Row => isRecord(entry));
  return isRecord(value) ? [value] : [];
}

function text(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function iso(value: unknown): string | null {
  const raw = text(value);
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isFinite(parsed.valueOf()) ? parsed.toISOString() : null;
}

function positiveInteger(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function queueGroup(value: unknown): ProjectWorkQueueGroup | null {
  const candidate = text(value) as ProjectWorkQueueGroup | null;
  return candidate && QUEUE_GROUPS.has(candidate) ? candidate : null;
}

function actionKind(value: unknown): ProjectWorkQueueActionKind | null {
  const candidate = text(value)?.toUpperCase();
  if (candidate === 'REPAIR') return 'recovery';
  if (candidate === 'WORK_ITEM') return 'workItem';
  if (candidate === 'STATE_REVIEW') return 'stateReview';
  if (candidate === 'NEEDS_TRIAGE') return 'needsTriage';
  return null;
}

function priority(value: unknown): ProjectWorkItemPriority | null {
  const candidate = text(value)?.toUpperCase();
  return candidate === 'NORMAL' || candidate === 'CRITICAL' ? candidate : null;
}

function sourceType(value: unknown): ProjectWorkItemSourceType | null {
  const candidate = text(value)?.toUpperCase() as ProjectWorkItemSourceType | undefined;
  return candidate && SOURCE_TYPES.has(candidate) ? candidate : null;
}

function projectActivityHref(projectId: string): string {
  return `/staff/projects/${encodeURIComponent(projectId)}?tab=activity`;
}

function durableHref(params: {
  projectId: string;
  actionKind: ProjectWorkQueueActionKind;
  subjectKind: string | null;
  subjectId: string | null;
}): string {
  if (
    params.actionKind === 'recovery'
    && params.subjectKind === 'QUOTE_VERSION'
    && params.subjectId
  ) {
    try {
      const quoteId = appIdFromUuid('qv', params.subjectId);
      return `/staff/projects/${encodeURIComponent(params.projectId)}?tab=quotes&quoteId=${encodeURIComponent(quoteId)}`;
    } catch {
      // The project Activity surface is the safe recovery destination when a
      // specialist reference is unavailable or malformed.
    }
  }
  return projectActivityHref(params.projectId);
}

function mapDurableQueueRow(row: Row): ProjectWorkQueueEntry {
  const projectUuid = text(row.project_id);
  const projectName = text(row.project_name);
  const stage = text(row.pipeline_stage);
  const group = queueGroup(row.queue_group);
  const kind = actionKind(row.action_kind);
  const title = text(row.title);
  const reason = text(row.reason);
  if (!projectUuid || !projectName || !stage || !group || !kind || !title || !reason) {
    throw new Error('Project work queue row is incomplete');
  }

  const projectId = appIdFromUuid('proj', projectUuid);
  const workItemId = text(row.work_item_id);
  const workItemRowVersion = positiveInteger(row.work_item_row_version);
  const stateRowVersion = positiveInteger(row.state_row_version);
  const repairSignalId = text(row.repair_signal_id);
  const repairSignalRowVersion = positiveInteger(
    row.repair_signal_row_version,
  );
  if (kind === 'workItem' && (!workItemId || !workItemRowVersion)) {
    throw new Error('Project work queue item is missing command metadata');
  }
  if (kind === 'stateReview' && !stateRowVersion) {
    throw new Error('Project state review is missing command metadata');
  }
  if (kind === 'recovery' && (!repairSignalId || !repairSignalRowVersion)) {
    throw new Error('Project recovery is missing command metadata');
  }

  const subjectKind = text(row.subject_kind)?.toUpperCase() ?? null;
  const subjectId = text(row.subject_id);
  return {
    projectId,
    projectName,
    stage: stage.toLowerCase(),
    group,
    actionKind: kind,
    title,
    reason,
    dueAt: iso(row.due_at),
    priority: priority(row.priority),
    blockedReason: text(row.blocked_reason),
    effectiveAssignee: resolveProjectWorkEffectiveAssignee(
      text(row.assignee_user_id),
      text(row.project_owner_key),
    ),
    workItemId,
    workItemRowVersion,
    stateRowVersion,
    sourceType: sourceType(row.source_type),
    sourceKey: text(row.source_key),
    subjectKind,
    subjectId,
    repairSignalId,
    repairSignalRowVersion,
    href: durableHref({ projectId, actionKind: kind, subjectKind, subjectId }),
  };
}

function domainCandidateFromProjectRow(row: Row): ActiveProjectDomainCandidate | null {
  const projectUuid = text(row.id);
  const projectName = text(row.name);
  const stage = text(row.pipeline_stage);
  if (!projectUuid || !projectName || !stage) return null;

  const projectId = appIdFromUuid('proj', projectUuid);
  const { estimates, quotes } = normalizeCommandCentreCommercialCandidates(row);
  const selection = resolveCommandCentreSelection({
    estimates,
    quoteVersions: quotes,
  });
  const basePath = `/staff/projects/${encodeURIComponent(projectId)}`;
  const currentCommercial = {
    source: selection.source,
    designState: selection.sourceEstimateMissing
      ? 'source_unavailable' as const
      : selection.estimate
        ? 'available' as const
        : 'none' as const,
    estimate: selection.estimate ? { id: selection.estimate.id } : null,
    quote: selection.quote
      ? {
          id: selection.quote.id,
          deliveryState: commandCentreQuoteDeliveryState(selection.quote),
        }
      : null,
    links: {
      designs: `${basePath}?tab=estimates`,
      quotes: `${basePath}?tab=quotes`,
      estimate: selection.estimate
        ? `${basePath}?tab=estimates&estimateId=${encodeURIComponent(selection.estimate.id)}`
        : null,
      quote: selection.quote
        ? `${basePath}?tab=quotes&quoteId=${encodeURIComponent(selection.quote.id)}`
        : null,
    },
  };
  const ownerRow = relationRows(row.ownerAssignment)[0];
  return {
    projectUuid,
    projectId,
    projectName,
    stage: stage.toLowerCase(),
    projectOwnerKey: text(ownerRow?.owner_key),
    actions: commercialProjectWorkActions(currentCommercial),
  };
}

async function loadActiveProjectDomainCandidates(
  supabase: SupabaseClient,
): Promise<ActiveProjectDomainCandidate[]> {
  const candidates: ActiveProjectDomainCandidate[] = [];
  for (let from = 0; ; from += ACTIVE_PROJECT_PAGE_SIZE) {
    const result = await supabase
      .from('projects')
      .select(ACTIVE_V2_COMMERCIAL_PROJECTS_SELECT)
      .is('archived_at', null)
      .eq('workModel.model_version', 2)
      .eq('operationalState.state', 'ACTIVE')
      .order('id', { ascending: true })
      .range(from, from + ACTIVE_PROJECT_PAGE_SIZE - 1);
    if (result.error) {
      throw Object.assign(
        new Error(result.error.message ?? 'Failed to load active V2 commercial actions'),
        result.error,
      );
    }
    const page = rows(result.data);
    for (const row of page) {
      const candidate = domainCandidateFromProjectRow(row);
      if (candidate) candidates.push(candidate);
    }
    if (page.length < ACTIVE_PROJECT_PAGE_SIZE) break;
  }
  return candidates;
}

function entryComparison(left: ProjectWorkQueueEntry, right: ProjectWorkQueueEntry): number {
  const group = GROUP_RANK[left.group] - GROUP_RANK[right.group];
  if (group !== 0) return group;
  const priorityRank = Number(right.priority === 'CRITICAL') - Number(left.priority === 'CRITICAL');
  if (priorityRank !== 0) return priorityRank;
  const leftDue = left.dueAt ? Date.parse(left.dueAt) : Number.POSITIVE_INFINITY;
  const rightDue = right.dueAt ? Date.parse(right.dueAt) : Number.POSITIVE_INFINITY;
  if (leftDue !== rightDue) return leftDue - rightDue;
  const name = left.projectName.localeCompare(right.projectName);
  return name || left.projectId.localeCompare(right.projectId);
}

function durableActionIsProtected(entry: ProjectWorkQueueEntry): boolean {
  return entry.actionKind === 'recovery'
    || entry.actionKind === 'stateReview'
    || entry.priority === 'CRITICAL'
    || entry.group === 'overdue'
    || entry.group === 'today'
    || entry.group === 'blocked';
}

function domainEntryBase(
  project: ActiveProjectDomainCandidate,
): Pick<
  ProjectWorkQueueEntry,
  | 'projectId'
  | 'projectName'
  | 'stage'
  | 'effectiveAssignee'
  | 'workItemId'
  | 'workItemRowVersion'
  | 'stateRowVersion'
  | 'sourceType'
  | 'sourceKey'
  | 'subjectKind'
  | 'subjectId'
  | 'repairSignalId'
  | 'repairSignalRowVersion'
> {
  return {
    projectId: project.projectId,
    projectName: project.projectName,
    stage: project.stage,
    effectiveAssignee: resolveProjectWorkEffectiveAssignee(null, project.projectOwnerKey),
    workItemId: null,
    workItemRowVersion: null,
    stateRowVersion: null,
    sourceType: null,
    sourceKey: null,
    subjectKind: null,
    subjectId: null,
    repairSignalId: null,
    repairSignalRowVersion: null,
  };
}

export function composeProjectWorkQueue(params: {
  durableEntries: ProjectWorkQueueEntry[];
  domainCandidates: ActiveProjectDomainCandidate[];
  limit: number;
}): ProjectWorkQueueEntry[] {
  const byProject = new Map<string, ProjectWorkQueueEntry>();
  for (const entry of params.durableEntries) {
    const existing = byProject.get(entry.projectId);
    if (!existing || entryComparison(entry, existing) < 0) {
      byProject.set(entry.projectId, entry);
    }
  }

  for (const project of params.domainCandidates) {
    const existing = byProject.get(project.projectId);
    const { recoveryAction, specialistAction } = project.actions;
    if (recoveryAction && existing?.actionKind !== 'recovery') {
      byProject.set(project.projectId, {
        ...domainEntryBase(project),
        group: 'blocked',
        actionKind: 'recovery',
        title: recoveryAction.title,
        reason: recoveryAction.reason,
        dueAt: null,
        priority: null,
        blockedReason: recoveryAction.reason,
        href: recoveryAction.href ?? projectActivityHref(project.projectId),
      });
      continue;
    }
    if (
      specialistAction
      && (!existing || !durableActionIsProtected(existing))
      && (!existing || existing.actionKind === 'needsTriage' || existing.actionKind === 'workItem')
    ) {
      byProject.set(project.projectId, {
        ...domainEntryBase(project),
        group: 'today',
        actionKind: 'specialist',
        title: specialistAction.title,
        reason: `Ready now. ${specialistAction.reason}`,
        dueAt: null,
        priority: null,
        blockedReason: null,
        href: specialistAction.href ?? projectActivityHref(project.projectId),
      });
    }
  }

  return [...byProject.values()]
    .sort(entryComparison)
    .slice(0, params.limit);
}

export async function getAuthoritativeProjectWorkQueue(
  supabase: SupabaseClient,
  options: { now?: Date; limit?: number } = {},
): Promise<{ entries: ProjectWorkQueueEntry[]; generatedAt: string }> {
  const now = options.now ?? new Date();
  const limit = Math.min(500, Math.max(1, options.limit ?? 500));
  const [durableResult, domainCandidates] = await Promise.all([
    supabase.rpc('project_work_queue_v3', {
      p_now: now.toISOString(),
      p_limit: 500,
    }),
    loadActiveProjectDomainCandidates(supabase),
  ]);
  if (durableResult.error) {
    throw Object.assign(
      new Error(durableResult.error.message ?? 'Failed to load project work queue'),
      durableResult.error,
    );
  }
  const durableEntries = rows(durableResult.data).map(mapDurableQueueRow);
  return {
    entries: composeProjectWorkQueue({ durableEntries, domainCandidates, limit }),
    generatedAt: now.toISOString(),
  };
}
