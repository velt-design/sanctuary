type PublicSupabaseEnv = { url: string; anonKey: string };

function safeEnv(name: 'NEXT_PUBLIC_SUPABASE_URL' | 'NEXT_PUBLIC_SUPABASE_ANON_KEY'): string {
  const value = process.env[name];
  return typeof value === 'string' ? value.trim() : '';
}

export default function SupabaseEnvHydrator() {
  const url = safeEnv('NEXT_PUBLIC_SUPABASE_URL');
  const anonKey = safeEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');

  // Avoid emitting an invalid script when env is not configured on the server.
  if (!url || !anonKey) return null;

  const payload: PublicSupabaseEnv = { url, anonKey };
  return <span hidden data-sp-supabase-env={JSON.stringify(payload)} />;
}

