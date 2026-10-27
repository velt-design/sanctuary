import { afterEach, expect, it, vi } from 'vitest';
import { acquisitionFixture, coreFixture } from './diagnostics-fixture';
import { acquisitionValidationReason } from './diagnostics';
import { parseGa4Report, readGa4Report } from './ga4';
const query = { period: { start: '2026-10-14', end: '2026-10-20' }, comparison: null };
afterEach(() => vi.restoreAllMocks());

it.each(['shape', 'duplicate', 'fractional', 'header', 'timezone', 'missing_pair'] as const)(
'retains only validated core and explicit unavailable acquisition for HTTP200 %s', async mode => {
  const log = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  const raw = acquisitionFixture(query), response = raw.reports[0];
  if (mode === 'duplicate') response.rows[1] = response.rows[0];
  if (mode === 'fractional') response.rows[0].metricValues[0].value = '0.1';
  if (mode === 'header') response.dimensionHeaders[0].name = 'PRIVATE_VALUE';
  if (mode === 'timezone') response.metadata.timeZone = 'PRIVATE_INVALID_ZONE';
  if (mode === 'missing_pair') response.rows.pop();
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async (_url, init) => Response.json(
    JSON.parse(String(init?.body)).requests.length === 5 ? coreFixture(query) : mode === 'shape' ? { PRIVATE_VALUE: true } : raw));
  const report = await readGa4Report('PRIVATE_TOKEN', '123', query, undefined, fetcher, { version: 'sanctuary-ga4-v3' });
  const core = parseGa4Report(coreFixture(query), '123', query, new Date(report.fetchedAt), true);
  expect(report).toEqual(core); // Core starts with the strict unavailable/no-rows acquisition state.
  expect(report.diagnostics?.stages[0].count.value).toBe(37);
  expect(report.diagnostics?.acquisition).toEqual({ status: 'unavailable', reason: 'compatibility_unproven' });
  expect(fetcher).toHaveBeenCalledTimes(2);
  const reason = mode === 'shape' ? 'response_schema'
    : mode === 'duplicate' ? 'duplicate_row' : mode === 'fractional' ? 'invalid_metric' : ['header', 'timezone'].includes(mode) ? 'profile' : 'incomplete_rows';
  expect(log.mock.calls).toMatchObject([['sanctuary_ga4_acquisition_unavailable', { stage: 'acquisition_response', reason, status: 200 }]]);
  expect(JSON.stringify([report, log.mock.calls])).not.toMatch(/PRIVATE_|dimensionValues|metricValues|schemaIssues/);
});

it.each(['network', 'invalid_json', 'authority', 'abort'] as const)('does not convert acquisition %s failure into a partial success', async mode => {
  const log = vi.spyOn(console, 'warn').mockImplementation(() => undefined), abort = new AbortController();
  const beforeRequest = vi.fn(async () => undefined);
  if (mode === 'authority') beforeRequest.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('PRIVATE_AUTHORITY'));
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async (_url, init) => {
    if (JSON.parse(String(init?.body)).requests.length === 5) return Response.json(coreFixture(query));
    if (mode === 'network') throw new Error('PRIVATE_NETWORK');
    if (mode === 'abort') abort.abort();
    return mode === 'invalid_json' ? new Response('PRIVATE_INVALID_JSON') : Response.json({ PRIVATE_VALUE: true });
  });
  await expect(readGa4Report('PRIVATE_TOKEN', '123', query, abort.signal, fetcher, { version: 'sanctuary-ga4-v3', beforeRequest })).rejects.toThrow();
  expect(log).not.toHaveBeenCalled();
});

it('does not classify arbitrary errors or aborts as acquisition validation', () => {
  expect(acquisitionValidationReason(new Error('PRIVATE_ERROR'))).toBeNull();
  expect(acquisitionValidationReason(new DOMException('cancelled', 'AbortError'))).toBeNull();
});

it('checks cancellation again after recording the acquisition limitation', async () => {
  const abort = new AbortController();
  vi.spyOn(console, 'warn').mockImplementation(() => abort.abort());
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async (_url, init) => Response.json(
    JSON.parse(String(init?.body)).requests.length === 5 ? coreFixture(query) : { invalid: true }));
  await expect(readGa4Report('synthetic', '123', query, abort.signal, fetcher, { version: 'sanctuary-ga4-v3' })).rejects.toThrow();
});
