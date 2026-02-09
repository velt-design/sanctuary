import type { ProjectStatus as CoreProjectStatus } from '@/lib/types/project';

export type QueueMode = 'today' | 'next7' | 'alldue';

export type ProjectStatus = CoreProjectStatus;

export type AttentionKey =
  | 'overdue'
  | 'due_today'
  | 'unscheduled_approved'
  | 'site_visits_to_book'
  | 'quotes_to_send'
  | 'email_failures';

export type Severity = 'high' | 'medium' | 'low';

export interface DashboardKpis {
  actionsDue: number; // today + overdue
  newLeads: number; // status=NEW
  quotesToSend: number; // TODO: wire to quotes/estimates when available
  installsThisWeek: number; // scheduled start in next 7 days
}

export interface AttentionItem {
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

export interface ScheduleStartingItem {
  startDate: string; // YYYY-MM-DD
  crewName: string;
  projectId: string;
  projectName: string;
  durationDays?: number | null;
}

export interface CrewAvailabilityItem {
  crewName: string;
  nextAvailableDate?: string | null; // YYYY-MM-DD
}

export interface ScheduleSnapshot {
  startingSoon: ScheduleStartingItem[]; // next 7 days
  crewAvailability: CrewAvailabilityItem[]; // all crews
  hrefBoard: string;
  hrefGantt: string;
}

export interface SiteVisitItem {
  id: string;
  startsAt: string; // ISO
  projectId?: string | null;
  projectName?: string | null;
  clientName?: string | null;
  assignedTo?: string | null;
  locationLabel?: string | null;
}

export interface SiteVisitsSnapshot {
  unscheduledCount: number;
  today: SiteVisitItem[];
  next7: SiteVisitItem[];
  hrefSiteVisits: string;
}

export type PipelineCounts = Record<string, number>;

export interface ActivityItem {
  at: string; // ISO
  label: string; // "Quote sent"
  projectId?: string;
  projectName?: string;
  href?: string;
}

export interface DashboardData {
  updatedAtIso: string;
  kpis: DashboardKpis;
  attention: AttentionItem[];
  workQueue: WorkQueueItem[];
  schedule: ScheduleSnapshot;
  siteVisits: SiteVisitsSnapshot;
  pipelineCounts: PipelineCounts;
  recentActivity?: ActivityItem[];
}
