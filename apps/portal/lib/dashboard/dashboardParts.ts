import type { DashboardData } from './types';
import { scheduleHref, siteVisitsHref } from './links';
import { appIdFromUuid } from '@/lib/supabase/mappers';

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

export type SnapshotData = {
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

export type DashboardParts = {
  snapshot: Pick<DashboardData, 'updatedAtIso' | 'kpis' | 'schedule' | 'siteVisits'>;
  recentEstimates: Pick<DashboardData, 'recentEstimates'>;
  recentActivity: Pick<DashboardData, 'recentActivity'>;
  personalTasks: Pick<DashboardData, 'personalTasks'>;
  projectWorkQueue: Pick<DashboardData, 'projectWorkQueue' | 'projectWorkQueueAvailable'>;
  projectStateCounts: Pick<DashboardData, 'projectStateCounts' | 'projectStateCountsAvailable'>;
  pipelineCounts: Pick<DashboardData, 'pipelineCounts' | 'pipelineCountsAvailable' | 'pipelineCountsScope'>;
};
export const dashboardPartNames = ['snapshot','recentEstimates','recentActivity','personalTasks','projectWorkQueue','projectStateCounts','pipelineCounts'] as const;
export function assembleDashboard(parts: DashboardParts): DashboardData {
  return Object.assign({}, ...dashboardPartNames.map(name => parts[name]));
}
export function dashboardSnapshotPart(snapshot: SnapshotData): DashboardParts['snapshot'] {
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

  return {
    updatedAtIso: asString(snapshot?.updated_at) || new Date().toISOString(),
    kpis: {
      newLeads: asNumber(kpis.new_leads),
      quotesToSend: asNumber(kpis.quotes_to_send),
      installsThisWeek: asNumber(kpis.installs_this_week),
    },
    schedule,
    siteVisits,
  };
}

export const DASHBOARD_READ_MAX_BYTES = 4 * 1024 * 1024;
