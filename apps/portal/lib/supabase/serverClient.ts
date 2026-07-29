import 'server-only';

import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

function requiredEnv(name: 'NEXT_PUBLIC_SUPABASE_URL' | 'NEXT_PUBLIC_SUPABASE_ANON_KEY'): string {
  const value = process.env[name];
  if (typeof value === 'string' && value.trim()) return value.trim();
  throw new Error(
    `${name} is not set. Add it to \.env.local for local dev, and set it in Vercel Project Settings → Environment Variables for deploys.`,
  );
}

async function createSupabaseServerAuth(options: {
  failOnCookieWrite: boolean;
}): Promise<SupabaseClient> {
  const url = requiredEnv('NEXT_PUBLIC_SUPABASE_URL');
  const key = requiredEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  const cookieStore = await cookies();

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        if (options.failOnCookieWrite) {
          cookiesToSet.forEach(({ name, value, options: cookieOptions }) => {
            cookieStore.set({ name, value, ...cookieOptions });
          });
          return;
        }
        try {
          cookiesToSet.forEach(({ name, value, options: cookieOptions }) => {
            cookieStore.set({ name, value, ...cookieOptions });
          });
        } catch {
          // Ignore cookie set failures in read-only contexts.
        }
      },
    },
  });
}

// Use this client for auth-bound server reads and writes that should honor user context.
export async function getSupabaseServerAuth(): Promise<SupabaseClient> {
  return createSupabaseServerAuth({ failOnCookieWrite: false });
}

// Auth exchanges must not report success unless the resulting session cookie
// was durably attached to the response.
export async function getSupabaseServerAuthCallback(): Promise<SupabaseClient> {
  return createSupabaseServerAuth({ failOnCookieWrite: true });
}
