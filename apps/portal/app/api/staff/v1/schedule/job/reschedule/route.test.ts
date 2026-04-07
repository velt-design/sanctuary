import { describe, expect, it, vi } from 'vitest';

const runCommitmentMutation = vi.fn();

vi.mock('../commitmentMutation', () => ({
  runCommitmentMutation,
}));

describe('POST /api/staff/v1/schedule/job/reschedule', () => {
  it('delegates to runCommitmentMutation with reschedule', async () => {
    runCommitmentMutation.mockResolvedValueOnce(new Response(null, { status: 200 }));
    const mod = await import('./route');
    const req = new Request('http://localhost/api/staff/v1/schedule/job/reschedule', { method: 'POST' });
    const res = await mod.POST(req);
    expect(runCommitmentMutation).toHaveBeenCalledWith(req, 'reschedule');
    expect(res.status).toBe(200);
  });
});
