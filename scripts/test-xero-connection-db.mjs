import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const db = new PGlite();
try {
  await db.exec('create role anon; create role authenticated; create role service_role;');
  const migration = await readFile(new URL('../supabase/migrations/20260914000001_xero_connection.sql',import.meta.url),'utf8');
  await db.exec(`begin; ${migration} rollback;`);
  assert.equal((await db.query("select to_regclass('xero_private.connection') as name")).rows[0].name,null);
  await db.exec(migration);
  for (const role of ['anon','authenticated']) {
    await db.exec(`set role ${role}`);
    await assert.rejects(db.query('select * from xero_private.connection'),/permission denied/);
    await assert.rejects(db.query("insert into xero_private.oauth_attempts values ('bad','11111111-1111-4111-8111-111111111111',now())"),/permission denied/);
    await db.exec('reset role');
  }
  await db.exec('set role sanctuary_xero_connector');
  assert.equal((await db.query('select * from xero_private.connection')).rows.length,1);
  await db.exec("insert into xero_private.oauth_attempts values ('state','11111111-1111-4111-8111-111111111111',now()+interval '10 minutes')");
  const consume="delete from xero_private.oauth_attempts where state_hash='state' and user_id='11111111-1111-4111-8111-111111111111' and expires_at>now() returning state_hash";
  assert.equal((await db.query(consume)).rows.length,1);
  assert.equal((await db.query(consume)).rows.length,0);
  await db.exec("insert into xero_private.events(event) values ('connected')");
  await assert.rejects(db.exec('delete from xero_private.events'),/permission denied/);
  await assert.rejects(db.exec('delete from xero_private.connection'),/permission denied/);
  await db.exec("update xero_private.connection set encrypted_tokens='encrypted-fixture'");
  await db.exec('reset role');
  assert.equal((await db.query('select encrypted_tokens from xero_private.connection')).rows[0].encrypted_tokens,'encrypted-fixture');
  console.log('Xero disposable PostgreSQL contracts passed: rollback, apply, staff denial, one-use state, append-only audit and connector grants.');
} finally { await db.close(); }
