import type { ProjectStatus as CoreProjectStatus } from '@/lib/types/project';

export type QueueMode = 'today' | 'next7' | 'alldue';

export type ProjectStatus = CoreProjectStatus;

type AttentionKey =
  | 'overdue'
  | 'due_today'
  | 'unscheduled_estimates'
  | 'site_visits_to_book'
  | 'quotes_to_send'
  | 'email_failures';

type Severity = 'high' | 'medium' | 'low';

export interface DashboardKpis {
  actionsDue: number; // today + overdue
  newLeads: number; // status=NEW
  quotesToSend: number; // TODO: wire to quotes/estimates when available
  installsThisWeek: number; // scheduled start in next 7 days
}

interface AttentionItem {
  key: AttentionKey;
  label: string;
  count: number;
  href: string;
  severity: Severity;
  helperText?: string;
}

export interface WorkQueueItem {
  projectId: string;
  projectName: string;
  clientName?: string | null;
  status: ProjectStatus | string;
  nextActionLabel?: string | null;
  nextActionDueDate?: string | null; // YYYY-MM-DD
  lastActivityAt?: string | null; // ISO
}

interface ScheduleStartingItem {
  startDate: string; // YYYY-MM-DD
  crewName: string;
  projectId: string;
  projectName: string;
  durationDays?: number | null;
}

interface CrewAvailabilityItem {
  crewName: string;
  nextAvailableDate?: string | null; // YYYY-MM-DD
}

interface ScheduleSnapshot {
  startingSoon: ScheduleStartingItem[]; // next 7 days
  crewAvailability: CrewAvailabilityItem[]; // all crews
  hrefBoard: string;
  hrefGantt: string;
}

interface SiteVisitItem {
  id: string;
  startsAt: string; // ISO
  projectId?: string | null;
  projectName?: string | null;
  clientName?: string | null;
  assignedTo?: string | null;
  locationLabel?: string | null;
}

interface SiteVisitsSnapshot {
  unscheduledCount: number;
  today: SiteVisitItem[];
  next7: SiteVisitItem[];
  hrefSiteVisits: string;
}

export type PipelineCounts = Record<string, number>;

export interface DashboardRecentActivityItem {
  id: string;
  type: 'project_note';
  at: string; // ISO
  body: string;
  projectId: string;
  projectName: string;
  authorDisplayName?: string | null;
  authorEmail?: string | null;
  href: string;
}

export interface DashboardPersonalTask {
  id: string;
  title: string;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardData {
  updatedAtIso: string;
  kpis: DashboardKpis;
  attention: AttentionItem[];
  workQueue: WorkQueueItem[];
  schedule: ScheduleSnapshot;
  siteVisits: SiteVisitsSnapshot;
  pipelineCounts: PipelineCounts;
  recentActivity: DashboardRecentActivityItem[];
  personalTasks: DashboardPersonalTask[];
}
