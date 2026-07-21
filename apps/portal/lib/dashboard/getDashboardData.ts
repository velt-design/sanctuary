import type { DashboardAttentionItem, DashboardData, QueueMode, WorkQueueItem } from './types';
import { projectsHref, scheduleHref, siteVisitsHref } from './links';
import { appIdFromUuid } from '@/lib/supabase/mappers';
import { getDashboardSnapshotCached } from './getDashboardSnapshotCached';
import { supabaseServiceRole } from '@/lib/supabaseClient';
import { listRecentProjectNoteActivity } from './activity';
import { listVisibleDashboardTasks } from './tasks';
import { listDashboardNewLeads, listDashboardRecentEstimates } from './operationalLists';

type SnapshotKpis = {
  actions_due?: number;
  new_leads?: number;
  quotes_to_send?: number;
  installs_this_week?: number;
};

type SnapshotAttention = {
  overdue_actions?: number;
  due_today?: number;
  unscheduled_estimates?: number;
  unscheduled_approved?: number;
  site_visits_to_book?: number;
  quotes_to_send?: number;
  email_failures?: number;
  oldest_overdue_days?: number | null;
};

type SnapshotWorkQueueRow = {
  project_id?: string | null;
  project_name?: string | null;
  status?: string | null;
  next_action_label?: string | null;
  next_action_date?: string | null;
  last_activity_at?: string | null;
  client_name?: string | null;
};

type SnapshotScheduleStarting = {
  start_date?: string | null;
  duration_days?: number | string | null;
  crew_name?: string | null;
  project_id?: string | null;
  project_name?: string | null;
};

type SnapshotCrewAvailability = {
  crew_name?: string | null;
  next_available_date?: string | null;
};

type SnapshotSiteVisit = {
  id?: string | null;
  starts_at?: string | null;
  assigned_to?: string | null;
  location_label?: string | null;
  project_id?: string | null;
  project_name?: string | null;
  client_name?: string | null;
};

type SnapshotData = {
  updated_at?: string | null;
  kpis?: SnapshotKpis | null;
  attention_counts?: SnapshotAttention | null;
  pipeline_counts?: Record<string, number> | null;
  work_queue?: SnapshotWorkQueueRow[] | null;
  schedule?: {
    starting_soon?: SnapshotScheduleStarting[] | null;
    crew_next_available?: SnapshotCrewAvailability[] | null;
  } | null;
  site_visits?: {
    unscheduled_count?: number | null;
    today?: SnapshotSiteVisit[] | null;
    next7?: SnapshotSiteVisit[] | null;
  } | null;
};

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function toProjectId(value: unknown): string {
  const raw = typeof value === 'string' ? value : '';
  return raw ? appIdFromUuid('proj', raw) : '';
}

function toSiteVisitId(value: unknown): string {
  const raw = typeof value === 'string' ? value : '';
  return raw ? appIdFromUuid('sv', raw) : '';
}

export async function getDashboardData(opts: { queueMode: QueueMode; userId?: string | null }): Promise<DashboardData> {
  const [snapshot, newLeads, recentEstimates, recentActivity, personalTasks] = await Promise.all([
    getDashboardSnapshotCached(opts.queueMode) as Promise<SnapshotData>,
    listDashboardNewLeads(supabaseServiceRole),
    listDashboardRecentEstimates(supabaseServiceRole),
    listRecentProjectNoteActivity(supabaseServiceRole, 8),
    opts.userId ? listVisibleDashboardTasks(supabaseServiceRole, opts.userId) : Promise.resolve([]),
  ]);

  const kpis = snapshot?.kpis ?? {};
  const attentionCounts = snapshot?.attention_counts ?? {};
  const oldestOverdueDays = typeof attentionCounts.oldest_overdue_days === 'number' ? attentionCounts.oldest_overdue_days : null;

  const attention: DashboardAttentionItem[] = [
    {
      key: 'overdue',
      label: 'Project actions overdue',
      count: asNumber(attentionCounts.overdue_actions),
      tone: 'urgent',
      helperText: oldestOverdueDays ? `Oldest overdue: ${oldestOverdueDays} days` : undefined,
      href: projectsHref({ nextActionDue: true, due: 'overdue' }),
    },
    {
      key: 'due_today',
      label: 'Project actions due today',
      count: asNumber(attentionCounts.due_today),
      tone: 'warning',
      href: projectsHref({ nextActionDue: true, due: 'today' }),
    },
    {
      key: 'site_visits_to_book',
      label: 'Site visits to book',
      count: asNumber(attentionCounts.site_visits_to_book),
      tone: 'warning',
      href: siteVisitsHref(),
    },
    {
      key: 'projects_in_quoting',
      label: 'Projects in quoting',
      count: asNumber(attentionCounts.quotes_to_send),
      tone: 'neutral',
      href: projectsHref({ status: 'QUOTING' }),
    },
  ];

  const workQueue: WorkQueueItem[] = (snapshot?.work_queue ?? []).map((row) => ({
    projectId: toProjectId(row.project_id),
    projectName: asString(row.project_name) || 'Untitled',
    clientName: row.client_name ?? null,
    status: asString(row.status) || 'NEW',
    nextActionLabel: row.next_action_label ?? null,
    nextActionDueDate: row.next_action_date ?? null,
    lastActivityAt: row.last_activity_at ?? null,
  }));

  const schedule = {
    startingSoon: (snapshot?.schedule?.starting_soon ?? []).map((item) => ({
      startDate: asString(item.start_date),
      crewName: asString(item.crew_name) || 'Crew',
      projectId: toProjectId(item.project_id),
      projectName: asString(item.project_name) || 'Project',
      durationDays:
        typeof item.duration_days === 'number'
          ? item.duration_days
          : typeof item.duration_days === 'string' && item.duration_days.trim()
            ? Number(item.duration_days)
            : null,
    })),
    crewAvailability: (snapshot?.schedule?.crew_next_available ?? []).map((crew) => ({
      crewName: asString(crew.crew_name) || 'Crew',
      nextAvailableDate: crew.next_available_date ?? null,
    })),
    hrefBoard: scheduleHref('board'),
    hrefGantt: scheduleHref('gantt'),
  };

  const siteVisits = {
    unscheduledCount: asNumber(snapshot?.site_visits?.unscheduled_count),
    today: (snapshot?.site_visits?.today ?? []).map((visit) => ({
      id: toSiteVisitId(visit.id),
      startsAt: asString(visit.starts_at),
      assignedTo: visit.assigned_to ?? null,
      locationLabel: visit.location_label ?? null,
      projectId: toProjectId(visit.project_id),
      projectName: asString(visit.project_name) || 'Project',
      clientName: visit.client_name ?? null,
    })),
    next7: (snapshot?.site_visits?.next7 ?? []).map((visit) => ({
      id: toSiteVisitId(visit.id),
      startsAt: asString(visit.starts_at),
      assignedTo: visit.assigned_to ?? null,
      locationLabel: visit.location_label ?? null,
      projectId: toProjectId(visit.project_id),
      projectName: asString(visit.project_name) || 'Project',
      clientName: visit.client_name ?? null,
    })),
    hrefSiteVisits: siteVisitsHref(),
  };

  const pipelineCounts: Record<string, number> = {};
  for (const [key, value] of Object.entries(snapshot?.pipeline_counts ?? {})) {
    pipelineCounts[key] = asNumber(value);
  }

  return {
    updatedAtIso: asString(snapshot?.updated_at) || new Date().toISOString(),
    kpis: {
      actionsDue: asNumber(kpis.actions_due),
      newLeads: asNumber(kpis.new_leads),
      quotesToSend: asNumber(kpis.quotes_to_send),
      installsThisWeek: asNumber(kpis.installs_this_week),
    },
    attention,
    workQueue,
    schedule,
    siteVisits,
    pipelineCounts,
    newLeads,
    recentEstimates,
    recentActivity,
    personalTasks,
  };
}
