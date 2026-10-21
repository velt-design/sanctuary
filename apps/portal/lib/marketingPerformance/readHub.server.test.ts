// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
const h = vi.hoisted(() => ({ snapshot: vi.fn(), rpc: vi.fn() }));
vi.mock('./readSnapshot', () => ({ readPreviewSnapshot: h.snapshot }));
import { hubFixture } from '@/app/qa/marketing-performance-fixture/hubFixtures';
import { SnapshotCoverageError } from './snapshotData';
import { readHub } from './readHub.server';
const client = { rpc: h.rpc } as unknown as Pick<SupabaseClient, 'rpc'>;
beforeEach(() => { vi.clearAllMocks(); h.snapshot.mockResolvedValue(null); h.rpc.mockResolvedValue({ data: hubFixture, error: null }); });
it('uses the existing guarded RPC and complete schema without a cross-request cache', async () => {
  expect(await readHub(client, hubFixture.start, hubFixture.end)).toEqual({ ok: true, report: hubFixture });
  expect(h.rpc).toHaveBeenLastCalledWith('marketing_sales_hub_read', { p_start: hubFixture.start, p_end: hubFixture.end });
  await readHub(client, hubFixture.start, hubFixture.end);
  expect(h.rpc).toHaveBeenCalledTimes(2);
  h.rpc.mockResolvedValue({ data: { ...hubFixture, end: '2026-09-21' }, error: null });
  expect(await readHub(client, hubFixture.start, hubFixture.end)).toMatchObject({ ok: false, status: 503, error: expect.stringContaining('No partial totals') });
});
it('retains safe denied, bound, malformed, thrown and snapshot results', async () => {
  for (const [code, status] of [['42501', 403], ['54000', 422], ['PGRST202', 503]]) {
    h.rpc.mockResolvedValue({ data: hubFixture, error: { code, message: 'private provider details' } });
    const result = await readHub(client, hubFixture.start, hubFixture.end);
    expect(result).toMatchObject({ ok: false, status }); expect(JSON.stringify(result)).not.toContain('private provider');
  }
  h.rpc.mockRejectedValue(new Error('private connection details'));
  expect(await readHub(client, hubFixture.start, hubFixture.end)).toEqual({ ok: false, status: 503, error: 'The hub could not be loaded. Please retry.' });
  h.rpc.mockClear(); h.snapshot.mockResolvedValue(hubFixture);
  expect(await readHub(client, hubFixture.start, hubFixture.end)).toEqual({ ok: true, report: hubFixture });
  expect(h.rpc).not.toHaveBeenCalled();
  h.snapshot.mockRejectedValue(new SnapshotCoverageError());
  expect(await readHub(client, hubFixture.start, hubFixture.end)).toEqual({ ok: false, status: 422, error: new SnapshotCoverageError().message });
});
it('rejects an invalid window before any snapshot or RPC work', async () => {
  expect(await readHub(client, '2026-02-30', hubFixture.end)).toMatchObject({ ok: false, status: 400 });
  expect(h.snapshot).not.toHaveBeenCalled(); expect(h.rpc).not.toHaveBeenCalled();
});
