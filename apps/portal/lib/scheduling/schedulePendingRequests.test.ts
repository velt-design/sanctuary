import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ owner: 'first-owner' as string | null, request: vi.fn() }));
vi.mock('@/lib/localFirst/store', () => ({ getLocalFirstStoreOwner: () => mocks.owner }));
vi.mock('@/lib/repo/apiClient', async () => ({ ...await vi.importActual('@/lib/repo/apiClient'), apiJson: mocks.request }));
import { ApiError } from '@/lib/repo/apiClient';
import { readPendingScheduleRequests, sendScheduleMutation } from './schedulePendingRequests';

describe('recoverable Schedule requests', () => {
  beforeEach(() => { window.localStorage.clear(); mocks.owner = 'first-owner'; mocks.request.mockReset(); });
  afterEach(() => window.localStorage.clear());
  it('retains exact intent after an ambiguous failure and isolates owners', async () => {
    mocks.request.mockRejectedValue(new Error('Connection lost'));
    const input = { job_id: 'job', requested_start_date: '2026-09-21', forecast_duration_days: 6 };
    await expect(sendScheduleMutation('/api/staff/v1/schedule/job/adjust', input)).rejects.toThrow('Connection lost');
    expect(readPendingScheduleRequests()).toEqual([expect.objectContaining({ input, state: 'unconfirmed' })]);
    mocks.owner = 'other-owner';
    expect(readPendingScheduleRequests()).toEqual([]);
    mocks.owner = 'first-owner';
    expect(readPendingScheduleRequests()).toHaveLength(1);
  });
  it('keeps concurrent rejected requests separately and clears only a successful request', async () => {
    mocks.request.mockRejectedValue(new ApiError('Stale crew', { status: 409, body: null }));
    await Promise.allSettled(['first', 'second'].map((job_id) => sendScheduleMutation('/api/staff/v1/schedule/job/pin', { job_id, requested_start_date: '2026-09-21' })));
    expect(readPendingScheduleRequests()).toHaveLength(2);
    expect(readPendingScheduleRequests().every((entry) => entry.state === 'rejected')).toBe(true);
    mocks.request.mockResolvedValue({ ok: true, crew_id: '00000000-0000-4000-8000-000000000001', schedule: { crew_id: '00000000-0000-4000-8000-000000000001', items: [], conflicts: [], next_available_date: '2026-09-28' } });
    await sendScheduleMutation('/api/staff/v1/schedule/job/pin', { job_id: 'third', requested_start_date: '2026-09-28' });
    expect(readPendingScheduleRequests().map((entry) => entry.input.job_id).sort()).toEqual(['first','second']);
  });
  it('recovers queued Board intent after the page runtime is lost', async () => {
    const { retainScheduleBoardIntent } = await import('./schedulePendingRequests');
    const input = { job_id: 'project', destination: 'Other crew', position: 2, operation: { destinationLaneId: 'other', insertionIndex: 2 } };
    retainScheduleBoardIntent(input);
    expect(readPendingScheduleRequests()).toEqual([]);
    vi.resetModules();
    const reloaded = await import('./schedulePendingRequests');
    expect(reloaded.readPendingScheduleRequests()).toEqual([expect.objectContaining({ path: 'board/placement', input })]);
  });
  it('does not discard intent after a malformed HTTP success', async () => {
    mocks.request.mockResolvedValue({ ok: true, schedule: {} });
    await expect(sendScheduleMutation('/api/staff/v1/schedule/job/pin', { job_id: 'job', requested_start_date: '2026-09-21' })).rejects.toThrow('invalid schedule response');
    expect(readPendingScheduleRequests()).toEqual([expect.objectContaining({ input: { job_id: 'job', requested_start_date: '2026-09-21' }, state: 'unconfirmed' })]);
  });
});
