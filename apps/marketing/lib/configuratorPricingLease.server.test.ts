import { afterEach, expect, it, vi } from 'vitest';
import { createConfiguratorPricingLease } from './configuratorPricingLease.server';
import type { getPublishedCostingConfiguration } from './publishedCostingConfiguration.server';

const published = (versionId = 'approved') => ({ provenance: { versionId } }) as Awaited<ReturnType<typeof getPublishedCostingConfiguration>>;
afterEach(() => { vi.useRealTimers(); });
it('deduplicates validation and reuses only the immutable approved version inside the original lease', async () => {
  vi.useFakeTimers(); vi.setSystemTime(100000);
  const retained: Promise<void>[] = [];
  const resolve = vi.fn().mockResolvedValue(published()); const read = createConfiguratorPricingLease(resolve, work => retained.push(work));
  const [a, b] = await Promise.all([read('approved'), read('approved')]);
  expect(resolve).toHaveBeenCalledTimes(1); expect(a).toBe(b); expect(a.expiresAt).toBe(130000);
  await vi.advanceTimersByTimeAsync(10000); expect(await read('approved')).toBe(a);
  expect(resolve).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(5000); expect((await read('approved')).expiresAt).toBe(130000);
  expect(retained).toHaveLength(1); await retained[0];
  expect((await read('approved')).expiresAt).toBe(145000);
  expect(resolve).toHaveBeenCalledTimes(2);
});
it('does not extend the deadline by validation time or serve a failed/changed publication on renewal', async () => {
  vi.useFakeTimers(); vi.setSystemTime(100000);
  const resolve = vi.fn().mockImplementation(async () => { await new Promise(done => setTimeout(done, 1000)); return published(); });
  const retained: Promise<void>[] = [];
  const read = createConfiguratorPricingLease(resolve, work => retained.push(work)), pending = read('approved');
  await vi.advanceTimersByTimeAsync(1000); expect((await pending).expiresAt).toBe(130000);
  await vi.advanceTimersByTimeAsync(14000); resolve.mockResolvedValue(published('revoked'));
  expect((await read('approved')).expiresAt).toBe(130000);
  await retained[0];
  resolve.mockRejectedValue(new Error('Unavailable'));
  await expect(read('approved')).rejects.toThrow('Unavailable');
  expect(resolve).toHaveBeenCalledTimes(3);
});
it('serves only the original still-valid lease during retained renewal, then waits or fails closed at expiry', async () => {
  vi.useFakeTimers(); vi.setSystemTime(100000);
  let reject!: (reason: Error) => void;
  const resolve = vi.fn().mockResolvedValueOnce(published()).mockImplementation(() => new Promise((_, fail) => { reject = fail; }));
  const retained: Promise<void>[] = [];
  const read = createConfiguratorPricingLease(resolve, work => retained.push(work));
  await read('approved'); await vi.advanceTimersByTimeAsync(15000);
  expect((await read('approved')).expiresAt).toBe(130000);
  expect((await read('approved')).expiresAt).toBe(130000);
  expect(resolve).toHaveBeenCalledTimes(2); expect(retained).toHaveLength(1);
  await vi.advanceTimersByTimeAsync(15000);
  const expired = read('approved'), rejected = expect(expired).rejects.toThrow('Denied');
  reject(new Error('Denied')); await rejected; await retained[0];
  resolve.mockResolvedValue(published('revoked'));
  await expect(read('approved')).rejects.toThrow('authorization changed');
});
it('checks each approval pin and rejects a late response from the previous pin', async () => {
  let complete!: (value: ReturnType<typeof published>) => void;
  const resolve = vi.fn().mockImplementationOnce(() => new Promise(done => { complete = done; })).mockResolvedValue(published('new'));
  const read = createConfiguratorPricingLease(resolve);
  const old = read('old'); const rejected = expect(old).rejects.toThrow();
  expect((await read('new')).resolved.provenance.versionId).toBe('new');
  complete(published('old')); await rejected;
  expect((await read('new')).resolved.provenance.versionId).toBe('new');
  await expect(read('')).rejects.toThrow();
});
