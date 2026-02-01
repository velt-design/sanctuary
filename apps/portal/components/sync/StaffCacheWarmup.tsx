'use client';

import { useEffect, useMemo } from 'react';
import { useSWRConfig } from 'swr';
import { contactsSWRKey } from '@/lib/cache/contactsCache';
import { projectsSWRKey } from '@/lib/cache/projectsCache';
import { listContacts } from '@/lib/repo/contactsRepo';
import { listProjects } from '@/lib/repo/projectsRepo';
import { supabaseHostFromUrl, supabaseRuntimeUrl } from '@/lib/supabase/browserClient';

function safeHost(): string {
  return supabaseHostFromUrl(supabaseRuntimeUrl()) || 'unknown';
}

export default function StaffCacheWarmup() {
  const { mutate } = useSWRConfig();
  const host = useMemo(() => safeHost(), []);

  useEffect(() => {
    const key = `sp_staff_warmup_v1:${host}`;
    if (typeof window === 'undefined') return;
    if (window.sessionStorage.getItem(key) === '1') return;
    window.sessionStorage.setItem(key, '1');

    const run = async () => {
      const [contactsRes, projectsRes] = await Promise.allSettled([listContacts(), listProjects()]);
      if (contactsRes.status === 'fulfilled') {
        await mutate(contactsSWRKey(), contactsRes.value, { revalidate: false });
      }
      if (projectsRes.status === 'fulfilled') {
        await mutate(projectsSWRKey(), projectsRes.value, { revalidate: false });
      }
    };

    const ric = (window as any).requestIdleCallback as ((cb: () => void, opts?: { timeout: number }) => number) | undefined;
    if (typeof ric === 'function') {
      ric(() => void run(), { timeout: 2000 });
      return;
    }
    const t = window.setTimeout(() => void run(), 150);
    return () => window.clearTimeout(t);
  }, [host, mutate]);

  return null;
}

