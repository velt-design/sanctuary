import type { MarketingRow, MarketingReport } from '@/lib/marketingPerformance/contract';

export const fixtureFilters = { start: '2026-09-01', end: '2026-09-22', source: '', campaign: '' };
const id = (n: number) => `11111111-1111-4111-8111-${String(n).padStart(12, '0')}`;
const row = (n: number, values: Partial<MarketingRow> = {}): MarketingRow => ({
  enquiryId: id(n), receivedAt: `2026-09-${String(1 + n % 20).padStart(2, '0')}T03:00:00Z`,
  projectId: id(n + 100), projectName: `Sample project ${n}`, origin: true,
  source: 'google', campaign: 'Spring pergolas', qualification: 'unreviewed',
  visit: false, quote: false, accepted: false, won: false, closedOutcome: null, ...values,
});
export const fixtureReport: MarketingReport = {
  schemaVersion: 1, asOf: '2026-09-22T03:00:00Z', start: fixtureFilters.start, end: fixtureFilters.end,
  timezone: 'Pacific/Auckland', excludedTests: 1, visitHistoryAvailable: true,
  rows: [
    row(1, { projectName: 'Sample courtyard', qualification: 'qualified', visit: true, quote: true, accepted: true, won: true }),
    row(2, { projectName: 'Sample terrace', qualification: 'qualified', visit: true, quote: true }),
    row(3, { projectName: 'Sample garden', qualification: 'not_qualified', closedOutcome: 'LOST_NOT_SUITABLE' }),
    row(4, { source: 'meta', campaign: 'Outdoor living', projectName: 'Sample poolside', qualification: 'qualified', visit: true, quote: true, accepted: true }),
    row(5, { source: 'meta', campaign: 'Outdoor living', projectName: 'Sample deck' }),
    row(6, { source: 'meta', campaign: 'Outdoor living', projectName: 'Sample retreat', closedOutcome: 'LOST_NO_RESPONSE' }),
    row(7, { source: null, campaign: null, projectName: 'Sample commercial canopy', qualification: 'ineligible', quote: true, accepted: true, won: true }),
    row(8, { source: null, campaign: null, projectName: 'Sample entry cover', qualification: 'ineligible' }),
    row(9, { source: 'meta', campaign: 'Outdoor living', projectId: id(101), projectName: 'Sample courtyard', origin: false, qualification: 'ineligible', visit: true, quote: true, accepted: true, won: true }),
    row(10, { source: null, campaign: 'Campaign without source', projectId: null, projectName: null, origin: false, qualification: 'unavailable' }),
    row(11, { source: 'google', campaign: 'Brand search', projectName: 'Sample returning project', origin: false, qualification: 'qualified', quote: true }),
    row(12, { source: 'google', campaign: 'Brand search', projectName: 'Sample early discussion' }),
  ],
};

export const historicalFixtureRows: MarketingRow[] = [
  row(31, { receivedAt: '2026-08-12T03:00:00Z', qualification: 'qualified' }),
  row(32, { receivedAt: '2026-08-20T03:00:00Z', qualification: 'unreviewed' }),
  row(33, { receivedAt: '2026-08-26T03:00:00Z', source: 'meta', campaign: 'Outdoor living', qualification: 'not_qualified' }),
  row(34, { receivedAt: '2026-08-29T03:00:00Z', source: 'newsletter', campaign: 'Previous campaign', qualification: 'ineligible' }),
];
