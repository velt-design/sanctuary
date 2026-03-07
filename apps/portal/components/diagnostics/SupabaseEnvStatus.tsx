'use client';

import { useEffect, useState } from 'react';
import { supabaseHostFromUrl, supabaseRestUrl, supabaseRuntimeUrl } from '@/lib/supabase/browserClient';

export default function SupabaseEnvStatus() {
  if (process.env.NODE_ENV === 'production') return null;

  const [details, setDetails] = useState<any>(null);

  // Compute on the client only to avoid SSR/client mismatches (hydration errors).
  useEffect(() => {
    const compileTimeUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').trim();
    const hydrated: any = (globalThis as any)?.__SP_SUPABASE__ ?? null;
    const hydratedUrl = typeof hydrated?.url === 'string' ? hydrated.url.trim() : '';
    const effectiveUrl = supabaseRuntimeUrl();

    setDetails({
      compileTime: {
        NEXT_PUBLIC_SUPABASE_URL: compileTimeUrl || null,
        host: supabaseHostFromUrl(compileTimeUrl) || null,
      },
      hydrated: {
        present: Boolean(hydratedUrl),
        url: hydratedUrl || null,
        host: supabaseHostFromUrl(hydratedUrl) || null,
      },
      effective: {
        url: effectiveUrl || null,
        host: supabaseHostFromUrl(effectiveUrl) || null,
        contactsRestUrl: supabaseRestUrl('contacts') || null,
      },
    });
  }, []);

  return (
    <details style={{ marginTop: 16, padding: 12, border: '1px solid rgba(var(--portal-bg-surface-rgb), 0.15)', borderRadius: 10 }}>
      <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Supabase Env Status (dev only)</summary>
      <pre
        suppressHydrationWarning
        style={{ marginTop: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 12, lineHeight: 1.4 }}
      >
        {details ? JSON.stringify(details, null, 2) : 'Loading…'}
      </pre>
    </details>
  );
}
