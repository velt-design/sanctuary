// @vitest-environment node
import { createHash } from 'node:crypto';
import { expect, it, vi } from 'vitest';
import { readStaffMeta } from './staffRead';
import { sampleMetaReport } from './report';
import { metaCoverage } from '../../marketingPerformance/dataSources';

function fixture() {
  const id = '10000000-0000-4000-8000-000000000001';
  const source = { databaseUrl: 'postgres://unused', databaseSsl: false as const, token: 't'.repeat(32), sourceKey: 'synthetic', connectionId: id, environment: 'test' };
  const control = { actor: id, account: '123', binding: 'a'.repeat(64) };
  const report = { ...sampleMetaReport({ start: '2026-08-01', end: '2026-08-07' }), fetchedAt: new Date().toISOString() };
  const saved = () => { const payload = JSON.stringify(report); return { status: 'available', operation: id, generation: 1, payload,
    resultHash: createHash('sha256').update(payload).digest('hex'), expiresAt: new Date(Date.parse(report.fetchedAt) + 7 * 86400000).toISOString() }; };
  const command = vi.fn(async () => saved());
  return { report, saved, command, deps: { source: () => source, control: vi.fn(() => control), store: () => command } };
}
it('reads only retained source evidence, preserving fetch time and expiry without credential/provider calls', async () => {
  const f = fixture(), signal = new AbortController().signal;
  const result = await readStaffMeta(signal, f.deps);
  expect(f.command).toHaveBeenCalledExactlyOnceWith('read', null, signal);
  expect(result).toMatchObject({ status: 'available', accountId: '123', report: f.report, expiresAt: f.saved().expiresAt });
  expect(JSON.stringify(result)).not.toMatch(/binding|databaseUrl|token|resultHash/);
});
it.each(['hash', 'expired', 'future', 'duplicate', 'partial', 'changed-control', 'abort'])('withholds %s evidence', async mode => {
  const f = fixture(), controller = new AbortController();
  if (mode === 'hash') f.command.mockImplementation(async () => ({ ...f.saved(), resultHash: 'b'.repeat(64) }));
  if (mode === 'expired') f.report.fetchedAt = new Date(Date.now() - 8 * 86400000).toISOString();
  if (mode === 'future') f.report.fetchedAt = new Date(Date.now() + 60000).toISOString();
  if (mode === 'duplicate') f.report.campaigns.push(f.report.campaigns[0]);
  if (mode === 'partial') f.command.mockImplementation(async () => ({ ...f.saved(), payload: '{"complete":false}' }));
  if (mode === 'changed-control') f.deps.control.mockImplementationOnce(() => ({ actor: '20000000-0000-4000-8000-000000000001', account: '123', binding: 'a'.repeat(64) }));
  if (mode === 'abort') controller.abort();
  await expect(readStaffMeta(controller.signal, f.deps)).rejects.toThrow();
});
it('distinguishes missing from failed source access', async () => {
  const f = fixture();
  const missing = { ...f.deps, store: () => vi.fn(async () => ({ status: 'missing' })) };
  expect(await readStaffMeta(new AbortController().signal, missing)).toMatchObject({ status: 'missing' });
  f.command.mockRejectedValue(new Error('unavailable'));
  await expect(readStaffMeta(new AbortController().signal, f.deps)).rejects.toThrow();
});
it('keeps reported zero, missing spend, empty reports and old evidence distinct', async () => {
  const f = fixture(); f.report.campaigns.forEach(c => { c.spend = 0; });
  const result = await readStaffMeta(new AbortController().signal, f.deps);
  if (result.status !== 'available') throw Error('Expected report');
  expect(metaCoverage(result).totalSpend).toBe(0);
  result.report.campaigns[0].spend = null;
  expect(metaCoverage(result).totalSpend).toBeNull();
  result.report.campaigns = [];
  expect(metaCoverage(result).totalSpend).toBeNull();
  expect(metaCoverage(result, new Date(Date.now() + 48 * 3600000)).stale).toBe(true);
  expect(metaCoverage(result, new Date(Date.now() + 8 * 86400000)).expired).toBe(true);
});
