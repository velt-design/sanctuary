import { describe, expect, it, vi } from 'vitest';
import { createGraph } from './graph';
import type { SharePointConfig } from './config';
const cfg: SharePointConfig = { tenantId: '11111111-1111-4111-8111-111111111111', clientId: '22222222-2222-4222-8222-222222222222', driveId: 'drive', enquiriesItemId: 'enquiries', hostname: 'fixture.sharepoint.com', siteUrl: 'https://fixture.sharepoint.com/sites/Jobs', binding: 'a'.repeat(64), provisionEnabled: true };
const folder = (id: string, parent = 'root') => ({ id, name: id, folder: {}, parentReference: { id: parent, driveId: 'drive' } });
const file = { id: 'file', name: 'design.3dm', file: { mimeType: 'application/octet-stream' }, parentReference: { id: 'root', driveId: 'drive' } };
function mock(...responses: (object | Response)[]) {
  const fetcher = vi.fn();
  for (const value of [{ access_token: 'graph-secret', token_type: 'Bearer' }, { id: 'drive-root', name: 'Documents', folder: {}, parentReference: { driveId: 'drive' }, webUrl: 'https://fixture.sharepoint.com/sites/Jobs/Shared%20Documents' }, ...responses]) fetcher.mockResolvedValueOnce(value instanceof Response ? value : Response.json(value));
  return fetcher;
}
describe('Jobs Graph boundary', () => {
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
