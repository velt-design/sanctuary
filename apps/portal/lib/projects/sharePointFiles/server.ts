import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { uuidFromAppId } from '@/lib/supabase/mappers';
import { graphId, sharePointConfig } from './config';
import { createGraph } from './graph';
import { ProjectFilesError, type ProjectFilesPage } from './types';
import { measureProjectFilesPhase, type ProjectFilesTimingObserver } from './timing';

const snapshotSchema = z.object({
  state: z.enum(['ready', 'unlinked', 'pending', 'needs_attention', 'disabled']),
  roots: z.array(z.object({ id: z.uuid(), label: z.string(), itemId: graphId })),
  binding: z.string().optional(),
});
export const inlineTypes = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif']);
async function readFileRoots(db: SupabaseClient, projectId: string, observer?: ProjectFilesTimingObserver) {
  let id: string;
  try { id = uuidFromAppId(projectId, 'proj'); } catch { throw new ProjectFilesError('invalid_request', 400); }
  const result = await measureProjectFilesPhase('bindings_rpc', observer, () => db.rpc('project_files_read', { p_project_id: id }));
  if (result.error) throw new ProjectFilesError(result.error.code === 'P0002' ? 'not_found' : 'access_required', result.error.code === 'P0002' ? 404 : 403);
  const parsed = snapshotSchema.safeParse(result.data);
  if (!parsed.success) throw new ProjectFilesError('source_invalid');
  return parsed.data;
}
export async function projectGraph(db: SupabaseClient, projectId: string, rootId: string | undefined, assertion: string, signal: AbortSignal) {
  const snapshot = await readFileRoots(db, projectId);
  const cfg = sharePointConfig();
  if (snapshot.state !== 'ready' || snapshot.binding !== cfg.binding) throw new ProjectFilesError('not_configured');
  const root = rootId ? snapshot.roots.find(value => value.id === rootId) : snapshot.roots[0];
  if (!root) throw new ProjectFilesError('not_found', 404);
  return { snapshot, root, cfg, graph: await createGraph(cfg, assertion, signal) };
}
export async function listProjectFiles(db: SupabaseClient, projectId: string, input: { rootId?: string; folderId?: string; cursor?: string }, assertion: string, observer?: ProjectFilesTimingObserver): Promise<ProjectFilesPage> {
  const snapshot = await readFileRoots(db, projectId, observer);
  const empty = { roots: snapshot.roots, rootId: null, folderId: null, items: [], cursor: null };
  if (snapshot.state !== 'ready') return { ...empty, state: snapshot.state };
  const cfg = sharePointConfig();
  if (snapshot.binding !== cfg.binding) throw new ProjectFilesError('not_configured');
  const root = input.rootId ? snapshot.roots.find(value => value.id === input.rootId) : snapshot.roots[0];
  if (!root) throw new ProjectFilesError('not_found', 404);
  const graph = await createGraph(cfg, assertion, AbortSignal.timeout(45000), undefined, observer);
  const folderId = input.folderId ?? root.itemId;
  const page = await graph.children(root.itemId, folderId, input.cursor);
  return { state: 'ready', roots: snapshot.roots, rootId: root.id, folderId, cursor: page.cursor,
    items: page.items.map(item => ({ id: item.id, name: item.name, kind: item.folder ? 'folder' : 'file', size: item.size ?? 0, contentType: item.file?.mimeType ?? null, modifiedAt: item.lastModifiedDateTime ?? null, viewable: !!item.file && inlineTypes.has(item.file.mimeType ?? '') && (item.size ?? Infinity) <= 50_000_000 })) };
}
