import { QueryClient } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import { discardProjectPreviews, PREVIEW_CACHE_MAX_BYTES, PREVIEW_LEASE_MS, readPreview, reconcileFolderPreviews, retainPreview, setPreviewOwner, type PreviewScope } from './projectFilePreviewCache';
import { ProjectPdfStream } from './ProjectPdfStream';
const scope: PreviewScope = { owner: 'host:staff', projectId: 'project', rootId: 'root', folderId: 'folder', itemId: 'file' };
const body = { bytes: new Uint8Array([1,2,3]), mime: 'image/png', name: 'Current.png', version: '"v1"' };
afterEach(() => vi.useRealTimers());
it('isolates owners, projects, roots and source versions and rejects late previous-owner insertion', () => {
  const client = new QueryClient(); setPreviewOwner(client, scope.owner); retainPreview(client, scope, body);
  expect(readPreview(client, scope, ['"v1"'])).toMatchObject(body);
  for (const changed of [{ projectId: 'other' }, { rootId: 'other' }, { owner: 'other' }]) expect(readPreview(client, { ...scope, ...changed }, ['"v1"'])).toBeNull();
  expect(readPreview(client, scope, ['"v2"'])).toBeNull(); retainPreview(client, scope, body);
  setPreviewOwner(client, 'next-owner'); retainPreview(client, scope, body); setPreviewOwner(client, scope.owner);
  expect(readPreview(client, scope, ['"v1"'])).toBeNull();
});
it('expires after the approved five-minute lease and keeps both count and byte budgets bounded', () => {
  vi.useFakeTimers(); const client = new QueryClient(); setPreviewOwner(client, scope.owner); retainPreview(client, scope, body);
  vi.advanceTimersByTime(PREVIEW_LEASE_MS); expect(readPreview(client, scope, [])).toBeNull();
  for (let index = 0; index < 9; index++) retainPreview(client, { ...scope, itemId: String(index) }, body);
  expect(readPreview(client, { ...scope, itemId: '0' }, [])).toBeNull();
  expect(readPreview(client, { ...scope, itemId: '8' }, [])).not.toBeNull();
  retainPreview(client, { ...scope, itemId: 'large' }, { ...body, bytes: new Uint8Array(PREVIEW_CACHE_MAX_BYTES) });
  expect(readPreview(client, { ...scope, itemId: '8' }, [])).toBeNull();
  retainPreview(client, { ...scope, itemId: 'too-large' }, { ...body, bytes: new Uint8Array(PREVIEW_CACHE_MAX_BYTES + 1) });
  expect(readPreview(client, { ...scope, itemId: 'too-large' }, [])).toBeNull();
});
it('removes observed deleted and changed files without treating partial cursor pages as a complete folder', () => {
  const client = new QueryClient(); setPreviewOwner(client, scope.owner); retainPreview(client, scope, body);
  reconcileFolderPreviews(client, scope.owner, scope.projectId, scope.rootId, scope.folderId, [], false);
  expect(readPreview(client, scope, [])).not.toBeNull();
  reconcileFolderPreviews(client, scope.owner, scope.projectId, scope.rootId, scope.folderId, [], true);
  expect(readPreview(client, scope, [])).toBeNull(); retainPreview(client, scope, body);
  discardProjectPreviews(client, scope.owner, scope.projectId); expect(readPreview(client, scope, [])).toBeNull();
});
it('replays a single PDF stream to viewers using copies so worker transfer cannot detach retained bytes', () => {
  const stream = new ProjectPdfStream(3), chunk = new Uint8Array([1,2]); stream.append(chunk);
  const read = vi.fn(), done = vi.fn(); const release = stream.subscribe(read, done);
  expect(read.mock.calls[0][0]).toEqual(chunk); expect(read.mock.calls[0][0]).not.toBe(chunk);
  stream.append(new Uint8Array([3])); stream.finish(); expect(done).toHaveBeenCalledTimes(1);
  release(); const replay = vi.fn(), replayDone = vi.fn(); stream.subscribe(replay, replayDone);
  expect(replay).toHaveBeenCalledTimes(2); expect(replayDone).toHaveBeenCalledTimes(1);
});
