import type { ProjectStatus as CoreProjectStatus } from '@/lib/types/project';

export type QueueMode = 'today' | 'next7' | 'alldue';

export type ProjectStatus = CoreProjectStatus;

type DashboardAttentionKey =
  | 'overdue'
  | 'due_today'
  | 'projects_in_quoting';

type DashboardAttentionTone = 'urgent' | 'warning' | 'neutral';

interface DashboardKpis {
  actionsDue: number; // today + overdue
  newLeads: number; // status=NEW
  quotesToSend: number; // legacy snapshot key: projects in QUOTING, not quote readiness
  installsThisWeek: number; // retained API contract; intentionally not rendered on Dashboard
}

export interface DashboardAttentionItem {
  key: DashboardAttentionKey;
  label: string;
  count: number;
  href: string;
  tone: DashboardAttentionTone;
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

export interface DashboardRecentEstimate {
  estimateId: string;
  projectId: string;
  projectName: string;
  versionLabel: string;
  status: 'draft';
  customerPriceIncGst: number | null;
  updatedAt: string;
  href: string;
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
  attention: DashboardAttentionItem[];
  workQueue: WorkQueueItem[];
  schedule: ScheduleSnapshot;
  siteVisits: SiteVisitsSnapshot;
  pipelineCounts: PipelineCounts;
  recentEstimates: DashboardRecentEstimate[];
  recentActivity: DashboardRecentActivityItem[];
  personalTasks: DashboardPersonalTask[];
}
