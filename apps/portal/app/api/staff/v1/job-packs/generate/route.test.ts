import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireStaffSession = vi.fn();
const parseJsonBody = vi.fn();
const generateJobPackForQuoteVersion = vi.fn();

vi.mock('@/lib/api/staffApi', () => ({
  jsonError: (error: string, status: number) => new Response(JSON.stringify({ error }), { status, headers: { 'content-type': 'application/json' } }),
  jsonOk: (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }),
  parseJsonBody,
  requireStaffSession,
}));

vi.mock('@/lib/jobPacks/server', () => ({
  generateJobPackForQuoteVersion,
  isMissingSchemaError: () => false,
}));

describe('POST /api/staff/v1/job-packs/generate', () => {
  beforeEach(() => {
    vi.resetModules();
    requireStaffSession.mockReset();
    parseJsonBody.mockReset();
    generateJobPackForQuoteVersion.mockReset();
  });

  it('returns job-pack identity/status summary without commercial source metadata', async () => {
    requireStaffSession.mockResolvedValue({ user: { email: 'ops@example.com' } });
    parseJsonBody.mockResolvedValue({ ok: true, body: { projectId: 'proj_1', quoteVersionId: 'qv_1' } });
    generateJobPackForQuoteVersion.mockResolvedValue({
      id: 'jpg_1',
      projectId: 'proj_1',
      estimateId: 'est_1',
      quoteVersionId: 'qv_1',
      quoteStatus: 'SENT',
    });

    const mod = await import('./route');
    const res = await mod.POST(new Request('http://localhost/api/staff/v1/job-packs/generate', { method: 'POST' }));

    expect(res.status).toBe(201);
    expect(generateJobPackForQuoteVersion).toHaveBeenCalledWith({
      projectId: 'proj_1',
      quoteVersionId: 'qv_1',
      actor: 'ops@example.com',
    });
    const body = await res.json();
    expect(body.jobPack.quoteVersionId).toBe('qv_1');
    expect(JSON.stringify(body)).not.toContain('commercial_design_input');
    expect(JSON.stringify(body)).not.toContain('pricing_source_metadata');
  });
});
