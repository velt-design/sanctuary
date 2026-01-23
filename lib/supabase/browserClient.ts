import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let cached: SupabaseClient | null = null;
let cachedUrl = '';
let cachedKey = '';

function env(name: 'NEXT_PUBLIC_SUPABASE_URL' | 'NEXT_PUBLIC_SUPABASE_ANON_KEY'): string {
  const value = process.env[name];
  return typeof value === 'string' ? value.trim() : '';
}

function hydrated(): { url: string; anonKey: string } | null {
  const g: any = globalThis as any;
  const value = g?.__SP_SUPABASE__;
  if (!value || typeof value !== 'object') return null;
  const url = typeof value.url === 'string' ? value.url.trim() : '';
  const anonKey = typeof value.anonKey === 'string' ? value.anonKey.trim() : '';
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

export function getSupabaseBrowser(): SupabaseClient {
  const fromEnv = { url: env('NEXT_PUBLIC_SUPABASE_URL'), key: env('NEXT_PUBLIC_SUPABASE_ANON_KEY') };
  const fromHydrated = hydrated();
  const url = fromEnv.url || fromHydrated?.url || '';
  const key = fromEnv.key || fromHydrated?.anonKey || '';

  if (!url || !key) {
    throw new Error(
      'Supabase env vars are missing: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY. ' +
        'If these are set in `.env.local`, restart `npm run dev`.',
    );
  }

  if (cached && cachedUrl === url && cachedKey === key) return cached;

  cachedUrl = url;
  cachedKey = key;
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return cached;
}

export function supabaseRuntimeUrl(): string {
  return env('NEXT_PUBLIC_SUPABASE_URL') || hydrated()?.url || '';
}

export function supabaseHostFromUrl(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return '';
  }
}

export function supabaseRestUrl(table: string): string {
  const url = supabaseRuntimeUrl();
  try {
    return new URL(`/rest/v1/${table}`, url).toString();
  } catch {
    return '';
  }
}
