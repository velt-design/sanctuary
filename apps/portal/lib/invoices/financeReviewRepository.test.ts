import { afterEach, expect, it, vi } from 'vitest';
const rpc = vi.hoisted(() => vi.fn());
vi.mock('../supabaseClient', () => ({ supabaseServiceRole: { rpc } }));
import { loadFinanceReview } from './financeReviewRepository';
afterEach(() => vi.clearAllMocks());
it('passes the chosen view and offset to the authorised server query', async () => {
  rpc.mockResolvedValue({ data: { rows: [], checkedAt: '2026-09-15T00:00:00Z' }, error: null });
  expect(await loadFinanceReview('owner', 'invoice', 50, 'history')).toMatchObject({ rows: [], hasMore: false });
  expect(rpc).toHaveBeenCalledWith('xero_finance_review_filtered', { p_actor: 'owner', p_search: 'invoice', p_offset: 50, p_view: 'history' });
});
it('does not turn a missing migration or an invalid response into an empty queue', async () => {
  rpc.mockResolvedValue({ error: { message: 'function missing' } });
  await expect(loadFinanceReview('owner', '', 0)).rejects.toThrow('FINANCE_REVIEW_UNAVAILABLE');
  rpc.mockResolvedValue({ data: {}, error: null });
  await expect(loadFinanceReview('owner', '', 0)).rejects.toThrow('FINANCE_REVIEW_UNAVAILABLE');
});
