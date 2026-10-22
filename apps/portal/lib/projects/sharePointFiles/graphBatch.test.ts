import { expect, it, vi } from 'vitest';
import { createGraph } from './graph';
import type { SharePointConfig } from './config';

const cfg: SharePointConfig = { tenantId: '11111111-1111-4111-8111-111111111111', clientId: '22222222-2222-4222-8222-222222222222', driveId: 'drive', enquiriesItemId: 'enquiries', hostname: 'fixture.sharepoint.com', siteUrl: 'https://fixture.sharepoint.com/sites/Jobs', binding: 'a'.repeat(64), provisionEnabled: true };
const oidc = () => `header.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 7200 })).toString('base64url')}.signature`;
const folder = (id: string, parent: string, name = id, path?: string) => ({ id, name, folder: {}, parentReference: { id: parent, driveId: 'drive', path } });
const root = { ...folder('project', 'clients', 'Project One', '/drive/root:/Clients'), webUrl: cfg.siteUrl + '/Shared%20Documents/Clients/Project%20One', sharepointIds: { siteUrl: cfg.siteUrl } };
const leaf = folder('leaf', 'middle', 'Deep', '/drive/root:/Clients/Project%20One/CAD');
const file = { id: 'drawing', name: 'Design.pdf', file: { mimeType: 'application/pdf' }, size: 123, eTag: '"version-1"', cTag: '"content-1"', parentReference: { id: 'leaf', driveId: 'drive', path: '/drive/root:/Clients/Project%20One/CAD/Deep' }, '@microsoft.graph.downloadUrl': 'https://fixture.sharepoint.com/sites/Jobs/_layouts/15/download.aspx?ephemeral=current' };
const library = { id: 'library', name: 'Documents', folder: {}, parentReference: { driveId: 'drive' }, webUrl: cfg.siteUrl + '/Shared%20Documents' };

function source(options: { file?: object; root?: object; leaf?: object; omitPath?: boolean; substatus?: number; malformed?: string; omitDownload?: boolean } = {}) {
  const items: Record<string, object> = { project: options.root ?? root, leaf: options.leaf ?? leaf, drawing: options.file ?? file, middle: folder('middle', 'project'), outside: folder('outside', 'library'), library: { id: 'library', name: 'Documents', folder: {} } };
  if (options.omitPath) for (const [id, item] of Object.entries(items)) items[id] = { ...item, parentReference: { ...(item as any).parentReference, path: undefined } };
  if (options.omitDownload) items.drawing = { ...items.drawing, '@microsoft.graph.downloadUrl': undefined };
  return vi.fn(async (url: string, init?: RequestInit) => {
    if (url.includes('/oauth2/')) return Response.json({ access_token: 'opaque-token', token_type: 'Bearer', expires_in: 3600 });
    if (url.endsWith('/$batch')) {
      const { requests } = JSON.parse(String(init?.body));
      const responses = requests.map((request: { id: string; url: string }) => ({ id: request.id, status: request.id === 'item1' && options.substatus ? options.substatus : 200, body: request.id === 'library' ? library : items[decodeURIComponent(request.url.split('/items/')[1].split('?')[0])] }));
      if (options.malformed === 'duplicate') responses[1] = responses[0];
      if (options.malformed === 'missing') responses.pop();
      return Response.json({ responses: responses.reverse() });
    }
    if (url.endsWith('/content')) return new Response(null, { status: 302, headers: { location: file['@microsoft.graph.downloadUrl'] } });
    if (url.includes('/drives/drive/root?')) return Response.json(library);
    if (url.includes('/children')) return Response.json({ value: [{ ...file, parentReference: { id: url.split('/items/')[1].split('/')[0], driveId: 'drive' } }] });
    const id = decodeURIComponent(url.split('/items/')[1].split('?')[0]);
    return items[id] ? Response.json(items[id]) : new Response(null, { status: 404 });
  });
}

it('keeps fresh root and deep list proof at one batch plus children, with only the first token exchange', async () => {
  const fetcher = source(), assertion = oidc(), signal = AbortSignal.timeout(5000);
  for (const itemId of ['project', 'leaf']) {
    const graph = await createGraph(cfg, assertion, signal, fetcher as typeof fetch, undefined, { rootId: 'project', itemId });
    await graph.children('project', itemId);
  }
  expect(fetcher.mock.calls.map(([url]) => url.includes('/oauth2/') ? 'token' : url.endsWith('/$batch') ? 'batch' : url.includes('/children') ? 'children' : 'metadata')).toEqual(['token', 'metadata', 'children', 'batch', 'children']);
  expect(fetcher.mock.calls.filter(([url]) => url.includes('/items/') && !url.includes('/children'))).toHaveLength(1);
});

it('uses current metadata URL and tags without a content-redirect lookup or URL retention', async () => {
  const fetcher = source(), assertion = oidc();
  const graph = await createGraph(cfg, assertion, AbortSignal.timeout(5000), fetcher as typeof fetch, undefined, { rootId: 'project', itemId: 'drawing', download: true });
  const result = await graph.download('project', 'drawing');
  expect(result.item.eTag).toBe('"version-1"'); expect(result.url).toBe(file['@microsoft.graph.downloadUrl']);
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(JSON.parse(String(fetcher.mock.calls[1][1]?.body)).requests.find((item: any) => item.id === 'item1').url).toContain('@microsoft.graph.downloadUrl');
});

it('retains the current source ancestry and /content fallback when optional metadata is absent', async () => {
  const fetcher = source({ omitPath: true, omitDownload: true });
  const graph = await createGraph(cfg, oidc(), AbortSignal.timeout(5000), fetcher as typeof fetch, undefined, { rootId: 'project', itemId: 'drawing', download: true });
  await graph.download('project', 'drawing');
  expect(fetcher.mock.calls.map(([url]) => url.includes('/items/') ? new URL(url).pathname.split('/').slice(-2).join('/') : url.endsWith('/$batch') ? 'batch' : 'token')).toEqual(['token', 'batch', 'items/leaf', 'items/middle', 'drawing/content']);
});

it('preserves ID-based rename recovery and denies a moved item before content access', async () => {
  const renamed = source({ root: { ...root, name: 'Renamed', webUrl: cfg.siteUrl + '/Shared%20Documents/Clients/Renamed' }, file: { ...file, parentReference: { ...file.parentReference, path: '/drive/root:/Clients/Renamed/CAD/Deep' } } });
  await (await createGraph(cfg, oidc(), AbortSignal.timeout(5000), renamed as typeof fetch, undefined, { rootId: 'project', itemId: 'drawing', download: true })).download('project', 'drawing');
  expect(renamed).toHaveBeenCalledTimes(2);
  const moved = source({ file: { ...file, parentReference: { id: 'outside', driveId: 'drive', path: '/drive/root:/OtherProject' } } });
  const graph = await createGraph(cfg, oidc(), AbortSignal.timeout(5000), moved as typeof fetch, undefined, { rootId: 'project', itemId: 'drawing', download: true });
  await expect(graph.download('project', 'drawing')).rejects.toMatchObject({ code: 'not_found' });
  expect(moved.mock.calls.some(([url]) => url.endsWith('/content'))).toBe(false);
});

it.each([401, 403, 404, 429, 503])('fails closed on an individual batch HTTP%s despite top-level200', async status => {
  const fetcher = source({ substatus: status });
  await expect(createGraph(cfg, oidc(), AbortSignal.timeout(5000), fetcher as typeof fetch, undefined, { rootId: 'project', itemId: 'drawing' })).rejects.toMatchObject({ code: [401, 403].includes(status) ? 'access_required' : status === 404 ? 'not_found' : 'source_unavailable' });
  expect(fetcher).toHaveBeenCalledTimes(2);
});
it.each(['duplicate', 'missing'])('rejects a malformed %s batch result without accepting partial source proof', async malformed => {
  await expect(createGraph(cfg, oidc(), AbortSignal.timeout(5000), source({ malformed }) as typeof fetch, undefined, { rootId: 'project', itemId: 'drawing' })).rejects.toMatchObject({ code: 'source_invalid' });
});
it.each([{ id: 'wrong' }, { remoteItem: { id: 'shortcut' } }, { parentReference: { driveId: 'foreign' } }])('rejects wrong source identity %s', async changed => {
  await expect(createGraph(cfg, oidc(), AbortSignal.timeout(5000), source({ file: { ...file, ...changed } }) as typeof fetch, undefined, { rootId: 'project', itemId: 'drawing' })).rejects.toMatchObject({ code: 'source_invalid' });
});

it('validates current metadata before304 without reading a download URL or original bytes', async () => {
  const fetcher = source({ omitDownload: true });
  const graph = await createGraph(cfg, oidc(), AbortSignal.timeout(5000), fetcher as typeof fetch, undefined, { rootId: 'project', itemId: 'drawing', download: true });
  expect(await graph.download('project', 'drawing', '"version-1"')).toMatchObject({ notModified: true, url: null });
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(fetcher.mock.calls.some(([url]) => url.endsWith('/content'))).toBe(false);
});
it.each([
  cfg.siteUrl + '/Shared%20Documents-other/Clients/Project%20One',
  cfg.siteUrl + '/Shared%20Documents/Other',
  cfg.siteUrl + '/Shared%20Documents/Clients%2fescape/Project%20One',
  'https://other.sharepoint.com/sites/Jobs/Shared%20Documents/Project%20One',
  cfg.siteUrl + '/Shared%20Documents/Clients/Project%20One?view=1',
])('falls back to fresh library proof for an unusable current project URL %s', async webUrl => {
  const fetcher = source({ root: { ...root, webUrl } });
  await createGraph(cfg, oidc(), AbortSignal.timeout(5000), fetcher as typeof fetch, undefined, { rootId: 'project', itemId: 'leaf' });
  expect(fetcher.mock.calls.some(([url]) => url.includes('/drives/drive/root?'))).toBe(true);
});
it('denies a current root belonging to a different configured site even when its URL appears valid', async () => {
  const fetcher = source({ root: { ...root, sharepointIds: { siteUrl: 'https://fixture.sharepoint.com/sites/Other' } } });
  await expect(createGraph(cfg, oidc(), AbortSignal.timeout(5000), fetcher as typeof fetch, undefined, { rootId: 'project', itemId: 'leaf' })).rejects.toMatchObject({ code: 'source_invalid' });
});
