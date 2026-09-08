import { describe, expect, it } from 'vitest';
import { recomputeCrewSchedule, type ScheduledJob } from './recompute';
import { buildWorkingDayIndex } from './workingDays';

const crew = { id: 'crew', region: 'Auckland' };
function compute(jobs: Array<Partial<ScheduledJob> & { id: string }>, today = '2026-09-08', preserveSaved = false) {
  return recomputeCrewSchedule({
    crew, today, preserveSaved, calendar: buildWorkingDayIndex(), downtimesById: new Map(),
    items: jobs.map((job, position) => ({ id: `item-${job.id}`, crewId: crew.id, itemType: 'job', jobId: job.id, position })),
    jobsById: new Map(jobs.map((job) => [job.id, {
      jobId: job.id, crewId: crew.id, mode: 'floating', forecastDurationDays: 2, status: 'not_started', ...job,
    }])),
  });
}

describe('authored Schedule dates', () => {
  it('does not extend started work or move the queue when only the clock advances', () => {
    const jobs = [
      { id: 'started', mode: 'pinned' as const, status: 'in_progress' as const, actualStart: '2026-09-03', forecastStart: '2026-09-03', forecastDurationDays: 5, daysRemaining: 2 },
      { id: 'next', forecastStart: '2026-09-10' },
    ];
    expect(compute(jobs, '2026-09-09')).toEqual(compute(jobs, '2026-09-08'));
    expect(compute(jobs).conflicts).toEqual([]);
  });
  it('does not move an overdue floating job to today', () => {
    const jobs = [{ id: 'overdue', forecastStart: '2026-09-01' }];
    expect(compute(jobs, '2026-09-09').blocks[0].start).toBe('2026-09-01');
  });
  it('preserves the saved dates and gaps on reads', () => {
    const result = compute([{ id: 'first', forecastStart: '2026-09-08' }, { id: 'second', forecastStart: '2026-09-21' }], '2026-09-09', true);
    expect(result.blocks.map((block) => block.start)).toEqual(['2026-09-08', '2026-09-21']);
  });
  it('does not call non-overlapping fixed jobs a conflict because of Board order', () => {
    const result = compute([
      { id: 'later', mode: 'pinned', forecastStart: '2026-09-30', forecastDurationDays: 4 },
      { id: 'earlier', mode: 'pinned', forecastStart: '2026-09-21', forecastDurationDays: 7 },
    ]);
    expect(result.conflicts).toEqual([]);
    expect(result.blocks.map((block) => block.start)).toEqual(['2026-09-30', '2026-09-21']);
  });
  it('places flexible work around fixed intervals even when it comes first in the queue', () => {
    const result = compute([
      { id: 'flexible', forecastStart: '2026-09-08', forecastDurationDays: 10 },
      { id: 'fixed', mode: 'pinned', forecastStart: '2026-09-10' },
    ]);
    expect(result.blocks.map((block) => block.start)).toEqual(['2026-09-14', '2026-09-10']);
    expect(result.conflicts).toEqual([]);
  });
  it('identifies the other job and only the actual shared working days for a fixed overlap', () => {
    const result = compute([
      { id: 'first', mode: 'pinned', forecastStart: '2026-09-08', forecastDurationDays: 4 },
      { id: 'second', mode: 'pinned', forecastStart: '2026-09-10', forecastDurationDays: 4 },
    ]);
    expect(result.conflicts).toEqual([expect.objectContaining({ job_id: 'second', conflicting_job_id: 'first', overlap_days: 2 })]);
    expect(result.blocks.map((block) => block.start)).toEqual(['2026-09-08', '2026-09-10']);
  });
  it('preserves recorded actual start and finish even when they fall on a weekend', () => {
    const result = compute([{ id: 'done', status: 'done', actualStart: '2026-09-05', actualFinish: '2026-09-06' }]);
    expect(result.blocks[0]).toMatchObject({ start: '2026-09-05', end_exclusive: '2026-09-07' });
  });
  it('keeps an accepted overlap quiet until either date interval changes', () => {
    const jobs: Array<Partial<ScheduledJob> & { id: string }> = [
      { id: 'first', mode: 'pinned', forecastStart: '2026-09-08', forecastDurationDays: 4 },
      { id: 'second', mode: 'pinned', forecastStart: '2026-09-10', forecastDurationDays: 4 },
    ];
    const key = compute(jobs).conflicts[0].overlap_key!;
    jobs[1].acceptedOverlaps = [key];
    expect(compute(jobs).conflicts).toEqual([]);
    jobs[0].forecastDurationDays = 5;
    expect(compute(jobs).conflicts).toHaveLength(1);
    expect(compute(jobs).conflicts[0].overlap_key).not.toBe(key);
  });
});
