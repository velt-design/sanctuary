import { QueryClient } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import { discardProjectPreviews, PREVIEW_CACHE_MAX_BYTES, PREVIEW_LEASE_MS, readPreview, reconcileFolderPreviews, retainPreview, setPreviewOwner, subscribePreview, type PreviewScope } from './projectFilePreviewCache';
import { ProjectPdfStream } from './ProjectPdfStream';
import * as owner from './projectFilePreviewOwner';
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
  for (let index = 0; index < 33; index++) retainPreview(client, { ...scope, itemId: String(index) }, body);
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
it('admits useful new neighbors after forty distinct opened files without evicting each new preparation itself', () => {
  const client = new QueryClient(); setPreviewOwner(client, scope.owner);
  for (let index = 0; index < 40; index++) retainPreview(client, { ...scope, itemId: String(index) }, body);
  for (let index = 40; index < 48; index++) retainPreview(client, { ...scope, itemId: String(index) }, body, true);
  for (let index = 40; index < 48; index++) expect(readPreview(client, { ...scope, itemId: String(index) }, [], false)).not.toBeNull();
  expect(readPreview(client, { ...scope, itemId: '8' }, [])).toBeNull();
  expect(readPreview(client, { ...scope, itemId: '39' }, [])).not.toBeNull();
});
it('rejects an older in-flight publication after a newer version or deletion was observed', () => {
  const client = new QueryClient(); setPreviewOwner(client, scope.owner);
  reconcileFolderPreviews(client, scope.owner, scope.projectId, scope.rootId, scope.folderId, [{ id: 'file', name: 'New', kind: 'file', size: 3, modifiedAt: null, viewable: true, eTag: '"v2"' }], true, 200);
  retainPreview(client, scope, body, true, 100); expect(readPreview(client, scope, [])).toBeNull();
  retainPreview(client, scope, { ...body, version: '"v2"' }, true, 300); expect(readPreview(client, scope, [])).not.toBeNull();
  reconcileFolderPreviews(client, scope.owner, scope.projectId, scope.rootId, scope.folderId, [], true, 400);
  retainPreview(client, scope, { ...body, version: '"v2"' }, true, 300); expect(readPreview(client, scope, [])).toBeNull();
});
it('keeps the sixteen-item moving neighbor window after twenty opened files fill the working set', () => {
  const client = new QueryClient(); setPreviewOwner(client, scope.owner);
  for (let index = 0; index < 20; index++) retainPreview(client, { ...scope, itemId: String(index) }, body);
  for (let index = 20; index < 36; index++) retainPreview(client, { ...scope, itemId: String(index) }, body, true);
  for (let index = 20; index < 36; index++) expect(readPreview(client, { ...scope, itemId: String(index) }, [], false)).not.toBeNull();
  expect(readPreview(client, { ...scope, itemId: '19' }, [])).not.toBeNull();
});
it('keeps a currently displayed large original alive when background neighbors exceed available memory', () => {
  const client = new QueryClient(); setPreviewOwner(client, scope.owner);
  retainPreview(client, scope, { ...body, bytes: new Uint8Array(30 * 1024 * 1024) });
  const listener = vi.fn(), release = subscribePreview(client, scope, listener);
  retainPreview(client, { ...scope, itemId: 'neighbor' }, { ...body, bytes: new Uint8Array(3 * 1024 * 1024) }, true);
  expect(readPreview(client, scope, [])?.bytes.length).toBe(30 * 1024 * 1024);
  expect(readPreview(client, { ...scope, itemId: 'neighbor' }, [])).toBeNull(); expect(listener).not.toHaveBeenCalledWith(null); release();
});

it('shares the original facade APIs with the direct owner and one client store', () => {
  expect(setPreviewOwner).toBe(owner.setPreviewOwner);
  expect(discardProjectPreviews).toBe(owner.discardProjectPreviews);
  expect(reconcileFolderPreviews).toBe(owner.reconcileFolderPreviews);
  const client = new QueryClient(); owner.setPreviewOwner(client, scope.owner);
  retainPreview(client, scope, body, true, 100);
  const listener = vi.fn(), release = subscribePreview(client, scope, listener);
  owner.discardPreview(client, scope);
  expect(readPreview(client, scope, [])).toBeNull(); expect(listener).toHaveBeenCalledExactlyOnceWith(null);
  retainPreview(client, scope, body, true, 200);
  expect(readPreview(client, scope, [])).toMatchObject(body); expect(listener).toHaveBeenLastCalledWith(body);
  owner.discardProjectPreviews(client, scope.owner, scope.projectId);
  expect(readPreview(client, scope, [])).toBeNull(); expect(listener).toHaveBeenLastCalledWith(null); release();
});

it('applies direct-core version/deletion/denial observations to private bodies and current subscribers before late publication', () => {
  const client = new QueryClient(); owner.setPreviewOwner(client, scope.owner);
  retainPreview(client, scope, body, true, 100);
  const listener = vi.fn(), release = subscribePreview(client, scope, listener);
  const current = { id: scope.itemId, name: 'New.png', kind: 'file' as const, size: 3, modifiedAt: null, viewable: true, eTag: '"v2"' };
  owner.reconcileFolderPreviews(client, scope.owner, scope.projectId, scope.rootId, scope.folderId, [current], true, 200);
  expect(readPreview(client, scope, [])).toBeNull(); expect(listener).toHaveBeenCalledExactlyOnceWith(null);
  retainPreview(client, scope, body, true, 100);
  expect(readPreview(client, scope, [])).toBeNull(); expect(listener).toHaveBeenCalledTimes(1);
  const verified = { ...body, version: '"v2"' }; retainPreview(client, scope, verified, true, 300);
  expect(readPreview(client, scope, [])).toMatchObject(verified); expect(listener).toHaveBeenLastCalledWith(verified);
  owner.reconcileFolderPreviews(client, scope.owner, scope.projectId, scope.rootId, scope.folderId, [], true, 400);
  retainPreview(client, scope, verified, true, 300);
  expect(readPreview(client, scope, [])).toBeNull(); expect(listener).toHaveBeenLastCalledWith(null);
  owner.reconcileFolderPreviews(client, scope.owner, scope.projectId, scope.rootId, scope.folderId, [current], true, 500);
  retainPreview(client, scope, verified, true, 600);
  owner.setPreviewOwner(client, null);
  expect(readPreview(client, scope, [])).toBeNull(); expect(listener).toHaveBeenLastCalledWith(null);
  const calls = listener.mock.calls.length;
  retainPreview(client, scope, verified, true, 700);
  expect(readPreview(client, scope, [])).toBeNull(); expect(listener).toHaveBeenCalledTimes(calls); release();
});
