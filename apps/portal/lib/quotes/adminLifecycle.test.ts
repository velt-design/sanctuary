import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  insertCommercialAuditEvent: vi.fn(),
}));

vi.mock('@/lib/supabaseClient', () => ({
  supabaseServiceRole: { from: mocks.from },
}));
vi.mock('@/lib/supabase/mappers', () => ({
  uuidFromAppId: () => 'quote-version-uuid',
}));
vi.mock('@/lib/commercial/audit', () => ({
  insertCommercialAuditEvent: mocks.insertCommercialAuditEvent,
}));

import { markQuoteVersionSuperseded } from './adminLifecycle';

function quoteVersionTable(status: string) {
  const loadResult = {
    data: {
      id: 'quote-version-uuid',
      status,
      quote_id: 'quote-uuid',
      quotes: { project_id: 'project-uuid' },
    },
    error: null,
  };
  const updateResult = { data: { id: 'quote-version-uuid' }, error: null };
  const load = {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({ maybeSingle: vi.fn().mockResolvedValue(loadResult) })),
    })),
  };
  const finalUpdate = { maybeSingle: vi.fn().mockResolvedValue(updateResult) };
  const updateSelect = { select: vi.fn(() => finalUpdate) };
  const updateStatus = { eq: vi.fn(() => updateSelect) };
  const updateId = { eq: vi.fn(() => updateStatus) };
  const update = vi.fn(() => updateId);
  return { table: { ...load, update }, update, updateId, updateStatus };
}

describe('manual quote superseding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.insertCommercialAuditEvent.mockResolvedValue('inserted');
  });

  it.each(['SENT', 'ACCEPTED'] as const)('retires a %s quote without touching its other records', async (status) => {
    const chain = quoteVersionTable(status);
    mocks.from.mockReturnValue(chain.table);

    await expect(markQuoteVersionSuperseded('qv_1', 'admin-1')).resolves.toEqual({
      changed: true,
      previousStatus: status,
    });
    expect(chain.update).toHaveBeenCalledWith(expect.objectContaining({
      status: 'SUPERSEDED',
      superseded_by: 'admin-1',
      accept_token_hash: null,
    }));
    expect(mocks.from).toHaveBeenCalledTimes(2);
    expect(mocks.from).toHaveBeenNthCalledWith(1, 'quote_versions');
    expect(mocks.from).toHaveBeenNthCalledWith(2, 'quote_versions');
    expect(mocks.insertCommercialAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
      projectId: 'project-uuid',
      type: 'quote.superseded',
      payload: expect.objectContaining({ previousStatus: status, actor: 'admin-1' }),
    }));
  });

  it('is idempotent once the quote is superseded', async () => {
    const chain = quoteVersionTable('SUPERSEDED');
    mocks.from.mockReturnValue(chain.table);

    await expect(markQuoteVersionSuperseded('qv_1', 'admin-1')).resolves.toEqual({
      changed: false,
      previousStatus: 'SUPERSEDED',
    });
    expect(chain.update).not.toHaveBeenCalled();
    expect(mocks.insertCommercialAuditEvent).not.toHaveBeenCalled();
  });
});
