export type Installer = {
  id: string;
  name: string;
  color: string; // hex
  active: boolean;
  availableFrom?: string; // YYYY-MM-DD
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
