import { describe, expect, it } from 'vitest';
import { recomputeCrewSchedule, type ScheduledJob } from './recompute';
import { buildWorkingDayIndex } from './workingDays';

const calendar = buildWorkingDayIndex();
const crew = { id: 'crew', region: 'Auckland' };
const downtime = { id: 'delay', crewId: crew.id, durationDays: 2, createdAt: '2026-09-08T01:00:00Z' };
const items = [
  { id: 'delay-item', crewId: crew.id, itemType: 'downtime' as const, downtimeId: downtime.id, position: 0 },
  { id: 'job-item', crewId: crew.id, itemType: 'job' as const, jobId: 'job', position: 1 },
];
const job: ScheduledJob = { id: 'job', jobId: 'project', crewId: crew.id, mode: 'floating', forecastDurationDays: 2 };

describe('authored queue anchor', () => {
  it('keeps leading downtime and the saved job in place after a later refresh', () => {
    const first = recomputeCrewSchedule({ crew, items, jobsById: new Map([[job.id, job]]), downtimesById: new Map([[downtime.id, downtime]]), today: '2026-09-08', calendar });
    const saved = { ...job, forecastStart: first.job_updates[0].forecast_start, forecastEndExclusive: first.job_updates[0].forecast_end_exclusive };
    const later = recomputeCrewSchedule({ crew: { ...crew, anchorDate: first.anchor_date }, items, jobsById: new Map([[job.id, saved]]), downtimesById: new Map([[downtime.id, downtime]]), today: '2026-09-22', calendar, preserveSaved: true });
    expect(later.blocks).toEqual(first.blocks);
    expect(later.blocks.map((block) => block.start)).toEqual(['2026-09-08','2026-09-10']);
  });
  it('recovers a legacy leading delay from saved work without consulting the clock', () => {
    const saved = { ...job, forecastStart: '2026-09-10', forecastEndExclusive: '2026-09-14' };
    const result = recomputeCrewSchedule({ crew, items, jobsById: new Map([[job.id, saved]]), downtimesById: new Map([[downtime.id, downtime]]), today: '2026-09-22', calendar, preserveSaved: true });
    expect(result.blocks.map((block) => block.start)).toEqual(['2026-09-08','2026-09-10']);
  });
  it('keeps a downtime-only queue anchored to its authored date', () => {
    const result = recomputeCrewSchedule({ crew, items: [items[0]], jobsById: new Map(), downtimesById: new Map([[downtime.id, downtime]]), today: '2026-09-22', calendar, preserveSaved: true });
    expect(result.blocks[0].start).toBe('2026-09-08');
  });
  it('does not backdate a newly assigned job into an old empty queue', () => {
    const result = recomputeCrewSchedule({ crew: { ...crew, anchorDate: '2026-09-01' }, items: [items[1]], jobsById: new Map([[job.id, job]]), downtimesById: new Map(), today: '2026-09-22', calendar });
    expect(result.blocks[0].start).toBe('2026-09-22');
  });
});
