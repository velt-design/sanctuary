import {beforeEach, expect, it, vi} from 'vitest';
const mocks = vi.hoisted(() => ({prepare: vi.fn(), rpc: vi.fn()}));
vi.mock('../../../../../lib/staffConfiguratorRevisionPreparation.server', () => ({prepareStaffConfiguratorRevision: mocks.prepare}));
vi.mock('../../../../../lib/supabaseService', () => ({getServiceSupabase: () => ({rpc: mocks.rpc})}));
import {POST} from './route';
const id = '11111111-1111-4111-8111-111111111111', hash = 'a'.repeat(64);
beforeEach(() => {
  vi.clearAllMocks();
  mocks.prepare.mockImplementation(async () => Response.json({projectId: id, sourceEstimateId: id,
    actorId: 'verified-actor', estimate: {serverPrepared: true}, preparationHash: hash}));
  mocks.rpc.mockResolvedValue({data: [{revision_id: id, estimate_id: id, already_existed: false}], error: null});
});
function request(overrides = {}, signedIn = true) {
  return new Request('http://localhost/api/staff/configurator-revisions/save', {method: 'POST',
    headers: {'Content-Type': 'application/json', ...(signedIn ? {Authorization: 'Bearer staff-session'} : {})},
    body: JSON.stringify({requestId: id, preparationHash: hash, ...overrides})});
}
it('rejects anonymous and unprepared saves without a write', async () => {
  expect((await POST(request({},false))).status).toBe(401);
  expect((await POST(request({preparationHash: ''}))).status).toBe(422);
  expect(mocks.prepare).not.toHaveBeenCalled();
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it('requires fresh staff/source/price checks and the reviewed calculation hash', async () => {
  mocks.prepare.mockResolvedValueOnce(Response.json({error: 'Unauthorized'}, {status: 401}));
  expect((await POST(request())).status).toBe(401);
  expect((await POST(request({preparationHash: 'b'.repeat(64)}))).status).toBe(409);
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it('writes only the server-prepared record and returns identifiers, not private costs', async () => {
  const response = await POST(request({estimate: {forged: true}, actorId: 'forged-actor'}));
  expect(response.status).toBe(200);
  expect(mocks.rpc).toHaveBeenCalledWith('configurator_estimate_revision_create', {
    p_project_id: id, p_source_estimate_id: id, p_request_id: id, p_actor_user_id: 'verified-actor', p_estimate: {serverPrepared: true}});
  expect(await response.json()).toEqual({status: 'saved', projectId: id, revisionId: id, estimateId: id, alreadyExisted: false});
  expect(response.headers.get('cache-control')).toBe('private, no-store');
});
it('reports replay, conflicts and unknown save results truthfully', async () => {
  mocks.rpc.mockResolvedValueOnce({data: [{revision_id: id, estimate_id: id, already_existed: true}], error: null});
  expect((await (await POST(request())).json()).alreadyExisted).toBe(true);
  mocks.rpc.mockResolvedValueOnce({error: {code: '23505', message: 'private detail'}});
  expect((await POST(request())).status).toBe(409);
  mocks.rpc.mockResolvedValueOnce({data: null, error: null});
  expect((await POST(request())).status).toBe(503);
});
