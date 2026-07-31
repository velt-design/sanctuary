import { describe, expect, it } from 'vitest';
import { createScheduleOpsFixture } from './fixtures';

describe('Schedule operational QA fixture', () => {
  it('provides bounded synthetic identity, capacity and conflict evidence', () => {
    const fixture = createScheduleOpsFixture('large');

    expect(fixture.installers).toHaveLength(9);
    expect(fixture.scheduleBars.length).toBeGreaterThanOrEqual(100);
    expect(fixture.unscheduledJobs.length).toBeGreaterThan(0);
    expect(fixture.scheduleIssues.some((issue) => issue.level === 'error')).toBe(true);
    expect(
      Array.from(fixture.jobsById.values()).some(
        (job) => (job.customerName?.length ?? 0) > 30 && (job.siteAddress?.length ?? 0) > 35,
      ),
    ).toBe(true);
  });
});
