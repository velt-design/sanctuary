import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ client: {}, server: vi.fn(), create: vi.fn(), command: vi.fn(), summary: vi.fn(), snapshot: vi.fn(), payment: vi.fn() }));
vi.mock('@/lib/supabase/serverClient', () => ({ getSupabaseServerAuth: mocks.server }));
vi.mock('@/lib/projects/commandCentre/getProjectCommandCentre', () => ({ createProjectCommandCentreRead: mocks.create }));
vi.mock('@/lib/projects/getProjectPageSnapshot', () => ({ getProjectPageSummary: mocks.summary, getProjectPageSnapshot: mocks.snapshot }));
vi.mock('@/lib/invoices/adminPayments', () => ({ getProjectInvoiceSchedule: mocks.payment }));
import { loadProjectWorkInitialRead } from './loadProjectWorkInitialRead';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.server.mockResolvedValue(mocks.client);
  mocks.create.mockReturnValue({ read: mocks.command });
  for (const read of [mocks.summary, mocks.snapshot, mocks.command, mocks.payment]) read.mockImplementation(() => new Promise(() => {}));
});
describe('Work initial document reader', () => {
  it.each([false, true])('starts all independent reads without waiting and preserves exact financial authority admin=%s', async (isAdmin) => {
    const viewer = { userId: 'staff-a', isAdmin };
    const read = loadProjectWorkInitialRead('proj_1', viewer);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mocks.server).toHaveBeenCalledTimes(1);
    expect(mocks.create).toHaveBeenCalledWith('proj_1', mocks.client, viewer);
    expect(mocks.summary).toHaveBeenCalledWith('proj_1', undefined, mocks.client);
    expect(mocks.snapshot).toHaveBeenCalledWith('proj_1', undefined, mocks.client, 'staff-a', mocks.create.mock.results[0].value);
    expect(mocks.command).toHaveBeenCalledTimes(1);
    expect(mocks.payment).toHaveBeenCalledWith('proj_1', { includePaymentEntries: isAdmin });
    expect(read.ownerId).toBe('staff-a');
    expect(read).not.toHaveProperty('viewer');
  });

  it('keeps snapshot and payment failures separate from a complete command result', async () => {
    mocks.summary.mockResolvedValue({ project: { id: 'proj_1' } });
    mocks.snapshot.mockRejectedValue(new Error('private internal detail'));
    mocks.command.mockResolvedValue({ projectId: 'proj_1', workModel: 'v2' });
    mocks.payment.mockRejectedValue(new Error('private payment detail'));
    const { results } = loadProjectWorkInitialRead('proj_1', { userId: 'staff-a', isAdmin: false });
    expect(await results.summary).toMatchObject({ ok: true });
    expect(await results.command).toMatchObject({ ok: true });
    expect(await results.snapshot).toEqual({ ok: false, status: 500, message: 'Failed to load project snapshot' });
    expect(await results.payment).toEqual({ ok: false, status: 500, message: 'Failed to load invoice schedule' });
  });
});
