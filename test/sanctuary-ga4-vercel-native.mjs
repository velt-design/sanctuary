import assert from 'node:assert/strict';

/** Runs against the same disposable PG17/safeupdate substrate as the existing lifecycle. */
export function proveGa4Vercel({ fixture, sql, command, boundary, ready, literal, actor, connection, binding, query }) {
  const credentialBinding = 'c'.repeat(64), nonce = 'd'.repeat(64);
  const reference = { credentialStore: 'vercel', credentialBinding };
  const transfer = (db, action, receipt = null) => JSON.parse(sql('set role service_role;select public.sanctuary_ga4_credential_transfer(' +
    [actor, '123', binding, 'synthetic', connection, 'test', nonce, action,
      receipt ?? (action === 'begin' ? { vaultId: 'a'.repeat(26), itemId: 'b'.repeat(26) } : null)].map(literal).join(',') + ');', db));
  const admit = db => sql(`update private.sanctuary_ga4_control c set credential_transfer=jsonb_build_object('state','admitted','nonceHash','${nonce}',
    'expiresAt',clock_timestamp()+interval '10 minutes','controlHash',encode(sha256(convert_to((to_jsonb(c)-'credential_transfer')::text,'UTF8')),'hex')) where singleton=true`, db);
  const cutover = db => {
    admit(db); transfer(db, 'begin'); transfer(db, 'install_begin'); transfer(db, 'installed', { credentialBinding, environmentId: 'synthetic-env' });
    sql(`update private.sanctuary_ga4_control set credential_store='vercel',credential_binding='${credentialBinding}' where singleton=true`, db);
  };
  const claim = db => command(db, 'claim', null, { query, evidence: { reportVersion: 'sanctuary-ga4-v3', ...reference } }).operation;
  {
    const db = fixture(), saved = ready(db); command(db, 'complete', saved.operation, { payload: saved.payload });
    const before = command(db, 'read'); cutover(db); const after = command(db, 'read');
    assert.deepEqual(after, before); command(db, 'deliver', saved.operation);
    assert.throws(() => command(db, 'claim', null, { query }), /credential authority changed/);
    const op = claim(db); boundary(db, op, 'credential_read', reference);
    boundary(db, op, 'token_refresh', {}, { scope: 'https://www.googleapis.com/auth/analytics.readonly', expiresIn: 3600, refreshRotated: false });
    boundary(db, op, 'property_read', { property: '123' }); command(db, 'finish', op, { evidence: { outcome: 'report_failed' } });
    assert.equal(command(db, 'read').payload, saved.payload);
  }
  for (const state of ['pending_read', 'settled_read', 'pending_token', 'rotated_token']) {
    const db = fixture(); cutover(db); const op = claim(db);
    command(db, 'before', op, { step: 'credential_read', evidence: reference });
    if (state !== 'pending_read') command(db, 'after', op, { step: 'credential_read', evidence: reference });
    if (state.endsWith('token')) command(db, 'before', op, { step: 'token_refresh', evidence: {} });
    if (state === 'rotated_token') command(db, 'after', op, { step: 'token_refresh', evidence: { scope: 'https://www.googleapis.com/auth/analytics.readonly', expiresIn: 3600, refreshRotated: true } });
    if (state.endsWith('read')) {
      command(db, 'finish', op, { evidence: { outcome: 'report_failed' } });
      assert.throws(() => command(db, 'after', op, { step: 'credential_read', evidence: reference }), /Invalid GA4 boundary/);
      assert.throws(() => command(db, 'before', op, { step: 'token_refresh', evidence: {} }), /Invalid GA4 boundary/);
      claim(db);
    } else {
      assert.throws(() => command(db, 'finish', op, { evidence: { outcome: 'report_failed' } }), /unresolved/);
      assert.throws(() => command(db, 'before', op, { step: 'property_read', evidence: { property: '123' } }), /out of order/);
      command(db, 'finish', op, { evidence: { outcome: 'uncertain' } });
      assert.throws(() => claim(db), /writer unresolved/);
    }
  }
  {
    const db = fixture(); admit(db); transfer(db, 'begin'); transfer(db, 'failed_before_install');
    assert.throws(() => transfer(db, 'install_begin'), /not working/);
    assert.throws(() => transfer(db, 'installed', { credentialBinding, environmentId: 'synthetic-env' }), /not working/);
    assert.throws(() => transfer(db, 'begin'), /already attempted/);
    command(db, 'claim', null, { query });
  }
  {
    const db = fixture(); admit(db); transfer(db, 'begin'); transfer(db, 'install_begin');
    assert.throws(() => transfer(db, 'failed_before_install'), /already final/); transfer(db, 'unconfirmed');
    sql(`update private.sanctuary_ga4_control set credential_transfer=jsonb_set(credential_transfer,'{expiresAt}',to_jsonb((now()-interval '1 hour')::text)) where singleton=true`, db);
    assert.throws(() => command(db, 'claim', null, { query }), /transfer unresolved/);
    assert.throws(() => transfer(db, 'begin'), /authority changed/);
  }
  {
    const db = fixture(); admit(db); transfer(db, 'begin');
    sql('update private.sanctuary_ga4_control set enabled=false where singleton=true', db);
    assert.throws(() => transfer(db, 'install_begin'), /authority changed/);
    transfer(db, 'failed_before_install');
    assert.throws(() => command(db, 'claim', null, { query }), /authority unavailable/);
  }
  return ['Vercel cutover preserves saved body/authority and fences old claims', 'honest credential-read and frozen binding',
    'pre-token terminal fencing and token rotation quarantine', 'finite transfer before-install settlement and stale-executor fence',
    'uncertain install never reopens on expiry', 'Stop remains authoritative during transfer'];
}
