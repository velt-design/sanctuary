import { readFileSync } from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  getSupabaseServerAuth: vi.fn(),
}));

vi.mock('@/lib/supabase/serverClient', () => ({
  getSupabaseServerAuth: h.getSupabaseServerAuth,
}));

describe('Design Package legacy task retirement', () => {
  beforeEach(() => {
    vi.resetModules();
    h.getSupabaseServerAuth.mockReset();
  });

  it('keeps design-request status mutation without a companion task RPC', async () => {
    const requestUuid = '11111111-1111-4111-8111-111111111111';
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: requestUuid,
        project_id: '22222222-2222-4222-8222-222222222222',
        estimate_id: null,
        request_version: 3,
        status: 'OPEN',
        priority_tier: 'TIER_2',
        price_total_inc_gst_cents: null,
        request_source: null,
        request_note: null,
        designer_note: null,
        assigned_designer: null,
        due_at: null,
        requested_at: null,
        started_at: null,
        completed_at: null,
        cancelled_at: null,
        updated_at: null,
      },
      error: null,
    });
    const updateEq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn(() => ({ eq: updateEq }));
    const rpc = vi.fn();
    const from = vi.fn((table: string) => {
      if (table !== 'design_package_requests') {
        throw new Error(`Unexpected table ${table}`);
      }
      return {
        select: () => ({ eq: () => ({ maybeSingle }) }),
        update,
      };
    });
    h.getSupabaseServerAuth.mockResolvedValue({ from, rpc });

    const { markDesignRequestStarted } = await import('./server');
    await expect(
      markDesignRequestStarted(`dpr_${requestUuid}`),
    ).resolves.toEqual({ requestId: `dpr_${requestUuid}` });

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'IN_PROGRESS',
        started_at: expect.any(String),
      }),
    );
    expect(updateEq).toHaveBeenCalledWith('id', requestUuid);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('contains no Design Package companion-task command call', () => {
    const source = readFileSync(
      path.join(
        process.cwd(),
        'apps/portal/lib/designPackages/server.ts',
      ),
      'utf8',
    );

    expect(source).not.toContain('project_command_sync_design_task');
    expect(source).toContain(".from('design_package_requests')");
  });
});
