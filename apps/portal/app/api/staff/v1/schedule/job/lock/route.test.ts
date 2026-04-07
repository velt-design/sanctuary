import { describe, expect, it, vi } from 'vitest';

const runCommitmentMutation = vi.fn();

vi.mock('../commitmentMutation', () => ({
  runCommitmentMutation,
}));

describe('POST /api/staff/v1/schedule/job/lock', () => {
  it('delegates to runCommitmentMutation with lock', async () => {
    runCommitmentMutation.mockResolvedValueOnce(new Response(null, { status: 200 }));
    const mod = await import('./route');
    const req = new Request('http://localhost/api/staff/v1/schedule/job/lock', { method: 'POST' });
    const res = await mod.POST(req);
    expect(runCommitmentMutation).toHaveBeenCalledWith(req, 'lock');
    expect(res.status).toBe(200);
  });
});
