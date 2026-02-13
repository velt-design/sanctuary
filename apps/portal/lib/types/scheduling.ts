export type Installer = {
  id: string;
  name: string;
  color: string; // hex
  active: boolean;
  availableFrom?: string; // YYYY-MM-DD
  calendarRegion?: string | null;
  baseAvailableDate?: string | null;
  sortOrder: number;
};

export type ScheduleItemStatus = 'TENTATIVE' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED';

export type ScheduleItem = {
  id: string;

  projectId: string;
  estimateId: string;

  installerId: string;

  sortIndex: number;

  scheduleStatus?: ScheduleItemStatus;
  locked?: boolean;
  confirmedAt?: string | null; // ISO datetime
  confirmedBy?: string | null;
  actualStartDate?: string | null; // YYYY-MM-DD
  actualEndDate?: string | null; // YYYY-MM-DD

  startDateOverride?: string; // YYYY-MM-DD
  durationHoursOverride?: number;

  // Schedule v2 extensions (optional).
  itemType?: 'job' | 'downtime';
  scheduledJobId?: string;
  forecastStart?: string | null;
  forecastEndExclusive?: string | null;
  forecastDurationDays?: number | null;
  plannedCommitmentType?: 'week_of' | 'fixed_date' | null;
  plannedWeekStart?: string | null;
  plannedStart?: string | null;
  plannedDurationDays?: number | null;
  plannedFlexDays?: number | null;
  plannedLockedAt?: string | null;
  plannedLockedBy?: string | null;
  driftDays?: number | null;
  clientUpdateStatus?: 'none' | 'needed' | 'acknowledged' | null;
  clientUpdateNeededAt?: string | null;
  clientUpdateAckAt?: string | null;
  clientUpdateAckBy?: string | null;
  mode?: 'floating' | 'pinned';
  jobStatus?: 'not_started' | 'in_progress' | 'paused' | 'done' | null;
  daysRemaining?: number | null;
  downtimeId?: string | null;
  downtimeReason?: string | null;
  downtimeNote?: string | null;

  updatedAt: string; // ISO datetime
};

export type ScheduledBar = {
  scheduleItemId: string;
  installerId: string;
  projectId: string;
  estimateId: string;

  projectName: string;
  status: string;

  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD (inclusive)
  durationHours: number;
};

export type SchedulingIssue = {
  scheduleItemId?: string;
  projectId?: string;
  estimateId?: string;
  level: 'warning' | 'error';
  message: string;
};
