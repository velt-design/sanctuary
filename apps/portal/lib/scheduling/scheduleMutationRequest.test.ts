import { describe, expect, it } from 'vitest';

import {
  excludeTargetCommitImpacts,
  isCalendarYmd,
  isCanonicalScheduleUuid,
  parseScheduleForce,
} from './scheduleMutationRequest';

describe('parseScheduleForce', () => {
  it.each([
    [undefined, false],
    [false, false],
    [true, true],
  ])('accepts %j as %s', (input, expected) => {
    expect(parseScheduleForce(input)).toEqual({ ok: true, value: expected });
  });

  it.each([null, 'false', 'true', 0, 1, {}, []])('rejects non-boolean force value %j', (input) => {
    expect(parseScheduleForce(input)).toEqual({
      ok: false,
      error: 'force must be a boolean',
    });
  });

  it('removes the edited job but preserves other affected jobs', () => {
    const impacts = [
      {
        job_id: 'project-target',
        scheduled_job_id: 'scheduled-target',
        before_start: '2026-04-07',
        after_start: '2026-04-08',
      },
      {
        job_id: 'project-other',
        scheduled_job_id: 'scheduled-other',
        before_start: '2026-04-09',
        after_start: '2026-04-10',
      },
    ];

    expect(
      excludeTargetCommitImpacts(impacts, {
        jobId: 'project-target',
        scheduledJobId: 'scheduled-target',
      }),
    ).toEqual([impacts[1]]);
  });

  it.each(['2026-04-08', '2024-02-29'])('accepts the real calendar date %s', (value) => {
    expect(isCalendarYmd(value)).toBe(true);
  });

  it.each(['2026-02-29', '2026-04-31', '2026-99-99', '08/04/2026'])(
    'rejects the invalid calendar date %s',
    (value) => {
      expect(isCalendarYmd(value)).toBe(false);
    },
  );

  it('requires a canonical unpadded UUID', () => {
    const uuid = '00000000-0000-4000-8000-000000000101';
    expect(isCanonicalScheduleUuid(uuid)).toBe(true);
    expect(isCanonicalScheduleUuid(` ${uuid}`)).toBe(false);
    expect(isCanonicalScheduleUuid('job-1')).toBe(false);
  });
});
