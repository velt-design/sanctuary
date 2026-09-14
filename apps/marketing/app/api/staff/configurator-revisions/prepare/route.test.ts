import {afterEach, beforeEach, expect, it, vi} from 'vitest';
const mocks = vi.hoisted(() => ({createClient: vi.fn(), getUser: vi.fn(), from: vi.fn(), parse: vi.fn(), resolved: vi.fn(), calculate: vi.fn()}));
vi.mock('@supabase/supabase-js', () => ({createClient: mocks.createClient}));
vi.mock('../../../../../components/configurator-prototype/previewDraft', () => ({parsePreviewDraft: mocks.parse}));
vi.mock('../../../../../lib/publishedCostingConfiguration.server', () => ({getPublishedCostingConfiguration: mocks.resolved}));
vi.mock('../../../../../lib/configuratorPricing.server', () => ({calculateFrozenConfiguratorPrice: mocks.calculate}));
vi.mock('../../../../../lib/staffConfiguratorRevisionEstimate.server', () => ({buildStaffConfiguratorRevisionEstimate: () => ({inputs: {}, outputs: {}})}));
import {POST} from './route';
const projectId = '11111111-1111-4111-8111-111111111111';
const sourceEstimateId = '22222222-2222-4222-8222-222222222222';
let role = 'staff';
let sourceExists = true;
let sourceKind = 'marketing_enquiry';
let filters: Array<[string, unknown]>;
afterEach(() => vi.unstubAllEnvs());
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://staging.example.test');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'test-public-key');
  vi.stubEnv('WEBSITE_CONFIGURATOR_APPROVED_VERSION_ID', 'approved-version');
  role = 'staff'; sourceExists = true; sourceKind = 'marketing_enquiry'; filters = [];
  mocks.getUser.mockResolvedValue({data: {user: {id: 'staff-id'}}, error: null});
  mocks.from.mockImplementation((table: string) => {
    const query = {select: vi.fn(() => query), eq: vi.fn((key: string, value: unknown) => {filters.push([key,value]); return query;}),
      maybeSingle: vi.fn(async () => ({data: table === 'portal_users' ? {role} : sourceExists ? {id: sourceEstimateId, outputs: {snapshot: {source: sourceKind}}} : null, error: null}))};
    return query;
  });
  mocks.createClient.mockReturnValue({auth: {getUser: mocks.getUser}, from: mocks.from});
  mocks.parse.mockImplementation(value => value?.valid ? value : null);
  mocks.resolved.mockResolvedValue({provenance: {versionId: 'approved-version'}});
  mocks.calculate.mockReturnValue({customerPrice: {amountIncGst: 15000}, privateCost: 9000});
});
function request(auth = true, extra = {}) {
  return new Request('http://localhost/api/staff/configurator-revisions/prepare', {method: 'POST',
    headers: {'Content-Type': 'application/json', ...(auth ? {Authorization: 'Bearer staff-session'} : {})},
    body: JSON.stringify({projectId, sourceEstimateId, design: {valid: true}, ...extra})});
}
it('requires a verified staff identity before reading project or pricing data', async () => {
  expect((await POST(request(false))).status).toBe(401);
  expect(mocks.createClient).not.toHaveBeenCalled();
  mocks.getUser.mockResolvedValueOnce({data: {user: null}, error: {message: 'expired'}});
  expect((await POST(request())).status).toBe(401);
  expect(mocks.from).not.toHaveBeenCalled();
  role = 'customer';
  expect((await POST(request())).status).toBe(403);
  expect(mocks.resolved).not.toHaveBeenCalled();
});
it('checks exact source/project membership using the caller session', async () => {
  sourceExists = false;
  expect((await POST(request())).status).toBe(404);
  expect(filters).toContainEqual(['project_id', projectId]);
  expect(filters).toContainEqual(['id', sourceEstimateId]);
  expect(mocks.createClient.mock.calls[0][2].global.headers.Authorization).toBe('Bearer staff-session');
  expect(mocks.calculate).not.toHaveBeenCalled();
});
it('rejects malformed designs and non-configurator estimate sources', async () => {
  expect((await POST(request(true, {design: {valid: false}}))).status).toBe(422);
  sourceKind = 'calculator';
  expect((await POST(request())).status).toBe(409);
  expect(mocks.calculate).not.toHaveBeenCalled();
});
it('never substitutes draft or unapproved pricing', async () => {
  vi.stubEnv('WEBSITE_CONFIGURATOR_APPROVED_VERSION_ID', '');
  expect((await POST(request())).status).toBe(409);
  expect(mocks.resolved).not.toHaveBeenCalled();
  vi.stubEnv('WEBSITE_CONFIGURATOR_APPROVED_VERSION_ID', 'different-version');
  expect((await POST(request())).status).toBe(503);
  expect(mocks.calculate).not.toHaveBeenCalled();
});
it('uses the complete server calculation and ignores browser-supplied prices', async () => {
  const response = await POST(request(true, {amountIncGst: 1, frozen: {amountIncGst: 1}}));
  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toBe('private, no-store');
  expect(await response.json()).toMatchObject({status: 'prepared', projectId, sourceEstimateId, actorId: 'staff-id',
    frozen: {customerPrice: {amountIncGst: 15000}, privateCost: 9000}});
  expect(mocks.calculate).toHaveBeenCalledWith({valid: true}, {provenance: {versionId: 'approved-version'}});
});
it('does not invent a priced result for custom designs or failed calculations', async () => {
  mocks.calculate.mockReturnValueOnce(null);
  expect((await POST(request())).status).toBe(422);
  mocks.calculate.mockImplementationOnce(() => {throw new Error('sensitive connection failure');});
  const response = await POST(request());
  expect(response.status).toBe(503);
  expect(await response.text()).not.toContain('sensitive');
});
