import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const provision = vi.hoisted(() => vi.fn());
vi.mock('@/lib/projects/sharePointFiles/provision', () => ({ provisionProjectFolder: provision }));
import { GET } from './route';
const secret = 's'.repeat(40);
const request = (authorization = `Bearer ${secret}`, suffix = '') => new Request('https://portal.test/api/integrations/sharepoint-project-folders' + suffix, { headers: { authorization, 'x-vercel-oidc-token': 'assertion' } });
beforeEach(() => { provision.mockReset(); vi.stubEnv('CRON_SECRET', secret); vi.stubEnv('SANCTUARY_SHAREPOINT_ENABLED', 'true'); vi.stubEnv('SANCTUARY_SHAREPOINT_PROVISION_ENABLED', 'true'); });
afterEach(() => vi.unstubAllEnvs());
it('rejects missing credentials and caller query input without claiming work', async () => {
  expect((await GET(request(''))).status).toBe(401);
  expect((await GET(request(undefined, '?projectId=arbitrary'))).status).toBe(400);
  expect(provision).not.toHaveBeenCalled();
});
it('stays dark until provisioning is enabled', async () => {
  vi.stubEnv('SANCTUARY_SHAREPOINT_PROVISION_ENABLED', 'false');
  expect(await (await GET(request())).json()).toEqual({ enabled: false });
  expect(provision).not.toHaveBeenCalled();
});
it('dispatches one scoped claim with the supplied server assertion', async () => {
  provision.mockResolvedValue({ updated: true });
  expect((await GET(request())).status).toBe(200);
  expect(provision).toHaveBeenCalledExactlyOnceWith('assertion');
});
