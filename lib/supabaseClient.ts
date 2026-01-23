import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

function requiredEnv(name: 'NEXT_PUBLIC_SUPABASE_URL' | 'NEXT_PUBLIC_SUPABASE_ANON_KEY' | 'SUPABASE_SERVICE_ROLE_KEY'): string {
  const value = process.env[name];
  if (typeof value === 'string' && value.trim()) return value.trim();
  throw new Error(
    `${name} is not set. Add it to \`.env.local\` for local dev, and set it in Vercel Project Settings → Environment Variables for deploys.`,
  );
}

let cachedServer: SupabaseClient | null = null;
let cachedAnon: SupabaseClient | null = null;
let cachedUrl = '';
let cachedServerKey = '';
let cachedAnonKey = '';

export function getSupabaseAnon(): SupabaseClient {
  const url = requiredEnv('NEXT_PUBLIC_SUPABASE_URL');
  const key = requiredEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');

  if (cachedAnon && cachedUrl === url && cachedAnonKey === key) return cachedAnon;
  cachedUrl = url;
  cachedAnonKey = key;
  cachedAnon = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return cachedAnon;
}

export function getSupabaseServer(): SupabaseClient {
  const url = requiredEnv('NEXT_PUBLIC_SUPABASE_URL');
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || '';
  const key = serviceKey || requiredEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');

  if (cachedServer && cachedUrl === url && cachedServerKey === key) return cachedServer;
  cachedUrl = url;
  cachedServerKey = key;
  cachedServer = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return cachedServer;
}

function bindIfFunction<T>(value: T, ctx: any): T {
  return (typeof value === 'function' ? (value as any).bind(ctx) : value) as T;
}

export const supabaseAnon: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getSupabaseAnon() as any;
    return bindIfFunction(client[prop], client);
  },
});

export const supabaseServer: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getSupabaseServer() as any;
    return bindIfFunction(client[prop], client);
  },
});

// Back-compat: prefer `supabaseServer` in route handlers.
export const supabase: SupabaseClient = supabaseServer;
