import assert from 'node:assert/strict';

// Transport is supplied by the disposable PostgreSQL harness; no hosted URL.
export function verifyMigrationOperator(execute, bootstrap, migration) {
  const database = 'praxis_operator_proof';
  const installer = 'praxis_migration_operator';
  const reader = 'praxis_operator_reader';
  const admin = (sql) => execute(sql, { quiet: true });
  const owner = (sql) => execute(sql, { user: installer, database, quiet: true });
  const login = (sql) => execute(sql, { user: reader, database, quiet: true });
  const json = (run, sql) => JSON.parse(run(sql));
  const memberships = `select coalesce(jsonb_agg(to_jsonb(m) order by roleid, member, grantor), '[]') from pg_auth_members m;`;
  const posture = `select to_jsonb(r) from pg_roles r where rolname='sanctuary_praxis_reader';`;
  const sourceState = () => json(owner, `
    create function pg_temp.source_state() returns jsonb language plpgsql as $$
    declare result jsonb := '{}'; item record; rows jsonb;
    begin
      for item in select n.nspname, c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
        where n.nspname in ('public','private','auth','storage') and c.relkind='r' loop
        execute format('select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text), ''[]'') from %I.%I t', item.nspname,item.relname) into rows;
        result := result || jsonb_build_object(item.nspname || '.' || item.relname, rows);
      end loop;
      return jsonb_build_object('rows',result,
        'relations',(select jsonb_agg(jsonb_build_array(n.nspname,c.relname,c.relowner,c.relacl) order by n.nspname,c.relname)
          from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private','auth','storage','praxis_reporting')),
        'functions',(select jsonb_agg(jsonb_build_array(n.nspname,p.oid,p.proowner,p.proacl,pg_get_functiondef(p.oid)) order by p.oid)
          from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private','auth','storage','praxis_reporting')));
    end $$; select pg_temp.source_state();`);
  const reject = (run, sql, pattern) => {
    assert.throws(() => run(`begin;\n${sql}\nrollback;`), pattern);
  };
  const hostedOwnership = () => execute(`
    alter schema auth owner to postgres;
    alter schema storage owner to postgres;
    grant usage on schema auth to ${installer};
    grant usage on schema storage to ${installer} with grant option;
    alter table auth.users owner to praxis_auth_owner;
    alter function auth.role() owner to praxis_auth_owner;
    alter function auth.uid() owner to praxis_auth_owner;
    grant select on auth.users to ${installer} with grant option;
    grant insert,update,delete,truncate,references,trigger,maintain on auth.users to ${installer};
    alter table storage.objects owner to praxis_storage_owner;
    grant all on storage.objects to ${installer} with grant option;
  `, { database });
  try {
    admin(`create role ${installer} login nosuperuser createdb createrole inherit replication bypassrls password 'synthetic-praxis-admin-only';
      create role ${reader} login nosuperuser nocreatedb nocreaterole inherit noreplication nobypassrls password 'synthetic-praxis-admin-only';
      alter role ${reader} set default_transaction_read_only=on;
      create role praxis_auth_owner nologin;
      create role praxis_storage_owner nologin;
      create database ${database} owner ${installer};`);
    // Existing Supabase role names are created by the harness administrator.
    // The actual installer LOGIN owns synthetic mutable tables/functions.
    owner(bootstrap);
    // Match the observed ownership split: installer-owned commercial objects,
    // separately owned auth/storage objects and only the observed grant powers.
    hostedOwnership();
    assert.deepEqual(json(owner, `select jsonb_build_array(session_user, current_user, rolsuper, rolcreatedb, rolcreaterole, rolinherit, rolreplication, rolbypassrls)
      from pg_roles where rolname=current_user;`), [installer, installer, false, true, true, true, true, true]);
    const beforeEdges = json(admin, memberships);
    owner(`begin;\n${migration}\ncommit;`);
    const installedEdges = json(admin, memberships);
    const added = installedEdges.filter((edge) => !beforeEdges.some((prior) => JSON.stringify(prior) === JSON.stringify(edge)));
    assert.ok(beforeEdges.every((prior) => installedEdges.some((edge) => JSON.stringify(prior) === JSON.stringify(edge))), 'Installation must preserve every existing membership.');
    assert.equal(added.length, 1, 'First install must add only the bootstrap-granted creator ADMIN edge.');
    const roleIds = json(admin, `select jsonb_object_agg(rolname, oid) from pg_roles
      where rolname in ('${installer}', 'sanctuary_praxis_reader', 'postgres');`);
    assert.deepEqual(added[0], {
      oid: added[0].oid, roleid: roleIds.sanctuary_praxis_reader, member: roleIds[installer],
      grantor: roleIds.postgres, admin_option: true, inherit_option: false, set_option: false,
    });
    process.stdout.write(`praxis-operator: exact new creator membership ${JSON.stringify(added[0])}\n`);
    assert.equal(owner(`select pg_has_role(current_user, 'sanctuary_praxis_reader', 'USAGE') or pg_has_role(current_user, 'sanctuary_praxis_reader', 'SET');`), 'f');
    const safePosture = json(admin, posture);
    const records = `select jsonb_agg(to_jsonb(r) order by resource,id) from praxis_reporting.context_page_v1('all',null,null,'2100-01-01',null,null,null,100) r;`;
    const beforeRecords = json(owner, records);
    const installedSource = sourceState();
    assert.equal(new Set(beforeRecords.map((record) => record.resource)).size, 12);
    owner(`grant sanctuary_praxis_reader to ${reader};`);
    const replayEdges = json(admin, memberships);
    owner(`begin;\n${migration}\ncommit;`);
    assert.deepEqual(json(admin, memberships), replayEdges, 'Replay must preserve every membership, including the provisioned LOGIN.');
    assert.deepEqual(json(admin, posture), safePosture, 'Replay must not alter reader attributes.');
    assert.deepEqual(json(owner, records), beforeRecords, 'Replay must preserve exact payload, timestamp and financial evidence.');
    assert.deepEqual(sourceState(), installedSource, 'Replay must preserve all source rows, owners, function bodies and ACLs.');
    assert.deepEqual(json(login, records), beforeRecords, 'Actual reader LOGIN must see identical projections.');
    assert.equal(login("select current_setting('default_transaction_read_only');"), 'on');
    for (const sql of [
      'select * from public.projects;', 'select * from private.commercial_email_intents;',
      'select * from auth.users;', 'select * from storage.objects;',
      'select public.commercial_project_financial_truth(null);',
      'select public.commercial_current_accepted_quote_versions(null);',
      'select public.commercial_record_project_payment_entry();',
      "insert into public.projects(id) values ('ffffffff-ffff-4fff-8fff-ffffffffffff');",
    ]) assert.throws(() => login(`set default_transaction_read_only=off;\nbegin;\n${sql}\nrollback;`), /permission denied/i);
    // Test existing unsafe role attributes individually, then restore only in
    // the synthetic administrator fixture. The migration must never repair them.
    for (const [unsafe, restore] of [
      ['login', 'nologin'], ['superuser', 'nosuperuser'], ['createdb', 'nocreatedb'],
      ['createrole', 'nocreaterole'], ['inherit', 'noinherit'],
      ['replication', 'noreplication'], ['bypassrls', 'nobypassrls'],
    ]) {
      admin(`alter role sanctuary_praxis_reader ${unsafe};`);
      const unsafePosture = json(admin, posture);
      reject(owner, migration, /unsafe sanctuary_praxis_reader posture/i);
      assert.deepEqual(json(admin, posture), unsafePosture);
      assert.deepEqual(json(admin, memberships), replayEdges);
      assert.deepEqual(sourceState(), installedSource);
      admin(`alter role sanctuary_praxis_reader ${restore};`);
    }
    admin('create role praxis_unexpected_parent nologin; grant praxis_unexpected_parent to sanctuary_praxis_reader with inherit false, set true;');
    const unsafeEdges = json(admin, memberships);
    reject(owner, migration, /unsafe sanctuary_praxis_reader membership/i);
    assert.deepEqual(json(admin, memberships), unsafeEdges);
    assert.deepEqual(json(owner, records), beforeRecords);
    admin('revoke praxis_unexpected_parent from sanctuary_praxis_reader; drop role praxis_unexpected_parent;');
    execute('create schema praxis_owned_probe authorization sanctuary_praxis_reader;', { database });
    const ownedPosture = json(admin, posture);
    reject(owner, migration, /unsafe sanctuary_praxis_reader ownership/i);
    assert.deepEqual(json(admin, posture), ownedPosture);
    assert.equal(owner("select pg_get_userbyid(nspowner) from pg_namespace where nspname='praxis_owned_probe';"), 'sanctuary_praxis_reader');
    execute('drop schema praxis_owned_probe;', { database });
    assert.deepEqual(sourceState(), installedSource);
    process.stdout.write('praxis-operator: full nonsuperuser LOGIN install/replay, exact creator ADMIN edge, seven unsafe flags, outgoing membership and actual reader denial passed\n');
  } finally {
    admin(`drop database if exists ${database} with (force); drop role if exists sanctuary_praxis_reader;
      drop role if exists ${reader}; drop role if exists ${installer}; drop role if exists praxis_unexpected_parent;
      drop role if exists praxis_auth_owner; drop role if exists praxis_storage_owner;`);
  }
  // Creation itself is atomic with the membership guard. Explicitly exercise
  // PostgreSQL 17's optional automatic self-grants, not only its default.
  admin(`create role ${installer} login nosuperuser createdb createrole inherit replication bypassrls password 'synthetic-praxis-admin-only';
    create database ${database} owner ${installer};`);
  try {
    owner(bootstrap);
    for (const setting of ['set', 'inherit', 'set, inherit']) {
      const beforeEdges = json(admin, memberships);
      reject(owner, `set createrole_self_grant='${setting}';\n${migration}`, /unsafe sanctuary_praxis_reader (creation|membership)/i);
      assert.equal(admin("select count(*) from pg_roles where rolname='sanctuary_praxis_reader';"), '0');
      assert.deepEqual(json(admin, memberships), beforeEdges);
      assert.equal(owner("select to_regnamespace('praxis_reporting') is null;"), 't');
    }
    admin('create role sanctuary_praxis_reader nologin nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls;');
    const preexistingPosture = json(admin, posture);
    const preexistingEdges = json(admin, memberships);
    owner(`begin;\n${migration}\ncommit;`);
    assert.deepEqual(json(admin, posture), preexistingPosture);
    assert.deepEqual(json(admin, memberships), preexistingEdges, 'A safe preexisting reader needs no installer ADMIN membership.');
    process.stdout.write('praxis-operator: SET, INHERIT and combined createrole_self_grant rejected without residue\n');
  } finally {
    admin(`drop database if exists ${database} with (force); drop role if exists sanctuary_praxis_reader; drop role if exists ${installer};`);
  }
}
