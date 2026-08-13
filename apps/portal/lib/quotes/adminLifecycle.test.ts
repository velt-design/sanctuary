import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
}));

vi.mock('@/lib/supabaseClient', () => ({
  supabaseServiceRole: { rpc: mocks.rpc },
}));
vi.mock('@/lib/supabase/mappers', () => ({
  uuidFromAppId: () => 'quote-version-uuid',
}));

import { markQuoteVersionSuperseded } from './adminLifecycle';

describe('manual quote superseding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each(['SENT', 'ACCEPTED'] as const)('retires a %s quote without touching its other records', async (status) => {
    mocks.rpc.mockResolvedValue({ data: [{ changed: true, previous_status: status }], error: null });

    await expect(markQuoteVersionSuperseded('qv_1', 'admin-1')).resolves.toEqual({
      changed: true,
      previousStatus: status,
    });
    expect(mocks.rpc).toHaveBeenCalledWith('commercial_mark_quote_superseded', {
      p_quote_version_id: 'quote-version-uuid', p_actor: 'admin-1',
    });
  });

  it('is idempotent once the quote is superseded', async () => {
    mocks.rpc.mockResolvedValue({ data: [{ changed: false, previous_status: 'SUPERSEDED' }], error: null });

    await expect(markQuoteVersionSuperseded('qv_1', 'admin-1')).resolves.toEqual({
      changed: false,
      previousStatus: 'SUPERSEDED',
    });
    expect(mocks.rpc).toHaveBeenCalledOnce();
  });
});
