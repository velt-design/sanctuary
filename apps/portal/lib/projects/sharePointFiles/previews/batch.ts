import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { projectGraph } from '../server';
import { ProjectFilesError, projectFilesHeaders } from '../types';
import { previewRepository } from './repository';
import { prepareCachedPreview } from './cache';
import { previewSource, type PreviewSource } from './source';
import { PREVIEW_BATCH_BYTES, PREVIEW_SOURCE_BATCH_BYTES, type CachedPreview, type PreviewBatchRequest } from './contracts';

export async function projectPreviewBatch(db: SupabaseClient, projectId: string, input: PreviewBatchRequest, assertion: string, signal: AbortSignal) {
  const cancellation = new AbortController();
  signal = AbortSignal.any([signal, cancellation.signal]);
  const access = await projectGraph(db, projectId, input.rootId, assertion, signal, input.folderId, undefined, input.items.map(item => item.id));
  const folder = await access.graph.within(access.root.itemId, input.folderId);
  if (!folder.folder) throw new ProjectFilesError('not_found', 404);
  // Prove ALL requested items before any private Storage read or response byte.
  const sources: { requested: PreviewBatchRequest['items'][number]; source: PreviewSource | null }[] = [];
  for (const requested of input.items) {
    const item = await access.graph.within(access.root.itemId, requested.id);
    if (!item.file || item.parentReference?.id !== input.folderId) throw new ProjectFilesError('not_found', 404);
    sources.push({ requested, source: previewSource(item) });
  }
  const repository = previewRepository(access.cfg.binding, projectId, input.rootId, signal, access.root.itemId);
  await repository.command('touch', { folderId: input.folderId });
  const encoder = new TextEncoder(); let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (value: unknown) => {
        signal.throwIfAborted(); if (cancelled) throw new Error('Cancelled');
        const bytes = encoder.encode(JSON.stringify(value) + '\n');
        // Chunk the protected stream; large ordinary PDFs do not become a
        // buffered Vercel JSON response or a reusable Storage capability.
        for (let offset = 0; offset < bytes.length; offset += 64 * 1024) controller.enqueue(bytes.slice(offset, offset + 64 * 1024));
      };
      let admitted = 0, sourceBytes = 0;
      const unavailable: string[] = [];
      const deliver = async ({ requested, source }: typeof sources[number]): Promise<CachedPreview | null> => {
        signal.throwIfAborted(); if (cancelled || !source) return null;
        let record = await repository.read(requested.id, source.version, source.profile);
        const known = requested.known;
        const unchanged = record && known && known.hash === record.hash && known.version === source.version && known.profile === record.profile;
        const reserve = unchanged ? 0 : record?.size ?? (source.profile === 'pdf-v1' ? source.item.size! : 512 * 1024);
        if (admitted + reserve > PREVIEW_BATCH_BYTES) return null;
        admitted += reserve;
        if (!record) {
          if (sourceBytes + source.item.size! > PREVIEW_SOURCE_BATCH_BYTES) return null;
          sourceBytes += source.item.size!;
          try { record = await prepareCachedPreview(repository, access.graph, access.root.itemId, input.folderId, source, signal); }
          catch { signal.throwIfAborted(); return null; }
        }
        if (!record) return null;
        const item: CachedPreview = { id: requested.id, name: source.item.name, version: source.version, profile: source.profile, hash: record.hash, mime: record.mime, size: record.size };
        if (!unchanged) {
          let body: Buffer;
          try { body = await repository.bytes(record); }
          catch (error) { await repository.command('invalidate', { folderId: input.folderId }).catch(() => undefined); throw error; }
          signal.throwIfAborted();
          if (body.length > reserve) throw new ProjectFilesError('source_invalid');
          item.body = body.toString('base64');
        }
        return item;
      };
      try {
        send({ kind: 'project-preview-batch-v1', projectId, rootId: input.rootId, folderId: input.folderId });
        // Two independent preparations, with ready items emitted immediately.
        // No unrelated slow file blocks an already prepared neighbor.
        let next = 0;
        type Outcome = { index: number; item?: CachedPreview | null; error?: unknown };
        const active = new Map<number, Promise<Outcome>>();
        while (next < sources.length || active.size) {
          while (active.size < 2 && next < sources.length) {
            const index = next++;
            active.set(index, deliver(sources[index]).then(item => ({ index, item }), error => ({ index, error })));
          }
          const result = await Promise.race(active.values()); active.delete(result.index);
          if (result.error) throw result.error;
          if (result.item) send({ kind: 'preview', item: result.item }); else unavailable.push(sources[result.index].requested.id);
        }
        send({ kind: 'complete', unavailable }); controller.close();
      } catch {
        if (!cancelled) { try { send({ kind: 'error' }); controller.close(); } catch { controller.error(new Error('Preview preparation cancelled')); } }
        cancellation.abort();
      }
    },
    cancel() { cancelled = true; cancellation.abort(); },
  });
  return new Response(stream, { headers: { ...projectFilesHeaders, 'Content-Type': 'application/x-ndjson', 'X-Content-Type-Options': 'nosniff' } });
}
