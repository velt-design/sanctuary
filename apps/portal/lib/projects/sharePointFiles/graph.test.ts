import { afterEach, describe, expect, it, vi } from 'vitest';
import { createGraph } from './graph';
import type { SharePointConfig } from './config';
import type { ProjectFilesPhase } from './timing';
afterEach(() => vi.restoreAllMocks());
const cfg: SharePointConfig = { tenantId: '11111111-1111-4111-8111-111111111111', clientId: '22222222-2222-4222-8222-222222222222', driveId: 'drive', enquiriesItemId: 'enquiries', hostname: 'fixture.sharepoint.com', siteUrl: 'https://fixture.sharepoint.com/sites/Jobs', binding: 'a'.repeat(64), provisionEnabled: true };
const folder = (id: string, parent = 'root') => ({ id, name: id, folder: {}, parentReference: { id: parent, driveId: 'drive' } });
const file = { id: 'file', name: 'design.3dm', file: { mimeType: 'application/octet-stream' }, parentReference: { id: 'root', driveId: 'drive' } };
function mock(...responses: (object | Response)[]) {
  const fetcher = vi.fn();
  for (const value of [{ access_token: 'graph-secret', token_type: 'Bearer' }, { id: 'drive-root', name: 'Documents', folder: {}, parentReference: { driveId: 'drive' }, webUrl: 'https://fixture.sharepoint.com/sites/Jobs/Shared%20Documents' }, ...responses]) fetcher.mockResolvedValueOnce(value instanceof Response ? value : Response.json(value));
  return fetcher;
}
describe('Jobs Graph boundary', () => {
  it('keeps request order, options, results and cursor denial identical with optional observation', async () => {
    const run = async (observed: boolean, cursor?: string) => {
      const fetcher = mock(folder('leaf', 'middle'), folder('middle'), folder('root'), { value: [{ ...file, parentReference: { id: 'leaf', driveId: 'drive' } }] });
      const phases: ProjectFilesPhase[] = [], signal = AbortSignal.timeout(1000);
      const graph = await createGraph(cfg, 'oidc', signal, fetcher, observed ? phase => { phases.push(phase); throw new Error('unavailable observer'); } : undefined);
      let result: unknown; try { result = await graph.children('root', 'leaf', cursor); } catch (error) { result = { code: (error as { code: string }).code, status: (error as { status: number }).status }; }
      const calls = fetcher.mock.calls.map(([url, options]) => ({ url, ...options, signal: options.signal === signal, body: options.body?.toString() }));
      return { result, calls, phases };
    };
    const plain = await run(false), observed = await run(true);
    expect(observed.result).toEqual(plain.result); expect(observed.calls).toEqual(plain.calls);
    expect(observed.calls.map(call => new URL(call.url).pathname)).toEqual([
      `/${cfg.tenantId}/oauth2/v2.0/token`, '/v1.0/drives/drive/root', '/v1.0/drives/drive/items/leaf', '/v1.0/drives/drive/items/middle', '/v1.0/drives/drive/items/root', '/v1.0/drives/drive/items/leaf/children',
    ]);
    expect(observed.phases).toEqual(['token', 'library', 'ancestry', 'children']);
    const cursor = Buffer.from('https://graph.microsoft.com/v1.0/drives/other/items/leaf/children').toString('base64url');
    const denied = await run(false, cursor), deniedObserved = await run(true, cursor);
    expect(deniedObserved.result).toEqual({ code: 'invalid_request', status: 400 });
    expect(deniedObserved.result).toEqual(denied.result); expect(deniedObserved.calls).toEqual(denied.calls);
    expect(deniedObserved.calls).toHaveLength(5);
  });

  it('includes JSON body reading in token, library, ancestry and children durations', async () => {
    let clock = 0, index = 0; vi.spyOn(performance, 'now').mockImplementation(() => clock);
    const bodies = [{ access_token: 'synthetic-token', token_type: 'Bearer' }, { id: 'drive-root', name: 'Documents', folder: {}, parentReference: { driveId: 'drive' }, webUrl: cfg.siteUrl + '/Shared%20Documents' }, folder('root'), { value: [file] }];
    const fetcher = vi.fn(async () => {
      const body = bodies[index], delay = ++index * 10; clock += 2;
      return new Response(new ReadableStream({ pull(controller) { clock += delay; controller.enqueue(new TextEncoder().encode(JSON.stringify(body))); controller.close(); } }, { highWaterMark: 0 }));
    }) as unknown as typeof fetch;
    const phases: [ProjectFilesPhase, number][] = [];
    const graph = await createGraph(cfg, 'oidc', AbortSignal.timeout(1000), fetcher, (phase, duration) => phases.push([phase, duration]));
    await graph.children('root', 'root');
    expect(phases).toEqual([['token', 12], ['library', 22], ['ancestry', 32], ['children', 42]]);
  });
  it('checks ancestry and pages only within the configured drive and folder', async () => {
    const next = 'https://graph.microsoft.com/v1.0/drives/drive/items/root/children?$skiptoken=opaque';
    const fetcher = mock(folder('root'), { value: [file], '@odata.nextLink': next }, folder('root'), { value: [] });
    const graph = await createGraph(cfg, 'oidc', AbortSignal.timeout(1000), fetcher);
    const page = await graph.children('root', 'root');
    expect(page.items[0].name).toBe('design.3dm');
    await graph.children('root', 'root', page.cursor!);
    expect(fetcher.mock.calls.at(-1)?.[0]).toBe(next);
  });
  it('rejects cross-project IDs before requesting content', async () => {
    const fetcher = mock({ ...file, parentReference: { id: 'other', driveId: 'drive' } }, { id: 'other', name: 'other', folder: {} });
    const graph = await createGraph(cfg, 'oidc', AbortSignal.timeout(1000), fetcher);
    await expect(graph.download('root', 'file')).rejects.toMatchObject({ code: 'not_found' });
    expect(fetcher.mock.calls.some(call => String(call[0]).endsWith('/content'))).toBe(false);
  });
  it.each(['https://evil.test/steal', 'https://graph.microsoft.com/v1.0/drives/other/items/root/children', 'not-a-url'])('rejects forged page cursor %s', async target => {
    const fetcher = mock(folder('root'));
    const graph = await createGraph(cfg, 'oidc', AbortSignal.timeout(1000), fetcher);
    await expect(graph.children('root', 'root', Buffer.from(target).toString('base64url'))).rejects.toMatchObject({ code: 'invalid_request' });
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
  it('rejects remote shortcuts and changed IDs', async () => {
    for (const value of [{ ...folder('root'), remoteItem: { id: 'private' } }, folder('other')]) {
      const graph = await createGraph(cfg, 'oidc', AbortSignal.timeout(1000), mock(value));
      await expect(graph.item('root')).rejects.toMatchObject({ code: 'source_invalid' });
    }
  });
  it('reuses a folder after conflict without renaming or overwriting it', async () => {
    const fetcher = mock(new Response(null, { status: 409 }), { ...folder('cad'), name: '3 CAD' });
    const graph = await createGraph(cfg, 'oidc', AbortSignal.timeout(1000), fetcher);
    expect((await graph.ensureFolder('root', '3 CAD')).id).toBe('cad');
    expect(JSON.parse(fetcher.mock.calls[2][1].body)['@microsoft.graph.conflictBehavior']).toBe('fail');
    expect(fetcher.mock.calls[3][0]).toContain('root:/3%20CAD');
  });
  it.each(['https://evil.test/_layouts/15/download.aspx?token=x', 'https://fixture.sharepoint.com/sites/private', 'https://fixture.sharepoint.com:444/_layouts/15/download.aspx'])('rejects unapproved download endpoint %s', async location => {
    const graph = await createGraph(cfg, 'oidc', AbortSignal.timeout(1000), mock(file, folder('root'), new Response(null, { status: 302, headers: { location } })));
    await expect(graph.download('root', 'file')).rejects.toMatchObject({ code: 'source_invalid' });
  });
  it('returns only the provider-generated tenant download URL, without fetching it with bearer auth', async () => {
    const url = 'https://fixture.sharepoint.com/sites/Jobs/_layouts/15/download.aspx?token=ephemeral';
    const fetcher = mock(file, folder('root'), new Response(null, { status: 302, headers: { location: url } }));
    const graph = await createGraph(cfg, 'oidc', AbortSignal.timeout(1000), fetcher);
    expect((await graph.download('root', 'file')).url).toBe(url);
    expect(fetcher).toHaveBeenCalledTimes(5);
    expect(fetcher.mock.calls[4][1].redirect).toBe('manual');
  });
});
