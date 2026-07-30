import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RunningJobRow } from './types';

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
  loadRunningJobRow: vi.fn(),
  markScheduleDone: vi.fn(),
  markScheduleInProgress: vi.fn(),
  markProjectCompleted: vi.fn(),
}));

vi.mock('server-only', () => ({}));

vi.mock('@/lib/supabase/serverClient', () => ({
  getSupabaseServerAuth: vi.fn(async () => ({
    from: mocks.from,
    rpc: mocks.rpc,
  })),
}));

vi.mock('./server', () => ({
  loadRunningJobRow: (...args: unknown[]) => mocks.loadRunningJobRow(...args),
}));

vi.mock('@/app/api/staff/v1/schedule/job/mark-done/route', () => ({
  POST: (...args: unknown[]) => mocks.markScheduleDone(...args),
}));

vi.mock('@/app/api/staff/v1/schedule/job/mark-in-progress/route', () => ({
  POST: (...args: unknown[]) => mocks.markScheduleInProgress(...args),
}));

vi.mock('@/app/api/staff/v1/projects/[projectId]/action/confirm_schedule/route', () => ({
  POST: vi.fn(),
}));

vi.mock('@/app/api/staff/v1/projects/[projectId]/action/mark_deposit_received/route', () => ({
  POST: vi.fn(),
}));

vi.mock('@/app/api/staff/v1/projects/[projectId]/action/mark_paid/route', () => ({
  POST: vi.fn(),
}));

vi.mock('@/app/api/staff/v1/projects/[projectId]/action/mark_completed/route', () => ({
  POST: (...args: unknown[]) => mocks.markProjectCompleted(...args),
}));

vi.mock('@/app/api/staff/v1/schedule/job/assign/route', () => ({ POST: vi.fn() }));
vi.mock('@/app/api/staff/v1/schedule/job/pin/route', () => ({ POST: vi.fn() }));
vi.mock('@/app/api/staff/v1/schedule/job/set-duration/route', () => ({ POST: vi.fn() }));

function makeRow(modelVersion: 2 | null): RunningJobRow {
  return {
    projectId: 'proj_11111111-1111-4111-8111-111111111111',
    source: 'live',
    groupYear: null,
    sourceRowNumber: null,
    contactId: null,
    siteVisitEventId: null,
    scheduledJobId: 'scheduled-job-1',
    latestEstimateId: null,
    latestQuoteVersionId: null,
    legacy: null,
    stage: 'SCHEDULED',
    sortDate: '2026-07-29',
    rowVersion: 'row-v1',
    displayTextByCell: {},
    cells: {
      client_name: 'Customer',
      phone_number: '',
      site_address: '',
      site_visit_rep: null,
      deposit_paid_date: null,
      materials_ordered: false,
      pergola_type: '',
      estimated_start_date: '2026-07-29',
      final_payment_date: null,
      job_assigned_to: 'Crew',
      job_completed: false,
      lights_status: 'TBC',
      blinds_status: 'TBC',
      install_days: 2,
      size_text: '',
      colour_text: '',
      roofing_text: '',
      roofing_ordered: false,
      running_notes: '',
    },
    derived: {
      pergola_type: null,
      lights_status: 'TBC',
      blinds_status: 'TBC',
      size_text: null,
      colour_text: null,
      roofing_text: null,
    },
    state: {
      workModelVersion: modelVersion,
      projectCreatedAt: '2026-07-29T00:00:00.000Z',
      hasSiteVisit: false,
      hasSchedule: true,
      hasCrewAssigned: true,
      hasEstimatedStartDate: true,
      hasLatestEstimate: false,
      tasks: {
        materialsOrdered: false,
        roofingOrdered: false,
        jobComplete: false,
      },
      siteVisit: {
        salespersonId: null,
        status: null,
        updatedAt: null,
      },
      schedule: {
        crewId: 'crew-1',
        plannedStart: '2026-07-29',
        forecastStart: '2026-07-29',
        plannedDurationDays: 2,
        forecastDurationDays: 2,
        actualStart: null,
        actualFinish: null,
        status: 'scheduled',
        updatedAt: '2026-07-29T00:00:00.000Z',
      },
      meta: {
        rowVersion: modelVersion === 2 ? 4 : 0,
        lightsStatus: null,
        materialsOrderedAt: null,
        materialsOrderedBy: null,
        roofingOrderedAt: null,
        roofingOrderedBy: null,
        updatedAt: null,
      },
    },
  };
}

describe('applyRunningJobCellMutation work-model ownership', () => {
  beforeEach(() => {
    mocks.from.mockReset();
    mocks.rpc.mockReset();
    mocks.loadRunningJobRow.mockReset();
    mocks.markScheduleDone.mockReset();
    mocks.markScheduleInProgress.mockReset();
    mocks.markProjectCompleted.mockReset();
    mocks.loadRunningJobRow.mockImplementation(async () => makeRow(2));
    mocks.rpc.mockResolvedValue({ data: { row_version: 5 }, error: null });
    mocks.markScheduleDone.mockResolvedValue(Response.json({ ok: true }));
    mocks.markScheduleInProgress.mockResolvedValue(Response.json({ ok: true }));
    mocks.markProjectCompleted.mockResolvedValue(Response.json({ ok: true }));
  });

  it('writes V2 material state through the Running Jobs fact RPC', async () => {
    const { applyRunningJobCellMutation } = await import('./writeOps');
    const row = makeRow(2);

    await applyRunningJobCellMutation({
      projectId: row.projectId,
      projectUuid: '11111111-1111-4111-8111-111111111111',
      actorUserId: '22222222-2222-4222-8222-222222222222',
      currentRow: row,
      key: 'materials_ordered',
      value: true,
    });

    expect(mocks.rpc).toHaveBeenCalledWith('project_running_job_fact_command', expect.objectContaining({
      p_project_id: '11111111-1111-4111-8111-111111111111',
      p_fact: 'materials_ordered',
      p_value: true,
      p_expected_row_version: 4,
      p_command_id: expect.any(String),
    }));
    expect(mocks.from).not.toHaveBeenCalledWith('project_task_checks');
  });

  it('writes unmarked-project material state through the same fact RPC', async () => {
    mocks.loadRunningJobRow.mockImplementation(async () => makeRow(null));
    const { applyRunningJobCellMutation } = await import('./writeOps');
    const row = makeRow(null);

    await applyRunningJobCellMutation({
      projectId: row.projectId,
      projectUuid: '11111111-1111-4111-8111-111111111111',
      actorUserId: '22222222-2222-4222-8222-222222222222',
      currentRow: row,
      key: 'materials_ordered',
      value: true,
    });

    expect(mocks.rpc).toHaveBeenCalledWith('project_running_job_fact_command', expect.objectContaining({
      p_project_id: '11111111-1111-4111-8111-111111111111',
      p_fact: 'materials_ordered',
      p_value: true,
      p_expected_row_version: 0,
      p_command_id: expect.any(String),
    }));
    expect(mocks.from).not.toHaveBeenCalledWith('project_task_checks');
  });

  it('uses Schedule alone when a V2 job is completed', async () => {
    const { applyRunningJobCellMutation } = await import('./writeOps');
    const row = makeRow(2);

    await applyRunningJobCellMutation({
      projectId: row.projectId,
      projectUuid: '11111111-1111-4111-8111-111111111111',
      actorUserId: '22222222-2222-4222-8222-222222222222',
      currentRow: row,
      key: 'job_completed',
      value: true,
    });

    expect(mocks.markScheduleDone).toHaveBeenCalledTimes(1);
    expect(mocks.markProjectCompleted).not.toHaveBeenCalled();
    expect(mocks.from).not.toHaveBeenCalledWith('project_task_checks');
  });

  it('preserves the server-owned legacy completion lifecycle without task checks', async () => {
    const { applyRunningJobCellMutation } = await import('./writeOps');
    const row = makeRow(null);

    await applyRunningJobCellMutation({
      projectId: row.projectId,
      projectUuid: '11111111-1111-4111-8111-111111111111',
      actorUserId: '22222222-2222-4222-8222-222222222222',
      currentRow: row,
      key: 'job_completed',
      value: true,
    });

    expect(mocks.markScheduleDone).toHaveBeenCalledTimes(1);
    expect(mocks.markProjectCompleted).toHaveBeenCalledTimes(1);
    expect(mocks.from).not.toHaveBeenCalledWith('project_task_checks');
  });
});
