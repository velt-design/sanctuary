import { expect, it } from 'vitest';
import { commercialSchema, commercialTrend, historyCoverage, historyLabel, recordedMetricValue, comparison, contributions, metricValue, type CommercialRow } from './commercial';
import { commercialFixture, commercialCoverageScenario } from '@/app/qa/marketing-performance-fixture/commercialFixtures';
import { representativeFixture, representativeFilters } from '@/app/qa/marketing-performance-fixture/representativeFixture';
const report = commercialFixture(representativeFixture, representativeFilters);
it('coherent fixture, weekly/monthly buckets and source subsets reconcile exact headline contributions', () => {
  expect(commercialSchema.safeParse(report).success).toBe(true);
  for (const rows of [report.rows, report.rows.filter((_, i) => i % 3 === 0)]) {
    const values = contributions(report, rows);
    for (const grouping of ['week', 'month'] as const) {
      const buckets = commercialTrend(report, values, grouping);
      expect(buckets[0].start).toBe(report.start); expect(buckets.at(-1)?.end).toBe(report.end);
      expect(buckets.reduce((n, b) => n + b.quoted!, 0)).toBe(metricValue('quoted', values.quoted));
      expect(buckets.reduce((n, b) => n + b.accepted!, 0)).toBe(metricValue('accepted', values.accepted));
      expect(buckets.reduce((n, b) => n + b.quotedCount, 0)).toBe(values.quoted.length);
      expect(buckets.reduce((n, b) => n + b.acceptedCount, 0)).toBe(values.accepted.length);
    }
  }
});
it('uses elapsed time, excludes missing/out-of-order and add-on timing but includes their accepted value', () => {
  const original = report.rows[0];
  const version = { versionId: original.quoteId, versionNumber: 2, amountCents: 10000 };
  const base: CommercialRow = { ...original, scopeKind: 'base', originAt: '2026-09-01T00:00:00Z', firstSentAt: '2026-09-03T00:00:00Z', currentSent: {...version,sentAt:'2026-09-03T00:00:00Z'}, accepted: {...version,acceptedAt:'2026-09-07T00:00:00Z'} };
  const rows = [base, {...base, originAt: null}, {...base, originAt:'2026-09-04T00:00:00Z'}, {...base, scopeKind:'add_on' as const}];
  const values = contributions(report, rows);
  expect(values.enquiryDays).toHaveLength(3); expect(metricValue('enquiryDays', values.enquiryDays)).toBe(2);
  expect(values.acceptanceDays).toHaveLength(3); expect(metricValue('acceptanceDays', values.acceptanceDays)).toBe(4);
  expect(metricValue('accepted', values.accepted)).toBe(40000); expect(metricValue('average', values.average)).toBe(10000);
  expect(contributions(report,[{...base,accepted:{...version,acceptedAt:null}}]).accepted).toHaveLength(0);
});
it('does not turn missing amounts or empty averages/timing into zero or infinite comparisons', () => {
  const values = contributions(report, report.rows);
  const items = values.quoted.slice(0,1).map(r => ({...r,amountCents:null}));
  expect(metricValue('quoted',items)).toBeNull(); expect(metricValue('average',[])).toBeNull(); expect(metricValue('enquiryDays',[])).toBeNull();
  expect(metricValue('quoted',[])).toBe(0); expect(comparison(20,0)).toBe('Previous period: zero'); expect(comparison(0,0)).toBe('No change from zero'); expect(comparison(null,10)).toBe('Comparison unavailable');
});
it('rejects duplicate scopes, invalid dates, wrong previous periods and mismatched dated versions', () => {
  for (const changed of [{...report,rows:[report.rows[0],report.rows[0]]},{...report,start:'not-a-date'},{...report,priorEnd:report.end},{...report,rows:[{...report.rows[0],currentSent:{versionId:report.rows[0].quoteId,versionNumber:1,amountCents:10,sentAt:'2020-01-01T00:00:00Z'}}]}]) expect(commercialSchema.safeParse(changed).success).toBe(false);
});

it('coverage demo shares undated acceptance and add-on evidence across hub and values', () => {
 const filters={...representativeFilters,start:'2026-08-01',end:'2026-09-22'};
 const {hub,commercial}=commercialCoverageScenario(representativeFixture,filters), values=contributions(commercial,commercial.rows);
 expect(commercial.rows.filter(r=>r.accepted&&!r.accepted.acceptedAt)).toHaveLength(1);
 expect(values.enquiryDays.some(r=>r.days===null)).toBe(true);
 const addon=commercial.rows.find(r=>r.scopeKind==='add_on')!;
 expect(values.accepted.some(r=>r.row.quoteId===addon.quoteId)).toBe(true);
 expect(values.acceptanceDays.some(r=>r.row.quoteId===addon.quoteId)).toBe(false);
 expect(hub.events.filter(e=>e.id.startsWith('demo-commercial-addon'))).toHaveLength(2);
 const undated=commercial.rows.find(r=>r.accepted&&!r.accepted.acceptedAt)!;
 expect(hub.events.some(e=>e.projectId===undated.projectId&&e.kind==='quote_accepted')).toBe(false);
});

it('shares honest interval coverage across pre-history, straddling, unknown and supported empty periods', () => {
 const source={earliestSentAt:'2026-02-02T00:00:00Z'};
 expect(historyCoverage(source,'2024-01-01','2024-01-31')).toBe('unavailable');
 expect(recordedMetricValue('quoted',[],historyCoverage(source,'2024-01-01','2024-01-31'))).toBeNull();
 expect(historyCoverage(source,'2026-01-01','2026-02-28')).toBe('partial');
 const items=contributions(report,report.rows).quoted;
 expect(recordedMetricValue('quoted',items,'partial')).toBe(metricValue('quoted',items));
 expect(historyLabel('partial',items.length)).toBe('Partial recorded history');
 expect(historyCoverage({earliestSentAt:null},'2026-03-01','2026-03-31')).toBe('unavailable');
 expect(recordedMetricValue('accepted',[],'unavailable')).toBeNull();
 expect(recordedMetricValue('quoted',items,'unavailable')).toBe(metricValue('quoted',items));
 expect(historyLabel('unavailable',items.length)).toBe('Partial recorded history');
 expect(historyCoverage(source,'2026-03-01','2026-03-31')).toBe('covered');
 expect(recordedMetricValue('quoted',[],'covered')).toBe(0);
 expect(recordedMetricValue('enquiryDays',[],'partial')).toBeNull();
 const old={...report,start:'2024-01-01',end:'2024-01-31'};
 expect(commercialTrend(old,contributions(old,[])).every(b=>b.quoted===null&&b.accepted===null)).toBe(true);
});
