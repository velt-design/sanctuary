import { describe, expect, it } from 'vitest';
import {
  emptyLegacySourceCells,
  inferLegacyGroupYear,
  isLegacyProjectRow,
  parseLegacyExcelDateYmd,
  parseLegacyStatusValue,
} from './legacy';

describe('parseLegacyExcelDateYmd', () => {
  it('converts excel serial dates and common slash dates', () => {
    expect(parseLegacyExcelDateYmd('44487')).toBe('2021-10-18');
    expect(parseLegacyExcelDateYmd('9/2/2026')).toBe('2026-02-09');
    expect(parseLegacyExcelDateYmd('10/18/21')).toBe('2021-10-18');
    expect(parseLegacyExcelDateYmd('Ready to go')).toBeNull();
  });
});

describe('parseLegacyStatusValue', () => {
  it('treats positive numeric legacy counts as yes while preserving display elsewhere', () => {
    expect(parseLegacyStatusValue('12')).toBe('Yes');
    expect(parseLegacyStatusValue('No')).toBe('No');
    expect(parseLegacyStatusValue('?')).toBe('TBC');
  });
});

describe('isLegacyProjectRow', () => {
  it('accepts populated project rows and skips divider or label rows', () => {
    const projectRow = emptyLegacySourceCells();
    projectRow.A = 'Alex Santos';
    projectRow.B = '0211126421';
    expect(isLegacyProjectRow(342, projectRow)).toBe(true);

    const dividerRow = emptyLegacySourceCells();
    dividerRow.A = '2025';
    expect(isLegacyProjectRow(336, dividerRow)).toBe(false);

    const labelRow = emptyLegacySourceCells();
    labelRow.A = 'Blinds to install';
    labelRow.L = 'Lights';
    labelRow.M = 'Blinds';
    expect(isLegacyProjectRow(235, labelRow)).toBe(false);
  });
});

describe('inferLegacyGroupYear', () => {
  it('prefers explicit divider years over parsed dates', () => {
    expect(
      inferLegacyGroupYear({
        explicitYear: 2025,
        estimatedStart: '2024-12-31',
        finalPayment: null,
        depositPaid: null,
      }),
    ).toBe(2025);
  });
});
