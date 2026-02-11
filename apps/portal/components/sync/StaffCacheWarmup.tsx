'use client';

import { useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { contactsListQueryOptions } from '@/lib/queries/contacts';
import { projectsListQueryOptions } from '@/lib/queries/projects';
import { supabaseHostFromUrl, supabaseRuntimeUrl } from '@/lib/supabase/browserClient';

function safeHost(): string {
  return supabaseHostFromUrl(supabaseRuntimeUrl()) || 'unknown';
}

export default function StaffCacheWarmup() {
  const queryClient = useQueryClient();
  const host = useMemo(() => safeHost(), []);

  useEffect(() => {
    const key = `sp_staff_warmup_v1:${host}`;
    if (typeof window === 'undefined') return;
    if (window.sessionStorage.getItem(key) === '1') return;
    window.sessionStorage.setItem(key, '1');

    const run = async () => {
      await Promise.allSettled([
        queryClient.prefetchQuery(contactsListQueryOptions(host)),
        queryClient.prefetchQuery(projectsListQueryOptions(host)),
      ]);
    };

    const ric = (window as any).requestIdleCallback as ((cb: () => void, opts?: { timeout: number }) => number) | undefined;
    if (typeof ric === 'function') {
      ric(() => void run(), { timeout: 2000 });
      return;
    }
    const t = window.setTimeout(() => void run(), 150);
    return () => window.clearTimeout(t);
  }, [host, queryClient]);

  return null;
}
