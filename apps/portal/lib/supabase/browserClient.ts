import { createBrowserClient } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let cached: SupabaseClient | null = null;
let cachedUrl = '';
let cachedKey = '';

function envSupabaseUrl(): string {
  const value = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return typeof value === 'string' ? value.trim() : '';
}

function envSupabaseAnonKey(): string {
  const value = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return typeof value === 'string' ? value.trim() : '';
}

function hydrated(): { url: string; anonKey: string } | null {
  const g: any = globalThis as any;
  let value = g?.__SP_SUPABASE__;
  if ((!value || typeof value !== 'object') && typeof document !== 'undefined') {
    const encoded = document.querySelector<HTMLElement>('[data-sp-supabase-env]')?.dataset.spSupabaseEnv;
    if (encoded) {
      try {
        value = JSON.parse(encoded);
      } catch {
        value = null;
      }
    }
  }
  if (!value || typeof value !== 'object') return null;
  const url = typeof value.url === 'string' ? value.url.trim() : '';
  const anonKey = typeof value.anonKey === 'string' ? value.anonKey.trim() : '';
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

export function getSupabaseBrowser(): SupabaseClient {
  const url = supabaseRuntimeUrl();
  const key = supabaseRuntimeAnonKey();

  if (!url || !key) {
    throw new Error(
      'Supabase env vars are missing: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY. ' +
        'On Vercel, set them in Project Settings → Environment Variables (Production/Preview) and redeploy. ' +
        'For local dev, set them in `.env.local` then restart `npm run dev`.',
    );
  }

  if (cached && cachedUrl === url && cachedKey === key) return cached;

  cachedUrl = url;
  cachedKey = key;
  if (typeof window === 'undefined') {
    cached = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  } else {
    cached = createBrowserClient(url, key);
  }
  return cached;
}

export function supabaseRuntimeUrl(): string {
  return envSupabaseUrl() || hydrated()?.url || '';
}

function supabaseRuntimeAnonKey(): string {
  return envSupabaseAnonKey() || hydrated()?.anonKey || '';
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
