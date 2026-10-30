import { expect, it, vi } from 'vitest';
import { readProjectSiteAddress, selectProjectSiteAddress } from './siteAddress.server';
import type { SiteAddressSelection } from './siteAddressContract';

// Synthetic auth-bound database adapter; no external data or provider calls.
const id = '10000000-0000-4000-8000-000000000001';
const original = { id, site_address: 'Previously recorded text', updated_at: '2026-10-28T01:00:00Z' };
const selection: SiteAddressSelection = { action: 'select', requestId: id, sessionToken: id, placeId: 'fixture_place', address: '12 Example Road, Auckland, New Zealand', expectedUpdatedAt: original.updated_at };
function database() {
  let result: { data: unknown; error: unknown } = { data: original, error: null };
  const chain = { select: vi.fn(), eq: vi.fn(), abortSignal: vi.fn(), update: vi.fn(), maybeSingle: vi.fn(async () => result) };
  chain.select.mockReturnValue(chain); chain.eq.mockReturnValue(chain); chain.abortSignal.mockReturnValue(chain); chain.update.mockImplementation(patch => { result = { data: { ...original, ...patch }, error: null }; return chain; });
  return { client: { from: vi.fn(() => chain) } as any, chain, result: (value: typeof result) => { result = value; } };
}
function provider() { return { search: vi.fn(), validateSelection: vi.fn(async () => selection.address) }; }
const signal = () => new AbortController().signal;
it('reads only the existing canonical columns and honors caller visibility', async () => {
  const db = database(); expect(await readProjectSiteAddress(db.client, id, signal())).toEqual(original);
  expect(db.chain.select).toHaveBeenCalledWith('id,site_address,updated_at');
  db.result({ data: null, error: null }); await expect(readProjectSiteAddress(db.client, id, signal())).rejects.toMatchObject({ status: 404 });
});
it('validates before one narrow CAS write and verifies its returned canonical text', async () => {
  const db = database(), source = provider();
  expect(await selectProjectSiteAddress(db.client, original, selection, source, signal())).toMatchObject({ projectId: `proj_${id}`, address: selection.address });
  expect(source.validateSelection).toHaveBeenCalledOnce(); expect(db.chain.update).toHaveBeenCalledOnce();
  const patch = db.chain.update.mock.calls[0][0]; expect(Object.keys(patch).sort()).toEqual(['site_address', 'updated_at']);
  expect(patch.site_address).toBe(selection.address); expect(db.chain.eq).toHaveBeenCalledWith('updated_at', original.updated_at);
  expect(source.validateSelection.mock.invocationCallOrder[0]).toBeLessThan(db.chain.update.mock.invocationCallOrder[0]);
});
it('acknowledges the committed canonical row when the normal DB trigger returns a different microsecond timestamp', async () => {
  const db = database(), source = provider();
  const offeredTime = '2026-10-28T03:00:00.100Z', committedTime = '2026-10-28T03:00:00.107456+00:00';
  const clock = vi.spyOn(Date, 'now').mockReturnValue(Date.parse(offeredTime));
  db.chain.update.mockImplementation(patch => {
    // Mirrors projects_set_updated_at BEFORE UPDATE -> new.updated_at = now().
    db.result({ data: { ...original, ...patch, updated_at: committedTime }, error: null });
    return db.chain;
  });
  try {
    expect(await selectProjectSiteAddress(db.client, original, selection, source, signal())).toEqual({
      projectId: `proj_${id}`, address: selection.address, updatedAt: committedTime,
    });
    expect(db.chain.update.mock.calls[0][0].updated_at).toBe(offeredTime);
    expect(Date.parse(committedTime)).not.toBe(Date.parse(offeredTime));
    expect(db.chain.eq).toHaveBeenCalledWith('updated_at', original.updated_at);
    expect(db.chain.update).toHaveBeenCalledOnce(); expect(db.chain.maybeSingle).toHaveBeenCalledOnce();
  } finally { clock.mockRestore(); }
});
it.each([
  { ...original, id: 'foreign-project', site_address: selection.address },
  { ...original, site_address: 'Different address' },
  { ...original, site_address: selection.address, updated_at: 'not-a-timestamp' },
  { ...original, site_address: selection.address, updated_at: null },
  { ...original, site_address: selection.address, updated_at: undefined },
])('does not acknowledge a malformed or mismatched returned committed row: %j', async returned => {
  const db = database(), source = provider();
  db.chain.update.mockImplementation(() => { db.result({ data: returned, error: null }); return db.chain; });
  await expect(selectProjectSiteAddress(db.client, original, selection, source, signal())).rejects.toMatchObject({ status: 503 });
  expect(db.chain.update).toHaveBeenCalledOnce(); expect(db.chain.maybeSingle).toHaveBeenCalledOnce();
});
it('refuses stale project state before spending a provider request', async () => {
  const db = database(), source = provider();
  await expect(selectProjectSiteAddress(db.client, { ...original, updated_at: '2026-10-28T02:00:00Z' }, selection, source, signal())).rejects.toMatchObject({ status: 409 });
  expect(source.validateSelection).not.toHaveBeenCalled(); expect(db.chain.update).not.toHaveBeenCalled();
});
it('treats distinct Postgres microseconds within one millisecond as conflicting version tokens', async () => {
  const db = database(), source = provider();
  const current = { ...original, updated_at: '2026-10-28T01:00:00.123456+00:00' };
  const stale = { ...selection, expectedUpdatedAt: '2026-10-28T01:00:00.123455+00:00' };
  expect(Date.parse(current.updated_at)).toBe(Date.parse(stale.expectedUpdatedAt));
  await expect(selectProjectSiteAddress(db.client, current, stale, source, signal())).rejects.toMatchObject({ status: 409 });
  expect(source.validateSelection).not.toHaveBeenCalled(); expect(db.chain.update).not.toHaveBeenCalled();
});
it('revalidates an already-saved address and rechecks current RLS state without another write', async () => {
  const db = database(), source = provider(), current = { ...original, site_address: selection.address, updated_at: '2026-10-28T02:00:00Z' };
  db.result({ data: current, error: null });
  expect(await selectProjectSiteAddress(db.client, current, selection, source, signal())).toMatchObject({ address: selection.address, updatedAt: current.updated_at });
  expect(source.validateSelection).toHaveBeenCalledOnce(); expect(db.chain.update).not.toHaveBeenCalled(); expect(db.chain.maybeSingle).toHaveBeenCalledOnce();
  db.result({ data: original, error: null }); await expect(selectProjectSiteAddress(db.client, current, selection, source, signal())).rejects.toMatchObject({ status: 409 });
});
it('does not write a correction or continue after provider failure/cancellation', async () => {
  const db = database(), source = provider(); source.validateSelection.mockResolvedValue('A corrected number');
  await expect(selectProjectSiteAddress(db.client, original, selection, source, signal())).rejects.toMatchObject({ status: 422 }); expect(db.chain.update).not.toHaveBeenCalled();
  source.validateSelection.mockRejectedValue(Error('synthetic failure'));
  await expect(selectProjectSiteAddress(db.client, original, selection, source, signal())).rejects.toThrow('synthetic failure'); expect(db.chain.update).not.toHaveBeenCalled();
  const aborted = new AbortController(); source.validateSelection.mockImplementation(async () => { aborted.abort(); return selection.address; });
  await expect(selectProjectSiteAddress(db.client, original, selection, source, aborted.signal)).rejects.toBeDefined(); expect(db.chain.update).not.toHaveBeenCalled();
});
it('does not report saved after a lost CAS or an unconfirmed returned write', async () => {
  const db = database(), source = provider();
  db.chain.update.mockImplementation(() => { db.result({ data: null, error: null }); return db.chain; });
  await expect(selectProjectSiteAddress(db.client, original, selection, source, signal())).rejects.toMatchObject({ status: 409 });
  db.chain.update.mockImplementation(() => { db.result({ data: original, error: null }); return db.chain; });
  await expect(selectProjectSiteAddress(db.client, original, selection, source, signal())).rejects.toMatchObject({ status: 503 });
});
