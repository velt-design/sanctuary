'use client';

import { useEffect, useState } from 'react';
import { supabaseHostFromUrl, supabaseRestUrl, supabaseRuntimeUrl } from '@/lib/supabase/browserClient';
import styles from './SupabaseEnvStatus.module.css';

export default function SupabaseEnvStatus() {
  if (process.env.NODE_ENV === 'production') return null;

  const [details, setDetails] = useState<any>(null);

  // Compute on the client only to avoid SSR/client mismatches (hydration errors).
  useEffect(() => {
    const compileTimeUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').trim();
    let hydrated: any = (globalThis as any)?.__SP_SUPABASE__ ?? null;
    const encoded = document.querySelector<HTMLElement>('[data-sp-supabase-env]')?.dataset.spSupabaseEnv;
    if (!hydrated && encoded) {
      try {
        hydrated = JSON.parse(encoded);
      } catch {
        hydrated = null;
      }
    }
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
    <details className={styles.details}>
      <summary>Supabase Env Status (dev only)</summary>
      <pre
        suppressHydrationWarning
        className={styles.output}
      >
        {details ? JSON.stringify(details, null, 2) : 'Loading…'}
      </pre>
    </details>
  );
}
