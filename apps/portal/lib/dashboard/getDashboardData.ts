import type { SupabaseClient } from '@supabase/supabase-js';
import type { DashboardData, QueueMode } from './types';
import { scheduleHref, siteVisitsHref } from './links';
import { appIdFromUuid } from '@/lib/supabase/mappers';
import { getDashboardSnapshotCached } from './getDashboardSnapshotCached';
import { supabaseServiceRole } from '@/lib/supabaseClient';
import { listRecentProjectNoteActivity } from './activity';
import { listVisibleDashboardTasks } from './tasks';
import { listDashboardRecentEstimates } from './operationalLists';
import { getProjectWorkQueue } from '@/lib/projects/workItems/repository';

type SnapshotKpis = {
  new_leads?: number;
  quotes_to_send?: number;
  installs_this_week?: number;
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
  pipeline_counts?: Record<string, number> | null;
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

export async function getDashboardData(opts: {
  queueMode: QueueMode;
  userId?: string | null;
  supabase?: SupabaseClient | null;
}): Promise<DashboardData> {
  const [snapshot, recentEstimates, recentActivity, personalTasks, projectWorkQueue] = await Promise.all([
    getDashboardSnapshotCached(opts.queueMode) as Promise<SnapshotData>,
    listDashboardRecentEstimates(supabaseServiceRole),
    listRecentProjectNoteActivity(supabaseServiceRole, 8),
    opts.userId ? listVisibleDashboardTasks(supabaseServiceRole, opts.userId) : Promise.resolve([]),
    opts.supabase
      ? getProjectWorkQueue(opts.supabase, { limit: 5 }).catch(() => null)
      : Promise.resolve(null),
  ]);

  const kpis = snapshot?.kpis ?? {};

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
      newLeads: asNumber(kpis.new_leads),
      quotesToSend: asNumber(kpis.quotes_to_send),
      installsThisWeek: asNumber(kpis.installs_this_week),
    },
    projectWorkQueue: projectWorkQueue?.entries ?? [],
    projectWorkQueueAvailable: projectWorkQueue !== null,
    schedule,
    siteVisits,
    pipelineCounts,
    recentEstimates,
    recentActivity,
    personalTasks,
  };
}
