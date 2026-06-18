import type { ScheduleItem } from '@/lib/types/scheduling';

export type SchedulableJob = {
  id: string;
  projectId: string;
  estimateId: string;
  projectName: string;
  descriptor: string;
  status: string;
  durationHours: number;
  durationLabel: string;
  durationTitle: string;
  warnings: string[];
};

export type ScheduleBoardModel = {
  schedulable: {
    jobsById: Map<string, SchedulableJob>;
    unscheduledJobs: SchedulableJob[];
    debug: Record<string, any>;
    blockingProjectIds: Set<string>;
  };
  unscheduledJobsAll: SchedulableJob[];
  unscheduledJobs: SchedulableJob[];
  laneItems: Map<string, ScheduleItem[]>;
};

