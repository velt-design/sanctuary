import 'server-only';
import { createHash } from 'node:crypto';
import type { DriveItem } from '../graphProtocol';
import type { createGraph } from '../graph';
import { strongFileVersion } from '../fileVersion';
import { ProjectFilesError } from '../types';
import { PREVIEW_PDF_BYTES, PREVIEW_PHOTO_BYTES, PREVIEW_SOURCE_BYTES } from './contracts';

export type PreviewSource = { item: DriveItem; version: string; profile: 'photo-v1' | 'pdf-v1' };
export function previewSource(item: DriveItem): PreviewSource | null {
  const version = strongFileVersion(item.eTag) ?? strongFileVersion(item.cTag);
  const mime = item.file?.mimeType;
  if (!version || !item.size || item.size > PREVIEW_SOURCE_BYTES) return null;
  if (mime === 'application/pdf' && item.size <= PREVIEW_PDF_BYTES) return { item, version, profile: 'pdf-v1' };
  if (['image/jpeg', 'image/png', 'image/webp'].includes(mime ?? '')) return { item, version, profile: 'photo-v1' };
  return null;
}
export async function readPreviewSource(graph: Awaited<ReturnType<typeof createGraph>>, root: string, source: PreviewSource, signal: AbortSignal) {
  const result = await graph.download(root, source.item.id);
  if (!result.url) throw new ProjectFilesError('source_invalid');
  const response = await fetch(result.url, { cache: 'no-store', redirect: 'error', signal });
  const version = strongFileVersion(response.headers.get('etag'));
  const declared = Number(response.headers.get('content-length'));
  if (response.status !== 200 || !version || ![source.item.eTag, source.item.cTag].includes(version) || !response.body || declared > PREVIEW_SOURCE_BYTES) {
    await response.body?.cancel(); throw new ProjectFilesError('source_invalid');
  }
  const reader = response.body.getReader(), chunks: Uint8Array[] = []; let size = 0;
  try {
    for (;;) {
      const next = await reader.read(); if (next.done) break;
      signal.throwIfAborted(); size += next.value.byteLength;
      if (size > PREVIEW_SOURCE_BYTES || size > source.item.size!) throw new ProjectFilesError('source_invalid');
      chunks.push(next.value);
    }
  } catch (error) { await reader.cancel().catch(() => undefined); throw error; }
  if (size !== source.item.size || declared > 0 && size !== declared) throw new ProjectFilesError('source_invalid');
  return Buffer.concat(chunks);
}
export async function makePreview(bytes: Uint8Array, profile: PreviewSource['profile']) {
  if (profile === 'pdf-v1') return { bytes: Buffer.from(bytes), mime: 'application/pdf' as const };
  // Reuse the installed processor, without coupling this domain to booklet state.
  const sharp = (await import('sharp')).default;
  for (const width of [1600, 1200, 900]) {
    const output = await sharp(bytes, { limitInputPixels: 40_000_000, failOn: 'error' }).rotate().resize({ width, height: width, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 78 }).toBuffer();
    if (output.length <= PREVIEW_PHOTO_BYTES) return { bytes: output, mime: 'image/jpeg' as const };
  }
  throw new ProjectFilesError('source_invalid');
}
export const previewHash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
