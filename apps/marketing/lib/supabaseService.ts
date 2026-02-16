import 'server-only';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let cachedClient: SupabaseClient | null = null;
let cachedUrl = '';
let cachedKey = '';

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (typeof value === 'string' && value.trim()) return value.trim();
  throw new Error(`${name} is not set`);
}

function serviceSupabaseUrl(): string {
  const publicUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || '';
  const serviceUrl = process.env.SUPABASE_URL?.trim() || '';
  if (publicUrl) return publicUrl;
  if (serviceUrl) return serviceUrl;
  return requiredEnv('SUPABASE_URL');
}

export function getServiceSupabase(): SupabaseClient {
  const url = serviceSupabaseUrl();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || '';
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');

  if (cachedClient && cachedUrl === url && cachedKey === key) return cachedClient;
  cachedUrl = url;
  cachedKey = key;
  cachedClient = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return cachedClient;
}
