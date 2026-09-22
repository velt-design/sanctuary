import { expect,it } from 'vitest';
import { representativeFixture as report } from '@/app/qa/marketing-performance-fixture/representativeFixture';
import { sliceSnapshot } from './snapshotData';
it('preserves real snapshot identities and project outcomes while slicing event/enquiry dates',()=>{
  const raw={report,excludedTestDates:['2026-09-10T03:00:00Z']};
  const short=sliceSnapshot(raw,'2026-09-16','2026-09-22');
  expect(short.projects).toEqual(report.projects);
  expect(short.enquiries.rows.every(r=>r.receivedAt>='2026-09-16')).toBe(true);
  expect(short.enquiries.excludedTests).toBe(0);
  expect(sliceSnapshot(raw,'2026-09-01','2026-09-22').enquiries.excludedTests).toBe(1);
  expect(()=>sliceSnapshot(raw,'2024-09-23','2025-09-22')).toThrow();
  expect(sliceSnapshot(raw,'2024-09-23','2025-09-22',true).enquiries.rows).toEqual([]);
  expect(()=>sliceSnapshot(raw,'2026-09-01','2026-09-23')).toThrow();
  expect(()=>sliceSnapshot(raw,'2026-09-01','2026-09-23',true)).toThrow();
  expect(()=>sliceSnapshot({...raw,report:{...report,earliestReceipt:'2024-01-01T00:00:00Z'}},'2024-09-23','2025-09-22',true)).toThrow();
});
