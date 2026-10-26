import { describe, expect, it, vi } from 'vitest';
import { projectStageAge } from './projectStageAge';
describe('Auckland stage age', () => {
  it('uses calendar days across the NZ spring daylight-saving boundary', () => {
    expect(projectStageAge('2026-09-26T12:30:00Z', new Date('2026-09-27T11:30:00Z'))?.days).toBe(1);
    expect(projectStageAge('2026-09-22T13:00:00Z', new Date('2026-09-23T01:00:00Z'))?.label).toBe('Today');
  });
  it('keeps missing, invalid and future evidence unknown', () => {
    const now = new Date('2026-09-23T01:00:00Z');
    for (const value of [null, undefined, '', 'bad', '2026-09-24T00:00:00Z']) expect(projectStageAge(value, now)).toBeNull();
  });
});


it('derives stage age from fresh current time when the same record crosses Auckland midnight', () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  try {
    const changed = '2026-10-25T00:00:00Z';
    vi.setSystemTime(new Date('2026-10-25T10:59:59Z'));
    expect(projectStageAge(changed)?.label).toBe('Today');
    vi.setSystemTime(new Date('2026-10-25T11:00:00Z'));
    expect(projectStageAge(changed)?.label).toBe('1 day');
  } finally { vi.useRealTimers(); }
});
