import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ auth: vi.fn(), summary: vi.fn(), config: vi.fn(), read: vi.fn(), access: vi.fn(), anchors: vi.fn() }));
vi.mock('@/lib/projects/correspondence/projectSendAnchors', () => ({ readProjectSendAnchors: mocks.anchors }));
vi.mock('@/lib/api/staffApi', async () => ({ ...await vi.importActual<object>('@/lib/api/staffApi'), requireStaffContext: mocks.auth }));
vi.mock('@/lib/projects/getProjectPageSnapshot', () => ({ getProjectPageSummary: mocks.summary }));
vi.mock('@/lib/projects/correspondence/gateway', () => ({ correspondenceGatewayConfig: mocks.config, readStaffCorrespondence: mocks.read }));
vi.mock('@/lib/portalAccess', () => ({ resolvePortalAccessState: mocks.access }));
import { GET, POST } from './route';

const projectUuid = '11111111-1111-4111-8111-111111111111';
const actorId = '22222222-2222-4222-8222-222222222222';
const projectId = `proj_${projectUuid}`;
const context = { params: Promise.resolve({ projectId }) };
const origin = 'https://portal.example.invalid';
const request = (init: RequestInit = {}) => new Request(`${origin}/api/staff/v1/projects/${projectId}/correspondence`, { method: 'POST', headers: { origin }, ...init });

beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue({ ok: true, session: { user: { id: actorId }, role: 'staff' }, supabase: {} });
  mocks.summary.mockResolvedValue({ project: { id: projectId } });
  mocks.config.mockReturnValue({ origin: 'https://velt.example.invalid', secret: 'test-only' });
  mocks.read.mockResolvedValue({ observedAt: '2026-09-17T00:00:00Z', answer: { sections: ['agreement', 'job_status', 'next_action'].map(topic => ({ topic, kind: 'unknown', answer: 'Not established', caveat: '', citations: [] })) }, sources: [], limitations: [], messages: [] });
  mocks.anchors.mockResolvedValue({ anchors: [], incomplete: true });
  mocks.access.mockResolvedValue({ kind: 'authenticated', session: { user: { id: actorId }, role: 'staff' } });
});
describe('staff correspondence route', () => {
  it('checks saved evidence through the receiver on GET without requesting a mailbox refresh', async () => {
    mocks.summary.mockResolvedValue({ project: { id: projectId, contactEmail: 'customer@example.test' } });
    mocks.config.mockReturnValue({ origin: 'https://velt.example.invalid', secret: 'test-only', snapshotsEnabled: true });
    expect((await GET(request({ method: 'GET' }), context)).status).toBe(200);
    expect(mocks.read).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ snapshot: {
      identityHash: expect.stringMatching(/^[a-f0-9]{64}$/), customerEmail: 'customer@example.test', refresh: false,
    } }), expect.any(AbortSignal));
    expect(mocks.access).toHaveBeenCalled();
  });
  it('withholds saved emails if the customer changes during the request', async () => {
    mocks.config.mockReturnValue({ origin: 'https://velt.example.invalid', secret: 'test-only', snapshotsEnabled: true });
    mocks.summary.mockResolvedValueOnce({ project: { id: projectId, contactEmail: 'one@example.test' } })
      .mockResolvedValueOnce({ project: { id: projectId, contactEmail: 'two@example.test' } });
    expect((await GET(request({ method: 'GET' }), context)).status).toBe(409);
  });
  it('returns availability when no saved result exists without inventing empty correspondence', async () => {
    mocks.summary.mockResolvedValue({ project: { id: projectId, contactEmail: 'customer@example.test' } });
    mocks.config.mockReturnValue({ origin: 'https://velt.example.invalid', secret: 'test-only', snapshotsEnabled: true });
    mocks.read.mockResolvedValue(null);
    expect(await (await GET(request({ method: 'GET' }), context)).json()).toMatchObject({ state: 'available' });
    expect(mocks.anchors).not.toHaveBeenCalled();
  });
  it('replaces remote association claims with project-bound evidence and strips raw headers', async () => {
    const base = await mocks.read();
    mocks.read.mockClear();
    mocks.read.mockResolvedValue({ ...base, messages: [{ id: 'reply', subject: 'Reply', from: 'customer@example.test',
      sentAt: base.observedAt, receivedAt: base.observedAt, observedAt: base.observedAt,
      url: 'https://outlook.office.com/mail/id/reply', bodyText: 'A customer reply', truncated: false,
      association: 'customer_address_only', lineage: { inReplyTo: ['<sent@example.test>'], references: [] },
      projectLink: { state: 'unconfirmed' } }] });
    mocks.anchors.mockResolvedValue({ anchors: [{ projectId: projectUuid, internetMessageId: '<sent@example.test>' }], incomplete: false });
    const response = await POST(request(), context);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.context.messages[0].projectLink).toEqual({ state: 'linked', basis: 'reply_chain' });
    expect(body.context.messages[0]).not.toHaveProperty('lineage');
    expect(mocks.anchors).toHaveBeenCalledWith(expect.anything(), projectUuid, expect.any(AbortSignal));
  });
  it('accepts a hosted empty POST stream with no caller-supplied data', async () => {
    const empty = request({ body: '' });
    expect(empty.body).not.toBeNull();
    const response = await POST(empty, context);
    expect(response.status).toBe(200);
    expect(mocks.read).toHaveBeenCalledWith(expect.anything(), { projectId: projectUuid, actorId }, expect.any(AbortSignal));
  });
  it.each([' ', '{}', '{"actorId":"other"}'])('rejects body bytes even when Content-Length claims zero: %s', async body => {
    const response = await POST(request({ body, headers: { origin, 'content-length': '0' } }), context);
    expect(response.status).toBe(400);
    expect(mocks.read).not.toHaveBeenCalled();
    expect(mocks.anchors).not.toHaveBeenCalled();
    expect(mocks.summary).not.toHaveBeenCalled();
  });
  it('forwards only the explicit interpretation choice after staff/project authorization', async () => {
    const response = await POST(new Request(`${origin}/api/staff/v1/projects/${projectId}/correspondence?analyze=true`, { method: 'POST', headers: { origin } }), context);
    expect(response.status).toBe(200);
    expect(mocks.read).toHaveBeenCalledWith(expect.anything(), { projectId: projectUuid, actorId, analyze: true }, expect.any(AbortSignal));
  });
  it('checks availability without any provider/model read', async () => {
    const response = await GET(request({ method: 'GET' }), context);
    expect(await response.json()).toEqual({ state: 'available' });
    expect(mocks.read).not.toHaveBeenCalled();
  });
  it('is default-dark even for an authenticated check', async () => {
    mocks.config.mockReturnValue(null);
    expect(await (await POST(request(), context)).json()).toEqual({ state: 'not_connected' });
    expect(mocks.read).not.toHaveBeenCalled();
  });
  it.each(['staff', 'admin'])('permits an authorized %s project read with server-derived actor and UUID', async role => {
    mocks.auth.mockResolvedValue({ ok: true, session: { user: { id: actorId }, role }, supabase: {} });
    const response = await POST(request(), context);
    expect(response.status).toBe(200);
    expect(mocks.read).toHaveBeenCalledWith(expect.anything(), { projectId: projectUuid, actorId }, expect.any(AbortSignal));
    expect(mocks.summary).toHaveBeenCalledTimes(2);
  });
  it.each([401, 403])('rejects authentication failure %s with private headers', async status => {
    mocks.auth.mockResolvedValue({ ok: false, response: Response.json({ error: 'Denied' }, { status }) });
    const response = await POST(request(), context);
    expect(response.status).toBe(status);
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(mocks.summary).not.toHaveBeenCalled();
    expect(mocks.read).not.toHaveBeenCalled();
  });
  it.each(['body', 'origin', 'hidden-project'])('rejects %s before gateway use', async kind => {
    if (kind === 'hidden-project') mocks.summary.mockResolvedValue(null);
    const response = await POST(request(kind === 'body' ? { body: JSON.stringify({ email: 'invented@example.invalid' }) } : kind === 'origin' ? { headers: { origin: 'https://other.invalid' } } : {}), context);
    expect(response.status).toBe(kind === 'body' ? 400 : kind === 'origin' ? 403 : 404);
    expect(mocks.read).not.toHaveBeenCalled();
  });
  it('discards completed evidence if staff access is revoked during the read', async () => {
    mocks.access.mockResolvedValue({ kind: 'no_access' });
    const response = await POST(request(), context);
    expect(response.status).toBe(403);
    expect(await response.text()).not.toContain('Verified transport');
  });
  it('discards completed evidence if project visibility changes during the read', async () => {
    mocks.summary.mockResolvedValueOnce({ project: { id: projectId } }).mockResolvedValueOnce(null);
    expect((await POST(request(), context)).status).toBe(404);
  });
  it('redacts remote failure details', async () => {
    mocks.read.mockRejectedValue(new Error('Secret credential and private email'));
    const response = await POST(request(), context);
    expect(response.status).toBe(503);
    expect(await response.text()).not.toMatch(/Secret|private email/);
  });
});
