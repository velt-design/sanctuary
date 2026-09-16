import { rootCertificates, type ConnectionOptions } from 'node:tls';
import { supabaseCa } from '../xero/supabaseCa';

/** Reuse the portal's verified public Supabase CA; no Xero credentials or runtime. */
export function praxisDatabaseTls(databaseUrl: string, mode: false | 'verify-full'): false | 'verify-full' | ConnectionOptions {
  if (mode === false) return false;
  const hostname = new URL(databaseUrl).hostname;
  const managedSupabase = /^[a-z0-9-]+\.pooler\.supabase\.com$|^db\.[a-z0-9]{20}\.supabase\.co$/.test(hostname);
  return managedSupabase ? { rejectUnauthorized: true, ca: [...rootCertificates, supabaseCa] } : 'verify-full';
}
