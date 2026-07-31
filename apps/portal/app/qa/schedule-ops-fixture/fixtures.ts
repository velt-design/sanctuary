import type { ScheduleProjectSummary } from '@/lib/queries/schedule';
import { addDaysYmd } from '@/lib/scheduling/date';
import { WORK_HOURS_PER_DAY } from '@/lib/scheduling/duration';
import type { Installer, ScheduleItem, SchedulingIssue } from '@/lib/types/scheduling';
import type { ScheduleBoardModel, SchedulableJob } from '@/app/staff/schedule/ScheduleClientModel';
import type { ScheduleGanttBar } from '@/app/staff/schedule/ScheduleGanttModel';

type ScheduleOpsFixture = {
  today: string;
  installers: Installer[];
  jobsById: Map<string, SchedulableJob>;
  unscheduledJobs: SchedulableJob[];
  laneItems: Map<string, ScheduleItem[]>;
  scheduleItemById: Map<string, ScheduleItem>;
  barsByScheduleId: Map<string, { startDate: string; endDate: string }>;
  projectsById: Map<string, ScheduleProjectSummary>;
  scheduleBars: ScheduleGanttBar[];
  scheduleIssues: SchedulingIssue[];
  nextAvailableByInstallerId: Map<string, string>;
};

const CREW_COLORS = [
  '#0f766e',
  '#1d4ed8',
  '#7c3aed',
  '#b45309',
  '#be123c',
  '#047857',
  '#0369a1',
  '#6d28d9',
  '#a16207',
] as const;

const CUSTOMER_NAMES = [
  'Alex and Morgan Te Rangi',
  'Harbourview Early Learning Centre Incorporated',
  'Priya Shah',
  'Samuel and Olivia Thompson',
  'North Shore Community Housing Trust',
] as const;

const SITE_ADDRESSES = [
  '128A Te Atatu Road, Te Atatu South, Auckland 0610',
  'Unit 14, 227 Great South Road, Greenlane, Auckland 1051',
  '42 Harbour View Crescent, Birkenhead, Auckland 0626',
  '7 Kowhai Lane, Warkworth 0910',
  '19B Dominion Road, Mount Eden, Auckland 1024',
] as const;

function projectNameFor(index: number): string {
  if (index === 0) {
    return 'Architectural Louvre Pergola with Integrated Screens and Multi-Zone Lighting';
  }
  return `${index % 3 === 0 ? 'Louvre' : index % 3 === 1 ? 'Canopy' : 'Outdoor room'} ${String(index + 1).padStart(3, '0')}`;
}

function identityFor(index: number) {
  const customerName = CUSTOMER_NAMES[index % CUSTOMER_NAMES.length];
  const siteAddress = SITE_ADDRESSES[index % SITE_ADDRESSES.length];
  return {
    customerName,
    siteAddress,
    identityDetail: `${customerName} · ${siteAddress}`,
  };
}

function makeJob(index: number, scheduled: boolean): SchedulableJob {
  const projectId = `fixture-project-${index}`;
  const estimateId = `fixture-estimate-${index}`;
  const id = scheduled ? `fixture-schedule-${index}` : `fixture-unscheduled-${index}`;
  const projectName = projectNameFor(index);
  const identity = identityFor(index);
  const durationDays = 1 + (index % 5);
  return {
    id,
    projectId,
    estimateId,
    projectName,
    ...identity,
    searchText: `${projectName} ${identity.customerName} ${identity.siteAddress}`.toLowerCase(),
    descriptor: '',
    status: 'DEPOSIT',
    durationHours: durationDays * WORK_HOURS_PER_DAY,
    durationLabel: `${durationDays}d`,
    durationTitle: `${durationDays * WORK_HOURS_PER_DAY}h`,
    warnings: index % 17 === 0 ? ['Review sequencing'] : [],
  };
}

export function createScheduleOpsFixture(scale: 'standard' | 'large'): ScheduleOpsFixture {
  const today = '2026-07-31';
  const scheduledCount = scale === 'large' ? 108 : 18;
  const installers: Installer[] = Array.from({ length: 9 }, (_, index) => ({
    id: `fixture-crew-${index + 1}`,
    name: index === 8 ? 'Northern Install Crew with Extended Operational Name' : `Install Crew ${index + 1}`,
    color: CREW_COLORS[index],
    active: true,
    sortOrder: index,
    calendarRegion: 'Auckland',
    baseAvailableDate: addDaysYmd(today, index),
  }));
  const jobsById = new Map<string, SchedulableJob>();
  const laneItems = new Map(installers.map((installer) => [installer.id, [] as ScheduleItem[]]));
  const scheduleItemById = new Map<string, ScheduleItem>();
  const barsByScheduleId = new Map<string, { startDate: string; endDate: string }>();
  const projectsById = new Map<string, ScheduleProjectSummary>();
  const scheduleBars: ScheduleGanttBar[] = [];
  const scheduleIssues: SchedulingIssue[] = [];

  for (let index = 0; index < scheduledCount; index += 1) {
    const job = makeJob(index, true);
    const crew = installers[index % installers.length];
    const lanePosition = Math.floor(index / installers.length);
    const durationDays = 1 + (index % 5);
    const startDate = addDaysYmd(today, lanePosition * 3 + (index % 4 === 0 ? 0 : 1));
    const endDate = addDaysYmd(startDate, durationDays - 1);
    const endExclusive = addDaysYmd(endDate, 1);
    const item: ScheduleItem = {
      id: job.id,
      projectId: job.projectId,
      estimateId: job.estimateId,
      installerId: crew.id,
      sortIndex: lanePosition,
      scheduleStatus: index % 7 === 0 ? 'CONFIRMED' : 'TENTATIVE',
      locked: index % 7 === 0,
      itemType: 'job',
      forecastStart: startDate,
      forecastEndExclusive: endExclusive,
      forecastDurationDays: durationDays,
      durationHoursOverride: durationDays * WORK_HOURS_PER_DAY,
      mode: index % 6 === 0 ? 'pinned' : 'floating',
      jobStatus: index % 11 === 0 ? 'in_progress' : 'not_started',
      plannedCommitmentType: index % 8 === 0 ? 'fixed_date' : null,
      plannedStart: index % 8 === 0 ? addDaysYmd(startDate, -3) : null,
      plannedDurationDays: index % 8 === 0 ? durationDays : null,
      plannedFlexDays: index % 8 === 0 ? 1 : null,
      driftDays: index % 8 === 0 ? 3 : null,
      clientUpdateStatus: index % 13 === 0 ? 'needed' : 'none',
      updatedAt: '2026-07-31T00:00:00.000Z',
    };
    jobsById.set(job.id, job);
    laneItems.get(crew.id)?.push(item);
    scheduleItemById.set(item.id, item);
    barsByScheduleId.set(item.id, { startDate, endDate });
    projectsById.set(job.projectId, {
      id: job.projectId,
      projectName: job.projectName,
      name: job.projectName,
      customerName: job.customerName,
      siteAddress: job.siteAddress,
      status: job.status,
      nextActionDate: null,
      followUpDate: null,
    });
    scheduleBars.push({
      scheduleItemId: item.id,
      installerId: crew.id,
      projectId: job.projectId,
      estimateId: job.estimateId,
      projectName: job.projectName,
      status: job.status,
      startDate,
      endDate,
      durationHours: job.durationHours,
    });
    if (index % 13 === 0) {
      scheduleIssues.push({
        scheduleItemId: item.id,
        projectId: item.projectId,
        estimateId: item.estimateId,
        level: index % 26 === 0 ? 'error' : 'warning',
        message: index % 26 === 0 ? 'Pinned work overlaps another job' : 'Crew sequence needs review',
      });
    }
  }

  const unscheduledJobs = Array.from({ length: 12 }, (_, offset) =>
    makeJob(scheduledCount + offset, false),
  );
  for (const job of unscheduledJobs) jobsById.set(job.id, job);

  return {
    today,
    installers,
    jobsById,
    unscheduledJobs,
    laneItems,
    scheduleItemById,
    barsByScheduleId,
    projectsById,
    scheduleBars,
    scheduleIssues,
    nextAvailableByInstallerId: new Map(
      installers.map((installer, index) => [installer.id, addDaysYmd(today, 21 + index)]),
    ),
  };
}

export function boardModelForFixture(fixture: ScheduleOpsFixture): ScheduleBoardModel {
  return {
    schedulable: {
      jobsById: fixture.jobsById,
      unscheduledJobs: fixture.unscheduledJobs,
      debug: {
        totalProjects: fixture.jobsById.size,
        schedulableProjects: fixture.jobsById.size,
        unscheduledJobs: fixture.unscheduledJobs.length,
        excluded: {
          noEstimates: 0,
          noSchedulableEstimate: 0,
          alreadyScheduled: fixture.scheduleItemById.size,
        },
        scheduleItems: {
          total: fixture.scheduleItemById.size,
          blocking: 0,
          missingProject: 0,
          missingEstimate: 0,
          estimateNotSchedulable: 0,
        },
      },
      blockingProjectIds: new Set(),
    },
    unscheduledJobsAll: fixture.unscheduledJobs,
    unscheduledJobs: fixture.unscheduledJobs,
    laneItems: fixture.laneItems,
  };
}
