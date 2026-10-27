import { describe, expect, it } from 'vitest';
import { designerFixture } from '@/app/qa/marketing-performance-fixture/designerFixtures';
import type { DesignerVisit, DesignerScope } from './designerContract';
import { designerPerformance } from './designer';
import { siteVisitCoverage, visitCoverageBuckets } from './siteVisitCoverage';

const id = (n: number) => `99999999-9999-4999-8999-${String(n).padStart(12, '0')}`;
function fixture() {
  const source = designerFixture(), visit = source.visits[0], scope = source.scopes[0];
  const report = { ...source, visits: [] as DesignerVisit[], scopes: [] as DesignerScope[], assignments: [], salesOutcomes: [], salesProjects: [] as typeof source.salesProjects };
  const add = (n: number, visitPatch: Partial<DesignerVisit> | null = {}, scopePatch: Partial<DesignerScope> = {}) => {
    report.salesProjects.push({ projectId: id(n), state: 'ACTIVE', closedOutcome: null });
    report.scopes.push({ ...scope, id: id(100 + n), projectId: id(n), reference: `SYNTHETIC-${n}`, paidAt: null, paymentEvidence: false, ...scopePatch });
    if (visitPatch) report.visits.push({ ...visit, id: id(200 + n), projectId: id(n), staff: ['jordan'], ...visitPatch });
  };
  return { report, add };
}

describe('team sales to retained-visit reconciliation', () => {
  it('partitions every net accepted job once and explains legitimate cohort differences', () => {
    const { report, add } = fixture();
    add(1); add(2, {}, { addOn: true }); add(3, { day: '2026-08-20', at: '2026-08-20T00:00:00Z' });
    add(4, { status: 'booked' }); add(5, null);
    const result = siteVisitCoverage(report, null, false, designerPerformance(report));
    expect(result.sales.goingAhead).toHaveLength(5);
    expect(result.jobs.map(item => item.bucket)).toEqual(['initial_win', 'add_on_only', 'outside_period', 'needs_review', 'no_record']);
    expect(visitCoverageBuckets.reduce((sum, [bucket]) => sum + result.jobs.filter(job => job.bucket === bucket).length, 0)).toBe(5);
    expect(new Set(result.jobs.map(item => item.job.projectId)).size).toBe(5);
    expect(result.jobs[2].reasons[0]).toContain('outside the selected visit dates');
    expect(result.firstObservedDay).toBe('2026-08-20');
  });
  it('respects project and acceptance-period selection, not a selected visitor or assigned designer', () => {
    const { report, add } = fixture(); add(1); add(2, {}, { lastAcceptedAt: '2026-08-29T00:00:00Z' });
    const visitor = designerPerformance(report, null, 'joe'); expect(visitor.total.outcomes).toHaveLength(0);
    expect(siteVisitCoverage(report, null, false, visitor).jobs.map(item => item.job.projectId)).toEqual([id(1)]);
    expect(siteVisitCoverage(report, null, true, visitor).jobs).toHaveLength(2);
    const selection = new Set([id(2)]);
    expect(siteVisitCoverage(report, selection, true, designerPerformance(report, selection, 'joe')).jobs.map(item => item.job.projectId)).toEqual([id(2)]);
  });
  it('keeps removed or incomplete records distinct from no linked history and does not infer attendance', () => {
    const { report, add } = fixture(); add(1, { removed: true }); add(2, { day: null, at: null }); add(3, { staff: [], unmappedStaff: 1 }); add(4, { purpose: 'measurement' }); add(5, null);
    const result = siteVisitCoverage(report, null, true, designerPerformance(report));
    expect(result.jobs.map(item => item.bucket)).toEqual(['needs_review', 'needs_review', 'needs_review', 'needs_review', 'no_record']);
    expect(result.jobs[0].reasons[0]).toContain('removed'); expect(result.jobs[1].reasons).toContain('Date not recorded');
    expect(result.jobs[2].reasons).toContain('Attendee identity not verified');
    expect(result.jobs[4].reasons[0]).toContain('does not establish that no visit occurred');
  });
  it('does not classify withheld, failed, never-read or stale sources as missing history', () => {
    for (const sourcePatch of [{ enabled: false }, { failed: true }, { lastSuccess: null }, { lastSuccess: '2026-09-21T00:00:00Z' }]) {
      const { report, add } = fixture(); add(1, null); Object.assign(report.source, sourcePatch);
      const result = siteVisitCoverage(report, null, true, designerPerformance(report));
      expect(result.sales.goingAhead).toHaveLength(1); expect(result.jobs).toEqual([]); expect(result.unavailable).toBeTruthy();
    }
  });
  it('preserves exclusions, unknown acceptance ordering and conflicting original safeguards', () => {
    const { report, add } = fixture(); add(1, {}, { acceptedAt: null, lastAcceptedAt: null }); add(2); add(3);
    report.salesProjects[1].closedOutcome = 'CANCELLED';
    report.visits.push({ ...report.visits[2], id: id(303), staff: ['jp'] });
    const result = siteVisitCoverage(report, null, true, designerPerformance(report));
    expect(result.sales.jobs).toHaveLength(3); expect(result.sales.excluded).toHaveLength(1); expect(result.jobs).toHaveLength(2);
    expect(result.jobs[0].bucket).toBe('needs_review'); expect(result.jobs[0].reasons[0]).toContain('acceptance date');
    expect(result.jobs[1].reasons).toContain('Conflicting original visits');
  });
  it('reconciles add-on-only acceptance in the selected period even if an older initial scope exists', () => {
    const { report, add } = fixture(); add(1, {}, { addOn: true });
    report.scopes.push({ ...report.scopes[0], id: id(999), addOn: false, lastAcceptedAt: '2026-08-31T00:00:00Z' });
    const performance = designerPerformance(report);
    expect(siteVisitCoverage(report, null, false, performance).jobs[0].bucket).toBe('add_on_only');
    expect(siteVisitCoverage(report, null, true, performance).jobs[0].bucket).toBe('initial_win');
  });
});
