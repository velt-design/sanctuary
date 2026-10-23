import 'server-only';
import { z } from 'zod';
import { sharePointConfig } from '../config';
import { graphId } from '../ids';
import { createGraph } from '../graph';
import { previewRepository } from './repository';
import { previewSource } from './source';
import { prepareCachedPreview } from './cache';
import { ProjectFilesError } from '../types';

const claimSchema = z.object({ claimed: z.literal(true), projectId: z.uuid(), rootId: z.uuid(), itemId: graphId, folderId: graphId, cursor: z.string().max(8000).nullable(), lease: z.uuid(), generation: z.uuid() });
export async function cleanupProjectPreviews(signal: AbortSignal) {
  const maintenance = previewRepository('', undefined, undefined, signal);
  const cleanup = await maintenance.command('cleanup');
  if (!Array.isArray(cleanup?.paths) || cleanup.paths.length > 64) throw new Error('Invalid cleanup response');
  if (cleanup.paths.length) { await maintenance.remove(cleanup.paths); await maintenance.command('cleaned', { paths: cleanup.paths }); }
  return cleanup.paths.length as number;
}
/** One due folder page, at most two new originals, and finite garbage collection. */
export async function reconcileProjectPreviews(assertion: string, signal: AbortSignal) {
  const removed = await cleanupProjectPreviews(signal);
  const cfg = sharePointConfig(), maintenance = previewRepository(cfg.binding, undefined, undefined, signal);
  const raw = await maintenance.command('claim');
  if (raw?.claimed === false) return { updated: false, removed };
  const claim = claimSchema.parse(raw);
  const repository = previewRepository(cfg.binding, claim.projectId, claim.rootId, signal, claim.itemId);
  try {
    const graph = await createGraph(cfg, assertion, signal, undefined, undefined, { rootId: claim.itemId, itemId: claim.folderId });
    const page = await graph.children(claim.itemId, claim.folderId, claim.cursor ?? undefined);
    const sources = page.items.map(previewSource).filter(source => source !== null);
    const state = await repository.command('reconcile', { folderId: claim.folderId, lease: claim.lease, cursor: page.cursor,
      items: page.items.map(item => ({ id: item.id, version: sources.find(source => source.item.id === item.id)?.version ?? null })) });
    if (!Array.isArray(state?.prepare) || state.prepare.length > 2) throw new Error('Invalid preparation response');
    let prepared = 0;
    for (const id of state.prepare) {
      signal.throwIfAborted();
      const source = sources.find(source => source.item.id === id);
      if (source) {
        try { if (await prepareCachedPreview(repository, graph, claim.itemId, claim.folderId, source, signal)) prepared++; }
        catch (error) {
          signal.throwIfAborted();
          if (error instanceof ProjectFilesError && ['access_required', 'not_found'].includes(error.code)) throw error;
          // One bad representation cannot retire good private copies.
        }
      }
    }
    return { updated: true, prepared, removed, more: Boolean(page.cursor) };
  } catch (error) {
    const invalidate = error instanceof ProjectFilesError && ['access_required', 'not_found', 'source_invalid'].includes(error.code);
    await repository.command('fail', { folderId: claim.folderId, lease: claim.lease, invalidate }).catch(() => undefined);
    throw error;
  }
}
