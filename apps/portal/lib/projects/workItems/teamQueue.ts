import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { measureRouteStep, type PortalServerLogContext } from '@/lib/api/routeDiagnostics';
import {
  COMMAND_CENTRE_COMMERCIAL_RELATIONS_SELECT,
  commandCentreQuoteDeliveryState,
  normalizeCommandCentreCommercialCandidates,
} from '@/lib/projects/commandCentre/commercialSelection';
import { fetchAllPages, fetchRowsByIdChunks, MAX_LIST_FETCH_ROWS } from '@/lib/list/listLimits';
import { resolveCommandCentreSelection } from '@/lib/projects/commandCentre/resolve';
import { appIdFromUuid, isRecord, uuidFromAppId } from '@/lib/supabase/mappers';
import { projectWorkDomainActions, type ProjectWorkDomainActions } from './domainActionAdapters';
import { hasActiveProjectConfirmation } from './confirmationFacts';
import { resolveProjectWorkEffectiveAssignee } from './effectiveAssignee';
import { getProjectWorkModelV2Ids } from './modelBoundary';
import { isApprovedSiteVisitSpecialistIdentity, isRetiredProjectWorkIdentity } from './prohibitedWork';
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
  ${COMMAND_CENTRE_COMMERCIAL_RELATIONS_SELECT}
`;

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
  'STAGE_REVIEW',
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
const QUEUE_RELATED_READ_CONCURRENCY = 4;

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
  return Array.isArray(value) ? value.filter((entry): entry is Row => isRecord(entry)) : [];
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

function maskRetiredQueueEntry(entry: ProjectWorkQueueEntry): ProjectWorkQueueEntry {
  if (
    isApprovedSiteVisitSpecialistIdentity({
      actionKind: entry.actionKind,
      sourceKey: entry.sourceKey,
      href: entry.href,
    })
  ) {
    return entry;
  }
  if (!isRetiredProjectWorkIdentity(entry)) return entry;
  return {
    ...entry,
    group: 'needsTriage',
    actionKind: 'needsTriage',
    title: 'Legacy work needs review',
    reason: 'A retired project action is still selected by the server. Review Project Work before continuing.',
    dueAt: null,
    priority: null,
    blockedReason: null,
    workItemId: null,
    workItemRowVersion: null,
    stateRowVersion: null,
    sourceType: null,
    sourceKey: null,
    subjectKind: null,
    subjectId: null,
    repairSignalId: null,
    repairSignalRowVersion: null,
    actionLabel: 'Review project',
    href: projectActivityHref(entry.projectId),
  };
}

function durableHref(params: {
  projectId: string;
  actionKind: ProjectWorkQueueActionKind;
  subjectKind: string | null;
  subjectId: string | null;
}): string {
  if (params.actionKind === 'recovery' && params.subjectKind === 'QUOTE_VERSION' && params.subjectId) {
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
  const repairSignalRowVersion = positiveInteger(row.repair_signal_row_version);
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
    effectiveAssignee: resolveProjectWorkEffectiveAssignee(text(row.assignee_user_id), text(row.project_owner_key)),
    workItemId,
    workItemRowVersion,
    stateRowVersion,
    sourceType: sourceType(row.source_type),
    sourceKey: text(row.source_key),
    subjectKind,
    subjectId,
    repairSignalId,
    repairSignalRowVersion,
    actionLabel: null,
    href: durableHref({ projectId, actionKind: kind, subjectKind, subjectId }),
  };
}

function domainCandidateFromProjectRow(row: Row, siteVisitCompleted: boolean): ActiveProjectDomainCandidate | null {
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
      ? ('source_unavailable' as const)
      : selection.estimate
        ? ('available' as const)
        : ('none' as const),
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
      quote: selection.quote ? `${basePath}?tab=quotes&quoteId=${encodeURIComponent(selection.quote.id)}` : null,
    },
  };
  const ownerRow = relationRows(row.ownerAssignment)[0];
  return {
    projectUuid,
    projectId,
    projectName,
    stage: stage.toLowerCase(),
    projectOwnerKey: text(ownerRow?.owner_key),
    actions: projectWorkDomainActions({
      projectId,
      stage: stage.toLowerCase(),
      siteVisitCompleted,
      currentDesign: currentCommercial,
    }),
  };
}

async function loadActiveProjectDomainCandidates(
  supabase: SupabaseClient,
  projectUuids: readonly string[] | null = null,
  diagnostics?: PortalServerLogContext | null,
): Promise<ActiveProjectDomainCandidate[]> {
  let activeStateRows: Row[];
  let projectRows: Row[];
  let confirmationRows: Row[];

  if (projectUuids) {
    const v2ProjectIds = [
      ...await measureRouteStep(
        diagnostics,
        'queue_inventory',
        () => getProjectWorkModelV2Ids(supabase, projectUuids),
      ),
    ].sort();
    if (!v2ProjectIds.length) return [];
    activeStateRows = await measureRouteStep(
      diagnostics,
      'queue_states',
      () => fetchRowsByIdChunks<Row>(v2ProjectIds, (projectIds) =>
        supabase
          .from('project_operational_states')
          .select('project_id,state')
          .in('project_id', projectIds)
          .eq('state', 'ACTIVE'),
      ),
    );
    const activeProjectIds = activeStateRows
      .map((row) => text(row.project_id))
      .filter((projectId): projectId is string => projectId !== null);
    if (!activeProjectIds.length) return [];
    [projectRows, confirmationRows] = await Promise.all([
      measureRouteStep(diagnostics, 'queue_projects', () => fetchRowsByIdChunks<Row>(activeProjectIds, (projectIds) =>
        supabase
          .from('projects')
          .select(ACTIVE_V2_COMMERCIAL_PROJECTS_SELECT)
          .in('id', projectIds)
          .is('archived_at', null)
          .order('id', { ascending: true }),
        { maxConcurrency: QUEUE_RELATED_READ_CONCURRENCY },
      )),
      measureRouteStep(diagnostics, 'queue_confirms', () => fetchRowsByIdChunks<Row>(activeProjectIds, (projectIds) =>
        supabase
          .from('project_confirmation_events')
          .select('id,project_id,event_kind,confirmation_type,retracts_event_id')
          .in('project_id', projectIds)
          .eq('confirmation_type', 'SITE_VISIT_COMPLETED'),
        { maxConcurrency: QUEUE_RELATED_READ_CONCURRENCY },
      )),
    ]);
  } else {
    [activeStateRows, projectRows, confirmationRows] = await Promise.all([
      measureRouteStep(diagnostics, 'queue_states', async () => {
        const result = await fetchAllPages<Row>((from, to) => supabase
          .from('project_operational_states')
          .select('project_id,state')
          .eq('state', 'ACTIVE')
          .order('project_id', { ascending: true })
          .range(from, to));
        if (result.truncated) {
          throw Object.assign(new Error('Active Project Work state inventory exceeded the authoritative read limit'), {
            code: 'PROJECT_WORK_INVENTORY_INCOMPLETE',
          });
        }
        return result.rows;
      }),
      measureRouteStep(diagnostics, 'queue_projects', async () => {
        const result = await fetchAllPages<Row>((from, to) => supabase
          .from('projects')
          .select(ACTIVE_V2_COMMERCIAL_PROJECTS_SELECT)
          .is('archived_at', null)
          .order('id', { ascending: true })
          .range(from, to));
        if (result.truncated) {
          throw Object.assign(new Error('Project Work commercial candidate inventory exceeded the authoritative read limit'), {
            code: 'PROJECT_WORK_INVENTORY_INCOMPLETE',
          });
        }
        return result.rows;
      }),
      measureRouteStep(diagnostics, 'queue_confirms', async () => {
        const result = await fetchAllPages<Row>((from, to) => supabase
          .from('project_confirmation_events')
          .select('id,project_id,event_kind,confirmation_type,retracts_event_id')
          .eq('confirmation_type', 'SITE_VISIT_COMPLETED')
          .order('id', { ascending: true })
          .range(from, to));
        if (result.truncated) {
          throw Object.assign(new Error('Project Work confirmation inventory exceeded the authoritative read limit'), {
            code: 'PROJECT_WORK_INVENTORY_INCOMPLETE',
          });
        }
        return result.rows;
      }),
    ]);
    const activeProjectIdSet = new Set(
      activeStateRows
        .map((row) => text(row.project_id))
        .filter((projectId): projectId is string => projectId !== null),
    );
    if (!activeProjectIdSet.size) return [];
    projectRows = projectRows.filter((row) => {
      const projectId = text(row.id);
      return projectId ? activeProjectIdSet.has(projectId) : false;
    });
    confirmationRows = confirmationRows.filter((row) => {
      const projectId = text(row.project_id);
      return projectId ? activeProjectIdSet.has(projectId) : false;
    });
  }

  return projectRows
    .map((row) => {
      const projectUuid = text(row.id);
      return domainCandidateFromProjectRow(
        row,
        projectUuid ? hasActiveProjectConfirmation(confirmationRows, projectUuid, 'SITE_VISIT_COMPLETED') : false,
      );
    })
    .filter((candidate): candidate is ActiveProjectDomainCandidate => candidate !== null);
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
  return (
    entry.actionKind === 'recovery' ||
    entry.actionKind === 'stateReview' ||
    entry.priority === 'CRITICAL' ||
    entry.group === 'overdue' ||
    entry.group === 'today' ||
    entry.group === 'blocked'
  );
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
  for (const rawEntry of params.durableEntries) {
    // The rollout cancels expected legacy rows. Mask any stale, manually
    // prohibited, or partially rolled-out selection instead of exposing its
    // identity or choosing a replacement in presentation code.
    const entry = maskRetiredQueueEntry(rawEntry);
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
        sourceKey: recoveryAction.key,
        actionLabel: recoveryAction.actionLabel ?? 'Review recovery',
        href: recoveryAction.href ?? projectActivityHref(project.projectId),
      });
      continue;
    }
    if (
      specialistAction &&
      (!existing || !durableActionIsProtected(existing)) &&
      (!existing || existing.actionKind === 'needsTriage' || existing.actionKind === 'workItem')
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
        sourceKey: specialistAction.key,
        actionLabel: specialistAction.actionLabel ?? 'Open workflow',
        href: specialistAction.href ?? projectActivityHref(project.projectId),
      });
    }
  }

  return [...byProject.values()].map(maskRetiredQueueEntry).sort(entryComparison).slice(0, params.limit);
}

async function loadDurableProjectWorkQueueRows(
  supabase: SupabaseClient,
  now: Date,
  projectUuids: readonly string[] | null = null,
): Promise<Row[]> {
  let result;
  try {
    result = await fetchAllPages<Row>((from, to) => {
      const query = supabase.rpc('project_work_queue_v3', {
        p_now: now.toISOString(),
        p_limit: MAX_LIST_FETCH_ROWS,
      });
      const scoped = projectUuids?.length ? query.in('project_id', [...projectUuids]) : query;
      return scoped.range(from, to);
    });
  } catch (error) {
    if (error instanceof Error) throw error;
    if (isRecord(error)) {
      throw Object.assign(new Error(text(error.message) ?? 'Failed to load project work queue'), error);
    }
    throw new Error('Failed to load project work queue');
  }

  if (result.truncated) {
    throw new Error(`Project work queue exceeded the safe ${MAX_LIST_FETCH_ROWS}-row fetch limit`);
  }
  return result.rows;
}

async function assertProjectWorkPortfolioComplete(supabase: SupabaseClient): Promise<void> {
  const result = await supabase.rpc('staff_project_state_counts_v1');
  if (result.error) {
    const message = text(result.error.message) ?? 'Project Work portfolio state is unavailable';
    const rolloutIncomplete = /PROJECT_WORK_ROLLOUT_INCOMPLETE/i.test(message);
    throw Object.assign(new Error(message), result.error, {
      code: rolloutIncomplete ? 'PROJECT_WORK_INVENTORY_INCOMPLETE' : result.error.code,
    });
  }
  const payload = isRecord(result.data) ? result.data : null;
  const totalCount = payload?.totalCount;
  if (typeof totalCount !== 'number' || !Number.isFinite(totalCount) || totalCount < 0) {
    throw Object.assign(new Error('Project Work portfolio state count is malformed'), {
      code: 'PROJECT_WORK_INVENTORY_INCOMPLETE',
    });
  }
}

export async function getAuthoritativeProjectWorkQueue(
  supabase: SupabaseClient,
  options: {
    now?: Date;
    limit?: number;
    projectIds?: readonly string[];
    diagnostics?: PortalServerLogContext | null;
  } = {},
): Promise<{ entries: ProjectWorkQueueEntry[]; generatedAt: string }> {
  const now = options.now ?? new Date();
  const projectUuids = options.projectIds
    ? Array.from(new Set(options.projectIds.map((projectId) => uuidFromAppId(projectId, 'proj')))).sort()
    : null;
  if (projectUuids && projectUuids.length === 0) {
    await assertProjectWorkPortfolioComplete(supabase);
    return { entries: [], generatedAt: now.toISOString() };
  }
  const limit = Math.min(
    MAX_LIST_FETCH_ROWS,
    Math.max(1, options.limit ?? projectUuids?.length ?? MAX_LIST_FETCH_ROWS),
  );
  const [durableRows, domainCandidates] = await Promise.all([
    measureRouteStep(options.diagnostics, 'queue_durable', () => loadDurableProjectWorkQueueRows(supabase, now, projectUuids)),
    loadActiveProjectDomainCandidates(supabase, projectUuids, options.diagnostics),
    measureRouteStep(options.diagnostics, 'queue_counts', () => assertProjectWorkPortfolioComplete(supabase)),
  ]);
  const durableEntries = rows(durableRows).map(mapDurableQueueRow);
  return {
    entries: composeProjectWorkQueue({
      durableEntries,
      domainCandidates,
      limit,
    }),
    generatedAt: now.toISOString(),
  };
}
