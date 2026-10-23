// @vitest-environment node
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ session: vi.fn(), load: vi.fn() }));
vi.mock('@/lib/xero/pilotAccess', () => ({ getPaymentPilotSession: mocks.session }));
vi.mock('@/lib/finance/registerRepository', () => ({ loadFinanceRegister: mocks.load }));
import { GET } from './route';
import { GET as fixtureGET } from '../../qa/finance-register/route';
const read = (query='') => GET(new NextRequest(`https://portal.example/api/payments/register?${query}`));
beforeEach(() => { vi.resetAllMocks(); mocks.session.mockResolvedValue({ user: { id: 'server-actor' } }); mocks.load.mockResolvedValue({ rows: [] }); });
afterEach(() => vi.unstubAllEnvs());
it('authorises before reading and never accepts a browser actor', async () => {
  mocks.session.mockResolvedValue(null);
  expect((await read()).status).toBe(403); expect(mocks.load).not.toHaveBeenCalled();
  mocks.session.mockResolvedValue({ user: { id:'server-actor' } });
  const result = await read('actor=browser-actor&tab=quotes&view=accepted&offset=50');
  expect(result.status).toBe(200); expect(result.headers.get('cache-control')).toBe('no-store');
  expect(mocks.load).toHaveBeenCalledWith('server-actor', {tab:'quotes',view:'accepted',offset:50,sent:'all',search:''});
});
it('reports unavailable without query diagnostics or invented zero records', async () => {
  mocks.load.mockRejectedValue(new Error('private database diagnostics'));
  const result=await read(); expect(result.status).toBe(503);
  const body=await result.text(); expect(body).not.toContain('private database'); expect(body).not.toContain('rows');
});
it.each(['production','test'])('keeps synthetic SQL proxy unavailable in %s even if the flag is set', async environment => {
  vi.stubEnv('NODE_ENV', environment); vi.stubEnv('ENABLE_PORTAL_QA_FIXTURES','1');
  expect((await fixtureGET(new NextRequest('http://localhost/api/qa/finance-register'))).status).toBe(404);
});
