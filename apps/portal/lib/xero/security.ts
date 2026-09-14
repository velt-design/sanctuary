import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export const XERO_SCOPES = 'offline_access accounting.contacts.read accounting.invoices.read accounting.payments.read accounting.banktransactions.read';
export const XERO_PAGE = '/staff/developer/xero';
export const XERO_CALLBACK = '/api/integrations/xero/callback';

export function isDeveloper(user: { email?: string; email_confirmed_at?: string } | null): boolean {
  return Boolean(user?.email_confirmed_at && user.email?.toLowerCase() === 'jordan@sanctuarypergolas.co.nz');
}

export function equalSecret(left: string, right: string): boolean {
  const a = Buffer.from(left); const b = Buffer.from(right);
  return a.length > 0 && a.length === b.length && timingSafeEqual(a, b);
}

export function hash(value: string): string { return createHash('sha256').update(value).digest('hex'); }
export function nonce(): string { return randomBytes(32).toString('base64url'); }

export function seal(value: unknown, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from('sanctuary.xero.v1'));
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64url');
}

export function unseal<T>(value: string, key: Buffer): T {
  const bytes = Buffer.from(value, 'base64url');
  const cipher = createDecipheriv('aes-256-gcm', key, bytes.subarray(0, 12));
  cipher.setAAD(Buffer.from('sanctuary.xero.v1'));
  cipher.setAuthTag(bytes.subarray(12, 28));
  return JSON.parse(Buffer.concat([cipher.update(bytes.subarray(28)), cipher.final()]).toString('utf8')) as T;
}

export function config() {
  const required = (name: string) => {
    const value = process.env[name]?.trim();
    if (!value) throw new Error('XERO_NOT_CONFIGURED');
    return value;
  };
  if (process.env.XERO_ENABLED !== 'true') throw new Error('XERO_DISABLED');
  const origin = new URL(required('XERO_PORTAL_ORIGIN'));
  if (origin.protocol !== 'https:' || origin.pathname !== '/' || origin.search || origin.hash || origin.username || origin.password) throw new Error('XERO_INVALID_ORIGIN');
  const key = Buffer.from(required('XERO_TOKEN_ENCRYPTION_KEY'), 'base64');
  if (key.length !== 32) throw new Error('XERO_INVALID_KEY');
  // Discovery is an explicit, temporary setup mode. It cannot persist tokens or read accounting data.
  const tenantId = process.env.XERO_TENANT_ID?.trim() ?? '';
  if (!tenantId && process.env.XERO_DISCOVERY !== 'true') throw new Error('XERO_NOT_CONFIGURED');
  if (tenantId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantId)) throw new Error('XERO_INVALID_TENANT');
  const databaseUrl = required('XERO_DATABASE_URL');
  const database = new URL(databaseUrl);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(database.hostname);
  if (!local && database.searchParams.get('sslmode') !== 'verify-full') throw new Error('XERO_DATABASE_TLS_REQUIRED');
  return { origin: origin.origin, key, tenantId, databaseUrl, local,
    clientId: required('XERO_CLIENT_ID'), clientSecret: required('XERO_CLIENT_SECRET') };
}
