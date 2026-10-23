// @vitest-environment node
import sharp from 'sharp';
import { afterEach, expect, it, vi } from 'vitest';
import { makePreview, previewSource, readPreviewSource } from './source';
import type { createGraph } from '../graph';

const item = { id: 'photo', name: 'Original.jpg', size: 3, eTag: '"v1"', file: { mimeType: 'image/jpeg' } };
afterEach(() => vi.unstubAllGlobals());
it('prepares only strong-version bounded raster photos and ordinary PDFs', () => {
  expect(previewSource(item)?.profile).toBe('photo-v1');
  expect(previewSource({ ...item, file: { mimeType: 'application/pdf' } })?.profile).toBe('pdf-v1');
  for (const changed of [{ eTag: 'W/"v1"' }, { size: 0 }, { size: 11 * 1024 * 1024 }, { file: { mimeType: 'image/svg+xml' } }, { size: 6 * 1024 * 1024, file: { mimeType: 'application/pdf' } }]) expect(previewSource({ ...item, ...changed })).toBeNull();
});
it('makes a real bounded, oriented JPEG with existing sharp and preserves PDF bytes', async () => {
  const input = await sharp({ create: { width: 4032, height: 3024, channels: 3, background: '#509864' } }).jpeg().toBuffer();
  const result = await makePreview(input, 'photo-v1'), metadata = await sharp(result.bytes).metadata();
  expect(result.mime).toBe('image/jpeg'); expect(result.bytes.length).toBeLessThanOrEqual(512 * 1024);
  expect(metadata.width).toBeLessThanOrEqual(1600); expect(metadata.height).toBeLessThanOrEqual(1600);
  expect((await makePreview(new Uint8Array([1,2,3]), 'pdf-v1')).bytes).toEqual(Buffer.from([1,2,3]));
});
it.each([undefined, 'W/"v1"', '"v2"'])('rejects missing/weak/changed origin version %s rather than mislabelling stored bytes', async etag => {
  const graph = { download: vi.fn(async () => ({ url: 'https://fixture.test/body' })) } as unknown as Awaited<ReturnType<typeof createGraph>>;
  vi.stubGlobal('fetch', vi.fn(async () => new Response('abc', { headers: { ...(etag ? { etag } : {}), 'content-length': '3' } })));
  await expect(readPreviewSource(graph, 'root', previewSource(item)!, new AbortController().signal)).rejects.toThrow();
});
it('checks actual complete byte length and forwards cancellation without Graph bearer to the transport', async () => {
  const graph = { download: vi.fn(async () => ({ url: 'https://fixture.test/body' })) } as unknown as Awaited<ReturnType<typeof createGraph>>;
  const fetcher = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response('abc', { headers: { etag: '"v1"', 'content-length': '3' } })); vi.stubGlobal('fetch', fetcher);
  const controller = new AbortController();
  expect(await readPreviewSource(graph, 'root', previewSource(item)!, controller.signal)).toEqual(Buffer.from('abc'));
  expect(fetcher.mock.calls[0][1]).toMatchObject({ signal: controller.signal, redirect: 'error', cache: 'no-store' });
  expect(fetcher.mock.calls[0][1]).not.toHaveProperty('headers');
  fetcher.mockImplementation(async () => new Response('ab', { headers: { etag: '"v1"' } }));
  await expect(readPreviewSource(graph, 'root', previewSource(item)!, controller.signal)).rejects.toThrow();
});
