import 'server-only';
import type { createGraph } from '../graph';
import { makePreview, previewHash, readPreviewSource, type PreviewSource } from './source';
import type { PreviewRepository } from './repository';

export async function prepareCachedPreview(repository: PreviewRepository, graph: Awaited<ReturnType<typeof createGraph>>, root: string, folderId: string, source: PreviewSource, signal: AbortSignal) {
  const existing = await repository.read(source.item.id, source.version, source.profile);
  if (existing) return existing;
  const key = repository.key(source.item.id, source.version, source.profile);
  let claim = await repository.command('build', { key });
  if (claim?.capacity === true) {
    const cleanup = await repository.command('cleanup');
    if (Array.isArray(cleanup?.paths) && cleanup.paths.length) { await repository.remove(cleanup.paths); await repository.command('cleaned', { paths: cleanup.paths }); }
    claim = await repository.command('build', { key });
  }
  if (claim?.claimed !== true) return null;
  const path = repository.path(key, claim.lease); let uploaded = false;
  try {
    const original = await readPreviewSource(graph, root, source, signal);
    const body = await makePreview(original, source.profile); signal.throwIfAborted();
    const hash = previewHash(body.bytes);
    await repository.upload(path, body.bytes, body.mime); uploaded = true;
    await repository.command('publish', { key, lease: claim.lease, folderId, itemId: source.item.id, version: source.version, profile: source.profile, size: body.bytes.length, mime: body.mime, hash });
    return { found: true as const, key, path, profile: source.profile, mime: body.mime, size: body.bytes.length, hash };
  } catch (error) {
    if (uploaded) await repository.remove([path]).catch(() => undefined);
    await repository.command('abort', { key, lease: claim.lease }).catch(() => undefined);
    throw error;
  }
}
