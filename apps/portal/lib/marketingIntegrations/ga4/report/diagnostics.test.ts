import { describe, expect, it, vi } from 'vitest';
import { acquisitionPlan, MAX_ACQUISITION_COHORTS, diagnosticsSchema, parseAcquisition } from './diagnostics';
import { coreFixture, acquisitionFixture } from './diagnostics-fixture';
import { parseGa4Report, readGa4Report, reportIntent, reportPlan } from './ga4';
import { boundedGoogleJson } from './transport';
const query = { period: { start: '2026-10-01', end: '2026-10-02' }, comparison: { start: '2026-09-29', end: '2026-09-30' } };
const now = new Date('2026-10-21T00:00:00Z');
describe('fixed v3 diagnostic', () => {
  it('keeps five legacy profiles and adds four fixed profiles with a distinct versioned plan hash', () => {
    expect(reportPlan(query).requests).toHaveLength(5); const plan = acquisitionPlan(query);
    expect(plan.requests).toHaveLength(4); expect(plan.requests[0].metrics).toEqual([{ name: 'sessions' }]);
    expect(plan.requests.slice(1).map(profile => profile.dimensionFilter.andGroup.expressions.at(-1)?.filter?.stringFilter?.value)).toEqual(['contact_form_interaction', 'contact_start', 'contact_success']);
    expect(plan.requests.every(profile => profile.limit === '1501' && profile.offset === '0')).toBe(true);
    expect(reportIntent('123', query).queryHash).not.toBe(reportIntent('123', query, 'sanctuary-ga4-v3').queryHash);
  });
  it('preserves first edit independently of key events and uses one success measure with unknown first-edit coverage', () => {
    const report = parseGa4Report(coreFixture(query), '123', query, now, true);
    expect(report.events.some(row => row.label === 'contact_form_interaction')).toBe(false);
    expect(report.diagnostics?.stages.map(stage => [stage.event, stage.count.value])).toEqual([['contact_form_interaction', 37], ['contact_start', 21], ['contact_success', 13]]);
    expect(report.diagnostics?.stages[0].count.previous).toBeNull(); expect(report.diagnostics?.firstEditCompleteFrom).toBeNull();
    expect(report.diagnostics?.orderedFunnel.status).toBe('unavailable');
    expect(parseGa4Report(coreFixture(query), '123', query, now).diagnostics).toBeUndefined();
  });
  it('joins complete cohorts, preserves an observed zero and keeps an absent event null', () => {
    const raw = acquisitionFixture(query); raw.reports[1].rows = raw.reports[1].rows.slice(2); raw.reports[1].rowCount--;
    const result = parseAcquisition(raw, query, 'Pacific/Auckland', now);
    expect(result.status).toBe('available'); if (result.status === 'unavailable') throw Error('Unexpected unavailable');
    expect(result.rows).toHaveLength(3); expect(result.rows[0].sessions.value).toBe(0); expect(result.rows[0].firstEdits.value).toBeNull();
    expect(result.rows.every(row => row.firstEdits.previous === null)).toBe(true);
  });
  it.each(['subjectToThresholding', 'dataLossFromOtherRow', 'samplingMetadatas'] as const)('suppresses comparison/ranking permission for %s', key => {
    const raw = acquisitionFixture(query); Object.assign(raw.reports[1].metadata, { [key]: key === 'samplingMetadatas' ? [{ samplesReadCount: '1', samplingSpaceSize: '2' }] : true });
    const result = parseAcquisition(raw, query, 'Pacific/Auckland', now);
    expect(result.status).toBe('limited'); if (result.status === 'unavailable') throw Error('Unexpected unavailable');
    expect(result.quality.comparisonsAllowed).toBe(false); expect(result.rows.every(row => Object.values(row).every(value => typeof value !== 'object' || value.previous === null))).toBe(true);
  });
  it('reports proven overflow without leaking first-page or previous cohort cells', () => {
    const raw = acquisitionFixture(query); raw.reports[0].rowCount = MAX_ACQUISITION_COHORTS + 1;
    expect(parseAcquisition(raw, query, 'Pacific/Auckland', now)).toEqual({ status: 'unavailable', reason: 'row_limit' });
    expect(() => diagnosticsSchema.parse({ ...parseGa4Report(coreFixture(query), '123', query, now, true).diagnostics,
      acquisition: { status: 'unavailable', reason: 'row_limit', rows: [] } })).toThrow();
  });
  it('supports 200 cohorts for all three events without multiplying the profile group ceiling', () => {
    const result = parseAcquisition(acquisitionFixture(query, 200), query, 'Pacific/Auckland', now);
    expect(result.status).toBe('available'); if (result.status !== 'unavailable') expect(result.rows).toHaveLength(200);
    expect(parseAcquisition(acquisitionFixture(query, MAX_ACQUISITION_COHORTS + 1), query, 'Pacific/Auckland', now)).toEqual({ status: 'unavailable', reason: 'row_limit' });
  });
  it.each(['duplicate', 'pair', 'header', 'fractional', 'restricted', 'timezone'])('rejects unexpected %s instead of claiming row-limit success', mode => {
    const raw = acquisitionFixture(query), response = raw.reports[0];
    if (mode === 'duplicate') response.rows[1] = response.rows[0];
    if (mode === 'pair') response.rows.pop();
    if (mode === 'header') response.dimensionHeaders[0].name = 'source';
    if (mode === 'fractional') response.rows[0].metricValues[0].value = '0.1';
    if (mode === 'private_path') response.rows[0].dimensionValues[1].value = '/invoice/private';
    if (mode === 'query_path') response.rows[0].dimensionValues[1].value = '/?email=private';
    if (mode === 'identity') response.rows[0].dimensionValues[0].value = 'private@example.test';
    if (mode === 'restricted') Object.assign(response.metadata, { schemaRestrictionResponse: { activeMetricRestrictions: [{}] } });
    if (mode === 'timezone') response.metadata.timeZone = 'UTC';
    expect(() => parseAcquisition(raw, query, 'Pacific/Auckland', now)).toThrow();
  });
  it('uses a shared streamed byte allowance and aborts a stalled sibling on provider failure', async () => {
    const budget = { remaining: 5 };
    await boundedGoogleJson(async () => new Response('{}'), 'https://provider.test', {}, 262144, 45000, budget);
    await expect(boundedGoogleJson(async () => new Response('null'), 'https://provider.test', {}, 262144, 45000, budget)).rejects.toThrow('exceeded');
    const signals: AbortSignal[] = [];
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (_url, init) => {
      signals.push(init!.signal!); if (signals.length === 1) return new Response(null, { status: 403 });
      return new Promise<Response>(() => {});
    });
    await expect(readGa4Report('synthetic', '123', query, undefined, fetcher, { version: 'sanctuary-ga4-v3' })).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(2); expect(signals.every(signal => signal.aborted)).toBe(true);
  });
  it('executes the fixed two batches with rechecks and returns complete core when validated acquisition exceeds its bound', async () => {
    const raw = acquisitionFixture(query); raw.reports[0].rowCount = MAX_ACQUISITION_COHORTS + 1;
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (_url, init) => Response.json(JSON.parse(String(init?.body)).requests.length === 5 ? coreFixture(query) : raw));
    const beforeRequest = vi.fn(async () => {});
    const result = await readGa4Report('synthetic', '123', query, undefined, fetcher, { version: 'sanctuary-ga4-v3', beforeRequest });
    expect(result.diagnostics?.stages[0].count.value).toBe(37); expect(result.diagnostics?.acquisition).toEqual({ status: 'unavailable', reason: 'row_limit' });
    expect(fetcher).toHaveBeenCalledTimes(2); expect(beforeRequest).toHaveBeenCalledTimes(2);
  });
  it('shares the 45-second phase deadline across stalled authorization and both report batches', async () => {
    const deadline = new AbortController();
    const timeout = vi.spyOn(AbortSignal, 'timeout').mockImplementation(milliseconds => { expect(milliseconds).toBe(45000); return deadline.signal; });
    try {
      const fetcher = vi.fn<typeof fetch>();
      const result = readGa4Report('synthetic', '123', query, undefined, fetcher, { version: 'sanctuary-ga4-v3', beforeRequest: () => new Promise<void>(() => {}) });
      const rejected = expect(result).rejects.toThrow();
      deadline.abort(new DOMException('Report phase timed out', 'TimeoutError'));
      await rejected; expect(fetcher).not.toHaveBeenCalled();
    } finally { timeout.mockRestore(); }
  });
});
