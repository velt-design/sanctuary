import 'server-only';
import { graphId, type SharePointConfig } from './config';
import { ProjectFilesError } from './types';
import { measureProjectFilesPhase, type ProjectFilesTimingObserver } from './timing';
import { graphAccessToken } from './accessToken';
import { batchBodies, boundedJson, currentProjectLibrary, itemSchema, ITEM_SELECT as SELECT, LIBRARY_SELECT, parseItem, validateLibrary, type DriveItem } from './graphProtocol';
import { currentGraphContainment } from './graphContainment';

export async function createGraph(cfg: SharePointConfig, assertion: string, signal: AbortSignal, fetcher: typeof fetch = fetch, observer?: ProjectFilesTimingObserver, scope?: { rootId: string; itemId: string; download?: boolean }) {
  if (!assertion || assertion.length > 20000) throw new ProjectFilesError('access_required');
  const token = await measureProjectFilesPhase('token', observer, () => graphAccessToken(cfg, assertion, signal, fetcher, async exchangeSignal => boundedJson(await fetcher(`https://login.microsoftonline.com/${cfg.tenantId}/oauth2/v2.0/token`, {
    method: 'POST', redirect: 'error', cache: 'no-store', signal: exchangeSignal, headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: cfg.clientId, client_assertion: assertion, client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer', grant_type: 'client_credentials', scope: 'https://graph.microsoft.com/.default' }),
  }))));
  const base = `https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(cfg.driveId)}/items/`;
  const request = async (url: string, init?: RequestInit) => {
    const response = await fetcher(url, { ...init, redirect: 'error', cache: 'no-store', signal, headers: { authorization: `Bearer ${token.value}`, ...(init?.headers ?? {}) } });
    if (response.status === 401 || response.status === 403) token.invalidate();
    return response;
  };
  const libraryUrl = `https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(cfg.driveId)}/root?$select=${LIBRARY_SELECT}`;
  const currentItems = new Map<string, DriveItem>();
  if (scope) {
    graphId.parse(scope.rootId); graphId.parse(scope.itemId);
    const ids = [...new Set([scope.rootId, scope.itemId])];
    const requests = ids.map((id, index) => ({ id: `item${index}`, method: 'GET', url: (base + encodeURIComponent(id) + '?$select=' + SELECT + (scope.download && id === scope.itemId ? ',@microsoft.graph.downloadUrl' : '')).replace('https://graph.microsoft.com/v1.0', '') }));
    const proof = await measureProjectFilesPhase('source_batch', observer, async () => requests.length === 1
      ? new Map([['item0', await boundedJson(await request('https://graph.microsoft.com/v1.0' + requests[0].url))]])
      : batchBodies(await boundedJson(await request('https://graph.microsoft.com/v1.0/$batch', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ requests }) })), requests.map(value => value.id), token.invalidate));
    ids.forEach((id, index) => currentItems.set(id, parseItem(proof.get(`item${index}`), id, cfg.driveId)));
    const root = currentItems.get(scope.rootId)!;
    if (!root.folder) throw new ProjectFilesError('not_found', 404);
    if (!currentProjectLibrary(root, cfg)) await measureProjectFilesPhase('library', observer, async () => validateLibrary(await boundedJson(await request(libraryUrl)), cfg));
  } else await measureProjectFilesPhase('library', observer, async () => validateLibrary(await boundedJson(await request(libraryUrl)), cfg));
  const item = async (id: string): Promise<DriveItem> => {
    graphId.parse(id);
    return currentItems.get(id) ?? parseItem(await boundedJson(await request(base + encodeURIComponent(id) + '?$select=' + SELECT)), id, cfg.driveId);
  };
  const within = async (root: string, id: string) => {
    let current = await item(id); const requested = current; const seen = new Set<string>();
    const currentRoot = currentItems.get(root);
    if (currentRoot && currentGraphContainment(currentRoot, requested, cfg.driveId)) return requested;
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
    async download(root: string, id: string, ifNoneMatch?: string) {
      const found = await measureProjectFilesPhase('ancestry', observer, () => within(root, id)); if (!found.file) throw new ProjectFilesError('not_found', 404);
      if (ifNoneMatch && [found.eTag, found.cTag].includes(ifNoneMatch)) return { item: found, url: null, notModified: true as const };
      // A fresh metadata download URL is the same temporary capability as /content.
      // Use it only in this authorized request; omitted URLs keep the existing fallback.
      let location = found['@microsoft.graph.downloadUrl'];
      if (!location) {
        const response = await measureProjectFilesPhase('content_redirect', observer, () => fetcher(base + encodeURIComponent(id) + '/content', { redirect: 'manual', cache: 'no-store', signal, headers: { authorization: `Bearer ${token.value}` } }));
        if (response.status === 401 || response.status === 403) token.invalidate();
        if (response.status !== 302) throw new ProjectFilesError('source_unavailable');
        location = response.headers.get('location') ?? undefined;
      }
      if (!location) throw new ProjectFilesError('source_invalid');
      const url = new URL(location);
      if (url.protocol !== 'https:' || url.hostname !== cfg.hostname || url.port || url.username || url.password || url.hash || !/\/_layouts\/15\/download\.aspx$/i.test(url.pathname)) throw new ProjectFilesError('source_invalid');
      return { item: found, url: url.href, notModified: false as const };
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
