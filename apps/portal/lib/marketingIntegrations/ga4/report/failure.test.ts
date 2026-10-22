import { expect, it, vi } from 'vitest';
import { Ga4ReportFailure, reportFailureLog } from './failure';
import { readGa4Report } from './ga4';
import { acquisitionFixture, coreFixture } from './diagnostics-fixture';
const query = { period: { start: '2026-10-01', end: '2026-10-02' }, comparison: null };

it.each(['core', 'acquisition'] as const)('isolates %s HTTP failure from the sibling in either completion order', async failed => {
  for (const order of [['core', 'acquisition'], ['acquisition', 'core']] as const) {
    const resolve: Partial<Record<'core' | 'acquisition', (value: Response) => void>> = {};
    const fetcher = vi.fn<typeof fetch>().mockImplementation((_url, init) => new Promise(done => {
      resolve[JSON.parse(String(init?.body)).requests.length === 5 ? 'core' : 'acquisition'] = done;
    }));
    const pending = readGa4Report('PRIVATE_TOKEN', '123', query, undefined, fetcher, { version: 'sanctuary-ga4-v3' });
    const checked = expect(pending).rejects.toMatchObject({ diagnostic: { stage: `${failed}_request`, reason: 'provider_http', status: 403 } });
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
    for (const batch of order) resolve[batch]!(batch === failed ? new Response('PRIVATE_PROVIDER_BODY', { status: 403 })
      : Response.json(batch === 'core' ? coreFixture(query) : acquisitionFixture(query)));
    await checked;
  }
});

it('does not borrow a successful sibling status for an acquisition transport failure', async () => {
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async (_url, init) => {
    if (JSON.parse(String(init?.body)).requests.length === 5) return Response.json(coreFixture(query));
    throw new Error('PRIVATE_TRANSPORT_URL');
  });
  try { await readGa4Report('PRIVATE_TOKEN', '123', query, undefined, fetcher, { version: 'sanctuary-ga4-v3' }); throw Error('Expected rejection'); }
  catch (error) { expect(reportFailureLog(error, 'collection')).toEqual({ stage: 'acquisition_request', reason: 'transport_or_response' }); }
});

it('keeps core response validation fatal', async () => {
  const batch = 'core';
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async (_url, init) => {
    const core = JSON.parse(String(init?.body)).requests.length === 5;
    return Response.json(core === (batch === 'core') ? { PRIVATE_PROVIDER_BODY: true } : core ? coreFixture(query) : acquisitionFixture(query));
  });
  await expect(readGa4Report('PRIVATE_TOKEN', '123', query, undefined, fetcher, { version: 'sanctuary-ga4-v3' }))
    .rejects.toMatchObject({ diagnostic: { stage: `${batch}_response`, reason: 'response_schema', status: 200 } });
});

it('identifies a pre-request authority failure without inventing a provider status', async () => {
  const beforeRequest = vi.fn(async () => undefined).mockRejectedValueOnce(new Error('PRIVATE_AUTHORITY'));
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json(acquisitionFixture(query)));
  try { await readGa4Report('PRIVATE_TOKEN', '123', query, undefined, fetcher, { version: 'sanctuary-ga4-v3', beforeRequest }); throw Error('Expected rejection'); }
  catch (error) { expect(reportFailureLog(error, 'collection')).toEqual({ stage: 'core_authority', reason: 'transport_or_response' }); }
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it('projects only fixed log values even when a failure object carries untrusted additions', () => {
  const failure = new Ga4ReportFailure({ stage: 'acquisition_response', reason: 'response_schema', status: 200 });
  Object.assign(failure.diagnostic, { PRIVATE_PROVIDER_BODY: 'PRIVATE_PATH', schemaIssues: [{ field: 'PRIVATE_EMAIL' }], structure: ['PRIVATE_QUERY'] });
  expect(reportFailureLog(failure, 'collection')).toEqual({ stage: 'acquisition_response', reason: 'response_schema', status: 200 });
  Object.assign(failure.diagnostic, { stage: 'PRIVATE_PATH', reason: 'PRIVATE_TOKEN', status: 123456 });
  expect(reportFailureLog(failure, 'collection')).toEqual({ stage: 'collection', reason: 'transport_or_response' });
  expect(reportFailureLog(new Error('PRIVATE_ERROR'), 'normalization')).toEqual({ stage: 'normalization', reason: 'report_validation' });
});
