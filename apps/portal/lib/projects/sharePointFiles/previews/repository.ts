import 'server-only';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { uuidFromAppId } from '@/lib/supabase/mappers';
import { ProjectFilesError } from '../types';
import { PREVIEW_PDF_BYTES, previewProfile } from './contracts';

const BUCKET = 'project-file-previews';
const storedSchema = z.object({ found: z.literal(true), key: z.string().regex(/^[a-f0-9]{64}$/), path: z.string(), hash: z.string().regex(/^[a-f0-9]{64}$/), size: z.number().int().positive().max(PREVIEW_PDF_BYTES), mime: z.enum(['image/jpeg', 'application/pdf']), profile: previewProfile });
export type PreviewRepository = ReturnType<typeof previewRepository>;
export function previewRepository(binding: string, projectId?: string, rootId?: string, signal?: AbortSignal, rootItemId?: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new ProjectFilesError('not_configured');
  // Request-local service adapter keeps cancellation out of the shared client.
  // Its only database capability is the scoped cache RPC; bytes remain private.
  const supabaseServiceRole = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: {
    fetch: (resource, init) => fetch(resource, { ...init, cache: 'no-store', redirect: 'error', signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(10_000)]) : AbortSignal.timeout(10_000) }),
  } });
  const project = projectId ? uuidFromAppId(projectId, 'proj') : null;
  async function command(action: string, input: unknown = {}, scope = { projectId: project, rootId: rootId ?? null }) {
    signal?.throwIfAborted();
    const query = supabaseServiceRole.rpc('project_file_preview_cache', { p_action: action, p_binding: binding, p_project_id: scope.projectId, p_root_id: scope.rootId, p_input: { rootItemId, ...(input as Record<string, unknown>) } });
    const result = await (signal ? query.abortSignal(signal) : query);
    if (result.error) throw new ProjectFilesError('source_unavailable');
    return result.data;
  }
  return {
    command,
    key(itemId: string, version: string, profile: string) { return createHash('sha256').update(JSON.stringify([binding, project, rootId, itemId, version, profile])).digest('hex'); },
    path(key: string, lease: string) { return `${binding}/${project}/${rootId}/${key}-${lease}`; },
    async read(itemId: string, version: string, profile: string) {
      const raw = await command('read', { itemId, version, profile });
      if (raw?.found === false) return null;
      const record = storedSchema.parse(raw);
      if (!record.path.startsWith(`${binding}/${project}/${rootId}/${record.key}-`) || !/^[a-f0-9-]{36}$/.test(record.path.slice(-36))) throw new ProjectFilesError('source_invalid');
      return record;
    },
    async bytes(record: z.infer<typeof storedSchema>) {
      const result = await supabaseServiceRole.storage.from(BUCKET).download(record.path);
      signal?.throwIfAborted();
      if (result.error || !result.data || result.data.size !== record.size) throw new ProjectFilesError('source_unavailable');
      const bytes = Buffer.from(await result.data.arrayBuffer());
      if (createHash('sha256').update(bytes).digest('hex') !== record.hash) throw new ProjectFilesError('source_invalid');
      return bytes;
    },
    async upload(path: string, bytes: Uint8Array, mime: string) {
      signal?.throwIfAborted();
      const result = await supabaseServiceRole.storage.from(BUCKET).upload(path, bytes, { contentType: mime, cacheControl: '0', upsert: false });
      if (result.error) throw new ProjectFilesError('source_unavailable');
    },
    async remove(paths: string[]) {
      if (!paths.length || paths.length > 64 || paths.some(path => !/^[a-f0-9]{64}\/[a-f0-9-]{36}\/[a-f0-9-]{36}\/[a-f0-9]{64}-[a-f0-9-]{36}$/.test(path))) throw new ProjectFilesError('source_invalid');
      const result = await supabaseServiceRole.storage.from(BUCKET).remove(paths);
      if (result.error) throw new ProjectFilesError('source_unavailable');
    },
  };
}
