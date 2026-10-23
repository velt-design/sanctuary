// @vitest-environment node
import { createHash } from 'node:crypto';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { projectPreviewBatch } from './batch';
import { fetchPreparedPreviews } from './client';
import type { CachedPreview, PreviewBatchRequest } from './contracts';
import type { SupabaseClient } from '@supabase/supabase-js';

const h = vi.hoisted(() => ({ access: vi.fn(), repository: vi.fn() }));
vi.mock('../server', () => ({ projectGraph: h.access }));
vi.mock('./repository', () => ({ previewRepository: h.repository }));
const rootId = '11111111-1111-4111-8111-111111111111';
const input: PreviewBatchRequest = { rootId, folderId: 'folder', items: [{ id: 'file' }] };
let version = '"v1"', sourceReads = 0;
let bodies: Map<string, Buffer>, records: Map<string, Record<string, unknown>>, events: string[];
let source = Buffer.from('%PDF-1.7\nSynthetic private original');
function item(id: string) { return id === 'folder' ? { id, folder: {}, parentReference: { id: 'root' } } : { id, name: id+'.pdf', size: source.length, eTag: version, file: { mimeType: 'application/pdf' }, parentReference: { id: 'folder' } }; }
const db = {} as SupabaseClient;
beforeEach(() => {
  source = Buffer.from('%PDF-1.7\nSynthetic private original');
  version = '"v1"'; sourceReads = 0; bodies = new Map(); records = new Map(); events = []; vi.resetAllMocks();
  h.access.mockImplementation(async () => ({ cfg: { binding: 'source' }, root: { itemId: 'root' }, graph: {
    within: async (_root: string, id: string) => { events.push('proof:'+id); return item(id); },
    download: async (_root: string, id: string) => ({ item: item(id), url: 'https://fixture.test/'+id }),
  } }));
  h.repository.mockImplementation(() => {
    events.push('repository');
    return {
      key: (id: string, version: string) => id+version, path: (key: string) => key,
      read: async (id: string, version: string) => records.get(id+version) ?? null,
      command: async (action: string, data: Record<string, unknown>) => {
        if (action === 'build') return { claimed: true, lease: 'lease' };
        if (action === 'publish') records.set(data.key as string, { found: true, key: data.key, path: data.key, hash: data.hash, profile: data.profile, mime: data.mime, size: data.size });
        return { completed: true };
      },
      upload: async (path: string, bytes: Uint8Array) => { bodies.set(path, Buffer.from(bytes)); },
      bytes: async (record: { path: string }) => bodies.get(record.path)!, remove: async () => undefined,
    };
  });
  vi.stubGlobal('fetch', vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    if (String(url).startsWith('/api/')) return projectPreviewBatch(db, 'project', JSON.parse(init!.body as string), 'assertion', init!.signal as AbortSignal);
    sourceReads++; return new Response(source, { headers: { etag: version, 'content-length': String(source.length) } });
  }));
});
afterEach(() => vi.unstubAllGlobals());
it('proves all requested source items before private cache reads, then publishes and progressively delivers exact bytes', async () => {
  const result: CachedPreview[] = [];
  await fetchPreparedPreviews('project', { ...input, items: [{ id: 'file' }, { id: 'second' }] }, new AbortController().signal, item => result.push(item));
  expect(events.slice(0, 4)).toEqual(['proof:folder', 'proof:file', 'proof:second', 'repository']);
  expect(h.access).toHaveBeenCalledTimes(1); expect(sourceReads).toBe(2); expect(result).toHaveLength(2);
  expect(result[0]).toMatchObject({ profile: 'pdf-v1', mime: 'application/pdf', size: source.length, hash: createHash('sha256').update(source).digest('hex') });
});
it('retains current-source proof for each new delivery, but matching variant receipts avoid original and Storage-byte retransfers', async () => {
  let current!: CachedPreview;
  await fetchPreparedPreviews('project', input, new AbortController().signal, item => { current = item; });
  const received = vi.fn();
  await fetchPreparedPreviews('project', { ...input, items: [{ id: 'file', known: { version: current.version, hash: current.hash, profile: current.profile } }] }, new AbortController().signal, received);
  expect(h.access).toHaveBeenCalledTimes(2); expect(sourceReads).toBe(1); expect(received.mock.calls[0][1]).toBeNull();
});
it.each([[5 * 1024 * 1024, 1], [4 * 1024 * 1024, 2]])('streams actual protected batch and client parsing for %i-byte PDFs, count%i', async (size, count) => {
  source = Buffer.alloc(size, 32); source.write('%PDF-1.7\n');
  const received: number[] = [];
  await fetchPreparedPreviews('project', { ...input, items: Array.from({ length: count }, (_, index) => ({ id: 'large'+index })) }, new AbortController().signal, (_item, bytes) => received.push(bytes!.length));
  expect(received).toEqual(Array.from({ length: count }, () => size));
  expect(sourceReads).toBe(count); expect(bodies.size).toBe(count);
});
it('replaces changed source versions rather than issuing a stale success receipt', async () => {
  let current!: CachedPreview;
  await fetchPreparedPreviews('project', input, new AbortController().signal, item => { current = item; });
  version = '"v2"'; const received = vi.fn();
  await fetchPreparedPreviews('project', { ...input, items: [{ id: 'file', known: { version: current.version, hash: current.hash, profile: current.profile } }] }, new AbortController().signal, received);
  expect(received.mock.calls[0][0].version).toBe('"v2"'); expect(received.mock.calls[0][1]).not.toBeNull(); expect(sourceReads).toBe(2);
});
it.each(['denied', 'deleted', 'moved'])('fails the entire current proof before any private read on one %s subresponse', async kind => {
  h.access.mockResolvedValue({ cfg: { binding: 'source' }, root: { itemId: 'root' }, graph: { within: async (_root: string, id: string) => {
    if (id === 'second') { if (kind !== 'moved') throw new Error(kind); return { ...item(id), parentReference: { id: 'elsewhere' } }; }
    return item(id);
  } } });
  await expect(projectPreviewBatch(db, 'project', { ...input, items: [{ id: 'file' }, { id: 'second' }] }, 'assertion', new AbortController().signal)).rejects.toThrow();
  expect(h.repository).not.toHaveBeenCalled(); expect(sourceReads).toBe(0);
});
it('does not publish a body changed during transfer and reports that individual preparation unavailable', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(source, { headers: { etag: '"v2"', 'content-length': String(source.length) } })));
  const response = await projectPreviewBatch(db, 'project', input, 'assertion', new AbortController().signal);
  const packets = (await response.text()).trim().split('\n').map(value => JSON.parse(value));
  expect(packets.at(-1)).toEqual({ kind: 'complete', unavailable: ['file'] }); expect(records.size).toBe(0);
});
it('aborts request-owned source work when the recipient cancels the stream', async () => {
  let aborted = false;
  vi.stubGlobal('fetch', vi.fn((_url: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
    sourceReads++;
    init!.signal!.addEventListener('abort', () => { aborted = true; reject(new Error('cancelled')); }, { once: true });
  })));
  const response = await projectPreviewBatch(db, 'project', input, 'assertion', new AbortController().signal);
  const reader = response.body!.getReader(); await reader.read();
  await vi.waitFor(() => expect(sourceReads).toBe(1)); await reader.cancel();
  expect(aborted).toBe(true); expect(records.size).toBe(0);
});
