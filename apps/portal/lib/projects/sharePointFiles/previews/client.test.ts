// @vitest-environment node
import { createHash } from 'node:crypto';
import { afterEach, expect, it, vi } from 'vitest';
import { fetchPreparedPreviews } from './client';
import type { PreviewBatchRequest } from './contracts';

const rootId = '11111111-1111-4111-8111-111111111111';
const input: PreviewBatchRequest = { rootId, folderId: 'folder', items: [{ id: 'file' }] };
const header = { kind: 'project-preview-batch-v1', projectId: 'project', rootId, folderId: 'folder' };
function item(bytes = Buffer.from('pdf')) { return { id: 'file', name: 'Current.pdf', version: '"v1"', profile: 'pdf-v1', hash: createHash('sha256').update(bytes).digest('hex'), mime: 'application/pdf', size: bytes.length, body: bytes.toString('base64') }; }
function response(packets: unknown[]) {
  const data = new TextEncoder().encode(packets.map(packet => JSON.stringify(packet)).join('\n') + '\n'); let offset = 0;
  return new Response(new ReadableStream({ pull(controller) { if (offset === data.length) { controller.close(); return; } const end = Math.min(offset + 64 * 1024, data.length); controller.enqueue(data.slice(offset, end)); offset = end; } }), { headers: { 'content-type': 'application/x-ndjson', 'cache-control': 'private, no-store' } });
}
afterEach(() => vi.unstubAllGlobals());
it('progressively verifies a full5MiB PDF over a >4.5MB chunked response without relying on custom headers', async () => {
  const bytes = Buffer.alloc(5 * 1024 * 1024, 65), prepared = item(bytes), onItem = vi.fn();
  vi.stubGlobal('fetch', vi.fn(async () => response([header, { kind: 'preview', item: prepared }, { kind: 'complete', unavailable: [] }])));
  await fetchPreparedPreviews('project', input, new AbortController().signal, onItem);
  expect(onItem).toHaveBeenCalledTimes(1); expect(Buffer.from(onItem.mock.calls[0][1]).equals(bytes)).toBe(true);
});
it('accepts an exact body-less variant receipt for the recipient cache owner to verify', async () => {
  const prepared = item(); delete (prepared as { body?: string }).body;
  vi.stubGlobal('fetch', vi.fn(async () => response([header, { kind: 'preview', item: prepared }, { kind: 'complete', unavailable: [] }])));
  const callback = vi.fn(); await fetchPreparedPreviews('project', input, new AbortController().signal, callback);
  expect(callback.mock.calls[0][1]).toBeNull();
});
it.each(['scope', 'hash', 'size', 'duplicate', 'truncated', 'stripped304', 'missing', 'error'])('fails closed on %s transport', async mode => {
  const prepared = item(); let packets: unknown[] = [header, { kind: 'preview', item: prepared }, { kind: 'complete', unavailable: [] }];
  if (mode === 'scope') packets[0] = { ...header, projectId: 'another' };
  if (mode === 'hash') prepared.hash = '0'.repeat(64);
  if (mode === 'size') prepared.size++;
  if (mode === 'duplicate') packets.splice(2, 0, { kind: 'preview', item: prepared });
  if (mode === 'truncated') packets.pop();
  if (mode === 'missing') packets = [header, { kind: 'complete', unavailable: [] }];
  if (mode === 'error') packets[1] = { kind: 'error' };
  vi.stubGlobal('fetch', vi.fn(async () => mode === 'stripped304' ? new Response(null, { status: 304, headers: { etag: '"v1"' } }) : response(packets)));
  await expect(fetchPreparedPreviews('project', input, new AbortController().signal, () => undefined)).rejects.toThrow();
});
it('makes the first completed item available before unrelated later bytes, and rejects an interrupted remainder', async () => {
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  vi.stubGlobal('fetch', vi.fn(async () => new Response(new ReadableStream({ start(value) { controller = value; } }), { headers: { 'content-type': 'application/x-ndjson' } })));
  const callback = vi.fn(); const request = fetchPreparedPreviews('project', input, new AbortController().signal, callback);
  await new Promise(resolve => setImmediate(resolve));
  controller.enqueue(new TextEncoder().encode(JSON.stringify(header) + '\n' + JSON.stringify({ kind: 'preview', item: item() }) + '\n'));
  await vi.waitFor(() => expect(callback).toHaveBeenCalledTimes(1));
  controller.close(); await expect(request).rejects.toThrow();
});
