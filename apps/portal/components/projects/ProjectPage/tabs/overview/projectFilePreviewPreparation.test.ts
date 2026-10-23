// @vitest-environment node
import { createHash } from 'node:crypto';
import { QueryClient } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cancelProjectPreviewPreparation, prepareFolderPreviews, prepareSelectedPreview } from './projectFilePreviewPreparation';
import { readPreview, retainPreview, setPreviewOwner, subscribePreview } from './projectFilePreviewCache';
import { PreviewPreparationError } from '@/lib/projects/sharePointFiles/previews/client';
import type { ProjectFilesPage } from '@/lib/projects/sharePointFiles/types';
import type { CachedPreview, PreviewBatchRequest } from '@/lib/projects/sharePointFiles/previews/contracts';

const h = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock('@/lib/projects/sharePointFiles/previews/client', async () => ({ ...await vi.importActual('@/lib/projects/sharePointFiles/previews/client'), fetchPreparedPreviews: h.fetch }));
const folder = { owner: 'host:staff', projectId: 'project', rootId: '11111111-1111-4111-8111-111111111111', folderId: 'folder' };
const scope = (id: string) => ({ ...folder, itemId: id });
const item = (id: string, size = 3): ProjectFilesPage['items'][number] => ({ id, name: id+'.pdf', size, kind: 'file', contentType: 'application/pdf', viewable: true, modifiedAt: null, eTag: '"v1"' });
let client: QueryClient;
let transferred = 0;
async function deliver(_project: string, input: PreviewBatchRequest, signal: AbortSignal, callback: (item: CachedPreview, bytes: Uint8Array | null) => void) {
  for (const requested of input.items) {
    signal.throwIfAborted(); const size = requested.id.startsWith('large') ? 3 * 1024 * 1024 : 3, bytes = new Uint8Array(size), hash = createHash('sha256').update(bytes).digest('hex');
    const unchanged = requested.known?.hash === hash;
    if (!unchanged) transferred += size;
    callback({ id: requested.id, name: requested.id+'.pdf', size, hash, mime: 'application/pdf', profile: 'pdf-v1', version: '"v1"' }, unchanged ? null : bytes);
  }
  return { unavailable: [] };
}
beforeEach(() => { client = new QueryClient(); setPreviewOwner(client, folder.owner); transferred = 0; h.fetch.mockReset().mockImplementation(deliver); });
afterEach(() => { cancelProjectPreviewPreparation(client, folder.owner, folder.projectId); client.clear(); vi.restoreAllMocks(); });
it('prepares twenty distinct first-use files across folders, then exposes them without selection-time network work', async () => {
  const first = Array.from({ length: 10 }, (_, index) => item('a'+index)), second = Array.from({ length: 10 }, (_, index) => item('b'+index));
  prepareFolderPreviews(client, folder, first);
  prepareFolderPreviews(client, { ...folder, folderId: 'photos' }, second);
  await vi.waitFor(() => expect(readPreview(client, { ...folder, folderId: 'photos', itemId: 'b9' }, [], false)).not.toBeNull());
  expect(h.fetch).toHaveBeenCalledTimes(4);
  for (const entry of first) expect(readPreview(client, scope(entry.id), [entry.eTag])).not.toBeNull();
  for (const entry of second) expect(readPreview(client, { ...folder, folderId: 'photos', itemId: entry.id }, [entry.eTag])).not.toBeNull();
  expect(h.fetch).toHaveBeenCalledTimes(4);
});
it('renews already delivered variant receipts before expiry with no repeated body transfer', async () => {
  prepareFolderPreviews(client, folder, [item('a')]);
  await vi.waitFor(() => expect(readPreview(client, scope('a'), [], false)).not.toBeNull());
  expect(transferred).toBe(3);
  prepareFolderPreviews(client, folder, [item('a')], 'a', true);
  await vi.waitFor(() => expect(h.fetch).toHaveBeenCalledTimes(2));
  expect(transferred).toBe(3); expect(readPreview(client, scope('a'), [])?.profile).toBe('pdf-v1');
});
it('keeps foreground private-cache use working beyond32MiB cumulative transfer and evicts by resident memory', async () => {
  for (let index = 0; index < 12; index++) {
    const current = item('large'+index, 3 * 1024 * 1024);
    expect(await prepareSelectedPreview(client, scope(current.id), current, false)).toBe(true);
    expect(readPreview(client, scope(current.id), [])?.bytes.length).toBe(3 * 1024 * 1024);
  }
  expect(transferred).toBe(36 * 1024 * 1024); expect(h.fetch).toHaveBeenCalledTimes(12);
  expect(readPreview(client, scope('large0'), [])).toBeNull(); expect(readPreview(client, scope('large11'), [])).not.toBeNull();
});
it('does not admit late responses after an owner/project cancellation', async () => {
  let release!: () => void;
  h.fetch.mockImplementation(async (...args) => { await new Promise<void>(resolve => { release = resolve; }); return deliver(...args as Parameters<typeof deliver>); });
  prepareFolderPreviews(client, folder, [item('old')]); await vi.waitFor(() => expect(release).toBeDefined());
  cancelProjectPreviewPreparation(client, folder.owner, folder.projectId); setPreviewOwner(client, 'next-owner'); release();
  await new Promise(resolve => setImmediate(resolve)); expect(readPreview(client, scope('old'), [])).toBeNull();
});
it('joins a selected neighbor already in the active batch without cancelling its progressive delivery', async () => {
  let release!: () => void;
  h.fetch.mockImplementation(async (...args) => { await new Promise<void>(resolve => { release = resolve; }); return deliver(...args as Parameters<typeof deliver>); });
  prepareFolderPreviews(client, folder, [item('a'), item('b')]);
  await vi.waitFor(() => expect(release).toBeDefined());
  const selected = prepareSelectedPreview(client, scope('b'), item('b'), false);
  release(); expect(await selected).toBe(true);
  expect(h.fetch).toHaveBeenCalledOnce(); expect(h.fetch.mock.calls[0][2].aborted).toBe(false);
  expect(readPreview(client, scope('b'), [])).not.toBeNull();
});
it('purges displayed prepared bytes after a failed recheck, stops queued speculation, and allows an explicit retry', async () => {
  const bytes = new Uint8Array([0,0,0]), hash = createHash('sha256').update(bytes).digest('hex');
  retainPreview(client, scope('a'), { bytes, mime: 'application/pdf', name: 'a.pdf', version: '"v1"', profile: 'pdf-v1', hash }, true);
  const observed = vi.fn(); const release = subscribePreview(client, scope('a'), observed);
  h.fetch.mockRejectedValue(new PreviewPreparationError());
  expect(await prepareSelectedPreview(client, scope('a'), item('a'), true)).toBe(false);
  expect(readPreview(client, scope('a'), [])).toBeNull(); expect(observed).toHaveBeenCalledWith(null);
  prepareFolderPreviews(client, folder, [item('b')]); expect(h.fetch).toHaveBeenCalledTimes(1);
  h.fetch.mockImplementation(deliver); expect(await prepareSelectedPreview(client, scope('a'), item('a'), true)).toBe(true); release();
});
it('verifies a matching receipt against request bytes even if an earlier streamed neighbor evicted its resident', async () => {
  const bytes = new Uint8Array(3), hash = createHash('sha256').update(bytes).digest('hex');
  retainPreview(client, scope('a'), { bytes, mime: 'application/pdf', name: 'a.pdf', version: '"v1"', profile: 'pdf-v1', hash }, true);
  for (let index = 0; index < 31; index++) retainPreview(client, scope('old'+index), { bytes, mime: 'application/pdf', name: 'old.pdf', version: '"v1"' }, true);
  h.fetch.mockImplementationOnce(async (_project, input, signal, callback) => {
    expect(input.items[0].known.hash).toBe(hash);
    await deliver('project', { ...input, items: [{ id: 'b' }] }, signal, callback);
    expect(readPreview(client, scope('a'), [], false)).toBeNull();
    await deliver('project', { ...input, items: [input.items[0]] }, signal, callback);
    return { unavailable: [] };
  });
  prepareFolderPreviews(client, folder, [item('a'), item('b')], undefined, true);
  await vi.waitFor(() => expect(readPreview(client, scope('a'), [], false)).not.toBeNull());
  prepareFolderPreviews(client, folder, [item('next')]);
  await vi.waitFor(() => expect(readPreview(client, scope('next'), [], false)).not.toBeNull());
  expect(h.fetch).toHaveBeenCalledTimes(2);
});
