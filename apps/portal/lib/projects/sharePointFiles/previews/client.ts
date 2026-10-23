import { z } from 'zod';
import { cachedPreview, PREVIEW_BATCH_BYTES, PREVIEW_BATCH_ITEMS, type CachedPreview, type PreviewBatchRequest } from './contracts';

const start = z.object({ kind: z.literal('project-preview-batch-v1'), projectId: z.string(), rootId: z.string(), folderId: z.string() }).strict();
const packet = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('preview'), item: cachedPreview }).strict(),
  z.object({ kind: z.literal('complete'), unavailable: z.array(z.string()).max(PREVIEW_BATCH_ITEMS) }).strict(),
]);
export class PreviewPreparationError extends Error {
  constructor(readonly disabled = false) { super('Preview preparation could not be verified.'); }
}
export async function fetchPreparedPreviews(projectId: string, input: PreviewBatchRequest, signal: AbortSignal, onItem: (item: CachedPreview, bytes: Uint8Array | null) => void) {
  const response = await fetch(`/api/staff/v1/projects/${encodeURIComponent(projectId)}/files/previews`, {
    method: 'POST', credentials: 'same-origin', cache: 'no-store', signal, headers: { 'content-type': 'application/json' }, body: JSON.stringify(input),
  });
  if (!response.ok || response.headers.get('content-type')?.split(';')[0] !== 'application/x-ndjson' || !response.body) {
    if (response.status === 503) { const error = await response.json().catch(() => null); if (error?.code === 'preview_cache_disabled') throw new PreviewPreparationError(true); }
    throw new PreviewPreparationError();
  }
  const reader = response.body.getReader(), decoder = new TextDecoder();
  let text = '', received = 0, decoded = 0, began = false, complete = false;
  const seen = new Set<string>(), allowed = new Set(input.items.map(item => item.id));
  let unavailable: string[] = [];
  async function line(value: string) {
    signal.throwIfAborted();
    if (!began) {
      const header = start.parse(JSON.parse(value));
      if (header.projectId !== projectId || header.rootId !== input.rootId || header.folderId !== input.folderId) throw new PreviewPreparationError();
      began = true; return;
    }
    if (complete) throw new PreviewPreparationError();
    const next = packet.parse(JSON.parse(value));
    if (next.kind === 'complete') {
      if (next.unavailable.some(id => !allowed.has(id) || seen.has(id)) || new Set(next.unavailable).size !== next.unavailable.length || seen.size + next.unavailable.length !== allowed.size) throw new PreviewPreparationError();
      unavailable = next.unavailable; complete = true; return;
    }
    const item = next.item;
    if (!allowed.has(item.id) || seen.has(item.id)) throw new PreviewPreparationError();
    seen.add(item.id);
    let bytes: Uint8Array | null = null;
    if (item.body !== undefined) {
      if (item.body.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(item.body)) throw new PreviewPreparationError();
      bytes = Uint8Array.from(atob(item.body), character => character.charCodeAt(0)); decoded += bytes.length;
      if (bytes.length !== item.size || decoded > PREVIEW_BATCH_BYTES) throw new PreviewPreparationError();
      const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array(bytes)));
      if ([...digest].map(byte => byte.toString(16).padStart(2, '0')).join('') !== item.hash) throw new PreviewPreparationError();
    }
    signal.throwIfAborted(); onItem(item, bytes);
  }
  try {
    for (;;) {
      const next = await reader.read(); if (next.done) break;
      received += next.value.length;
      if (received > 12 * 1024 * 1024) throw new PreviewPreparationError();
      text += decoder.decode(next.value, { stream: true });
      let index: number;
      while ((index = text.indexOf('\n')) !== -1) { await line(text.slice(0, index)); text = text.slice(index + 1); }
      if (text.length > 7 * 1024 * 1024 + 16_384) throw new PreviewPreparationError();
    }
    text += decoder.decode();
    if (!complete || text.length || !began) throw new PreviewPreparationError();
    return { unavailable };
  } catch (error) { await reader.cancel().catch(() => undefined); throw error; }
}
