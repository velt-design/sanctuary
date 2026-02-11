import { describe, expect, it } from 'vitest';
import { buildWorkingDayIndex } from './workingDays';
import { recomputeCrewSchedule, type CrewScheduleItem, type ScheduledJob } from './recompute';

const calendar = buildWorkingDayIndex();
const crew = { id: 'crew_1', region: 'Auckland', baseAvailableDate: '2026-02-02' };

function buildJobs(jobs: ScheduledJob[]): Map<string, ScheduledJob> {
  return new Map(jobs.map((job) => [job.id, job]));
}

describe('scheduling.recompute', () => {
  it('ripples floating jobs downstream', () => {
    const items: CrewScheduleItem[] = [
      { id: 'item_1', crewId: crew.id, itemType: 'job', jobId: 'sj_1', position: 0 },
      { id: 'item_2', crewId: crew.id, itemType: 'job', jobId: 'sj_2', position: 1 },
    ];

    const jobs = buildJobs([
      { id: 'sj_1', jobId: 'proj_1', crewId: crew.id, mode: 'floating', forecastDurationDays: 2 },
      { id: 'sj_2', jobId: 'proj_2', crewId: crew.id, mode: 'floating', forecastDurationDays: 1 },
    ]);

    const res = recomputeCrewSchedule({
      crew,
      items,
      jobsById: jobs,
      downtimesById: new Map(),
      today: '2026-02-02',
      calendar,
    });

    const job1 = res.job_updates.find((j) => j.id === 'sj_1')!;
    const job2 = res.job_updates.find((j) => j.id === 'sj_2')!;
    expect(job1.forecast_start).toBe('2026-02-02');
    expect(job1.forecast_end_exclusive).toBe('2026-02-04');
    expect(job2.forecast_start).toBe('2026-02-04');

    jobs.set('sj_1', { ...jobs.get('sj_1')!, forecastDurationDays: 3 });
    const res2 = recomputeCrewSchedule({
      crew,
      items,
      jobsById: jobs,
      downtimesById: new Map(),
      today: '2026-02-02',
      calendar,
    });
    const job2b = res2.job_updates.find((j) => j.id === 'sj_2')!;
    expect(job2b.forecast_start).toBe('2026-02-05');
  });

  it('flags pinned collisions', () => {
    const items: CrewScheduleItem[] = [
      { id: 'item_1', crewId: crew.id, itemType: 'job', jobId: 'sj_1', position: 0 },
      { id: 'item_2', crewId: crew.id, itemType: 'job', jobId: 'sj_2', position: 1 },
    ];

    const jobs = buildJobs([
      { id: 'sj_1', jobId: 'proj_1', crewId: crew.id, mode: 'floating', forecastDurationDays: 2 },
      { id: 'sj_2', jobId: 'proj_2', crewId: crew.id, mode: 'pinned', forecastStart: '2026-02-02', forecastDurationDays: 1 },
    ]);

    const res = recomputeCrewSchedule({
      crew,
      items,
      jobsById: jobs,
      downtimesById: new Map(),
      today: '2026-02-02',
      calendar,
    });

    expect(res.conflicts).toHaveLength(1);
    expect(res.conflicts[0]).toMatchObject({
      job_id: 'sj_2',
      type: 'pinned_collision',
      expected_cursor_start: '2026-02-04',
      pinned_start: '2026-02-02',
      overlap_days: 2,
    });
  });

  it('shifts downstream jobs when downtimes are inserted', () => {
    const items: CrewScheduleItem[] = [
      { id: 'item_1', crewId: crew.id, itemType: 'job', jobId: 'sj_1', position: 0 },
      { id: 'item_2', crewId: crew.id, itemType: 'downtime', downtimeId: 'dt_1', position: 1 },
      { id: 'item_3', crewId: crew.id, itemType: 'job', jobId: 'sj_2', position: 2 },
    ];

    const jobs = buildJobs([
      { id: 'sj_1', jobId: 'proj_1', crewId: crew.id, mode: 'floating', forecastDurationDays: 1 },
      { id: 'sj_2', jobId: 'proj_2', crewId: crew.id, mode: 'floating', forecastDurationDays: 1 },
    ]);

    const res = recomputeCrewSchedule({
      crew,
      items,
      jobsById: jobs,
      downtimesById: new Map([
        ['dt_1', { id: 'dt_1', crewId: crew.id, durationDays: 2, reason: 'weather' }],
      ]),
      today: '2026-02-02',
      calendar,
    });

    const job2 = res.job_updates.find((j) => j.id === 'sj_2')!;
    expect(job2.forecast_start).toBe('2026-02-05');
  });

  it('snaps pinned starts that land on non-working days', () => {
    const items: CrewScheduleItem[] = [
      { id: 'item_1', crewId: crew.id, itemType: 'job', jobId: 'sj_1', position: 0 },
    ];

    const jobs = buildJobs([
      { id: 'sj_1', jobId: 'proj_1', crewId: crew.id, mode: 'pinned', forecastStart: '2026-02-07', forecastDurationDays: 1 },
    ]);

    const res = recomputeCrewSchedule({
      crew,
      items,
      jobsById: jobs,
      downtimesById: new Map(),
      today: '2026-02-02',
      calendar,
    });

    const job1 = res.job_updates.find((j) => j.id === 'sj_1')!;
    expect(job1.forecast_start).toBe('2026-02-09');
  });
});
