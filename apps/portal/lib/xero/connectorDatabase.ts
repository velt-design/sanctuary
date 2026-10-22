import 'server-only';
import postgres from 'postgres';
import { rootCertificates } from 'node:tls';
import { config } from './security';
import { supabaseCa } from './supabaseCa';

type Database = ReturnType<typeof postgres>;
export function createConnectorDatabase() {
  let db: Database | undefined;
  let closed = false;
  let databaseIdentity: string | undefined;
  let closing: Promise<void> | undefined;
  return {
    async run<T>(work: (db: Database) => Promise<T>): Promise<T> {
      if (closed) throw new Error('XERO_READ_WINDOW_CLOSED');
      const cfg = config();
      const identityKey = `${cfg.databaseUrl}:${cfg.local}`;
      if (databaseIdentity && databaseIdentity !== identityKey) throw new Error('XERO_DATABASE_IDENTITY_CHANGED');
      if (!db) {
        databaseIdentity = identityKey;
        const hostname = new URL(cfg.databaseUrl).hostname;
        const managedSupabase = /^[a-z0-9-]+\.pooler\.supabase\.com$|^db\.[a-z0-9]{20}\.supabase\.co$/.test(hostname);
        const ssl = cfg.local ? false : managedSupabase
          ? { rejectUnauthorized: true, ca: [...rootCertificates, supabaseCa] }
          : 'verify-full';
        db = postgres(cfg.databaseUrl, { ssl, max: 1, prepare: false, connect_timeout: 10, onnotice: () => {} });
      }
      const [identity] = await db`select current_user as name, rolsuper, rolcreaterole, rolcreatedb, rolreplication, rolbypassrls,
        pg_has_role(current_user, 'sanctuary_xero_connector', 'member') as connector,
        pg_has_role(current_user, 'service_role', 'member') as service,
        not exists (select 1 from pg_roles r where r.rolname not in (current_user::text,'sanctuary_xero_connector')
          and pg_has_role(current_user,r.oid,'member')) as only_connector
        from pg_roles where rolname=current_user`;
      if (!identity?.connector || !identity.only_connector || identity.service || identity.rolsuper || identity.rolcreaterole || identity.rolcreatedb || identity.rolreplication || identity.rolbypassrls) throw new Error('XERO_DATABASE_ROLE_INVALID');
      if (closed) throw new Error('XERO_READ_WINDOW_CLOSED');
      return work(db);
    },
    close() { closed = true; return closing ??= Promise.resolve(db ? db.end({ timeout: 5 }) : undefined); },
  };
}
export async function withDatabase<T>(work: (db: Database) => Promise<T>): Promise<T> {
  const connection = createConnectorDatabase();
  try { return await connection.run(work); } finally { await connection.close(); }
}
