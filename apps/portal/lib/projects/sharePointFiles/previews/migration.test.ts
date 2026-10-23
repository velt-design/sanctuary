// @vitest-environment node
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { beforeAll, afterAll, expect, it } from 'vitest';

let db: PGlite;
const binding = 'a'.repeat(64), project = '00000000-0000-4000-8000-000000000001';
let root: string;
async function command(action: string, input: object = {}, projectId: string | null = project, rootId: string | null = root, source = binding) {
  return (await db.query<{ result: Record<string, unknown> }>('select public.project_file_preview_cache($1,$2,$3::uuid,$4::uuid,$5::jsonb) result', [action, source, projectId, rootId, JSON.stringify({ rootItemId: 'root', ...input })])).rows[0].result;
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role; create schema auth; create schema private; create schema storage;
    create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create function auth.role() returns text language sql as $$select current_setting('request.jwt.claim.role',true)$$;
    create table auth.users(id uuid primary key,email_confirmed_at timestamptz,deleted_at timestamptz,banned_until timestamptz);
    create table public.portal_users(user_id uuid primary key,role text);
    create table public.projects(id uuid primary key,name text);
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit integer,allowed_mime_types text[]);
    insert into public.projects values('${project}','Synthetic project');`);
  await db.exec(readFileSync('supabase/migrations/20261022090001_project_sharepoint_files.sql', 'utf8'));
  await db.exec(readFileSync('supabase/migrations/20261023100715_project_private_preview_cache.sql', 'utf8'));
  await db.exec("set request.jwt.claim.role='service_role'");
  await db.query('select public.project_files_admin($1,$2::jsonb)', ['configure', JSON.stringify({ binding, driveId: 'drive', enquiriesItemId: 'enquiries', enabled: true })]);
  await db.query('select public.project_files_admin($1,$2::jsonb)', ['import', JSON.stringify({ binding, projectId: project, itemId: 'root', label: 'Synthetic root', evidenceSha256: binding })]);
  root = (await db.query<{ id: string }>('select id from private.project_file_roots')).rows[0].id;
});
afterAll(async () => { await db.close(); });
it('creates a private bounded bucket and denies every browser cache RPC/table capability', async () => {
  expect((await db.query('select public,file_size_limit from storage.buckets')).rows).toEqual([{ public: false, file_size_limit: 5242880 }]);
  for (const role of ['anon', 'authenticated']) {
    await db.exec(`set role ${role}`);
    await expect(command('read', { itemId: 'x' })).rejects.toThrow(/permission denied/);
    await expect(db.query('select * from private.project_file_previews')).rejects.toThrow(/permission denied/);
    await db.exec('reset role');
  }
});
it('fences duplicate builds, publishes an exact version, and keeps different bindings/roots outside the lookup', async () => {
  const key = '1'.repeat(64), hash = '2'.repeat(64);
  const claim = await command('build', { key });
  expect(claim.claimed).toBe(true); expect((await command('build', { key })).claimed).toBe(false);
  await expect(command('publish', { key, lease: '00000000-0000-4000-8000-000000000999', itemId: 'file', folderId: 'folder', version: '"v1"', profile: 'photo-v1', mime: 'image/jpeg', size: 100, hash })).rejects.toThrow(/Lease expired/);
  expect((await command('publish', { key, lease: claim.lease, itemId: 'file', folderId: 'folder', version: '"v1"', profile: 'photo-v1', mime: 'image/jpeg', size: 100, hash })).completed).toBe(true);
  expect(await command('read', { itemId: 'file', version: '"v1"', profile: 'photo-v1' })).toMatchObject({ found: true, hash, size: 100 });
  expect(await command('read', { itemId: 'file', version: '"v2"', profile: 'photo-v1' })).toEqual({ found: false });
  await expect(command('read', {}, project, root, 'b'.repeat(64))).rejects.toThrow(/Source unavailable/);
  await expect(command('read', {}, project, '00000000-0000-4000-8000-000000000999')).rejects.toThrow(/Root unavailable/);
});
it('does not retire absent files until a complete folder scan and rejects stale/replayed sync leases', async () => {
  await command('touch', { folderId: 'folder' });
  const claim = await command('claim'); expect(claim.claimed).toBe(true);
  expect(await command('claim')).toEqual({ claimed: false });
  await command('reconcile', { folderId: 'folder', lease: claim.lease, cursor: 'next', items: [] });
  expect((await command('read', { itemId: 'file', version: '"v1"', profile: 'photo-v1' })).found).toBe(true);
  await expect(command('reconcile', { folderId: 'folder', lease: claim.lease, cursor: null, items: [] })).rejects.toThrow(/Lease expired/);
  const next = await command('claim'); expect(next.generation).toBe(claim.generation);
  await command('reconcile', { folderId: 'folder', lease: next.lease, cursor: null, items: [] });
  expect((await command('read', { itemId: 'file', version: '"v1"', profile: 'photo-v1' })).found).toBe(false);
  expect((await db.query('select * from private.project_file_preview_gc')).rows.length).toBeGreaterThan(0);
});
it('retains new publications made during a paged scan and invalidates an observed changed source version', async () => {
  await db.exec("update private.project_file_preview_folders set next_sync=now()-interval '1 minute'");
  const scan = await command('claim');
  const key = '3'.repeat(64), build = await command('build', { key });
  await command('publish', { key, lease: build.lease, itemId: 'new', folderId: 'folder', version: '"v1"', profile: 'pdf-v1', mime: 'application/pdf', size: 100, hash: '4'.repeat(64) });
  await command('reconcile', { folderId: 'folder', lease: scan.lease, cursor: null, items: [] });
  expect((await command('read', { itemId: 'new', version: '"v1"', profile: 'pdf-v1' })).found).toBe(true);
  await db.exec("update private.project_file_preview_folders set next_sync=now()-interval '1 minute'");
  const next = await command('claim');
  await command('reconcile', { folderId: 'folder', lease: next.lease, cursor: null, items: [{ id: 'new', version: '"v2"' }] });
  expect((await command('read', { itemId: 'new', version: '"v1"', profile: 'pdf-v1' })).found).toBe(false);
});
it('rotates missing preparations so two corrupt files cannot stall the remaining working set', async () => {
  await command('touch', { folderId: 'rotation' });
  await db.exec("update private.project_file_preview_folders set active_until=now()-interval '1 minute' where folder_id<>'rotation'");
  const items = ['bad1', 'bad2', 'good3', 'good4'].map(id => ({ id, version: '"v1"' }));
  const first = await command('claim');
  expect(await command('reconcile', { folderId: 'rotation', lease: first.lease, items, cursor: null })).toMatchObject({ prepare: ['bad1', 'bad2'] });
  await db.exec("update private.project_file_preview_folders set next_sync=now()-interval '1 minute' where folder_id='rotation'");
  const next = await command('claim');
  expect(await command('reconcile', { folderId: 'rotation', lease: next.lease, items, cursor: null })).toMatchObject({ prepare: ['good3', 'good4'] });
  await db.exec("update private.project_file_preview_folders set active_until=now()+interval '15 minutes'");
});
it('rejects expired build and sync leases and stale completion after a root rebind', async () => {
  const key = '6'.repeat(64), build = await command('build', { key });
  await db.exec("update private.project_file_preview_builds set lease_until=now()-interval '1 minute'");
  await expect(command('publish', { key, lease: build.lease })).rejects.toThrow(/Lease expired/);
  await db.exec("update private.project_file_preview_folders set next_sync=now()-interval '1 minute'");
  const scan = await command('claim');
  await db.exec("update private.project_file_preview_folders set lease_until=now()-interval '1 minute'");
  await expect(command('reconcile', { folderId: 'folder', lease: scan.lease, items: [] })).rejects.toThrow(/Lease expired/);
  await db.query("update private.project_file_roots set item_id='rebound' where id=$1", [root]);
  await expect(command('build', { key })).rejects.toThrow(/Root unavailable/);
  await db.query("update private.project_file_roots set item_id='root' where id=$1", [root]);
});
it('accounts for abandoned uploads in global capacity and makes expired copies unreadable before cleanup', async () => {
  const key = '7'.repeat(64), build = await command('build', { key });
  await command('publish', { key, lease: build.lease, itemId: 'expiry', folderId: 'folder', version: '"v1"', profile: 'pdf-v1', mime: 'application/pdf', size: 100, hash: '8'.repeat(64) });
  await db.exec("update private.project_file_previews set expires_at=now()-interval '1 minute'");
  expect(await command('read', { itemId: 'expiry', version: '"v1"', profile: 'pdf-v1' })).toEqual({ found: false });
  await db.exec("insert into private.project_file_preview_gc(storage_path,reserved_bytes) values('synthetic-capacity-reservation',536870912)");
  expect(await command('build', { key: '9'.repeat(64) })).toEqual({ claimed: false, capacity: true });
  await db.exec("delete from private.project_file_preview_gc where storage_path='synthetic-capacity-reservation'");
});
it('bounds abandoned-object cleanup, retains queued cleanup while disabled, and rejects completion after project deletion', async () => {
  const build = await command('build', { key: '5'.repeat(64) });
  await db.exec("update private.project_file_preview_gc set ready_at=now()-interval '3 minutes'");
  await db.exec('update private.project_files_control set enabled=false');
  const clean = await command('cleanup'); expect((clean.paths as string[]).length).toBeLessThanOrEqual(64);
  await command('cleaned', { paths: clean.paths });
  await db.exec('update private.project_files_control set enabled=true');
  await db.query('delete from public.projects where id=$1', [project]);
  await expect(command('publish', { key: '5'.repeat(64), lease: build.lease })).rejects.toThrow(/Project not found/);
  expect((await db.query('select * from private.project_file_previews')).rows).toEqual([]);
});
