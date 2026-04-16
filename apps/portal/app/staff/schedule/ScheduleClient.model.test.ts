import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Installer, ScheduleItem } from '@/lib/types/scheduling';
import { buildScheduleBoardModelV2 } from './ScheduleBoardModelV2';
import type { SchedulableJob } from './ScheduleClientModel';

vi.mock('next/dynamic', () => ({
  default: () => () => null,
}));

const installers: Installer[] = [
  {
    id: 'crew_alpha',
    name: 'Crew Alpha',
    color: '#0f766e',
    active: true,
    sortOrder: 0,
  },
];

const visibleScheduleItems: ScheduleItem[] = [
  {
    id: 'sch_sched_1',
    projectId: 'proj_sched_1',
    estimateId: 'est_sched_1',
    installerId: 'crew_alpha',
    sortIndex: 0,
    itemType: 'job',
    forecastDurationDays: 2,
    updatedAt: '2026-04-03T00:00:00.000Z',
  },
];

const unscheduledJobsSeed: SchedulableJob[] = [
  {
    id: 'job_alpha',
    projectId: 'proj_alpha',
    estimateId: 'est_alpha',
    projectName: 'Alpha Deck',
    descriptor: 'Deck replacement',
    status: 'DEPOSIT_PAID',
    durationHours: 8,
    durationLabel: '1d',
    durationTitle: '8h',
    warnings: [],
  },
  {
    id: 'job_bravo',
    projectId: 'proj_bravo',
    estimateId: 'est_bravo',
    projectName: 'Bravo Pergola',
    descriptor: 'Pergola install',
    status: 'DEPOSIT_PAID',
    durationHours: 16,
    durationLabel: '2d',
    durationTitle: '16h',
    warnings: [],
  },
];

describe('buildScheduleBoardModelV2', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('filters the unscheduled board list without touching scheduled lane items', () => {
    const model = buildScheduleBoardModelV2({
      installers,
      orphanedScheduleItems: [],
      projects: [],
      projectsById: new Map(),
      query: 'alpha',
      scheduleItems: visibleScheduleItems,
      scheduleItemsRenderable: visibleScheduleItems,
      unscheduledJobsSeed,
      visibleScheduleItems,
    });

    expect(model.unscheduledJobsAll.map((job) => job.id)).toEqual(['job_alpha', 'job_bravo']);
    expect(model.unscheduledJobs.map((job) => job.id)).toEqual(['job_alpha']);
    expect(model.laneItems.get('crew_alpha')?.map((item) => item.id)).toEqual(['sch_sched_1']);
  });

  it('keeps empty installer lanes stable when there are no visible schedule items', () => {
    const model = buildScheduleBoardModelV2({
      installers,
      orphanedScheduleItems: [],
      projects: [],
      projectsById: new Map(),
      query: '',
      scheduleItems: [],
      scheduleItemsRenderable: [],
      unscheduledJobsSeed: [],
      visibleScheduleItems: [],
    });

    expect(model.unscheduledJobs).toEqual([]);
    expect(model.laneItems.get('crew_alpha')).toEqual([]);
  });

  it('uses the lightweight project summary to label scheduled V2 items', () => {
    const model = buildScheduleBoardModelV2({
      installers,
      orphanedScheduleItems: [],
      projects: [
        {
          id: 'proj_sched_1',
          projectName: 'Scheduled Pergola',
          name: 'Scheduled Pergola',
          status: 'DEPOSIT',
          nextActionDate: '2026-04-12',
          followUpDate: '2026-04-12',
        },
      ],
      projectsById: new Map([
        [
          'proj_sched_1',
          {
            id: 'proj_sched_1',
            projectName: 'Scheduled Pergola',
            name: 'Scheduled Pergola',
            status: 'DEPOSIT',
            nextActionDate: '2026-04-12',
            followUpDate: '2026-04-12',
          },
        ],
      ]),
      query: '',
      scheduleItems: visibleScheduleItems,
      scheduleItemsRenderable: visibleScheduleItems,
      unscheduledJobsSeed: [],
      visibleScheduleItems,
    });

    const scheduledJob = model.schedulable.jobsById.get('sch_sched_1');
    expect(scheduledJob).toEqual(
      expect.objectContaining({
        projectName: 'Scheduled Pergola',
        status: 'DEPOSIT',
        descriptor: 'Next: 2026-04-12',
      }),
    );
  });
});
