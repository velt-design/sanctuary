import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ auth: vi.fn(), load: vi.fn(), crew: vi.fn(), commit: vi.fn() }));
vi.mock('@/lib/api/staffApi', async () => ({ ...await vi.importActual('@/lib/api/staffApi'), requireStaffContext: mocks.auth }));
vi.mock('@/lib/scheduling/scheduleCommands', () => ({ commitKeepOverlap: mocks.commit }));
vi.mock('@/lib/scheduling/scheduleV2Server', () => ({
  loadScheduleContext: mocks.load, buildCrewContext: mocks.crew, isMissingSchemaError: () => false,
  formatCrewScheduleBlocks: (input: any) => ({ crew_id: input.crewRow.id, conflicts: input.recompute.conflicts, items: [], next_available_date: '2026-09-14' }),
}));
import { POST } from './route';
const crewId = '00000000-0000-4000-8000-000000000001';
const jobId = '00000000-0000-4000-8000-000000000002';
const conflict = { job_id: jobId, overlap_key: 'exact-dates' };
const request = (key = 'exact-dates') => new Request('http://localhost/api/staff/v1/schedule/overlap/keep', { method: 'POST', body: JSON.stringify({ crew_id: crewId, overlap_key: key }) });
beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ ok: true });
  mocks.load.mockResolvedValue({ crews: [{ id: crewId, schedule_revision: 7 }], today: '2026-09-08' });
  mocks.crew.mockReturnValue({ crewRow: { id: crewId }, jobs: [], jobsById: new Map(), downtimesById: new Map(), recompute: { anchor_date: '2026-09-08', conflicts: [conflict] } });
  mocks.commit.mockResolvedValue({ ok: true });
});
it('requires a staff session before reading or writing', async () => {
  mocks.auth.mockResolvedValue({ ok: false, response: new Response(null, { status: 401 }) });
  expect((await POST(request())).status).toBe(401);
  expect(mocks.load).not.toHaveBeenCalled();
});
it('rejects a stale overlap without acknowledging different dates', async () => {
  expect((await POST(request('old-dates'))).status).toBe(409);
  expect(mocks.commit).not.toHaveBeenCalled();
});
it('guards the exact crew and removes only the accepted conflict from the response', async () => {
  const response = await POST(request());
  expect(response.status).toBe(200);
  expect(mocks.commit).toHaveBeenCalledWith(expect.objectContaining({ scheduledJobId: jobId, overlapKey: 'exact-dates', writeGuard: { [crewId]: { revision: 7, anchor_date: '2026-09-08' } } }));
  expect((await response.json()).schedule.conflicts).toEqual([]);
});
it('preserves a concurrent-write rejection from the atomic command', async () => {
  mocks.commit.mockResolvedValue({ ok: false, status: 409, responseMessage: 'Crew changed' });
  expect((await POST(request())).status).toBe(409);
});
