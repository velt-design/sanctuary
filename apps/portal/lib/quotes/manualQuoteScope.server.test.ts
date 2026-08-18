// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  loadQuoteFamilyByCommercialScope: vi.fn(),
  from: vi.fn(),
}));

vi.mock('@/lib/supabaseClient', () => ({
  supabaseServiceRole: { from: mocks.from },
}));

vi.mock('./serverLoaders', () => ({
  loadQuoteFamilyByCommercialScope: mocks.loadQuoteFamilyByCommercialScope,
}));

import { resolveManualQuoteCommercialScopeId } from './manualQuoteScope.server';

function quoteVersionsResult(data: Array<{ status: string; accepted_at?: string | null }>) {
  mocks.from.mockReturnValue({
    select: () => ({
      eq: async () => ({ data, error: null }),
    }),
  });
}

describe('manual quote commercial scope', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.loadQuoteFamilyByCommercialScope.mockResolvedValue({ data: { id: 'base-quote' }, error: null });
  });

  it('keeps manual creation in the base family before acceptance', async () => {
    quoteVersionsResult([{ status: 'SENT', accepted_at: null }]);

    await expect(resolveManualQuoteCommercialScopeId('project-1', 'intent-1')).resolves.toBeNull();
  });

  it('uses a stable independent scope after the base enters the accepted lifecycle', async () => {
    quoteVersionsResult([{ status: 'SUPERSEDED', accepted_at: '2026-08-01T00:00:00.000Z' }]);

    const first = await resolveManualQuoteCommercialScopeId('project-1', 'intent-1');
    const replay = await resolveManualQuoteCommercialScopeId('project-1', 'intent-1');
    const otherIntent = await resolveManualQuoteCommercialScopeId('project-1', 'intent-2');

    expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(replay).toBe(first);
    expect(otherIntent).not.toBe(first);
  });

  it('keeps the first manual quote in the base family when no base family exists yet', async () => {
    mocks.loadQuoteFamilyByCommercialScope.mockResolvedValue({ data: null, error: null });

    await expect(resolveManualQuoteCommercialScopeId('project-1', 'intent-1')).resolves.toBeNull();
    expect(mocks.from).not.toHaveBeenCalled();
  });
});
