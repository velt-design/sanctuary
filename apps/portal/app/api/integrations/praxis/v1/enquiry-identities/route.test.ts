// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../../../../../../lib/praxis/enquiryIdentity.server', () => ({ readEnquiryIdentities: vi.fn() }));
import * as route from './route';
import { readEnquiryIdentities } from '../../../../../../lib/praxis/enquiryIdentity.server';
import { PraxisConnectorError } from '../../../../../../lib/praxis/server';

const token = 'synthetic-praxis-token-over-thirty-two-characters';
const connection = 'a0000000-0000-4000-8000-000000000001';
function request(headers: Record<string, string> = {}, extra = '') {
  return new Request(`https://example.invalid/api/integrations/praxis/v1/enquiry-identities?submittedFrom=2020-01-01T00:00:00Z&submittedBefore=2020-01-02T00:00:00Z${extra}`, {
    headers: { authorization: `Bearer ${token}`, 'x-praxis-source-key': 'sanctuary',
      'x-praxis-connection-id': connection, 'x-praxis-environment': 'test', ...headers },
  });
}
beforeEach(() => {
  vi.stubEnv('PRAXIS_SANCTUARY_DATABASE_URL', 'postgres://synthetic@127.0.0.1:1/postgres');
  vi.stubEnv('PRAXIS_SANCTUARY_READ_TOKEN', token);
  vi.stubEnv('PRAXIS_SANCTUARY_SOURCE_KEY', 'sanctuary');
  vi.stubEnv('PRAXIS_SANCTUARY_CONNECTION_ID', connection);
  vi.stubEnv('PRAXIS_SANCTUARY_ENVIRONMENT', 'test');
});
afterEach(() => { vi.unstubAllEnvs(); vi.resetAllMocks(); });

describe('enquiry identity HTTP boundary', () => {
  it('exports GET only and forwards the normalized query after exact binding', async () => {
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) expect(route).not.toHaveProperty(method);
    vi.mocked(readEnquiryIdentities).mockResolvedValue({ records: [] } as never);
    const response = await route.GET(request());
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(readEnquiryIdentities).toHaveBeenCalledExactlyOnceWith(
      { submittedFrom: '2020-01-01T00:00:00.000000Z', submittedBefore: '2020-01-02T00:00:00.000000Z', references: [], suppliedReferenceCount: 0 },
      expect.objectContaining({ sourceKey: 'sanctuary', connectionId: connection }), expect.any(String),
    );
  });
  it.each([
    [{ authorization: 'Bearer wrong-token' }, 401],
    [{ 'x-praxis-source-key': 'another-source' }, 403],
    [{ 'x-praxis-connection-id': 'a0000000-0000-4000-8000-000000000002' }, 403],
    [{ 'x-praxis-environment': 'production' }, 403],
  ])('rejects mismatched credentials/binding before a database read', async (headers, status) => {
    const response = await route.GET(request(headers as Record<string, string>));
    expect(response.status).toBe(status);
    expect(readEnquiryIdentities).not.toHaveBeenCalled();
  });
  it('rejects extra filters and over-cap candidate lists before reading', async () => {
    for (const extra of ['&cursor=unsupported', Array.from({ length: 101 }, () => '&reference=sp_enq_30000000-0000-4000-8000-000000000001').join('')]) {
      const response = await route.GET(request({}, extra));
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ error: { code: 'INVALID_QUERY' } });
    }
    expect(readEnquiryIdentities).not.toHaveBeenCalled();
  });
  it('returns no partial or terminal-success envelope on overflow', async () => {
    vi.mocked(readEnquiryIdentities).mockRejectedValue(new PraxisConnectorError(400, 'SNAPSHOT_TOO_LARGE', 'The identity snapshot exceeds its row limit.'));
    const response = await route.GET(request());
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body).toMatchObject({ error: { code: 'SNAPSHOT_TOO_LARGE' } });
    expect(body).not.toHaveProperty('records');
    expect(body).not.toHaveProperty('coverage');
  });
});
