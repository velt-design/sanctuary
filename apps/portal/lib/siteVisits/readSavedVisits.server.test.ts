import { afterEach, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { readSavedVisits } from './readSavedVisits.server';
vi.mock('server-only', () => ({}));
afterEach(() => vi.unstubAllEnvs());
it('preserves validation, saved RPC selection and the disabled provider flag', async () => {
  vi.stubEnv('SANCTUARY_OUTLOOK_ENABLED', 'false');
  const rpc = vi.fn().mockResolvedValue({ data: { enabled: true, events: [] }, error: null });
  const client = { rpc } as unknown as SupabaseClient, id = '00000000-0000-4000-8000-000000000001';
  for (const query of ['project=', 'project=x', 'visit=x', 'unknown=x', `visit=${id}&visit=${id}`]) {
    expect(await readSavedVisits(client, new URLSearchParams(query))).toMatchObject({ ok: false, status: 400 });
  }
  expect(rpc).not.toHaveBeenCalled();
  expect(await readSavedVisits(client, new URLSearchParams(`project=proj_${id}&visit=${id}`))).toEqual({ ok: true, data: { enabled: false, events: [] } });
  expect(rpc).toHaveBeenLastCalledWith('outlook_site_visit_detail_read', { p_visit: id, p_project: id });
  await readSavedVisits(client, new URLSearchParams());
  expect(rpc).toHaveBeenLastCalledWith('outlook_site_visits_read', { p_project: null });
});
it('keeps safe denial, schema and malformed-read errors retryable', async () => {
  const rpc = vi.fn(), client = { rpc } as unknown as SupabaseClient;
  for (const [response, status] of [[{ error: { code: '42501', message: 'private' } }, 403], [{ error: { code: '42883' } }, 503], [{ data: { events: {} } }, 503]] as const) {
    rpc.mockResolvedValueOnce(response);
    expect(await readSavedVisits(client, new URLSearchParams())).toEqual({ ok: false, status, message: 'Site visits could not be loaded.' });
  }
  rpc.mockRejectedValue(new Error('private provider detail'));
  expect(await readSavedVisits(client, new URLSearchParams())).toMatchObject({ ok: false, status: 503 });
});
