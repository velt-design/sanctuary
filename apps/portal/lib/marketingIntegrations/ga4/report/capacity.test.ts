import { expect, it, vi } from 'vitest';
import { acquisitionFixture, coreFixture } from './diagnostics-fixture';
import { acquisitionSchema, MAX_ACQUISITION_COHORTS, parseAcquisition } from './diagnostics';
import { readGa4Report } from './ga4';
import { parseReportResponse } from './response';
const query = { period: { start: '2026-09-29', end: '2026-10-26' }, comparison: { start: '2026-09-01', end: '2026-09-28' } };

it.each([501, 750])('retains all %i cohorts with representative event density within separate wire and saved-report bounds', async count => {
  const core = coreFixture(query), acquisition = acquisitionFixture(query, count);
  [59, 45, 45].forEach((groups, index) => {
    acquisition.reports[index + 1].rows = acquisition.reports[index + 1].rows.slice(0, groups * 2);
    acquisition.reports[index + 1].rowCount = groups;
  });
  for (const profile of acquisition.reports) for (const row of profile.rows) row.dimensionValues[1].value = `/acrylic-roof-${row.dimensionValues[1].value.slice(1)}`;
  const bytes = Buffer.byteLength(JSON.stringify(core)) + Buffer.byteLength(JSON.stringify(acquisition));
  expect(bytes).toBeLessThanOrEqual(524288);
  if (count === 750) expect(bytes).toBeGreaterThan(262144);
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async (_url, init) => Response.json(JSON.parse(String(init?.body)).requests.length === 5 ? core : acquisition));
  const report = await readGa4Report('synthetic', '123', query, undefined, fetcher, { version: 'sanctuary-ga4-v3' });
  const detail = report.diagnostics!.acquisition;
  expect(detail.status).toBe('available'); if (detail.status === 'unavailable') throw Error('Unavailable');
  expect(detail.rows).toHaveLength(count); expect(detail.rows.at(-1)?.sessions.value).toBe(count + 19);
  expect(detail.rows.at(-1)?.firstEdits.value).toBeNull();
  expect(Buffer.byteLength(JSON.stringify(report))).toBeLessThanOrEqual(245760);
  expect(parseReportResponse(JSON.parse(JSON.stringify(report)), query)).toEqual(report);
  expect(fetcher).toHaveBeenCalledTimes(2);
});

it('rejects a 751-cohort result without retaining a partial detailed table', () => {
  const acquisition = acquisitionFixture(query, MAX_ACQUISITION_COHORTS + 1);
  expect(parseAcquisition(acquisition, query, 'Pacific/Auckland', new Date('2026-10-30'))).toEqual({ status: 'unavailable', reason: 'row_limit' });
  const item = { sourceMedium: 'google / organic', landingPath: '/pergolas', deviceCategory: 'desktop', sessions: { value: 1, previous: null }, firstEdits: { value: null, previous: null }, submitAttempts: { value: null, previous: null }, acceptedSuccesses: { value: null, previous: null } };
  expect(() => acquisitionSchema.parse({ status: 'available', dimensions: ['sessionSourceMedium', 'landingPage', 'deviceCategory'], sessionUnit: 'sessions', eventUnit: 'event_occurrences', quality: { sampled: false, thresholded: false, otherRowLoss: false, provisional: false, comparisonsAllowed: true }, rows: Array.from({ length: 751 }, (_, index) => ({ ...item, landingPath: `/pergolas-${index}` })) })).toThrow();
});

it('keeps the larger provider stream strictly bounded without retry', async () => {
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async (_url, init) => JSON.parse(String(init?.body)).requests.length === 5
    ? Response.json(coreFixture(query)) : new Response(' '.repeat(524289)));
  await expect(readGa4Report('synthetic', '123', query, undefined, fetcher, { version: 'sanctuary-ga4-v3' })).rejects.toMatchObject({ diagnostic: { reason: 'response_limit' } });
  expect(fetcher).toHaveBeenCalledTimes(2);
});
