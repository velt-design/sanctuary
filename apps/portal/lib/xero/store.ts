import 'server-only';
import postgres from 'postgres';
import { rootCertificates } from 'node:tls';
import { supabaseCa } from './supabaseCa';
import { config, seal, unseal, XERO_SCOPES } from './security';
import { accountingRead, connections, tokenRequest, type Tokens, XeroError } from './provider';

async function withDatabase<T>(work: (db: ReturnType<typeof postgres>) => Promise<T>): Promise<T> {
  const cfg = config();
  const hostname = new URL(cfg.databaseUrl).hostname;
  const managedSupabase = /^[a-z0-9-]+\.pooler\.supabase\.com$|^db\.[a-z0-9]{20}\.supabase\.co$/.test(hostname);
  const ssl = cfg.local ? false : managedSupabase
    ? { rejectUnauthorized: true, ca: [...rootCertificates, supabaseCa] }
    : 'verify-full';
  const db = postgres(cfg.databaseUrl, { ssl, max: 1, prepare: false, connect_timeout: 10, onnotice: () => {} });
  try {
    const [identity] = await db`select current_user as name, rolsuper, rolcreaterole, rolcreatedb, rolreplication, rolbypassrls,
      pg_has_role(current_user, 'sanctuary_xero_connector', 'member') as connector,
      pg_has_role(current_user, 'service_role', 'member') as service,
      not exists (select 1 from pg_roles r where r.rolname not in (current_user::text,'sanctuary_xero_connector')
        and pg_has_role(current_user,r.oid,'member')) as only_connector
      from pg_roles where rolname=current_user`;
    if (!identity?.connector || !identity.only_connector || identity.service || identity.rolsuper || identity.rolcreaterole || identity.rolcreatedb || identity.rolreplication || identity.rolbypassrls) throw new Error('XERO_DATABASE_ROLE_INVALID');
    return await work(db);
  } finally { await db.end({ timeout: 5 }); }
}

export async function saveAttempt(stateHash: string, userId: string) {
  await withDatabase(async db => {
    await db`delete from xero_private.oauth_attempts where expires_at < now() or user_id=${userId}`;
    await db`insert into xero_private.oauth_attempts(state_hash,user_id,expires_at) values (${stateHash},${userId},now()+interval '10 minutes')`;
  });
}

export async function consumeAttempt(stateHash: string, userId: string) {
  return withDatabase(async db => {
    const rows = await db`delete from xero_private.oauth_attempts where state_hash=${stateHash} and user_id=${userId} and expires_at>now() returning state_hash`;
    return rows.length === 1;
  });
}

export async function connect(tokens: Tokens, userId: string, preserveGrantedScopes = false) {
  const cfg = config();
  if (!cfg.tenantId) throw new Error('XERO_ORGANISATION_NOT_PINNED');
  const organisations = await connections(tokens.accessToken);
  const tenant = organisations.find(item => item.tenantId === cfg.tenantId);
  if (!tenant) throw new Error('XERO_WRONG_ORGANISATION');
  await withDatabase(async db => {
    await db.begin(async tx => {
      const [current] = await tx`select tenant_id,encrypted_tokens from xero_private.connection where singleton for update`;
      if (preserveGrantedScopes && current?.encrypted_tokens) {
        if (current.tenant_id !== cfg.tenantId) throw new Error('XERO_WRONG_ORGANISATION');
        // Consent can race another callback during token exchange. Check the latest
        // encrypted grant under the same lock as replacement, not only before OAuth.
        const granted = unseal<Tokens>(current.encrypted_tokens, cfg.key).scopes ?? XERO_SCOPES.split(' ');
        const incoming = tokens.scopes ?? XERO_SCOPES.split(' ');
        if (granted.some(scope => !incoming.includes(scope))) throw new Error('XERO_GRANT_CHANGED_DURING_CONSENT');
      }
      await tx`update xero_private.connection set tenant_id=${tenant.tenantId}, tenant_name=${tenant.tenantName}, encrypted_tokens=${seal(tokens,cfg.key)},
        connected_by=${userId}, connected_at=now(), last_verified_at=now(), last_error=null where singleton`;
      await tx`insert into xero_private.events(actor_id,event,tenant_id) values (${userId},'connected',${tenant.tenantId})`;
    });
  });
}

export async function status() {
  return withDatabase(async db => {
    const [row] = await db`select tenant_id,tenant_name,connected_at,last_verified_at,last_error from xero_private.connection where singleton`;
    if (!row) throw new Error('XERO_STORE_UNAVAILABLE');
    return { connected: Boolean(row.tenant_id), organisation: row.tenant_name, connectedAt: row.connected_at,
      lastVerifiedAt: row.last_verified_at, error: row.last_error };
  });
}

/** Scope metadata only; credential material stays inside the existing encrypted connector boundary. */
export async function grantedConsentScopes(): Promise<string[]> {
  const cfg = config();
  return withDatabase(async db => {
    const [row] = await db`select tenant_id,encrypted_tokens from xero_private.connection where singleton`;
    if (!row?.encrypted_tokens) return [];
    if (row.tenant_id !== cfg.tenantId) throw new Error('XERO_WRONG_ORGANISATION');
    return unseal<Tokens>(row.encrypted_tokens, cfg.key).scopes ?? XERO_SCOPES.split(' ');
  });
}

export async function access(): Promise<Tokens> {
  const cfg = config();
  if (!cfg.tenantId) throw new Error('XERO_ORGANISATION_NOT_PINNED');
  // A database row lock serialises rotation across cron, reads and reconnects.
  // Commit rotated tokens before any subsequent provider reads can fail.
  const result = await withDatabase(async db => db.begin(async tx => {
    await tx`set local lock_timeout='3s'`;
    const [row] = await tx`select * from xero_private.connection where singleton for update`;
    if (!row?.encrypted_tokens || row.tenant_id !== cfg.tenantId) return { error: 'RECONNECT_REQUIRED' };
    if (row.last_error === 'RECONNECT_REQUIRED') return { error: 'RECONNECT_REQUIRED' };
    try {
      let tokens = unseal<Tokens>(row.encrypted_tokens, cfg.key);
      if (tokens.expiresAt < Date.now() + 120000) {
        tokens = await tokenRequest(cfg.clientId, cfg.clientSecret, new URLSearchParams({ grant_type: 'refresh_token', refresh_token: tokens.refreshToken }), tokens.scopes);
        await tx`update xero_private.connection set encrypted_tokens=${seal(tokens,cfg.key)},last_error=null where singleton`;
      }
      return { tokens };
    } catch (error) {
      const code = error instanceof XeroError ? error.code : 'CONNECTION_UNAVAILABLE';
      await tx`update xero_private.connection set last_error=${code} where singleton`;
      await tx`insert into xero_private.events(event,tenant_id,detail) values ('connection_error',${cfg.tenantId},${code})`;
      return { error: code };
    }
  }));
  if (!result.tokens) throw new XeroError(result.error ?? 'CONNECTION_UNAVAILABLE');
  return result.tokens;
}

export async function readAccounting(resource: 'Invoices' | 'BankTransactions', where: string, recordId?: string) {
  const cfg = config();
  const tokens = await access();
  try {
    return await accountingRead(tokens, cfg.tenantId, resource, where, recordId);
  } catch (error) {
    if (error instanceof XeroError && error.code === 'RECONNECT_REQUIRED') {
      await withDatabase(async db => db.begin(async tx => {
        await tx`set local lock_timeout='3s'`;
        const [row] = await tx`select * from xero_private.connection where singleton for update`;
        // A late rejection must not invalidate credentials rotated or reconnected during the read.
        if (row?.tenant_id !== cfg.tenantId || !row.encrypted_tokens ||
          unseal<Tokens>(row.encrypted_tokens, cfg.key).accessToken !== tokens.accessToken) return;
        await tx`update xero_private.connection set last_error=${'RECONNECT_REQUIRED'} where singleton`;
        await tx`insert into xero_private.events(event,tenant_id,detail) values ('connection_error',${cfg.tenantId},${'RECONNECT_REQUIRED'})`;
      }));
    }
    throw error;
  }
}

export async function verifyConnection() {
  const cfg = config();
  try {
    const tokens = await access();
    const tenants = await connections(tokens.accessToken);
    if (!tenants.some(tenant => tenant.tenantId === cfg.tenantId)) throw new XeroError('RECONNECT_REQUIRED');
    await withDatabase(async db => { await db`update xero_private.connection set last_verified_at=now(),last_error=null where singleton and tenant_id=${cfg.tenantId}`; });
  } catch (error) {
    const code=error instanceof XeroError ? error.code : 'CONNECTION_UNAVAILABLE';
    await withDatabase(async db => { await db`update xero_private.connection set last_error=${code} where singleton`; });
    throw error;
  }
}
