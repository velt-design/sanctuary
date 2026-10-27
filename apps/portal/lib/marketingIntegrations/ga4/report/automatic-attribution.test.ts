import { expect, it, vi } from 'vitest';
import { acquisitionFixture, coreFixture } from './diagnostics-fixture';
import { parseAcquisition, PRIVACY_WARNING, safePath, WITHHELD_LABEL, WITHHELD_PATH } from './diagnostics';
import { parseGa4Report, readGa4Report } from './ga4';
import { parseReportResponse } from './response';

const query = { period: { start: '2026-09-28', end: '2026-10-25' }, comparison: { start: '2026-08-31', end: '2026-09-27' } };
const now = new Date('2026-10-27T00:00:00Z');

it('preserves the consumer raw-path contract while rejecting encoded private paths', () => {
  for (const value of ['%2Fpergolas', '//pergolas', '/%2Fpergolas', '/%71uote/private', '/%2571uote/private']) {
    expect(safePath(value)).toBe(false);
    const raw = acquisitionFixture({ ...query, comparison: null });
    raw.reports[0].rows[0].dimensionValues[1].value = value;
    const result = parseAcquisition(raw, { ...query, comparison: null }, 'Pacific/Auckland', now);
    expect(result.status).toBe('available');
    if (result.status !== 'unavailable') expect(result.rows[0].landingPath).toBe(WITHHELD_PATH);
  }
  expect(safePath('/pergolas')).toBe(true);
});

it('collects a full 28-day comparison with 200 three-stage cohorts inside the original wire and saved-report bounds', async () => {
  const core = coreFixture(query), acquisition = acquisitionFixture(query, 200);
  const compact = JSON.stringify(core).length + JSON.stringify(acquisition).length;
  const pretty = JSON.stringify(core, null, 2).length + JSON.stringify(acquisition, null, 2).length;
  expect(compact).toBeLessThanOrEqual(262144); expect(pretty).toBeGreaterThan(262144);
  const beforeRequest = vi.fn(async () => {});
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async (url, init) => {
    expect(String(url)).toBe('https://analyticsdata.googleapis.com/v1beta/properties/123:batchRunReports?prettyPrint=false');
    const plan = JSON.parse(String(init?.body));
    expect(plan.requests[0].dateRanges).toEqual([{ startDate: query.period.start, endDate: query.period.end, name: 'selected' }, { startDate: query.comparison.start, endDate: query.comparison.end, name: 'prior' }]);
    if (plan.requests.length === 5) return Response.json(core);
    // Honor Google's documented row limit instead of returning fixture rows
    // beyond the request. This catches a comparison limit of only 201.
    const limited = structuredClone(acquisition);
    limited.reports.forEach((report, index) => { report.rowCount = report.rows.length; report.rows = report.rows.slice(0, Number(plan.requests[index].limit)); });
    return Response.json(limited);
  });
  const report = await readGa4Report('synthetic', '123', query, undefined, fetcher, { version: 'sanctuary-ga4-v3', beforeRequest });
  expect(report.diagnostics?.acquisition.status).toBe('available');
  expect(parseReportResponse(JSON.parse(JSON.stringify(report)), query)).toEqual(report);
  expect(fetcher).toHaveBeenCalledTimes(2); expect(beforeRequest).toHaveBeenCalledTimes(2);
});

it('redacts only unsafe labels, merges withheld paths without losing observed counts, and preserves missing values', () => {
  const raw = acquisitionFixture(query);
  for (const report of raw.reports) for (const [index, row] of report.rows.entries()) {
    row.dimensionValues[0].value = 'google / organic'; row.dimensionValues[2].value = 'desktop';
    row.dimensionValues[1].value = index < 2 ? '/quote/PRIVATE_A' : index < 4 ? '/invoice/PRIVATE_B' : '/public';
  }
  // An absent observation remains unknown. It is not invented as a zero.
  raw.reports[1].rows = raw.reports[1].rows.slice(0, 4); raw.reports[1].rowCount = 2;
  const result = parseAcquisition(raw, query, 'Pacific/Auckland', now);
  expect(result.status).toBe('available'); if (result.status === 'unavailable') throw Error('Unavailable');
  expect(result.rows).toHaveLength(2);
  expect(result.rows[0]).toMatchObject({ sourceMedium: 'google / organic', landingPath: WITHHELD_PATH, deviceCategory: 'desktop', sessions: { value: 21 }, firstEdits: { value: 14, previous: null }, submitAttempts: { value: 8 }, acceptedSuccesses: { value: 4 } });
  expect(result.rows[1].firstEdits.value).toBeNull();
  expect(JSON.stringify(result)).not.toContain('PRIVATE_');
  raw.reports[1].rows = raw.reports[1].rows.slice(0, 2); raw.reports[1].rowCount = 1;
  const partial = parseAcquisition(raw, query, 'Pacific/Auckland', now);
  if (partial.status === 'unavailable') throw Error('Unavailable');
  expect(partial.rows[0].firstEdits.value).toBeNull();
  expect(partial.rows[0].sessions.value).toBe(21);
  raw.reports[0].rows[1] = raw.reports[0].rows[0];
  expect(() => parseAcquisition(raw, query, 'Pacific/Auckland', now)).toThrow();
});

it.each(['identity', 'query', 'encoded', 'control', 'oversized'])('never retains a private %s label in core or detailed attribution', async mode => {
  const core = coreFixture(query), raw = acquisitionFixture(query);
  const unsafe = mode === 'identity' ? 'PRIVATE_VALUE@example.test' : mode === 'query' ? '/?email=PRIVATE_VALUE' : mode === 'encoded' ? '/%71uote/PRIVATE_VALUE' : mode === 'control' ? '/PRIVATE_VALUE\n' : 'x'.repeat(129);
  for (const row of raw.reports[0].rows.slice(0, 2)) row.dimensionValues[mode === 'identity' || mode === 'oversized' ? 0 : 1].value = unsafe;
  core.reports[2].rows[0].dimensionValues[0].value = '/quote/PRIVATE_VALUE';
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async (_url, init) => Response.json(JSON.parse(String(init?.body)).requests.length === 5 ? core : raw));
  const report = await readGa4Report('synthetic', '123', query, undefined, fetcher, { version: 'sanctuary-ga4-v3' });
  expect(report.diagnostics?.acquisition.status).toBe('available');
  expect(report.warnings).toContain(PRIVACY_WARNING); expect(report.landing[0].label).toBe(WITHHELD_PATH);
  expect(JSON.stringify(report)).not.toContain(unsafe); expect(JSON.stringify(report)).not.toContain('PRIVATE_VALUE');
  expect(parseReportResponse(report, query)).toEqual(report);
});

it('keeps raw completeness independent from privacy collisions and accepts only a complete comparison product', () => {
  const raw = acquisitionFixture(query, 200);
  for (const report of raw.reports) report.rowCount = report.rows.length;
  expect(parseAcquisition(raw, query, 'Pacific/Auckland', now).status).toBe('available');
  raw.reports[0].rows.pop();
  expect(() => parseAcquisition(raw, query, 'Pacific/Auckland', now)).toThrow();
  // A smaller reported count explicitly establishes complete sparse rows.
  raw.reports[0].rowCount--;
  const sparse = parseAcquisition(raw, query, 'Pacific/Auckland', now);
  expect(sparse.status).toBe('available');
  if (sparse.status !== 'unavailable') expect(sparse.rows.at(-1)?.sessions.previous).toBeNull();
});

it('rejects overflow when privacy grouping adds individually valid counts beyond safe integers', () => {
  const raw = acquisitionFixture({ ...query, comparison: null });
  for (const row of raw.reports[0].rows) {
    row.dimensionValues[0].value = WITHHELD_LABEL; row.dimensionValues[2].value = 'desktop';
    row.dimensionValues[1].value = `/quote/${row.dimensionValues[1].value}`;
    row.metricValues[0].value = String(Number.MAX_SAFE_INTEGER);
  }
  expect(() => parseAcquisition(raw, { ...query, comparison: null }, 'Pacific/Auckland', now)).toThrow();
});

it('groups private core landings while retaining counts and rejecting raw duplicates', () => {
  const raw = coreFixture(query), landing = raw.reports[2];
  landing.rows[0].dimensionValues[0].value = '/quote/PRIVATE_A';
  const second = structuredClone(landing.rows[0]); second.dimensionValues[0].value = '/invoice/PRIVATE_B';
  landing.rows.push(second); landing.rowCount++;
  expect(parseGa4Report(raw, '123', query, now).landing[0]).toMatchObject({ label: WITHHELD_PATH, value: 26 });
  landing.rows.push(second); landing.rowCount++;
  expect(() => parseGa4Report(raw, '123', query, now)).toThrow('Duplicate');
});
