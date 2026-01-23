import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

function requiredEnv(name: 'NEXT_PUBLIC_SUPABASE_URL' | 'NEXT_PUBLIC_SUPABASE_ANON_KEY' | 'SUPABASE_SERVICE_ROLE_KEY'): string {
  const value = process.env[name];
  if (typeof value === 'string' && value.trim()) return value.trim();
  throw new Error(`${name} is not set. Add it to \`.env.local\`.`);
}

const supabaseUrl = requiredEnv('NEXT_PUBLIC_SUPABASE_URL');
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || null;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || null;

export const supabaseAnon: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey ?? requiredEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'), {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

export const supabaseServer: SupabaseClient = createClient(supabaseUrl, supabaseServiceKey ?? requiredEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'), {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

// Back-compat: prefer `supabaseServer` in route handlers.
export const supabase: SupabaseClient = supabaseServer;
