import 'server-only';
import { z } from 'zod';
import { graphId, type SharePointConfig } from './config';
import { ProjectFilesError } from './types';
import { measureProjectFilesPhase, type ProjectFilesTimingObserver } from './timing';

const itemSchema = z.object({
  id: graphId, name: z.string().min(1).max(400), size: z.number().int().nonnegative().optional(),
  parentReference: z.object({ id: graphId.optional(), driveId: graphId.optional() }).optional(),
  folder: z.object({ childCount: z.number().optional() }).optional(),
  file: z.object({ mimeType: z.string().optional() }).optional(),
  remoteItem: z.unknown().optional(), lastModifiedDateTime: z.string().optional(),
  '@microsoft.graph.downloadUrl': z.string().optional(),
});
type DriveItem = z.infer<typeof itemSchema>;
const SELECT = 'id,name,size,folder,file,parentReference,lastModifiedDateTime,remoteItem';
async function boundedJson(response: Response): Promise<Record<string, unknown>> {
  if (!response.ok) throw new ProjectFilesError([401, 403].includes(response.status) ? 'access_required' : response.status === 404 ? 'not_found' : 'source_unavailable', response.status === 404 ? 404 : 503);
  const reader = response.body?.getReader(); if (!reader) throw new ProjectFilesError('source_invalid');
  const chunks: Uint8Array[] = []; let bytes = 0;
  while (true) { const part = await reader.read(); if (part.done) break; bytes += part.value.length; if (bytes > 2_000_000) { await reader.cancel(); throw new ProjectFilesError('source_invalid'); } chunks.push(part.value); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>; } catch { throw new ProjectFilesError('source_invalid'); }
}
export async function createGraph(cfg: SharePointConfig, assertion: string, signal: AbortSignal, fetcher: typeof fetch = fetch, observer?: ProjectFilesTimingObserver) {
  if (!assertion || assertion.length > 20000) throw new ProjectFilesError('access_required');
  const token = await measureProjectFilesPhase('token', observer, async () => boundedJson(await fetcher(`https://login.microsoftonline.com/${cfg.tenantId}/oauth2/v2.0/token`, {
    method: 'POST', redirect: 'error', cache: 'no-store', signal, headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: cfg.clientId, client_assertion: assertion, client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer', grant_type: 'client_credentials', scope: 'https://graph.microsoft.com/.default' }),
  })));
  if (typeof token.access_token !== 'string' || !token.access_token || token.token_type !== 'Bearer') throw new ProjectFilesError('source_invalid');
  const base = `https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(cfg.driveId)}/items/`;
  const request = (url: string, init?: RequestInit) => fetcher(url, { ...init, redirect: 'error', cache: 'no-store', signal, headers: { authorization: `Bearer ${token.access_token}`, ...(init?.headers ?? {}) } });
  await measureProjectFilesPhase('library', observer, async () => {
    const drive = await boundedJson(await request(`https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(cfg.driveId)}/root?$select=id,name,webUrl,folder,parentReference,sharepointIds,remoteItem`));
    const root = itemSchema.safeParse(drive);
    if (!root.success || !root.data.folder || root.data.remoteItem || root.data.parentReference?.driveId !== cfg.driveId || typeof drive.webUrl !== 'string') throw new ProjectFilesError('source_invalid');
    const driveUrl = new URL(drive.webUrl), siteUrl = new URL(cfg.siteUrl);
    if (driveUrl.origin !== siteUrl.origin || decodeURIComponent(driveUrl.pathname).replace(/\/$/, '') !== siteUrl.pathname + '/Shared Documents' || driveUrl.username || driveUrl.password || driveUrl.hash || driveUrl.search) throw new ProjectFilesError('source_invalid');
    const ids = drive.sharepointIds as { siteUrl?: unknown } | undefined;
    if (ids?.siteUrl !== undefined && ids.siteUrl !== cfg.siteUrl) throw new ProjectFilesError('source_invalid');
  });
  const item = async (id: string): Promise<DriveItem> => {
    graphId.parse(id); const parsed = itemSchema.safeParse(await boundedJson(await request(base + encodeURIComponent(id) + '?$select=' + SELECT)));
    if (!parsed.success || parsed.data.id !== id || parsed.data.remoteItem || parsed.data.parentReference?.driveId && parsed.data.parentReference.driveId !== cfg.driveId) throw new ProjectFilesError('source_invalid');
    return parsed.data;
  };
  const within = async (root: string, id: string) => {
    let current = await item(id); const requested = current; const seen = new Set<string>();
    for (let depth = 0; depth < 40; depth++) {
      if (current.id === root) return requested;
      if (!current.parentReference?.id || seen.has(current.id)) break;
      seen.add(current.id); current = await item(current.parentReference.id);
    }
    throw new ProjectFilesError('not_found', 404);
  };
  return {
    item, within,
    async resolvePath(path: string) {
      const segments = path.split('/');
      if (!segments.length || segments.some(part => !part || part === '.' || part === '..' || /[\\\x00-\x1f]/.test(part))) throw new ProjectFilesError('invalid_request', 400);
      const raw = await boundedJson(await request(`https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(cfg.driveId)}/root:/${segments.map(encodeURIComponent).join('/')}?$select=${SELECT}`));
      const parsed = itemSchema.safeParse(raw);
      if (!parsed.success || !parsed.data.folder || parsed.data.remoteItem || parsed.data.parentReference?.driveId !== cfg.driveId || parsed.data.name !== segments.at(-1)) throw new ProjectFilesError('source_invalid');
      return parsed.data;
    },
    async children(root: string, folder: string, cursor?: string) {
      const parent = await measureProjectFilesPhase('ancestry', observer, () => within(root, folder)); if (!parent.folder) throw new ProjectFilesError('not_found', 404);
      const path = base + encodeURIComponent(folder) + '/children';
      let url = path + '?$top=100&$select=' + SELECT;
      if (cursor) {
        if (cursor.length > 8000 || !/^[A-Za-z0-9_-]+$/.test(cursor)) throw new ProjectFilesError('invalid_request', 400);
        try { url = Buffer.from(cursor, 'base64url').toString('utf8'); } catch { throw new ProjectFilesError('invalid_request', 400); }
        let parsed: URL;
        try { parsed = new URL(url); } catch { throw new ProjectFilesError('invalid_request', 400); }
        if (parsed.origin !== 'https://graph.microsoft.com' || parsed.pathname !== new URL(path).pathname || parsed.username || parsed.password || parsed.hash) throw new ProjectFilesError('invalid_request', 400);
      }
      const page = await measureProjectFilesPhase('children', observer, async () => boundedJson(await request(url)));
      if (!Array.isArray(page.value) || page.value.length > 200) throw new ProjectFilesError('source_invalid');
      const items = page.value.map(value => { const parsed = itemSchema.safeParse(value); if (!parsed.success || parsed.data.remoteItem || parsed.data.parentReference?.driveId !== cfg.driveId || parsed.data.parentReference?.id !== folder) throw new ProjectFilesError('source_invalid'); return parsed.data; });
      const next = page['@odata.nextLink'];
      if (next !== undefined && typeof next !== 'string') throw new ProjectFilesError('source_invalid');
      if (next) { const parsed = new URL(next as string); if (parsed.origin !== 'https://graph.microsoft.com' || parsed.pathname !== new URL(path).pathname || parsed.username || parsed.password || parsed.hash || (next as string).length > 6000) throw new ProjectFilesError('source_invalid'); }
      return { items, cursor: next ? Buffer.from(next as string).toString('base64url') : null };
    },
    async download(root: string, id: string) {
      const found = await within(root, id); if (!found.file) throw new ProjectFilesError('not_found', 404);
      const response = await fetcher(base + encodeURIComponent(id) + '/content', { redirect: 'manual', cache: 'no-store', signal, headers: { authorization: `Bearer ${token.access_token}` } });
      if (response.status !== 302) throw new ProjectFilesError('source_unavailable');
      const location = response.headers.get('location'); if (!location) throw new ProjectFilesError('source_invalid');
      const url = new URL(location);
      if (url.protocol !== 'https:' || url.hostname !== cfg.hostname || url.port || url.username || url.password || url.hash || !/\/_layouts\/15\/download\.aspx$/i.test(url.pathname)) throw new ProjectFilesError('source_invalid');
      return { item: found, url: url.href };
    },
    async ensureFolder(parentId: string, name: string) {
      graphId.parse(parentId);
      if (!name || name.length > 180 || /["*:<>?\/\\|#%\x00-\x1f]/.test(name) || /[. ]$/.test(name)) throw new ProjectFilesError('invalid_request', 400);
      const response = await request(base + encodeURIComponent(parentId) + '/children', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name, folder: {}, '@microsoft.graph.conflictBehavior': 'fail' }) });
      const value = response.status === 409
        ? await boundedJson(await request(base + encodeURIComponent(parentId) + ':/' + encodeURIComponent(name)))
        : await boundedJson(response);
      const parsed = itemSchema.safeParse(value);
      if (!parsed.success || !parsed.data.folder || parsed.data.remoteItem || parsed.data.name !== name || parsed.data.parentReference?.id !== parentId || parsed.data.parentReference?.driveId !== cfg.driveId) throw new ProjectFilesError('source_invalid');
      return parsed.data;
    },
  };
}
