import { beforeEach, expect, it, vi } from 'vitest';
import { observeStudioDocumentAuth } from './studioDocumentAuth';
const mocks = vi.hoisted(() => ({ initialize: vi.fn(), subscribe: vi.fn(), unsubscribe: vi.fn(), from: vi.fn() }));
vi.mock('@/lib/supabase/browserClient', () => ({ getSupabaseBrowser: () => ({
  auth: { initialize: mocks.initialize, onAuthStateChange: mocks.subscribe }, from: mocks.from,
}) }));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.subscribe.mockReturnValue({ data: { subscription: { unsubscribe: mocks.unsubscribe } } });
  mocks.initialize.mockResolvedValue({ error: null });
});
it('subscribes before initialization and returns only its subscription cleanup', async () => {
  const changed = vi.fn(), ready = vi.fn();
  const stop = observeStudioDocumentAuth(changed, ready);
  expect(mocks.subscribe).toHaveBeenCalledWith(changed);
  expect(mocks.initialize).not.toHaveBeenCalled();
  expect(typeof stop).toBe('function');
  await vi.waitFor(() => expect(ready).toHaveBeenCalledTimes(1));
  expect(mocks.initialize).toHaveBeenCalledTimes(1);
  expect(mocks.from).not.toHaveBeenCalled();
  stop();expect(mocks.unsubscribe).toHaveBeenCalledTimes(1);
});
it('settles readiness after failed cached initialization without granting access', async () => {
  mocks.initialize.mockRejectedValueOnce(new Error('Transport unavailable'));
  const ready = vi.fn(), stop = observeStudioDocumentAuth(vi.fn(), ready);
  stop();
  await vi.waitFor(() => expect(ready).toHaveBeenCalledTimes(1));
  expect(mocks.unsubscribe).toHaveBeenCalledTimes(1);
  expect(mocks.from).not.toHaveBeenCalled();
});
