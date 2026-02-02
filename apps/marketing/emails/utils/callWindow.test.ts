import { describe, expect, it } from 'vitest';
import { getCallWindowText } from './callWindow';

describe('getCallWindowText', () => {
  it('returns within 30 minutes during working hours (Mon 10:00 NZ)', () => {
    const d = new Date('2026-02-01T21:00:00.000Z'); // Mon 10:00 in Pacific/Auckland (NZDT)
    expect(getCallWindowText(d, 'Pacific/Auckland')).toBe('within 30 minutes');
  });

  it('returns next working day outside working hours (Mon 18:00 NZ)', () => {
    const d = new Date('2026-02-02T05:00:00.000Z'); // Mon 18:00 in Pacific/Auckland (NZDT)
    expect(getCallWindowText(d, 'Pacific/Auckland')).toBe('within 30 minutes of the next working day');
  });

  it('returns next working day on weekends (Sat 10:00 NZ)', () => {
    const d = new Date('2026-02-06T21:00:00.000Z'); // Sat 10:00 in Pacific/Auckland (NZDT)
    expect(getCallWindowText(d, 'Pacific/Auckland')).toBe('within 30 minutes of the next working day');
  });
});
